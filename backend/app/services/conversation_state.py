# svdeeq-backend/app/services/conversation_state.py
"""
Conversation State Machine
──────────────────────────
States:
  COLD         → Lead just replied to outreach. Bot has never engaged.
  DISCOVERY    → Bot is qualifying: asking about business, pain points, goals.
  PITCH        → Enough info gathered. Bot is presenting Sadiq's solution.
  CALL_INVITE  → Bot has made the WhatsApp call ask. Waiting for response.
  BOOKED       → Lead confirmed a call. Bot confirms & notifies Sadiq.
  NURTURE      → Lead showed interest but not ready. Bot stays warm.
  DEAD         → Lead has gone cold after full sequence. No more pushing.

Transitions are driven by:
  - Message count in current state
  - Interest score
  - Keyword signals in latest message
  - Explicit confirmation/rejection patterns
"""
# =========================
# CONVERSATION STATE v2 (ADAPTIVE)
# =========================

import re
import logging
from uuid import UUID
from app.core.supabase import get_supabase
from app.utils.logger import log

_l = logging.getLogger("svdeeq")

# ── States ───────────────────────────────────────────────
COLD        = "COLD"
DISCOVERY   = "DISCOVERY"
PITCH       = "PITCH"
CALL_INVITE = "CALL_INVITE"
BOOKED      = "BOOKED"
NURTURE     = "NURTURE"
DEAD        = "DEAD"

# ── Patterns ─────────────────────────────────────────────

CALL_CONFIRM = [
    r"\byes\b", r"\bsure\b", r"\bokay\b", r"\blet'?s\b",
    r"\bbook\b", r"\bschedule\b", r"\bwhen\b", r"\btime\b"
]

CALL_REJECT = [
    r"\bnot now\b", r"\bmaybe later\b", r"\bbusy\b",
    r"\bno thanks\b", r"\bnot interested\b"
]

OBJECTION = [
    r"\bnot sure\b", r"\bdon'?t think\b", r"\bwon'?t work\b",
    r"\btoo expensive\b", r"\bno budget\b"
]

HIGH_INTENT = [
    r"\bhow much\b", r"\bprice\b", r"\bcost\b",
    r"\binterested\b", r"\bshow me\b", r"\bdemo\b"
]


def _matches(text: str, patterns: list[str]) -> bool:
    t = text.lower()
    return any(re.search(p, t) for p in patterns)


def _recent_user_messages(messages: list[dict], n=3) -> list[str]:
    return [
        (m.get("content") or "").lower()
        for m in messages if m.get("sender") == "USER"
    ][-n:]


def _momentum(messages: list[dict]) -> str:
    """
    Returns: "RISING", "FLAT", "DROPPING"
    """
    recent = _recent_user_messages(messages, 3)

    score = 0
    for msg in recent:
        if _matches(msg, HIGH_INTENT):
            score += 1
        elif _matches(msg, OBJECTION):
            score -= 1

    if score >= 2:
        return "RISING"
    if score <= -1:
        return "DROPPING"
    return "FLAT"


# ── Core Logic ───────────────────────────────────────────

def determine_next_state(
    current_state: str,
    lead: dict,
    messages: list[dict],
    latest_message: str,
    interest_score: float,
    intent: str = "NEUTRAL",
    lead_profile: dict | None = None,
) -> str:

    text = latest_message.lower()
    momentum = _momentum(messages)

    # ── Terminal ─────────────────────────
    if current_state in (BOOKED, DEAD):
        return current_state

    # ── HARD INTERRUPTS ──────────────────

    # Objection overrides flow — DO NOT advance
    if intent == "OBJECTION" or _matches(text, OBJECTION):
        return current_state  # HOLD and handle objection in response layer

    # Strong negative → nurture
    if intent == "NEGATIVE":
        return NURTURE

    # ── CALL STAGE ──────────────────────

    if current_state == CALL_INVITE:
        if _matches(text, CALL_CONFIRM):
            return BOOKED

        if _matches(text, CALL_REJECT):
            return NURTURE

        # If momentum drops, don't keep pushing
        if momentum == "DROPPING":
            return NURTURE

        return CALL_INVITE  # HOLD

    # ── NURTURE ─────────────────────────

    if current_state == NURTURE:
        if interest_score >= 0.55 or _matches(text, HIGH_INTENT):
            return PITCH  # reactivation
        return NURTURE

    # ── COLD ────────────────────────────

    if current_state == COLD:
        return DISCOVERY

    # ── DISCOVERY ───────────────────────

    if current_state == DISCOVERY:

        has_context = bool(lead_profile and lead_profile.get("problem_identified"))

        # Fast track if strong intent
        if interest_score >= 0.6 or _matches(text, HIGH_INTENT):
            return PITCH

        # If momentum rising and we have context → move
        if momentum == "RISING" and has_context:
            return PITCH

        # If conversation is flat → HOLD (this is new and important)
        if momentum == "FLAT":
            return DISCOVERY

        # Force move only if dragging too long
        if len(messages) > 8:
            return PITCH

        return DISCOVERY

    # ── PITCH ───────────────────────────

    if current_state == PITCH:

        # If objection appears → HOLD
        if _matches(text, OBJECTION):
            return PITCH

        # If strong buying signal → go for call
        if interest_score >= 0.7 or momentum == "RISING":
            return CALL_INVITE

        # If momentum drops → don't push call yet
        if momentum == "DROPPING":
            return PITCH

        return PITCH

    return current_state


# ── DB Helpers (unchanged) ───────────────────────────────

async def get_lead_state(lead_id: UUID) -> str:
    db = get_supabase()
    try:
        result = (
            db.table("leads")
            .select("conversation_state")
            .eq("id", str(lead_id))
            .single()
            .execute()
        )
        return result.data.get("conversation_state") or COLD
    except Exception:
        return COLD


async def save_lead_state(lead_id: UUID, state: str) -> None:
    db = get_supabase()
    try:
        db.table("leads").update({"conversation_state": state}).eq("id", str(lead_id)).execute()
    except Exception as e:
        _l.warning(f"[STATE] Failed to save state {state} for {lead_id}: {e}")


async def advance_state(
    lead_id: UUID,
    lead: dict,
    messages: list[dict],
    latest_message: str,
    interest_score: float,
    intent: str = "NEUTRAL",
    lead_profile: dict | None = None,
) -> tuple[str, str]:

    current = lead.get("conversation_state") or COLD

    next_state = determine_next_state(
        current_state=current,
        lead=lead,
        messages=messages,
        latest_message=latest_message,
        interest_score=interest_score,
        intent=intent,
        lead_profile=lead_profile or {},
    )

    if next_state != current:
        await save_lead_state(lead_id, next_state)
        await log.info("STATE_TRANSITION", lead_id=lead_id, metadata={
            "from": current,
            "to": next_state,
            "interest_score": interest_score,
        })

    return current, next_state