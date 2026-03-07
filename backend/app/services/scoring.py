# svdeeq-backend/app/services/scoring.py
"""
Lead Interest Scoring
─────────────────────
Computes interest_score (0.0–1.0) for a lead based on:

  Signal                        Weight
  ─────────────────────────────────────
  High-intent keywords          0.35
  Reply count                   0.25
  Reply speed (vs outreach)     0.20
  Follow-up responsiveness      0.10
  Negative signals (penalty)   -0.15

Score is clamped to [0.0, 1.0] and written to leads.interest_score.
"""

import re
import logging
from uuid import UUID
from datetime import datetime, timezone
from app.core.supabase import get_supabase

_l = logging.getLogger("svdeeq")

# ── Keyword banks ─────────────────────────────────────────────────────────────

HIGH_INTENT = [
    # Pricing & budget
    r"\bhow much\b", r"\bprice\b", r"\bcost\b", r"\bbudget\b", r"\bfee\b",
    r"\brate\b", r"\baffordable\b", r"\bpayment\b", r"\bquote\b",
    # Scheduling
    r"\bcall\b", r"\bmeet\b", r"\bschedule\b", r"\bbook\b", r"\bappointment\b",
    r"\bwhen\b.*\bavailable\b", r"\bavailability\b", r"\bzoom\b", r"\bvideo\b",
    # Strong interest
    r"\binterested\b", r"\bsend.*more\b", r"\btell.*more\b", r"\bmore info\b",
    r"\byes\b", r"\bsure\b", r"\bsounds good\b", r"\blet'?s\b", r"\bgo ahead\b",
    r"\bproceed\b", r"\bstart\b", r"\bsign up\b",
]

MEDIUM_INTENT = [
    r"\bwhat.*do\b", r"\bhow.*work\b", r"\bexplain\b", r"\bdetails?\b",
    r"\bservices?\b", r"\bpackage\b", r"\boffer\b", r"\bexample\b",
    r"\bshow me\b", r"\bcan you\b", r"\bdo you\b", r"\bare you\b",
]

NEGATIVE_SIGNALS = [
    r"\bnot interested\b", r"\bno thanks\b", r"\bdon'?t contact\b",
    r"\bstop\b", r"\bunsubscribe\b", r"\bremove\b", r"\bbusy\b",
    r"\bnot now\b", r"\bmaybe later\b", r"\bno need\b", r"\bwrong number\b",
]


def _keyword_score(messages: list[dict]) -> float:
    """Score based on high/medium intent keywords across all USER messages."""
    user_texts = [
        m["content"].lower()
        for m in messages
        if m.get("sender") == "USER" and m.get("content")
    ]
    if not user_texts:
        return 0.0

    combined = " ".join(user_texts)
    high_hits   = sum(1 for p in HIGH_INTENT   if re.search(p, combined))
    medium_hits = sum(1 for p in MEDIUM_INTENT if re.search(p, combined))
    neg_hits    = sum(1 for p in NEGATIVE_SIGNALS if re.search(p, combined))

    raw = (high_hits * 0.15) + (medium_hits * 0.05) - (neg_hits * 0.20)
    return max(0.0, min(1.0, raw))


def _reply_count_score(messages: list[dict]) -> float:
    """More USER replies = more interest. Caps at 10 replies = 1.0."""
    user_count = sum(1 for m in messages if m.get("sender") == "USER")
    return min(1.0, user_count / 10.0)


def _reply_speed_score(lead: dict, messages: list[dict]) -> float:
    """
    How quickly did the lead first reply after outreach?
    < 10 min  → 1.0
    < 1 hour  → 0.7
    < 6 hours → 0.4
    < 24h     → 0.2
    > 24h     → 0.05
    No data   → 0.3 (neutral)
    """
    outreach_at = lead.get("last_outreach_at")
    if not outreach_at:
        return 0.3

    first_user_reply = next(
        (m for m in messages if m.get("sender") == "USER"),
        None,
    )
    if not first_user_reply:
        return 0.1  # no reply yet

    try:
        sent  = datetime.fromisoformat(outreach_at.replace("Z", "+00:00"))
        reply = datetime.fromisoformat(first_user_reply["inserted_at"].replace("Z", "+00:00"))
        diff_minutes = (reply - sent).total_seconds() / 60
    except Exception:
        return 0.3

    if diff_minutes < 10:   return 1.0
    if diff_minutes < 60:   return 0.7
    if diff_minutes < 360:  return 0.4
    if diff_minutes < 1440: return 0.2
    return 0.05


def _followup_responsiveness_score(lead: dict, messages: list[dict]) -> float:
    """
    Did the lead reply to a follow-up message? Each follow-up reply is a strong signal.
    follow_up_count > 0 and user has replied after the first exchange → high score.
    """
    follow_up_count = lead.get("follow_up_count", 0)
    if not follow_up_count:
        return 0.0

    user_replies = [m for m in messages if m.get("sender") == "USER"]
    # If they replied more than once, they're engaging across follow-ups
    if len(user_replies) > follow_up_count:
        return 1.0
    if len(user_replies) > 0:
        return 0.5
    return 0.0


def compute_score(lead: dict, messages: list[dict]) -> float:
    """
    Weighted combination of all signals.
    Returns float between 0.0 and 1.0.
    """
    # Hard overrides
    if lead.get("status") in ("OPTED_OUT", "INVALID_NUMBER"):
        return 0.0
    if lead.get("status") == "HUMAN_REQUIRED":
        # Escalated leads have shown strong intent (they want a human)
        base = 0.75
    else:
        base = 0.0

    weights = {
        "keyword":    0.35,
        "reply_count": 0.25,
        "reply_speed": 0.20,
        "followup":   0.10,
    }

    kw   = _keyword_score(messages)
    rc   = _reply_count_score(messages)
    rs   = _reply_speed_score(lead, messages)
    fu   = _followup_responsiveness_score(lead, messages)

    weighted = (
        kw  * weights["keyword"]
        + rc * weights["reply_count"]
        + rs * weights["reply_speed"]
        + fu * weights["followup"]
    )

    score = max(base, weighted)
    return round(min(1.0, max(0.0, score)), 4)


async def update_lead_score(lead_id: UUID) -> float:
    """
    Fetch lead + messages, compute score, write to DB.
    Returns the new score.
    """
    db = get_supabase()

    try:
        lead_res = (
            db.table("leads")
            .select("id, status, last_outreach_at, follow_up_count")
            .eq("id", str(lead_id))
            .single()
            .execute()
        )
        lead = lead_res.data
    except Exception as e:
        _l.warning(f"[SCORING] Failed to fetch lead {lead_id}: {e}")
        return 0.0

    try:
        msgs_res = (
            db.table("messages")
            .select("sender, content, inserted_at")
            .eq("lead_id", str(lead_id))
            .order("inserted_at", desc=False)
            .execute()
        )
        messages = msgs_res.data or []
    except Exception as e:
        _l.warning(f"[SCORING] Failed to fetch messages for {lead_id}: {e}")
        messages = []

    score = compute_score(lead, messages)

    try:
        db.table("leads").update({"interest_score": score}).eq("id", str(lead_id)).execute()
        _l.info(f"[SCORING] lead={lead_id} score={score}")
    except Exception as e:
        _l.warning(f"[SCORING] Failed to write score for {lead_id}: {e}")

    return score
