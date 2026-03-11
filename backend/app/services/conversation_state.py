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

import re
import logging
from uuid import UUID
from app.core.supabase import get_supabase
from app.utils.logger import log

_l = logging.getLogger("svdeeq")

# ── State constants ───────────────────────────────────────────────
COLD        = "COLD"
DISCOVERY   = "DISCOVERY"
PITCH       = "PITCH"
CALL_INVITE = "CALL_INVITE"
BOOKED      = "BOOKED"
NURTURE     = "NURTURE"
DEAD        = "DEAD"

ALL_STATES = [COLD, DISCOVERY, PITCH, CALL_INVITE, BOOKED, NURTURE, DEAD]

# ── Signal patterns ───────────────────────────────────────────────
CALL_CONFIRM = [
    r"\byes\b", r"\bsure\b", r"\bokay\b", r"\bok\b", r"\blet'?s\b",
    r"\bsounds good\b", r"\bi'?m in\b", r"\bgo ahead\b", r"\bproceed\b",
    r"\bcount me in\b", r"\bbook\b", r"\bschedule\b", r"\bconfirm\b",
    r"\bwhen.*call\b", r"\bwhat.*time\b",
]

CALL_REJECT = [
    r"\bnot (now|ready|interested)\b", r"\bmaybe later\b", r"\bbusy\b",
    r"\bno thanks\b", r"\bno,?\s*thank", r"\bnot for me\b",
    r"\bdon'?t (need|want)\b", r"\bpass\b",
]

DISCOVERY_SIGNALS = [
    r"\bwe\b", r"\bour\b", r"\bmy business\b", r"\bwe (do|sell|offer|provide|have)\b",
    r"\bi (run|own|manage|work)\b", r"\bcompany\b", r"\bstartup\b",
    r"\bproblem\b", r"\bchallenge\b", r"\bstruggl\b", r"\bissue\b",
    r"\bmanual\b", r"\brepetitive\b", r"\btime.consum\b",
]

HIGH_INTEREST = [
    r"\bhow much\b", r"\bprice\b", r"\bcost\b", r"\bbudget\b",
    r"\binterested\b", r"\btell me more\b", r"\bsend.*more\b",
    r"\bwhat.*include\b", r"\bhow.*work\b", r"\bwhen.*start\b",
    r"\bexamples?\b", r"\bportfolio\b", r"\bprevious.*work\b",
]


def _matches(text: str, patterns: list[str]) -> bool:
    t = text.lower()
    return any(re.search(p, t) for p in patterns)


def _count_state_messages(messages: list[dict], state: str) -> int:
    """Count how many AI messages were sent while lead was in this state."""
    # Rough proxy: count AI messages after the state was set.
    # We don't store per-message state, so we use total exchange count.
    return sum(1 for m in messages if m.get("sender") == "AI")


def determine_next_state(
    current_state: str,
    lead: dict,
    messages: list[dict],
    latest_message: str,
    interest_score: float,
    intent: str = "NEUTRAL",
    lead_profile: dict | None = None,
) -> str:
    """
    Core state transition logic.
    Returns the next state (may be the same if no transition needed).
    """
    ai_count   = sum(1 for m in messages if m.get("sender") == "AI")
    user_count = sum(1 for m in messages if m.get("sender") == "USER")
    text       = latest_message.lower()

    # ── Terminal states — no transition out ──────────────────────
    if current_state == BOOKED:
        return BOOKED
    if current_state == DEAD:
        return DEAD

    # ── Negative intent — move to NURTURE regardless of stage ────
    if intent == "NEGATIVE":
        return NURTURE

    # ── Use lead profile to fast-track DISCOVERY → PITCH ─────────
    profile = lead_profile or {}
    if (current_state == DISCOVERY
            and profile.get("problem_identified")
            and profile.get("business_described")):
        # Enough info — don't wait for turn count, advance now
        if interest_score >= 0.3 or user_count >= 2:
            return PITCH

    # ── CALL_INVITE → resolution ─────────────────────────────────
    if current_state == CALL_INVITE:
        # Strict: only BOOKED if explicit CONFIRM_CALL intent AND not a question
        if intent == "CONFIRM_CALL" and "?" not in latest_message:
            return BOOKED
        if intent in ("NEGATIVE", "STOP") or _matches(text, CALL_REJECT):
            return NURTURE
        # Still waiting — stay in CALL_INVITE for up to 2 more exchanges
        if ai_count >= 8:
            return NURTURE
        return CALL_INVITE

    # ── NURTURE → re-engage ──────────────────────────────────────
    if current_state == NURTURE:
        if _matches(text, HIGH_INTEREST) or interest_score >= 0.5:
            return PITCH
        return NURTURE

    # ── COLD → DISCOVERY ─────────────────────────────────────────
    if current_state == COLD:
        # First reply always moves to DISCOVERY
        return DISCOVERY

    # ── DISCOVERY → PITCH ────────────────────────────────────────
    if current_state == DISCOVERY:
        # Advance to PITCH if:
        # 1. Lead has shared business info (discovery signals)
        # 2. High interest score
        # 3. Or we've had enough exchanges to know their context
        has_context   = _matches(text, DISCOVERY_SIGNALS)
        high_interest = _matches(text, HIGH_INTEREST) or interest_score >= 0.55
        enough_turns  = user_count >= 3

        if high_interest:
            return PITCH  # fast-track for hot leads
        if has_context and enough_turns:
            return PITCH
        if user_count >= 5:
            return PITCH  # force advance after 5 turns
        return DISCOVERY

    # ── PITCH → CALL_INVITE ──────────────────────────────────────
    if current_state == PITCH:
        # Push for call if:
        # 1. Lead is very interested (high score)
        # 2. Or after 2 pitch exchanges
        pitch_ai_turns = max(0, ai_count - 3)  # approx turns since PITCH started
        if interest_score >= 0.6 or pitch_ai_turns >= 2:
            return CALL_INVITE
        return PITCH

    # Default — stay put
    return current_state


async def get_lead_state(lead_id: UUID) -> str:
    """Fetch current conversation state from DB. Defaults to COLD."""
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
    """Persist new conversation state to DB."""
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
    """
    Load current state, compute next state, save if changed.
    Returns (old_state, new_state).
    """
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
            "from": current, "to": next_state,
            "interest_score": interest_score,
        })

    return current, next_state
