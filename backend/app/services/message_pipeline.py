# svdeeq-backend/app/services/message_pipeline.py
from datetime import datetime, timezone
import asyncio
import time
import logging
import traceback
from uuid import UUID
from app.core.config import get_settings
from app.core.supabase import get_supabase
from app.models.schemas import WAWebhookPayload
from app.services import memory, rag, llm, whatsapp, escalation, scoring, conversation_state as state_machine
from app.services import intent_engine
from app.utils.logger import log

_l = logging.getLogger("svdeeq")
settings = get_settings()

# ── Per-lead lock (prevents duplicate replies on rapid back-to-back messages) ──
_lead_locks: dict[str, asyncio.Lock] = {}

def _get_lead_lock(lead_id: str) -> asyncio.Lock:
    if lead_id not in _lead_locks:
        _lead_locks[lead_id] = asyncio.Lock()
    return _lead_locks[lead_id]


async def process_inbound_message(payload: WAWebhookPayload) -> None:
    """Wrapper that catches all exceptions so Render logs show the crash."""
    _l.info("[PIPELINE_START] background task started")
    try:
        await _process(payload)
    except Exception as e:
        _l.error(f"[PIPELINE_CRASH] {e}\n{traceback.format_exc()}")


async def _process(payload: WAWebhookPayload) -> None:
    pipeline_start = time.monotonic()
    db = get_supabase()

    # ── Extract message data ──────────────────────────────────────
    wa_data       = payload.data
    remote_jid    = wa_data.key.get("remoteJid", "")
    phone_number  = remote_jid.replace("@s.whatsapp.net", "").lstrip("+")
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
    if "@g.us" in remote_jid:
        return

    # ── Per-lead lock — drop duplicate rapid messages ─────────────
    lead_lock = _get_lead_lock(phone_number)
    if lead_lock.locked():
        _l.info(f"[PIPELINE_SKIP_DUPLICATE] phone={phone_number[:6]}****")
        return
    async with lead_lock:
        await _process_inner(
            db, pipeline_start, phone_number, wa_message_id,
            message_type, lead_name, message_text, remote_jid
        )


async def _process_inner(
    db, pipeline_start, phone_number, wa_message_id,
    message_type, lead_name, message_text, remote_jid
):
    # ── Check if this is an admin RESUME command ──────────────────
    admin_number = (settings.admin_whatsapp_number or "").lstrip("+")
    if phone_number == admin_number and message_text.strip().upper().startswith("RESUME"):
        await _handle_resume_command(message_text.strip(), phone_number)
        return

    # ── Find lead by phone number ─────────────────────────────────
    lead_result = (
        db.table("leads")
        .select("id, name, status, ai_paused, outreach_variant, conversation_state, interest_score, follow_up_count, last_outreach_at")
        .eq("phone_number", phone_number)
        .execute()
    )

    if not lead_result.data:
        await log.warn("UNKNOWN_LEAD", metadata={"phone": phone_number[:6] + "****"})
        return

    lead      = lead_result.data[0]
    lead_id   = UUID(lead["id"])
    lead_name = lead.get("name") or lead_name

    # ── Track reply for A/B testing ───────────────────────────────
    outreach_variant = lead.get("outreach_variant")
    if outreach_variant and lead.get("status") == "OUTREACH_SENT":
        try:
            db.rpc("increment_variant_replies", {"p_variant_id": outreach_variant}).execute()
        except Exception:
            pass

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
        "message_type":  "TEXT" if message_text else "TEXT",
        "wa_message_id": wa_message_id,
        "timestamp":     datetime.now(timezone.utc).isoformat(),
    }).execute()

    await log.info("MESSAGE_RECEIVED", lead_id=lead_id)

    # ── Update lead interest score ────────────────────────────────
    try:
        await scoring.update_lead_score(lead_id)
    except Exception as e:
        await log.warn("SCORING_FAILED", lead_id=lead_id, metadata={"error": str(e)})

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

    # ── Handle media messages gracefully ──────────────────────────
    if escalation.is_media_message(message_type):
        reply = escalation.get_media_reply(message_type)
        if reply:
            await whatsapp.send_message(phone_number, reply, lead_id)

        if settings.admin_whatsapp_number:
            admin_alert = (
                f"📎 *Media received from lead*\n\n"
                f"Phone: +{phone_number}\n"
                f"Type: {message_type}\n"
                f"Name: {lead_name}\n\n"
                f"To resume AI for this lead reply:\n"
                f"RESUME {phone_number}"
            )
            try:
                from uuid import UUID as _UUID
                await whatsapp.send_message(settings.admin_whatsapp_number, admin_alert, _UUID(int=0))
            except Exception as e:
                await log.warn("ADMIN_NOTIFY_FAILED", metadata={"error": str(e)})

        await log.info("MEDIA_HANDLED", lead_id=lead_id, metadata={"type": message_type})
        return

    # ── Intent detection ─────────────────────────────────────────
    intent = intent_engine.detect_intent(message_text)

    # Hard exit — STOP / remove me / tired of answering
    if intent_engine.is_hard_exit(intent):
        db.table("leads").update({"status": "OPTED_OUT", "ai_paused": True}).eq("id", str(lead_id)).execute()
        await whatsapp.send_message(phone_number, "Understood, I'll remove you from our list. Take care!", lead_id)
        await log.info("LEAD_OPTED_OUT", lead_id=lead_id, metadata={"reason": "hard_exit_intent"})
        return

    # Also catch raw "STOP" keyword
    if message_text.strip().upper() == "STOP":
        db.table("leads").update({"status": "OPTED_OUT", "ai_paused": True}).eq("id", str(lead_id)).execute()
        await whatsapp.send_message(phone_number, "You've been unsubscribed. We won't contact you again.", lead_id)
        return

    # Canned responses — identity/source questions answered directly without LLM
    canned = intent_engine.get_canned_response(intent)
    if canned:
        db.table("messages").insert({
            "lead_id": str(lead_id), "sender": "AI", "content": canned,
            "message_type": "TEXT", "latency_ms": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }).execute()
        await whatsapp.send_message(phone_number, canned, lead_id)
        await log.info("CANNED_RESPONSE_SENT", lead_id=lead_id, metadata={"intent": intent})
        return

    # ── Handle human request ──────────────────────────────────────
    if escalation.user_requested_human(message_text):
        await escalation.escalate(lead_id, "HUMAN_REQUESTED")

        if settings.admin_whatsapp_number:
            admin_alert = (
                f"🙋 *Lead requested human*\n\n"
                f"Phone: +{phone_number}\n"
                f"Name: {lead_name}\n"
                f"Message: {message_text[:100]}\n\n"
                f"To resume AI after handling reply:\n"
                f"RESUME {phone_number}"
            )
            try:
                from uuid import UUID as _UUID
                await whatsapp.send_message(settings.admin_whatsapp_number, admin_alert, _UUID(int=0))
            except Exception as e:
                await log.warn("ADMIN_NOTIFY_FAILED", metadata={"error": str(e)})

        await whatsapp.send_message(phone_number, "Of course! I'll connect you with Sadiq shortly.", lead_id)
        return

    # ── Fetch messages for state machine ─────────────────────────
    try:
        msgs_result = (
            db.table("messages")
            .select("sender, content, timestamp")
            .eq("lead_id", str(lead_id))
            .order("timestamp", desc=False)
            .execute()
        )
        all_messages = msgs_result.data or []
    except Exception:
        all_messages = []

    # ── Extract lead profile (prevents question loops) ───────────
    lead_profile = intent_engine.extract_lead_profile(all_messages)

    # Apply name correction if user provided it
    if lead_profile.get("name_confirmed"):
        lead_name = lead_profile["name_confirmed"]
        db.table("leads").update({"name": lead_name}).eq("id", str(lead_id)).execute()

    # ── Advance conversation state ────────────────────────────────
    try:
        old_state, current_state = await state_machine.advance_state(
            lead_id=lead_id,
            lead=lead,
            messages=all_messages,
            latest_message=message_text,
            interest_score=lead.get("interest_score") or 0.0,
            intent=intent,
            lead_profile=lead_profile,
        )
    except Exception as e:
        await log.warn("STATE_ADVANCE_FAILED", lead_id=lead_id, metadata={"error": str(e)})
        current_state = lead.get("conversation_state") or "COLD"
        old_state = current_state

    # ── If just BOOKED — notify Sadiq ────────────────────────────
    if current_state == "BOOKED" and old_state != "BOOKED":
        if settings.admin_whatsapp_number:
            try:
                from uuid import UUID as _UUID
                await whatsapp.send_message(
                    settings.admin_whatsapp_number,
                    f"\U0001f389 *Lead booked a call!*\n\nName: {lead_name}\nPhone: +{phone_number}\n\nThey confirmed interest in a WhatsApp call with you. Follow up now!",
                    _UUID(int=0),
                )
            except Exception:
                pass

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

    # ── Call LLM ──────────────────────────────────────────────────
    try:
        reply_text, provider_used = await llm.generate_reply(context, message_text, conversation_state=current_state, lead_profile=lead_profile)
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
        "timestamp":    datetime.now(timezone.utc).isoformat(),
    }).execute()

    if provider_used != "rule_based":
        db.table("leads").update({"status": "AI_RESPONDED"}).eq("id", str(lead_id)).execute()

    # ── Safety guardrails before sending ────────────────────────
    # Block hallucinated call agreements
    if "agreed to" in reply_text.lower() and not intent_engine.is_call_confirmed(intent, message_text):
        reply_text = reply_text  # will regenerate below if needed
        # Check if response falsely claims booking
        if any(p in reply_text.lower() for p in ["you've agreed", "you agreed", "you confirmed", "you've confirmed"]):
            await log.warn("GUARDRAIL_BLOCKED_FAKE_AGREEMENT", lead_id=lead_id)
            reply_text = "Of course! Feel free to ask anything else — I'm happy to help."

    # Block if lead is opted out (double-check)
    fresh_lead = db.table("leads").select("status, ai_paused").eq("id", str(lead_id)).execute()
    if fresh_lead.data:
        fl = fresh_lead.data[0]
        if fl.get("ai_paused") or fl.get("status") == "OPTED_OUT":
            await log.info("GUARDRAIL_BLOCKED_OPTED_OUT", lead_id=lead_id)
            return

    # ── Send via WhatsApp ─────────────────────────────────────────
    try:
        await whatsapp.send_message(phone_number, reply_text, lead_id)
    except Exception as e:
        await log.error("WA_SEND_FAILED", lead_id=lead_id, metadata={"error": str(e)})
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


async def _handle_resume_command(message_text: str, admin_phone: str) -> None:
    db = get_supabase()

    parts = message_text.split()
    if len(parts) < 2:
        try:
            from uuid import UUID as _UUID
            await whatsapp.send_message(
                admin_phone,
                "Usage: RESUME <phoneNumber>\nExample: RESUME 2348113513598",
                _UUID(int=0),
            )
        except Exception:
            pass
        return

    target_phone = parts[1].lstrip("+")

    result = (
        db.table("leads")
        .select("id, name")
        .eq("phone_number", target_phone)
        .execute()
    )

    if not result.data:
        try:
            from uuid import UUID as _UUID
            await whatsapp.send_message(
                admin_phone,
                f"❌ No lead found with phone number {target_phone}",
                _UUID(int=0),
            )
        except Exception:
            pass
        return

    lead = result.data[0]
    lead_id = lead["id"]
    lead_name = lead.get("name", "Unknown")

    db.table("leads").update({
        "ai_paused": False,
        "status":    "PENDING",
    }).eq("id", lead_id).execute()

    await log.info("LEAD_RESUMED", metadata={"lead_id": lead_id, "phone": target_phone})

    try:
        from uuid import UUID as _UUID
        await whatsapp.send_message(
            admin_phone,
            f"✅ AI resumed for {lead_name} (+{target_phone})",
            _UUID(int=0),
        )
    except Exception:
        pass
