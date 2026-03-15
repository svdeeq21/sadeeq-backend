# svdeeq-backend/app/routers/scrape.py
#
# POST /api/scrape  — trigger a Google Maps scrape from the frontend

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.scraper import scrape_and_insert, scrape_multiple_cities, NIGERIAN_STATES, ALL_STATES, LAGOS_AREAS, ABUJA_AREAS
from app.utils.logger import log

router = APIRouter(prefix="/api", tags=["scraper"])

# Cities exposed to the frontend — pulled from scraper module

# Preset categories aligned with opportunity analyzer industry profiles
PRESET_CATEGORIES = [
    "pharmacy",
    "bakery",
    "restaurant",
    "supermarket",
    "clinic",
    "hospital",
    "school",
    "real estate agency",
    "logistics company",
    "salon",
    "gym",
    "hotel",
    "boutique",
    "car wash",
    "printing press",
    "event planner",
    "catering service",
    "fashion designer",
    "law firm",
    "accounting firm",
]


class ScrapeRequest(BaseModel):
    category:    str = Field(..., min_length=2, max_length=100)
    location:    str = Field(default="Abuja, Nigeria", max_length=100)
    max_results: int = Field(default=20, ge=1, le=50)


class ScrapeResponse(BaseModel):
    scraped:  int
    new:      int
    skipped:  int
    leads:    list[dict]
    message:  str


@router.post("/scrape", response_model=ScrapeResponse)
async def trigger_scrape(body: ScrapeRequest):
    """
    Scrape Google Maps for businesses matching category + location,
    deduplicate, and insert new leads into Supabase as PENDING.
    """
    try:
        result = await scrape_and_insert(
            category=body.category,
            location=body.location,
            max_results=body.max_results,
        )
        return ScrapeResponse(
            scraped=result["scraped"],
            new=result["new"],
            skipped=result["skipped"],
            leads=result["leads"],
            message=f"Done. {result['new']} new leads added, {result['skipped']} duplicates skipped.",
        )
    except ValueError as e:
        # Config error — SERPAPI_KEY not set
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        await log.warn("SCRAPE_ENDPOINT_ERROR", metadata={"error": str(e)})
        raise HTTPException(status_code=500, detail="Scrape failed unexpectedly.")


class BatchScrapeRequest(BaseModel):
    category:     str   = Field(..., min_length=2, max_length=100)
    cities:       list[str] | None = None   # None = all cities
    region:       str | None = None          # e.g. "South West"
    max_per_city: int   = Field(default=20, ge=1, le=50)
    delay_secs:   float = Field(default=2.0, ge=0.5, le=10.0)


class BatchScrapeResponse(BaseModel):
    category:      str
    cities_run:    int
    cities_failed: list[str]
    scraped:       int
    new:           int
    skipped:       int
    message:       str


@router.post("/scrape/batch", response_model=BatchScrapeResponse)
async def trigger_batch_scrape(body: BatchScrapeRequest):
    """
    Scrape a category across multiple cities or an entire region.
    Uses the multi-city batch function with delays between calls.
    """
    # Resolve city list
    if body.region:
        region_map = {r.lower(): cities for r, cities in NIGERIAN_STATES.items()}
        cities = region_map.get(body.region.lower())
        if not cities:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown region. Valid regions: {list(NIGERIAN_STATES.keys())}",
            )
    else:
        cities = body.cities  # None = all cities in scraper

    try:
        result = await scrape_multiple_cities(
            category=body.category,
            cities=cities,
            max_per_city=body.max_per_city,
            delay_secs=body.delay_secs,
        )
        return BatchScrapeResponse(
            **result,
            message=(
                f"Batch complete. {result['new']} new leads across "
                f"{result['cities_run']} cities. "
                f"{len(result['cities_failed'])} cities failed."
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        await log.warn("BATCH_SCRAPE_ERROR", metadata={"error": str(e)})
        raise HTTPException(status_code=500, detail="Batch scrape failed.")


@router.get("/scrape/presets")
async def get_presets():
    """Return preset categories, all 36 states, zones, and area drilldowns."""
    return {
        "categories":  PRESET_CATEGORIES,
        "states":      ALL_STATES,                          # flat list for single-state picker
        "zones":       NIGERIAN_STATES,                     # grouped by geopolitical zone for batch
        "lagos_areas": LAGOS_AREAS,                         # drilldown for Lagos
        "abuja_areas": ABUJA_AREAS,                         # drilldown for Abuja
    }