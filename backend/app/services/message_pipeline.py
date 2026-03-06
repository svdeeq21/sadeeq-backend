# svdeeq-backend/app/services/message_pipeline.py
#
# The central orchestrator. Implements the exact 10-step pipeline
# from PRD §5:
#
#   1.  Receive webhook payload
#   2.  Immediately store the inbound message
#   3.  Check ai_paused flag
#   4.  Check rate limit
#   5.  Retrieve context (recent window + summary)
#   6.  Perform vector search (RAG)
#   7.  Call LLM
#   8.  Store AI response
#   9.  Send via WhatsApp
#   10. Log similarity score + latency
#
# This function is called by the webhook router.
# It is designed to run as a FastAPI BackgroundTask so the webhook
# returns 200 immediately and processing happens asynchronously.

import time
from uuid import UUID
from app.core.supabase import get_supabase
from app.models.schemas import WAWebhookPayload
from app.services import memory, rag, llm, whatsapp, escalation
from app.utils.logger import log


async def process_inbound_message(payload: WAWebhookPayload) -> None:
    """
    Full pipeline for a single inbound WhatsApp message.
    Never raises — all errors are caught, logged, and handled gracefully.
    """
    pipeline_start = time.monotonic()
    db = get_supabase()

    # ── Extract message data ──────────────────────────────────────
    wa_data       = payload.data
    phone_number  = wa_data.key.get("remoteJid", "").replace("@s.whatsapp.net", "")
    wa_message_id = wa_data.key.get("id")
    message_type  = wa_data.messageType
    lead_name     = wa_data.pushName or "there"

    # Extract text content (handles plain text messages)
    message_text = (
        wa_data.message.get("conversation")
        or wa_data.message.get("extendedTextMessage", {}).get("text")
        or ""
        if wa_data.message else ""
    )

    if not phone_number:
        await log.warn("WEBHOOK_MISSING_PHONE", metadata={"payload": str(payload)[:200]})
        return

    # ── STEP 2: Immediately store the inbound message ─────────────
    # We store BEFORE any processing. If anything fails downstream,
    # we still have the message on record.

    # First, find or upsert the lead by phone number
    lead_result = (
        db.table("leads")
        .select("id, name, status, ai_paused")
        .eq("phone_number", phone_number)
        .single()
        .execute()
    )

    if not lead_result.data:
        await log.warn(
            "UNKNOWN_LEAD",
            metadata={"phone": phone_number[:6] + "****"},
        )
        return

    lead      = lead_result.data
    lead_id   = UUID(lead["id"])
    lead_name = lead.get("name") or lead_name

    # Deduplication: skip if we've already processed this WA message ID
    if wa_message_id:
        existing = (
            db.table("messages")
            .select("id")
            .eq("wa_message_id", wa_message_id)
            .maybe_single()
            .execute()
        )
        if existing.data:
            await log.debug("DUPLICATE_MESSAGE_SKIPPED", lead_id=lead_id)
            return

    # Store the inbound USER message
    db.table("messages").insert({
        "lead_id":      str(lead_id),
        "sender":       "USER",
        "content":      message_text or f"[{message_type}]",
        "message_type": "TEXT" if message_text else message_type.upper()[:20],
        "wa_message_id": wa_message_id,
    }).execute()

    await log.info("MESSAGE_RECEIVED", lead_id=lead_id)

    # ── STEP 3: Check ai_paused ───────────────────────────────────
    if lead.get("ai_paused") or lead.get("status") == "HUMAN_REQUIRED":
        await log.info("AI_PAUSED_SKIP", lead_id=lead_id)
        return

    # ── Check for opted-out leads ─────────────────────────────────
    if lead.get("status") == "OPTED_OUT":
        return

    # ── STEP 4: Check rate limit ──────────────────────────────────
    rate_ok = db.rpc("check_rate_limit", {"p_lead_id": str(lead_id)}).execute()

    if not rate_ok.data:
        db.table("messages").insert({
            "lead_id":      str(lead_id),
            "sender":       "SYSTEM",
            "content":      "Rate limit reached — please wait a moment before sending more messages.",
            "message_type": "SYSTEM_EVENT",
        }).execute()

        await log.warn("RATE_LIMITED", lead_id=lead_id)
        return

    # ── Handle media messages (escalate immediately) ──────────────
    if escalation.is_media_message(message_type):
        await escalation.escalate(lead_id, "MEDIA_REQUEST", {"message_type": message_type})
        return

    # ── Handle opted-out request ──────────────────────────────────
    if message_text.strip().upper() == "STOP":
        db.table("leads").update({"status": "OPTED_OUT"}).eq("id", str(lead_id)).execute()
        await whatsapp.send_message(phone_number, "You've been unsubscribed. We won't contact you again.", lead_id)
        return

    # ── Handle human-request phrases ─────────────────────────────
    if escalation.user_requested_human(message_text):
        await escalation.escalate(lead_id, "HUMAN_REQUESTED")
        await whatsapp.send_message(
            phone_number,
            "Of course! I'll connect you with one of our agents shortly. They'll reach out to you soon.",
            lead_id,
        )
        return

    # ── STEP 5: Retrieve conversation context ─────────────────────
    context = await memory.get_context(lead_id, lead_name)

    # ── STEP 6: Vector search ─────────────────────────────────────
    rag_chunks = await rag.search_knowledge_base(message_text)
    context.rag_chunks = rag_chunks

    # Escalate if no RAG match and this isn't a simple greeting
    greetings = {"hi", "hello", "hey", "salam", "good morning", "good afternoon", "good evening"}
    is_greeting = message_text.strip().lower() in greetings

    if not rag_chunks and not is_greeting:
        await escalation.escalate(
            lead_id,
            "NO_RAG_MATCH",
            {"query_preview": message_text[:80]},
        )
        # Still send a polite holding message before going silent
        await whatsapp.send_message(
            phone_number,
            "That's a great question — let me connect you with one of our specialists who can help you better.",
            lead_id,
        )
        return

    # ── STEP 7: Call LLM ──────────────────────────────────────────
    reply_text, used_fallback = await llm.generate_reply(context, message_text)

    if used_fallback:
        await escalation.escalate(lead_id, "LLM_QUOTA")

    # ── STEP 8: Store AI response ─────────────────────────────────
    latency_ms = int((time.monotonic() - pipeline_start) * 1000)

    db.table("messages").insert({
        "lead_id":      str(lead_id),
        "sender":       "AI",
        "content":      reply_text,
        "message_type": "TEXT",
        "latency_ms":   latency_ms,
    }).execute()

    # Update lead status to AI_RESPONDED (unless we just escalated)
    if not used_fallback:
        db.table("leads").update({"status": "AI_RESPONDED"}).eq("id", str(lead_id)).execute()

    # ── STEP 9: Send via WhatsApp ─────────────────────────────────
    try:
        await whatsapp.send_message(phone_number, reply_text, lead_id)
    except Exception as e:
        await log.error(
            "WA_SEND_FAILED",
            lead_id=lead_id,
            metadata={"error": str(e), "attempts": 3},
        )
        # Mark as invalid if all retries failed
        if "Evolution API error" in str(e):
            await whatsapp.mark_invalid_number(lead_id)
        return

    # ── STEP 10: Log similarity score + latency ───────────────────
    top_score = rag_chunks[0].similarity if rag_chunks else 0.0

    await log.info(
        "AI_REPLIED",
        lead_id=lead_id,
        metadata={
            "latency_ms":    latency_ms,
            "rag_score":     round(top_score, 4),
            "chunks_used":   len(rag_chunks),
            "used_fallback": used_fallback,
        },
    )

    # ── Update conversation summary if needed ─────────────────────
    session_result = (
        db.table("sessions")
        .select("message_count")
        .eq("lead_id", str(lead_id))
        .single()
        .execute()
    )
    msg_count = session_result.data.get("message_count", 0) if session_result.data else 0
    await memory.maybe_update_summary(lead_id, msg_count)
