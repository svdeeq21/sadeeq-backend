# svdeeq-backend/app/services/whatsapp.py
#
# All outbound WhatsApp communication goes through this file.
# Two concerns:
#   1. send_message()  — sends a reply in an existing conversation
#   2. send_outreach() — sends the first message to a new lead
#
# Anti-ban measures (PRD §2.1):
#   - Randomised human-like delay before sending (1.5–4s)
#   - No links in outreach messages
#   - Daily cap enforced via outreach_daily_caps table
#   - Exponential backoff on delivery failure (max 3 attempts)
#   - Auto-stop if WA returns an abnormal error rate

import asyncio
import random
import httpx
from uuid import UUID
from app.core.config import get_settings
from app.core.supabase import get_supabase
from app.utils.logger import log
from app.utils.retry import with_retry

settings = get_settings()

# Typing simulation delay range in seconds (feels human, not instant)
_MIN_DELAY = 1.5
_MAX_DELAY = 4.0


def _evolution_headers() -> dict:
    return {
        "apikey":       settings.evolution_api_key,
        "Content-Type": "application/json",
    }


def _format_phone(phone: str) -> str:
    """
    Evolution API expects phone numbers in international format
    without the leading + and with @s.whatsapp.net suffix removed.
    Input:  "+971501234421"
    Output: "971501234421"
    """
    return phone.lstrip("+").replace(" ", "").replace("-", "")


@with_retry(max_attempts=3, base_delay=2.0)
async def send_message(phone_number: str, text: str, lead_id: UUID) -> bool:
    """
    Sends a text message to an existing conversation.
    Used for all AI replies.

    Returns True on success, raises on final failure (after 3 retries).
    """
    # Human-like typing delay
    delay = random.uniform(_MIN_DELAY, _MAX_DELAY)
    await asyncio.sleep(delay)

    url = (
        f"{settings.evolution_api_url}/message/sendText"
        f"/{settings.evolution_instance_name}"
    )

    payload = {
        "number":  _format_phone(phone_number),
        "text":    text,
        "options": {
            "delay":    int(delay * 1000),  # Evolution API also accepts delay in ms
            "presence": "composing",        # shows "typing..." indicator
        },
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload, headers=_evolution_headers())

    if response.status_code not in (200, 201):
        raise RuntimeError(
            f"Evolution API error {response.status_code}: {response.text[:200]}"
        )

    await log.info(
        "WA_MESSAGE_SENT",
        lead_id=lead_id,
        metadata={"phone": phone_number[:6] + "****", "delay_s": round(delay, 2)},
    )

    return True


@with_retry(max_attempts=3, base_delay=2.0)
async def send_outreach(phone_number: str, message: str, lead_id: UUID) -> bool:
    """
    Sends the very first outreach message to a new lead.
    Extra restrictions apply:
      - No links allowed (checked before sending)
      - Daily cap must not be exceeded (checked before sending)
      - Slightly longer delays for warm-up safety
    """
    # Safety check: no links in outreach
    if "http://" in message or "https://" in message:
        await log.warn(
            "OUTREACH_BLOCKED_LINK",
            lead_id=lead_id,
            metadata={"reason": "Links not allowed in first message"},
        )
        raise ValueError("Outreach messages must not contain links")

    # Check daily cap
    cap_ok = await _check_and_increment_daily_cap()
    if not cap_ok:
        await log.warn(
            "OUTREACH_DAILY_CAP_REACHED",
            lead_id=lead_id,
        )
        raise RuntimeError("Daily outreach cap reached")

    # Longer delay for first message (2.5–6s)
    delay = random.uniform(2.5, 6.0)
    await asyncio.sleep(delay)

    url = (
        f"{settings.evolution_api_url}/message/sendText"
        f"/{settings.evolution_instance_name}"
    )

    payload = {
        "number":  _format_phone(phone_number),
        "text":    message,
        "options": {
            "delay":    int(delay * 1000),
            "presence": "composing",
        },
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload, headers=_evolution_headers())

    if response.status_code not in (200, 201):
        raise RuntimeError(
            f"Evolution API outreach error {response.status_code}: {response.text[:200]}"
        )

    # Mark lead as OUTREACH_SENT
    db = get_supabase()
    db.table("leads").update({
        "status":          "OUTREACH_SENT",
        "outreach_attempts": 1,
    }).eq("id", str(lead_id)).execute()

    await log.info(
        "OUTREACH_SENT",
        lead_id=lead_id,
        metadata={"phone": phone_number[:6] + "****"},
    )

    return True


async def mark_invalid_number(lead_id: UUID) -> None:
    """Called after 3 failed delivery attempts."""
    db = get_supabase()
    db.table("leads").update({
        "status": "INVALID_NUMBER",
    }).eq("id", str(lead_id)).execute()

    await log.warn("INVALID_NUMBER", lead_id=lead_id)


async def get_wa_connection_status() -> str:
    """
    Checks Evolution API for the current WA connection state.
    Returns "CONNECTED", "DISCONNECTED", or "UNKNOWN".
    Used by the health check endpoint.
    """
    try:
        url = (
            f"{settings.evolution_api_url}/instance/connectionState"
            f"/{settings.evolution_instance_name}"
        )
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, headers=_evolution_headers())

        if response.status_code == 200:
            state = response.json().get("instance", {}).get("state", "")
            return "CONNECTED" if state == "open" else "DISCONNECTED"

        return "UNKNOWN"
    except Exception:
        return "UNKNOWN"


async def _check_and_increment_daily_cap() -> bool:
    """
    Checks whether the daily outreach cap has been reached.
    If not, increments the counter and returns True.
    Returns False if cap is reached or outreach is paused.
    """
    db = get_supabase()

    # get_or_create_daily_cap() is defined in 03_functions.sql
    cap_result = db.rpc("get_or_create_daily_cap").execute()
    cap = cap_result.data

    if not cap or cap.get("is_paused"):
        return False

    if cap.get("messages_sent", 0) >= cap.get("daily_limit", 10):
        return False

    # Increment counter
    db.table("outreach_daily_caps").update({
        "messages_sent": cap["messages_sent"] + 1,
    }).eq("id", cap["id"]).execute()

    return True
