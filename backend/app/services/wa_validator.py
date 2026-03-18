# svdeeq-backend/app/services/wa_validator.py
#
# WhatsApp Number Validator
#
# Uses Evolution API's /chat/whatsappNumbers endpoint to check
# whether a phone number is registered on WhatsApp BEFORE
# we ever attempt outreach.
#
# This runs as part of the scraper pipeline so only valid
# WhatsApp numbers ever enter the outreach queue.
#
# Also used by the outreach cycle to re-validate numbers that
# previously failed with "exists: false".

import httpx
from app.core.config import get_settings
from app.core.supabase import get_supabase
from app.utils.logger import log

settings = get_settings()


async def check_number(phone: str) -> bool:
    """
    Check if a single phone number is registered on WhatsApp.

    Args:
        phone: digits only, no + prefix e.g. "2348012345678"

    Returns:
        True if registered on WhatsApp, False otherwise
    """
    url = (
        f"{settings.evolution_api_url}"
        f"/chat/whatsappNumbers/{settings.evolution_instance_name}"
    )
    headers = {
        "apikey":       settings.evolution_api_key,
        "Content-Type": "application/json",
    }
    body = {"numbers": [phone]}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

        # Response is a list: [{"exists": true/false, "number": "...", "jid": "..."}]
        if isinstance(data, list) and len(data) > 0:
            return data[0].get("exists", False)

        return False

    except Exception as e:
        await log.warn(
            "WA_CHECK_FAILED",
            metadata={"phone": phone[:6] + "****", "error": str(e)},
        )
        # If check fails, be conservative — don't block the lead
        # They'll be caught at send time if truly invalid
        return True


async def check_numbers_batch(phones: list[str]) -> dict[str, bool]:
    """
    Check multiple numbers at once.
    Evolution API supports up to 50 in a single call.

    Returns dict: {phone: exists_bool}
    """
    if not phones:
        return {}

    url = (
        f"{settings.evolution_api_url}"
        f"/chat/whatsappNumbers/{settings.evolution_instance_name}"
    )
    headers = {
        "apikey":       settings.evolution_api_key,
        "Content-Type": "application/json",
    }

    results: dict[str, bool] = {}

    # Process in chunks of 50
    chunk_size = 50
    for i in range(0, len(phones), chunk_size):
        chunk = phones[i:i + chunk_size]
        body  = {"numbers": chunk}

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(url, headers=headers, json=body)
                resp.raise_for_status()
                data = resp.json()

            if isinstance(data, list):
                for item in data:
                    number = item.get("number", "")
                    exists = item.get("exists", False)
                    results[number] = exists

        except Exception as e:
            await log.warn(
                "WA_BATCH_CHECK_FAILED",
                metadata={"chunk_start": i, "error": str(e)},
            )
            # Mark all in this chunk as unknown (True = don't block)
            for phone in chunk:
                results[phone] = True

    return results


async def validate_and_mark_leads(lead_ids: list[str] | None = None) -> dict:
    """
    Validate WhatsApp numbers for PENDING leads in Supabase.
    Marks invalid numbers as INVALID_NUMBER so they're never outreached.

    Args:
        lead_ids: specific lead IDs to validate, or None to validate all PENDING

    Returns summary of validation results.
    """
    db = get_supabase()

    # Fetch leads to validate
    query = (
        db.table("leads")
        .select("id, phone_number, name")
        .eq("status", "PENDING")
        .eq("ai_paused", False)
    )
    if lead_ids:
        query = query.in_("id", lead_ids)

    result = query.limit(200).execute()
    leads  = result.data or []

    if not leads:
        return {"checked": 0, "valid": 0, "invalid": 0}

    phones     = [l["phone_number"] for l in leads]
    phone_map  = {l["phone_number"]: l for l in leads}

    await log.info("WA_VALIDATION_STARTED", metadata={"count": len(phones)})

    # Batch check all numbers
    check_results = await check_numbers_batch(phones)

    valid_count   = 0
    invalid_count = 0
    invalid_ids   = []

    for phone, exists in check_results.items():
        lead = phone_map.get(phone)
        if not lead:
            continue
        if exists:
            valid_count += 1
        else:
            invalid_count += 1
            invalid_ids.append(lead["id"])

    # Bulk mark invalids
    if invalid_ids:
        db.table("leads").update({
            "status":    "INVALID_NUMBER",
            "ai_paused": True,
        }).in_("id", invalid_ids).execute()

        await log.info(
            "WA_VALIDATION_COMPLETE",
            metadata={
                "checked": len(check_results),
                "valid":   valid_count,
                "invalid": invalid_count,
            },
        )

    return {
        "checked": len(check_results),
        "valid":   valid_count,
        "invalid": invalid_count,
    }
