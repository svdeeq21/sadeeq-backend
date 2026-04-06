# svdeeq-backend/app/services/outreach.py
#
# Outreach module — sends first messages to PENDING leads
# and handles follow-ups on Day 2, 5, 10.
#
# Called by the scheduler every 20-40 minutes during allowed window.
# WAT timezone (UTC+1) — window: 09:00-12:00 and 14:00-17:30

import random
from datetime import datetime, timezone, timedelta
from app.core.config import get_settings
from app.core.supabase import get_supabase
from app.services import whatsapp
from app.utils.logger import log

settings = get_settings()

# WAT = UTC+1
WAT = timezone(timedelta(hours=1))

# Allowed sending windows (WAT hours)
MORNING_START  = 9
MORNING_END    = 12
AFTERNOON_START = 14
AFTERNOON_END  = 17.5  # 17:30

# Follow-up schedule in days
FOLLOWUP_DAYS = {
    0: "followup_1",   # Day 2
    1: "followup_2",   # Day 5
    2: "followup_final", # Day 10
}
FOLLOWUP_INTERVALS = [2, 5, 10]  # days after last_outreach_at

# Booking link / number
BOOKING_CONTACT = "+2349035144812"


def _is_within_window() -> bool:
    """Check if current WAT time is within allowed sending window."""
    now_wat = datetime.now(WAT)
    hour = now_wat.hour + now_wat.minute / 60

    in_morning   = MORNING_START <= hour < MORNING_END
    in_afternoon = AFTERNOON_START <= hour < AFTERNOON_END

    return in_morning or in_afternoon


def _pick_variant(db, variant_type: str) -> dict | None:
    """
    Pick a message variant using weighted random selection.
    Higher reply rate = higher probability of being selected.
    Falls back to pure random if no performance data yet.
    """
    result = (
        db.table("message_variants")
        .select("*")
        .eq("type", variant_type)
        .eq("is_active", True)
        .execute()
    )

    variants = result.data
    if not variants:
        return None

    # Calculate weights based on reply rate
    # New variants (sent=0) get a base weight of 0.1 to ensure they get tested
    weights = []
    for v in variants:
        if v["sent"] == 0:
            weights.append(0.15)  # exploration weight
        else:
            reply_rate = v["replies"] / v["sent"]
            weights.append(max(reply_rate, 0.01))  # min weight so no variant is excluded

    # Weighted random selection
    total = sum(weights)
    normalised = [w / total for w in weights]
    return random.choices(variants, weights=normalised, k=1)[0]


def _personalise(template: str, lead: dict) -> str:
    """
    Fill in placeholders. Handles fallback syntax {industry|fallback}
    so messages never break when a field is missing.
    """
    import re

    name          = lead.get("name") or "there"
    business_name = lead.get("business_name") or "your business"
    industry      = lead.get("industry") or ""
    first_name    = name.split()[0] if name else "there"

    result = template

    # Handle fallback syntax: {industry|local} → uses industry if available, else fallback
    def replace_with_fallback(match):
        field, fallback = match.group(1), match.group(2)
        values = {
            "name":          first_name,
            "business_name": business_name,
            "industry":      industry,
        }
        val = values.get(field, "")
        return val if val else fallback

    result = re.sub(r"\{(\w+)\|([^}]+)\}", replace_with_fallback, result)

    # Handle standard placeholders
    result = (
        result
        .replace("{name}",          first_name)
        .replace("{business_name}", business_name)
        .replace("{industry}",      industry if industry else "business")
        .replace("{booking_contact}", BOOKING_CONTACT)
    )

    return result


def _increment_sent(db, variant_id: str, industry: str | None = None) -> None:
    """Increment sent counter. Also records best industry when reply rates emerge."""
    try:
        db.rpc("increment_variant_sent", {"p_variant_id": variant_id}).execute()
    except Exception:
        try:
            current = db.table("message_variants").select("sent, replies, best_industry").eq("id", variant_id).execute()
            if current.data:
                patch: dict = {"sent": current.data[0]["sent"] + 1}
                # Track which industry this variant is performing best for
                if industry and not current.data[0].get("best_industry"):
                    if current.data[0].get("replies", 0) > 2:
                        patch["best_industry"] = industry
                db.table("message_variants").update(patch).eq("id", variant_id).execute()
        except Exception:
            pass


async def send_initial_outreach(lead: dict) -> bool:
    """
    Sends the first message to a PENDING lead.
    Returns True on success, False on failure.
    """
    db      = get_supabase()
    lead_id = lead["id"]
    phone   = lead["phone_number"].lstrip("+")

    # ── Run opportunity analyzer before first message ───────────
    # Generates pain_point, suggested_solutions, and industry_opening_variant
    # and saves them to the lead's record in Supabase.
    try:
        from app.services.opportunity_analyzer import run_and_save as analyze
        await analyze(lead)
        # Reload lead to get fresh industry_opening_variant if just generated
        fresh = db.table("leads").select("*").eq("id", lead_id).execute()
        if fresh.data:
            lead = fresh.data[0]
    except Exception as e:
        await log.warn("ANALYZER_SKIPPED", metadata={"lead_id": lead_id, "error": str(e)})

    # ── Pick opening variant ──────────────────────────────────
    # If the analyzer generated a personalized opening, use it directly.
    # Otherwise fall back to a message variant from the database.
    industry_hook = lead.get("industry_opening_variant")

    if industry_hook:
        # Use the analyzer's outcome-led hook.
        # The hook is a complete opening already — just clean and prefix.
        first_name    = (lead.get("name") or "there").split()[0]
        business_name = lead.get("business_name") or "your business"

        hook = industry_hook.strip()
        # If the hook already starts with Hi, just do placeholder replacement
        if hook.lower().startswith("hi "):
            message = hook.replace("{name}", first_name).replace("{business_name}", business_name)
        else:
            message = f"Hi {first_name}, {hook}".replace("{business_name}", business_name)

        # Pick a variant for A/B tracking even though message came from analyzer
        variant = _pick_variant(db, "opening")
        analyzer_generated = True
    else:
        # No analyzer hook — pick a database variant directly
        variant = _pick_variant(db, "opening")
        if not variant:
            await log.warn("NO_OPENING_VARIANT", metadata={"lead_id": lead_id})
            return False
        message = _personalise(variant["message"], lead)
        analyzer_generated = False

    try:
        from uuid import UUID
        await whatsapp.send_outreach(phone, message, UUID(lead_id))
    except Exception as e:
        error_str = str(e)
        # If Evolution API confirms number not on WhatsApp, mark immediately
        if '"exists":false' in error_str:
            try:
                db.table("leads").update({
                    "status":    "INVALID_NUMBER",
                    "ai_paused": True,
                }).eq("id", lead_id).execute()
                await log.info("LEAD_MARKED_INVALID", metadata={"lead_id": lead_id})
            except Exception:
                pass
        await log.warn("OUTREACH_SEND_FAILED", metadata={"lead_id": lead_id, "error": error_str})
        return False

    # Update lead state
    now = datetime.now(timezone.utc).isoformat()
    db.table("leads").update({
        "status":           "OUTREACH_SENT",
        "last_outreach_at": now,
        "next_follow_up_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "follow_up_count":  0,
        "outreach_variant": variant["id"],
    }).eq("id", lead_id).execute()

    _increment_sent(db, variant["id"], industry=lead.get("industry"))

    await log.info("INITIAL_OUTREACH_SENT", metadata={
        "lead_id":   lead_id,
        "phone":     phone[:6] + "****",
        "variant":   variant["id"],
    })

    return True


async def send_follow_up(lead: dict) -> bool:
    """
    Sends a follow-up message based on follow_up_count.
    Returns True on success, False if no more follow-ups to send.
    """
    db             = get_supabase()
    lead_id        = lead["id"]
    phone          = lead["phone_number"].lstrip("+")
    follow_up_count = lead.get("follow_up_count", 0)

    # No more follow-ups after 3
    if follow_up_count >= 3:
        db.table("leads").update({
            "status":           "INACTIVE",
            "next_follow_up_at": None,
        }).eq("id", lead_id).execute()
        return False

    variant_type = list(FOLLOWUP_DAYS.values())[follow_up_count]
    variant      = _pick_variant(db, variant_type)

    if not variant:
        await log.warn("NO_FOLLOWUP_VARIANT", metadata={"lead_id": lead_id, "type": variant_type})
        return False

    message = _personalise(variant["message"], lead)

    try:
        from uuid import UUID
        await whatsapp.send_outreach(phone, message, UUID(lead_id))
    except Exception as e:
        await log.warn("FOLLOWUP_SEND_FAILED", metadata={"lead_id": lead_id, "error": str(e)})
        return False

    # Calculate next follow-up
    new_count = follow_up_count + 1
    if new_count < 3:
        days_until_next = FOLLOWUP_INTERVALS[new_count]
        next_follow_up  = (datetime.now(timezone.utc) + timedelta(days=days_until_next)).isoformat()
    else:
        next_follow_up = None

    now = datetime.now(timezone.utc).isoformat()
    db.table("leads").update({
        "last_outreach_at":  now,
        "follow_up_count":   new_count,
        "next_follow_up_at": next_follow_up,
    }).eq("id", lead_id).execute()

    _increment_sent(db, variant["id"])

    await log.info("FOLLOWUP_SENT", metadata={
        "lead_id":       lead_id,
        "phone":         phone[:6] + "****",
        "follow_up_num": new_count,
        "variant":       variant["id"],
    })

    return True


async def run_outreach_cycle() -> None:
    """
    Main entry point called by the scheduler.
    Sends ONE message per cycle (either initial or follow-up).
    Respects the time window.
    """
    if not _is_within_window():
        return

    db  = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Priority 1: Send follow-ups that are due
    followup_result = (
        db.table("leads")
        .select("id, name, phone_number, business_name, industry, follow_up_count, status")
        .eq("ai_paused", False)
        .eq("status", "OUTREACH_SENT")
        .lte("next_follow_up_at", now)
        .not_.is_("next_follow_up_at", "null")
        .limit(1)
        .execute()
    )

    if followup_result.data:
        lead = followup_result.data[0]
        await send_follow_up(lead)
        return

    # Priority 2: Send initial outreach to next PENDING lead
    pending_result = (
        db.table("leads")
        .select("id, name, phone_number, business_name, industry, location, opportunity_analysis, pain_point, suggested_solutions, industry_opening_variant")
        .eq("status", "PENDING")
        .eq("ai_paused", False)
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )

    if pending_result.data:
        lead = pending_result.data[0]
        await send_initial_outreach(lead)
