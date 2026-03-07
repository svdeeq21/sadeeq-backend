# svdeeq-backend/app/services/message_pipeline.py

import time
from uuid import UUID
from app.core.supabase import get_supabase
from app.models.schemas import WAWebhookPayload
from app.services import memory, rag, llm, whatsapp, escalation
from app.utils.logger import log


async def process_inbound_message(payload: WAWebhookPayload) -> None:
    import logging
    logging.getLogger("uvicorn").info(f"[PIPELINE_START] raw payload received")
    pipeline_start = time.monotonic()
    db = get_supabase()

    # ── Extract message data ──────────────────────────────────────
    wa_data       = payload.data
    phone_number  = wa_data.key.get("remoteJid", "").replace("@s.whatsapp.net", "").lstrip("+")
    wa_message_id = wa_data.key.get("id")
    message_type  = wa_data.messageType
    lead_name     = wa_data.pushName or "there"

    message_text = (
        wa_data.message.get("conversation")
        or wa_data.message.get("extendedTextMessage", {}).get("text")
        or ""
        if wa_data.message else ""
    )

    if not phone_number:
        await log.warn("WEBHOOK_MISSING_PHONE", metadata={"payload": str(payload)[:200]})
        return

    # Skip group messages
    if "@g.us" in wa_data.key.get("remoteJid", ""):
        return

    # ── Find lead by phone number ─────────────────────────────────
    lead_result = (
        db.table("leads")
        .select("id, name, status, ai_paused")
        .eq("phone_number", phone_number)
        .execute()
    )

    if not lead_result.data:
        await log.warn(
            "UNKNOWN_LEAD",
            metadata={"phone": phone_number[:6] + "****"},
        )
        return

    # FIX: data is a list, grab the first item
    lead      = lead_result.data[0]
    lead_id   = UUID(lead["id"])
    lead_name = lead.get("name") or lead_name

    # ── Deduplication ─────────────────────────────────────────────
    if wa_message_id:
        try:
            existing = (
                db.table("messages")
                .select("id")
                .eq("wa_message_id", wa_message_id)
                .execute()
            )
            if existing.data:
                await log.debug("DUPLICATE_MESSAGE_SKIPPED", lead_id=lead_id)
                return
        except Exception:
            pass

    # ── Store inbound message ─────────────────────────────────────
    db.table("messages").insert({
        "lead_id":       str(lead_id),
        "sender":        "USER",
        "content":       message_text or f"[{message_type}]",
        "message_type":  "TEXT" if message_text else message_type.upper()[:20],
        "wa_message_id": wa_message_id,
    }).execute()

    await log.info("MESSAGE_RECEIVED", lead_id=lead_id)

    # ── Check ai_paused ───────────────────────────────────────────
    if lead.get("ai_paused") or lead.get("status") in ("HUMAN_REQUIRED", "OPTED_OUT"):
        await log.info("AI_PAUSED_SKIP", lead_id=lead_id)
        return

    # ── Rate limit ────────────────────────────────────────────────
    try:
        rate_ok = db.rpc("check_rate_limit", {"p_lead_id": str(lead_id)}).execute()
        if not rate_ok.data:
            await log.warn("RATE_LIMITED", lead_id=lead_id)
            return
    except Exception as e:
        await log.warn("RATE_LIMIT_CHECK_FAILED", lead_id=lead_id, metadata={"error": str(e)})

    # ── Handle media messages ─────────────────────────────────────
    if escalation.is_media_message(message_type):
        await escalation.escalate(lead_id, "MEDIA_REQUEST", {"message_type": message_type})
        return

    # ── Handle STOP ───────────────────────────────────────────────
    if message_text.strip().upper() == "STOP":
        db.table("leads").update({"status": "OPTED_OUT"}).eq("id", str(lead_id)).execute()
        await whatsapp.send_message(phone_number, "You've been unsubscribed. We won't contact you again.", lead_id)
        return

    # ── Handle human request ──────────────────────────────────────
    if escalation.user_requested_human(message_text):
        await escalation.escalate(lead_id, "HUMAN_REQUESTED")
        await whatsapp.send_message(
            phone_number,
            "Of course! I'll connect you with Sadiq shortly.",
            lead_id,
        )
        return

    # ── Retrieve context ──────────────────────────────────────────
    try:
        context = await memory.get_context(lead_id, lead_name)
    except Exception as e:
        await log.error("CONTEXT_FETCH_FAILED", lead_id=lead_id, metadata={"error": str(e)})
        return

    # ── RAG search ────────────────────────────────────────────────
    try:
        rag_chunks = await rag.search_knowledge_base(message_text)
        context.rag_chunks = rag_chunks
    except Exception as e:
        await log.warn("RAG_FAILED", lead_id=lead_id, metadata={"error": str(e)})
        rag_chunks = []
        context.rag_chunks = []

    greetings = {"hi", "hello", "hey", "salam", "good morning", "good afternoon", "good evening"}
    is_greeting = message_text.strip().lower() in greetings

    if not rag_chunks and not is_greeting:
        await escalation.escalate(
            lead_id,
            "NO_RAG_MATCH",
            {"query_preview": message_text[:80]},
        )
        await whatsapp.send_message(
            phone_number,
            "That's a great question — let me get Sadiq to follow up with you on that.",
            lead_id,
        )
        return

    # ── Call LLM ──────────────────────────────────────────────────
    try:
        reply_text, provider_used = await llm.generate_reply(context, message_text)
    except Exception as e:
        await log.error("LLM_FAILED", lead_id=lead_id, metadata={"error": str(e)})
        return

    if provider_used == "rule_based":
        await escalation.escalate(lead_id, "LLM_ALL_PROVIDERS_FAILED")

    # ── Store AI response ─────────────────────────────────────────
    latency_ms = int((time.monotonic() - pipeline_start) * 1000)

    db.table("messages").insert({
        "lead_id":      str(lead_id),
        "sender":       "AI",
        "content":      reply_text,
        "message_type": "TEXT",
        "latency_ms":   latency_ms,
    }).execute()

    if provider_used != "rule_based":
        db.table("leads").update({"status": "AI_RESPONDED"}).eq("id", str(lead_id)).execute()

    # ── Send via WhatsApp ─────────────────────────────────────────
    try:
        await whatsapp.send_message(phone_number, reply_text, lead_id)
    except Exception as e:
        await log.error(
            "WA_SEND_FAILED",
            lead_id=lead_id,
            metadata={"error": str(e)},
        )
        return

    # ── Log result ────────────────────────────────────────────────
    top_score = rag_chunks[0].similarity if rag_chunks else 0.0

    await log.info(
        "AI_REPLIED",
        lead_id=lead_id,
        metadata={
            "latency_ms":    latency_ms,
            "rag_score":     round(top_score, 4),
            "chunks_used":   len(rag_chunks),
            "provider_used": provider_used,
        },
    )

    # ── Update summary if needed ──────────────────────────────────
    try:
        session_result = (
            db.table("sessions")
            .select("message_count")
            .eq("lead_id", str(lead_id))
            .execute()
        )
        if session_result.data:
            msg_count = session_result.data[0].get("message_count", 0)
            await memory.maybe_update_summary(lead_id, msg_count)
    except Exception as e:
        await log.warn("SUMMARY_UPDATE_FAILED", lead_id=lead_id, metadata={"error": str(e)})