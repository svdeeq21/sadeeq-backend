# svdeeq-backend/app/services/escalation.py
#
# Decides when to escalate a lead to a human agent and stops the AI.
#
# Escalation triggers (PRD §2.2):
#   1. LLM returned a fallback (quota/error)
#   2. No RAG chunks found (confidence below threshold)
#   3. Incoming message contains media (image, audio, document)
#   4. User explicitly asks to speak to a human
#   5. Admin manually pauses AI via dashboard (ai_paused=TRUE in DB)
#
# When escalated:
#   - lead.status → HUMAN_REQUIRED
#   - lead.ai_paused → TRUE  (AI will not reply until admin resumes)
#   - A SYSTEM message is written to the messages table
#   - An audit log entry is created
#   - (Future: push notification to admin)

from uuid import UUID
from app.core.supabase import get_supabase
from app.utils.logger import log

# Keywords that signal the user wants a human
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
]

# Media message types from Evolution API that we can't handle
MEDIA_MESSAGE_TYPES = {
    "imageMessage",
    "audioMessage",
    "videoMessage",
    "documentMessage",
    "stickerMessage",
}


def is_media_message(message_type: str) -> bool:
    """Returns True if Evolution API says this is a non-text message."""
    return message_type in MEDIA_MESSAGE_TYPES


def user_requested_human(message_text: str) -> bool:
    """Returns True if the user's message contains a human-request phrase."""
    lower = message_text.lower()
    return any(phrase in lower for phrase in HUMAN_REQUEST_PHRASES)


async def check_ai_paused(lead_id: UUID) -> bool:
    """
    Checks the ai_paused flag in the leads table.
    Called at step 3 of the pipeline — before any processing begins.
    Returns True if the AI should stay silent for this lead.
    """
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
    Escalates a lead to HUMAN_REQUIRED status.
    Writes a SYSTEM message to the conversation and logs the event.

    reason: short string like "MEDIA_REQUEST", "LLM_QUOTA", "NO_RAG_MATCH",
            "HUMAN_REQUESTED", "REPEATED_LLM_FAILURE"
    """
    db = get_supabase()

    # Update lead status and pause AI
    db.table("leads").update({
        "status":    "HUMAN_REQUIRED",
        "ai_paused": True,
    }).eq("id", str(lead_id)).execute()

    # Write a SYSTEM message to the transcript so admins can see why
    reason_messages = {
        "MEDIA_REQUEST":        "Media/file request received — AI cannot process attachments. Escalated to agent.",
        "LLM_QUOTA":            "AI quota exhausted — fallback response sent. Escalated to agent.",
        "NO_RAG_MATCH":         "Query outside knowledge base — confidence too low. Escalated to agent.",
        "HUMAN_REQUESTED":      "Lead requested a human agent. AI stopped.",
        "REPEATED_LLM_FAILURE": "Repeated LLM errors — escalated to agent.",
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
