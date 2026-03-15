# svdeeq-backend/app/services/scraper.py
#
# Google Maps Lead Scraper
#
# Uses SerpAPI's Google Maps endpoint to pull businesses by
# category and location, clean the results, deduplicate against
# existing leads, and insert into Supabase as PENDING.
#
# Free tier: 100 searches/month = ~2,000 leads
# Sign up at serpapi.com — no card required for free tier
#
# Required env var: SERPAPI_KEY

import re
import httpx
from app.core.supabase import get_supabase
from app.core.config import get_settings
from app.utils.logger import log

settings = get_settings()

SERPAPI_URL = "https://serpapi.com/search"

# Nigerian country/area code prefixes to recognise valid mobile numbers
NG_PREFIXES = ("0", "234", "+234", "07", "08", "09", "070", "080", "090", "081", "091")

# All major Nigerian cities organised by region
NIGERIAN_CITIES: dict[str, list[str]] = {
    "North Central": [
        "Abuja", "Wuse Abuja", "Maitama Abuja", "Garki Abuja",
        "Gwarinpa Abuja", "Kubwa Abuja", "Lokoja", "Minna", "Ilorin",
        "Lafia", "Makurdi", "Jos",
    ],
    "North West": [
        "Kano", "Kaduna", "Zaria", "Katsina", "Sokoto",
        "Gusau", "Dutse", "Birnin Kebbi",
    ],
    "North East": [
        "Maiduguri", "Yola", "Bauchi", "Gombe", "Jalingo", "Damaturu",
    ],
    "South West": [
        "Lagos", "Ikeja Lagos", "Victoria Island Lagos", "Lekki Lagos",
        "Ibadan", "Abeokuta", "Akure", "Ado-Ekiti", "Osogbo",
    ],
    "South South": [
        "Port Harcourt", "Warri", "Benin City", "Uyo", "Calabar",
        "Asaba", "Yenagoa",
    ],
    "South East": [
        "Enugu", "Onitsha", "Nnewi", "Owerri", "Awka", "Abakaliki", "Umuahia",
    ],
}

# Flat list for iteration
ALL_CITIES: list[str] = [city for cities in NIGERIAN_CITIES.values() for city in cities]


# ── Phone cleaning ────────────────────────────────────────────────

def _clean_phone(raw: str | None) -> str | None:
    """
    Normalise a raw phone string to digits only, no leading +.
    Returns None if the number looks invalid or non-Nigerian.
    """
    if not raw:
        return None

    # Strip everything except digits and leading +
    digits = re.sub(r"[^\d]", "", raw)

    if len(digits) < 7:
        return None

    # Convert local 0xx format → 234xx
    if digits.startswith("0") and len(digits) == 11:
        digits = "234" + digits[1:]

    # Already has country code
    if digits.startswith("234") and len(digits) == 13:
        return digits

    # Short number — keep as-is but mark valid if length OK
    if 7 <= len(digits) <= 15:
        return digits

    return None


# ── Name cleaning ─────────────────────────────────────────────────

def _clean_name(raw: str | None) -> str | None:
    if not raw:
        return None
    # Remove common suffixes that aren't useful
    name = re.sub(r"\s*(ltd|limited|nigeria|nig|enterprises|enterprise|co\.|company)\.?$", "", raw, flags=re.IGNORECASE)
    return name.strip() or raw.strip()


# ── SerpAPI call ──────────────────────────────────────────────────

async def _fetch_serpapi(query: str, location: str) -> list[dict]:
    """
    Call SerpAPI Google Maps endpoint and return raw results.
    """
    api_key = getattr(settings, "serpapi_key", None)
    if not api_key:
        raise ValueError("SERPAPI_KEY not set in environment variables")

    params = {
        "engine":   "google_maps",
        "q":        f"{query} in {location}",
        "type":     "search",
        "api_key":  api_key,
        "hl":       "en",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(SERPAPI_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    return data.get("local_results", [])


# ── Result parser ─────────────────────────────────────────────────

def _parse_result(result: dict, industry: str, location: str) -> dict | None:
    """
    Parse a single SerpAPI local_result into a lead dict.
    Returns None if the result is unusable.
    """
    # Try multiple phone fields SerpAPI might return
    raw_phone = (
        result.get("phone")
        or result.get("phone_number")
        or result.get("contact", {}).get("phone")
    )
    phone = _clean_phone(raw_phone)
    if not phone:
        return None  # No usable phone number — skip

    name          = _clean_name(result.get("title") or result.get("name"))
    address       = result.get("address") or result.get("vicinity") or location
    website       = result.get("website") or result.get("link")
    rating        = result.get("rating")
    business_type = result.get("type") or industry

    if not name:
        return None

    return {
        "name":          name,
        "phone_number":  phone,
        "business_name": name,
        "industry":      business_type,
        "location":      address,
        "status":        "PENDING",
        # Store website for opportunity analyzer enrichment later
        **({"outreach_variant": website[:200]} if website else {}),
    }


# ── Deduplication ─────────────────────────────────────────────────

def _existing_phones(db) -> set[str]:
    """Fetch all phone numbers already in the leads table."""
    try:
        result = db.table("leads").select("phone_number").execute()
        return {row["phone_number"] for row in (result.data or [])}
    except Exception:
        return set()


# ── Main scrape function ──────────────────────────────────────────

async def scrape_and_insert(
    category: str,
    location: str = "Abuja, Nigeria",
    max_results: int = 50,
) -> dict:
    """
    Main entry point. Scrapes Google Maps for businesses matching
    category in location, deduplicates, and inserts into Supabase.

    Returns:
      {
        "scraped": int,    # raw results from Google Maps
        "new": int,        # leads actually inserted
        "skipped": int,    # duplicates or invalid numbers
        "leads": [...]     # sample of inserted leads (first 5)
      }
    """
    await log.info("SCRAPE_STARTED", metadata={"category": category, "location": location})

    db = get_supabase()

    # ── Fetch from SerpAPI ────────────────────────────────────────
    try:
        raw_results = await _fetch_serpapi(category, location)
    except ValueError as e:
        raise  # re-raise config errors
    except Exception as e:
        await log.warn("SCRAPE_FETCH_FAILED", metadata={"error": str(e)})
        raise RuntimeError(f"Failed to fetch from Google Maps: {str(e)}")

    await log.info("SCRAPE_RAW_RESULTS", metadata={"count": len(raw_results)})

    if not raw_results:
        return {"scraped": 0, "new": 0, "skipped": 0, "leads": []}

    # ── Parse results ─────────────────────────────────────────────
    parsed: list[dict] = []
    for result in raw_results[:max_results]:
        lead = _parse_result(result, category, location)
        if lead:
            parsed.append(lead)

    # ── Deduplicate against DB ────────────────────────────────────
    existing = _existing_phones(db)
    new_leads = [l for l in parsed if l["phone_number"] not in existing]
    skipped   = len(parsed) - len(new_leads)

    # Also deduplicate within this batch
    seen: set[str] = set()
    unique_leads: list[dict] = []
    for lead in new_leads:
        if lead["phone_number"] not in seen:
            seen.add(lead["phone_number"])
            unique_leads.append(lead)

    if not unique_leads:
        await log.info("SCRAPE_ALL_DUPLICATES", metadata={"skipped": skipped})
        return {
            "scraped": len(raw_results),
            "new": 0,
            "skipped": len(parsed),
            "leads": [],
        }

    # ── Insert into Supabase ──────────────────────────────────────
    try:
        db.table("leads").insert(unique_leads).execute()
        await log.info(
            "SCRAPE_INSERTED",
            metadata={"new": len(unique_leads), "skipped": skipped},
        )
    except Exception as e:
        await log.warn("SCRAPE_INSERT_FAILED", metadata={"error": str(e)})
        raise RuntimeError(f"Failed to insert leads: {str(e)}")

    return {
        "scraped": len(raw_results),
        "new":     len(unique_leads),
        "skipped": skipped + (len(new_leads) - len(unique_leads)),
        "leads":   unique_leads[:5],  # preview of first 5
    }


# ── Multi-city batch scrape ───────────────────────────────────────
# Used by the CLI script to sweep an entire category across
# multiple cities in one run.

async def scrape_multiple_cities(
    category:     str,
    cities:       list[str] | None = None,
    max_per_city: int = 20,
    delay_secs:   float = 2.0,
) -> dict:
    """
    Scrape a category across multiple cities sequentially.
    Adds a small delay between calls to avoid rate limiting.

    Args:
        category:      Business category to search (e.g. "pharmacy")
        cities:        List of city strings. Defaults to ALL_CITIES.
        max_per_city:  Max results per city (1-50)
        delay_secs:    Seconds to wait between city calls

    Returns summary of total results across all cities.
    """
    import asyncio

    target_cities = cities or ALL_CITIES
    total_scraped = 0
    total_new     = 0
    total_skipped = 0
    failed_cities: list[str] = []

    await log.info(
        "BATCH_SCRAPE_STARTED",
        metadata={"category": category, "cities": len(target_cities)},
    )

    for i, city in enumerate(target_cities):
        try:
            result = await scrape_and_insert(
                category=category,
                location=city if "Nigeria" in city else f"{city}, Nigeria",
                max_results=max_per_city,
            )
            total_scraped += result["scraped"]
            total_new     += result["new"]
            total_skipped += result["skipped"]

            print(
                f"[{i+1}/{len(target_cities)}] {city}: "
                f"{result['new']} new, {result['skipped']} skipped"
            )

        except Exception as e:
            failed_cities.append(city)
            print(f"[{i+1}/{len(target_cities)}] {city}: FAILED — {e}")

        # Respect rate limits
        if i < len(target_cities) - 1:
            await asyncio.sleep(delay_secs)

    await log.info(
        "BATCH_SCRAPE_COMPLETE",
        metadata={
            "category":    category,
            "total_new":   total_new,
            "total_scraped": total_scraped,
            "failed":      len(failed_cities),
        },
    )

    return {
        "category":      category,
        "cities_run":    len(target_cities),
        "cities_failed": failed_cities,
        "scraped":       total_scraped,
        "new":           total_new,
        "skipped":       total_skipped,
    }
