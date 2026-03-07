# svdeeq-backend/app/services/escalation.py

from uuid import UUID
from app.core.supabase import get_supabase
from app.utils.logger import log

HUMAN_REQUEST_PHRASES = [
    "speak to a human",
    "talk to a person",
    "real person",
    "human agent",
    "speak to someone",
    "call me",
    "phone me",
    "transfer me",
    "escalate",
    "speak to sadiq",
    "talk to sadiq",
]

MEDIA_MESSAGE_TYPES = {
    "imageMessage",
    "audioMessage",
    "videoMessage",
    "documentMessage",
    "stickerMessage",
}

MEDIA_REPLIES = {
    "imageMessage":    "Thanks for sharing that image! I'm not able to view images directly — could you describe what you're looking for in text? I'd love to help.",
    "audioMessage":    "I appreciate the voice note! I'm not able to play audio — could you type out your message? I'm all ears.",
    "videoMessage":    "Thanks for the video! I can't play videos directly — feel free to describe what you need and I'll do my best to help.",
    "documentMessage": "Thanks for sending that document! I'm not able to open files — if you can summarise what you need, I'll take it from there.",
    "stickerMessage":  None,  # ignore stickers silently
}


def is_media_message(message_type: str) -> bool:
    return message_type in MEDIA_MESSAGE_TYPES


def user_requested_human(message_text: str) -> bool:
    lower = message_text.lower()
    return any(phrase in lower for phrase in HUMAN_REQUEST_PHRASES)


def get_media_reply(message_type: str) -> str | None:
    """Returns a polite text reply for media messages, or None to ignore."""
    return MEDIA_REPLIES.get(message_type)


async def check_ai_paused(lead_id: UUID) -> bool:
    db = get_supabase()
    result = (
        db.table("leads")
        .select("ai_paused")
        .eq("id", str(lead_id))
        .single()
        .execute()
    )
    return result.data.get("ai_paused", False)


async def escalate(
    lead_id: UUID,
    reason:  str,
    metadata: dict | None = None,
) -> None:
    """
    Only escalates for real reasons — NOT for media or missing RAG.
    Those are handled gracefully in the pipeline now.
    """
    db = get_supabase()

    db.table("leads").update({
        "status":    "HUMAN_REQUIRED",
        "ai_paused": True,
    }).eq("id", str(lead_id)).execute()

    reason_messages = {
        "LLM_ALL_PROVIDERS_FAILED": "All AI providers failed — fallback used. Review needed.",
        "HUMAN_REQUESTED":          "Lead requested to speak with Sadiq directly. AI stopped.",
        "REPEATED_LLM_FAILURE":     "Repeated LLM errors — escalated to agent.",
    }
    system_message = reason_messages.get(reason, f"Escalated: {reason}")

    db.table("messages").insert({
        "lead_id":      str(lead_id),
        "sender":       "SYSTEM",
        "content":      system_message,
        "message_type": "SYSTEM_EVENT",
    }).execute()

    await log.warn(
        "ESCALATED",
        lead_id=lead_id,
        metadata={"reason": reason, **(metadata or {})},
    )