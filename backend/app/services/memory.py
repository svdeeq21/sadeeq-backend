# svdeeq-backend/app/services/memory.py
#
# Hybrid memory model:
#   - Full history: all messages passed directly for accuracy
#   - Persistent summary: updated every 5 messages as a compressed fallback
#
# We no longer limit to a small recent window. The full conversation is
# passed to the LLM so it never re-asks questions or re-introduces itself.

from uuid import UUID
from app.core.supabase import get_supabase
from app.core.config import get_settings
from app.models.schemas import ConversationContext
from app.utils.logger import log

settings = get_settings()


async def get_context(
    lead_id: UUID,
    lead_name: str,
    all_messages: list[dict] | None = None,
) -> ConversationContext:
    """
    Builds conversation context for a lead.

    If all_messages is provided (fetched upstream in the pipeline),
    we use the full history directly — no truncation.

    Falls back to the RPC-based window if all_messages is not provided.
    """
    db = get_supabase()

    # ── Get summary from sessions ─────────────────────────────────
    summary = None
    message_count = 0
    try:
        session_result = (
            db.table("sessions")
            .select("conversation_summary, message_count")
            .eq("lead_id", str(lead_id))
            .execute()
        )
        if session_result.data:
            summary = session_result.data[0].get("conversation_summary")
            message_count = session_result.data[0].get("message_count", 0)
    except Exception:
        pass

    # ── Build recent messages list ────────────────────────────────
    if all_messages:
        # Use full history — convert to the format the LLM expects
        recent = [
            {
                "role":    "assistant" if m.get("sender") == "AI" else "user",
                "content": m.get("content", ""),
            }
            for m in all_messages
            if m.get("sender") in ("AI", "USER") and m.get("content")
        ]
    else:
        # Fallback: fetch via RPC with window limit
        try:
            result = db.rpc("get_conversation_context", {
                "p_lead_id":      str(lead_id),
                "p_recent_limit": 50,  # increased from 6 to 50 as fallback
            }).execute()
            data = result.data or {}
            recent = data.get("recent", [])
            if not summary:
                summary = data.get("summary")
            if not message_count:
                message_count = data.get("message_count", 0)
        except Exception:
            recent = []

    return ConversationContext(
        lead_id=lead_id,
        lead_name=lead_name,
        summary=summary,
        recent=recent,
        message_count=message_count,
    )


async def maybe_update_summary(lead_id: UUID, message_count: int) -> None:
    """
    Called after every AI reply. Generates and saves a compressed summary
    every MEMORY_SUMMARY_INTERVAL messages as a long-term memory fallback.
    """
    if message_count % settings.memory_summary_interval != 0:
        return

    db = get_supabase()

    msgs_result = (
        db.table("messages")
        .select("sender, content, timestamp")
        .eq("lead_id", str(lead_id))
        .in_("sender", ["USER", "AI"])
        .order("timestamp", desc=False)
        .limit(50)
        .execute()
    )

    messages = msgs_result.data or []
    if not messages:
        return

    transcript = "\n".join(
        f"{m['sender']}: {m['content']}" for m in messages
    )

    from app.services.llm import generate_summary
    summary = await generate_summary(transcript)

    db.table("sessions").update({
        "conversation_summary":  summary,
        "summary_message_count": message_count,
    }).eq("lead_id", str(lead_id)).execute()

    await log.info(
        "SUMMARY_UPDATED",
        lead_id=lead_id,
        metadata={"message_count": message_count},
    )