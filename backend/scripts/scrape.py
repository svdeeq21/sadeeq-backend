#!/usr/bin/env python3
# scripts/scrape.py
#
# CLI backup scraper — run from your terminal when you want to
# fill the leads table without opening the frontend.
#
# Usage:
#   python scripts/scrape.py --category pharmacy
#   python scripts/scrape.py --category bakery --cities "Lagos,Abuja,Kano"
#   python scripts/scrape.py --category restaurant --region "South West"
#   python scripts/scrape.py --category clinic --all-cities
#   python scripts/scrape.py --list-cities
#   python scripts/scrape.py --list-categories
#
# Setup (one time):
#   1. Copy .env.local.example → .env and fill in your keys
#   2. pip install python-dotenv httpx supabase
#   3. Run: python scripts/scrape.py --category pharmacy

import argparse
import asyncio
import os
import sys

# ── Load env vars from .env file if present ───────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv optional — env vars can be set directly in shell

# ── Validate required env vars ────────────────────────────────────
REQUIRED = ["SERPAPI_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
missing = [k for k in REQUIRED if not os.environ.get(k)]
if missing:
    print(f"\n❌  Missing environment variables: {', '.join(missing)}")
    print("    Set them in your shell or create a .env file in the project root.\n")
    sys.exit(1)

# ── Import scraper (after env is set) ────────────────────────────
# Add project root to path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.scraper import (
    scrape_and_insert,
    scrape_multiple_cities,
    NIGERIAN_CITIES,
    ALL_CITIES,
)

PRESET_CATEGORIES = [
    "pharmacy", "bakery", "restaurant", "supermarket", "clinic",
    "hospital", "school", "real estate agency", "logistics company",
    "salon", "gym", "hotel", "boutique", "car wash", "printing press",
    "event planner", "catering service", "fashion designer",
    "law firm", "accounting firm",
]


# ── CLI ───────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Svdeeq Lead Scraper — pulls businesses from Google Maps into Supabase",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Scrape pharmacies across all Nigerian cities
  python scripts/scrape.py --category pharmacy --all-cities

  # Scrape bakeries in specific cities only
  python scripts/scrape.py --category bakery --cities "Lagos,Abuja,Kano"

  # Scrape restaurants in South West region only
  python scripts/scrape.py --category restaurant --region "South West"

  # Single city scrape
  python scripts/scrape.py --category clinic --city "Port Harcourt"

  # List all available cities
  python scripts/scrape.py --list-cities

  # List preset categories
  python scripts/scrape.py --list-categories
        """,
    )
    p.add_argument("--category",        type=str, help="Business category to search")
    p.add_argument("--city",            type=str, help="Single city to scrape")
    p.add_argument("--cities",          type=str, help="Comma-separated list of cities")
    p.add_argument("--region",          type=str, help="Nigerian region (e.g. 'South West')")
    p.add_argument("--all-cities",      action="store_true", help="Scrape all Nigerian cities")
    p.add_argument("--max-per-city",    type=int, default=20, help="Max results per city (default: 20)")
    p.add_argument("--delay",           type=float, default=2.0, help="Seconds between city calls (default: 2)")
    p.add_argument("--list-cities",     action="store_true", help="Print all available cities and exit")
    p.add_argument("--list-categories", action="store_true", help="Print preset categories and exit")
    return p


async def main():
    parser = build_parser()
    args   = parser.parse_args()

    # ── Info commands ─────────────────────────────────────────────
    if args.list_cities:
        print("\n📍 Available Nigerian Cities:\n")
        for region, cities in NIGERIAN_CITIES.items():
            print(f"  {region}:")
            for city in cities:
                print(f"    - {city}")
        print()
        return

    if args.list_categories:
        print("\n🏢 Preset Categories:\n")
        for cat in PRESET_CATEGORIES:
            print(f"  - {cat}")
        print()
        return

    # ── Require category for scraping ────────────────────────────
    if not args.category:
        parser.print_help()
        print("\n❌  --category is required for scraping.\n")
        sys.exit(1)

    category = args.category.strip()

    # ── Determine target cities ───────────────────────────────────
    if args.all_cities:
        cities = ALL_CITIES
        mode   = f"all {len(cities)} cities"

    elif args.cities:
        cities = [c.strip() for c in args.cities.split(",") if c.strip()]
        mode   = f"{len(cities)} cities"

    elif args.region:
        region_map = {r.lower(): cities for r, cities in NIGERIAN_CITIES.items()}
        cities = region_map.get(args.region.lower())
        if not cities:
            print(f"\n❌  Unknown region: '{args.region}'")
            print(f"    Available: {', '.join(NIGERIAN_CITIES.keys())}\n")
            sys.exit(1)
        mode = f"{args.region} region ({len(cities)} cities)"

    elif args.city:
        # Single city — use scrape_and_insert directly
        city = args.city.strip()
        if "Nigeria" not in city:
            city = f"{city}, Nigeria"
        print(f"\n🗺  Scraping '{category}' in {city}…\n")
        result = await scrape_and_insert(
            category=category,
            location=city,
            max_results=args.max_per_city,
        )
        _print_single_result(result, city)
        return

    else:
        # Default: Abuja only
        cities = ["Abuja, Nigeria"]
        mode   = "Abuja (default)"

    # ── Multi-city batch scrape ───────────────────────────────────
    print(f"\n🗺  Scraping '{category}' across {mode}")
    print(f"   Max {args.max_per_city} results per city · {args.delay}s delay\n")
    print("─" * 55)

    result = await scrape_multiple_cities(
        category=category,
        cities=cities,
        max_per_city=args.max_per_city,
        delay_secs=args.delay,
    )

    # ── Summary ───────────────────────────────────────────────────
    print("─" * 55)
    print(f"\n✅  Done!\n")
    print(f"   Category:       {result['category']}")
    print(f"   Cities run:     {result['cities_run']}")
    print(f"   Found on Maps:  {result['scraped']}")
    print(f"   New leads:      {result['new']}")
    print(f"   Duplicates:     {result['skipped']}")
    if result["cities_failed"]:
        print(f"   Failed cities:  {', '.join(result['cities_failed'])}")
    print()


def _print_single_result(result: dict, city: str):
    print(f"   Found on Maps:  {result['scraped']}")
    print(f"   New leads:      {result['new']}")
    print(f"   Duplicates:     {result['skipped']}")
    if result.get("leads"):
        print(f"\n   Sample leads added:")
        for lead in result["leads"]:
            print(f"   · {lead['name']} — {lead['phone_number']}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
