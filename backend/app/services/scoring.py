# =========================
# SCORING ENGINE v2 (ADVANCED)
# =========================

import re
import logging
from uuid import UUID
from datetime import datetime
from app.core.supabase import get_supabase

_l = logging.getLogger("svdeeq")

# ── Keyword banks ─────────────────────────────────────────────────────────────

HIGH_INTENT = [
    r"\bhow much\b", r"\bprice\b", r"\bcost\b", r"\bquote\b",
    r"\blet'?s start\b", r"\bhow do we start\b", r"\bready\b",
    r"\bshow me\b", r"\bdemo\b", r"\bi want this\b",
]

MEDIUM_INTENT = [
    r"\bhow does it work\b", r"\bwhat do you do\b",
    r"\bdetails\b", r"\bmore info\b", r"\binterested\b"
]

OBJECTION_SIGNALS = [
    r"\bnot sure\b", r"\bdon'?t think\b", r"\bwon'?t work\b",
    r"\btoo expensive\b", r"\bno budget\b", r"\bmaybe later\b"
]

NEGATIVE_SIGNALS = [
    r"\bnot interested\b", r"\bno thanks\b", r"\bstop\b",
    r"\bunsubscribe\b", r"\bwrong number\b"
]


# ── Core Scoring Components ───────────────────────────────────────────────────

def _keyword_score(messages: list[dict]) -> float:
    """Recency-weighted keyword scoring"""
    if not messages:
        return 0.0

    score = 0.0
    total_weight = 0.0

    for i, m in enumerate(reversed(messages)):  # recent first
        if m.get("sender") != "USER":
            continue

        text = (m.get("content") or "").lower()
        weight = 1 / (i + 1)  # recency decay

        total_weight += weight

        if any(re.search(p, text) for p in HIGH_INTENT):
            score += 1.0 * weight
        elif any(re.search(p, text) for p in MEDIUM_INTENT):
            score += 0.5 * weight
        elif any(re.search(p, text) for p in OBJECTION_SIGNALS):
            score -= 0.8 * weight
        elif any(re.search(p, text) for p in NEGATIVE_SIGNALS):
            score -= 1.2 * weight

    if total_weight == 0:
        return 0.0

    normalized = score / total_weight
    return max(0.0, min(1.0, (normalized + 1) / 2))  # shift to 0–1


def _momentum_score(messages: list[dict]) -> float:
    """
    Measures whether conversation is trending positive or negative
    based on last 3 user messages.
    """
    recent = [
        (m.get("content") or "").lower()
        for m in messages
        if m.get("sender") == "USER"
    ][-3:]

    if not recent:
        return 0.5

    score = 0

    for text in recent:
        if any(re.search(p, text) for p in HIGH_INTENT):
            score += 1
        elif any(re.search(p, text) for p in OBJECTION_SIGNALS):
            score -= 1

    return max(0.0, min(1.0, (score + 3) / 6))


def _reply_depth_score(messages: list[dict]) -> float:
    """Measures engagement depth (not just count)"""
    user_msgs = [m for m in messages if m.get("sender") == "USER"]

    if not user_msgs:
        return 0.0

    avg_length = sum(len((m.get("content") or "")) for m in user_msgs) / len(user_msgs)

    if avg_length > 120:
        return 1.0
    if avg_length > 60:
        return 0.7
    if avg_length > 20:
        return 0.4
    return 0.2


def _reply_speed_score(lead: dict, messages: list[dict]) -> float:
    outreach_at = lead.get("last_outreach_at")
    if not outreach_at:
        return 0.3

    first_reply = next((m for m in messages if m.get("sender") == "USER"), None)
    if not first_reply:
        return 0.1

    try:
        sent = datetime.fromisoformat(outreach_at.replace("Z", "+00:00"))
        reply = datetime.fromisoformat(first_reply["inserted_at"].replace("Z", "+00:00"))
        minutes = (reply - sent).total_seconds() / 60
    except:
        return 0.3

    if minutes < 5: return 1.0
    if minutes < 30: return 0.8
    if minutes < 120: return 0.6
    if minutes < 720: return 0.3
    return 0.1


def _followup_score(lead: dict, messages: list[dict]) -> float:
    followups = lead.get("follow_up_count", 0)
    replies = sum(1 for m in messages if m.get("sender") == "USER")

    if followups == 0:
        return 0.0

    ratio = replies / (followups + 1)
    return min(1.0, ratio)


# ── Final Score ───────────────────────────────────────────────────────────────

def compute_score(lead: dict, messages: list[dict]) -> float:

    if lead.get("status") in ("OPTED_OUT", "INVALID_NUMBER"):
        return 0.0

    if lead.get("status") == "HUMAN_REQUIRED":
        return 0.85

    weights = {
        "keyword": 0.30,
        "momentum": 0.20,
        "depth": 0.15,
        "speed": 0.20,
        "followup": 0.15
    }

    kw = _keyword_score(messages)
    mo = _momentum_score(messages)
    dp = _reply_depth_score(messages)
    sp = _reply_speed_score(lead, messages)
    fu = _followup_score(lead, messages)

    score = (
        kw * weights["keyword"] +
        mo * weights["momentum"] +
        dp * weights["depth"] +
        sp * weights["speed"] +
        fu * weights["followup"]
    )

    # Non-linear boost for high intent
    if kw > 0.7 and mo > 0.6:
        score += 0.1

    return round(min(1.0, max(0.0, score)), 4)


# ── DB Update ────────────────────────────────────────────────────────────────

async def update_lead_score(lead_id: UUID) -> float:
    db = get_supabase()

    try:
        lead = (
            db.table("leads")
            .select("id, status, last_outreach_at, follow_up_count")
            .eq("id", str(lead_id))
            .single()
            .execute()
        ).data
    except Exception as e:
        _l.warning(f"[SCORING] lead fetch failed: {e}")
        return 0.0

    try:
        messages = (
            db.table("messages")
            .select("sender, content, inserted_at")
            .eq("lead_id", str(lead_id))
            .order("inserted_at", desc=False)
            .execute()
        ).data or []
    except Exception as e:
        _l.warning(f"[SCORING] message fetch failed: {e}")
        messages = []

    score = compute_score(lead, messages)

    try:
        db.table("leads").update({"interest_score": score}).eq("id", str(lead_id)).execute()
        _l.info(f"[SCORING] lead={lead_id} score={score}")
    except Exception as e:
        _l.warning(f"[SCORING] write failed: {e}")

    return score