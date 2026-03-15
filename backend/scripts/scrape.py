#!/usr/bin/env python3
# scripts/scrape.py
#
# CLI backup scraper — run from your terminal when you want to
# fill the leads table without opening the frontend.
#
# Usage:
#   python scripts/scrape.py --category pharmacy
#   python scripts/scrape.py --category bakery --states "Lagos,Abuja,Kano"
#   python scripts/scrape.py --category restaurant --region "South West"
#   python scripts/scrape.py --category clinic --all-states
#   python scripts/scrape.py --list-states
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
    scrape_multiple_states,
    NIGERIAN_STATES,
    ALL_STATES,
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
  # Scrape pharmacies across all Nigerian states
  python scripts/scrape.py --category pharmacy --all-states

  # Scrape bakeries in specific states only
  python scripts/scrape.py --category bakery --states "Lagos,Abuja,Kano"

  # Scrape restaurants in South West region only
  python scripts/scrape.py --category restaurant --region "South West"

  # Single state scrape
  python scripts/scrape.py --category clinic --state "Port Harcourt"

  # List all available states
  python scripts/scrape.py --list-states

  # List preset categories
  python scripts/scrape.py --list-categories
        """,
    )
    p.add_argument("--category",        type=str, help="Business category to search")
    p.add_argument("--state",            type=str, help="Single state to scrape")
    p.add_argument("--states",          type=str, help="Comma-separated list of states")
    p.add_argument("--region",          type=str, help="Nigerian region (e.g. 'South West')")
    p.add_argument("--all-states",      action="store_true", help="Scrape all Nigerian states")
    p.add_argument("--max-per-state",    type=int, default=20, help="Max results per state (default: 20)")
    p.add_argument("--delay",           type=float, default=2.0, help="Seconds between state calls (default: 2)")
    p.add_argument("--list-states",     action="store_true", help="Print all available states and exit")
    p.add_argument("--list-categories", action="store_true", help="Print preset categories and exit")
    return p


async def main():
    parser = build_parser()
    args   = parser.parse_args()

    # ── Info commands ─────────────────────────────────────────────
    if args.list_states:
        print("\n📍 Available Nigerian Cities:\n")
        for region, states in NIGERIAN_STATES.items():
            print(f"  {region}:")
            for state in states:
                print(f"    - {state}")
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

    # ── Determine target states ───────────────────────────────────
    if args.all_states:
        states = ALL_STATES
        mode   = f"all {len(states)} states"

    elif args.states:
        states = [c.strip() for c in args.states.split(",") if c.strip()]
        mode   = f"{len(states)} states"

    elif args.region:
        region_map = {r.lower(): states for r, states in NIGERIAN_STATES.items()}
        states = region_map.get(args.region.lower())
        if not states:
            print(f"\n❌  Unknown region: '{args.region}'")
            print(f"    Available: {', '.join(NIGERIAN_STATES.keys())}\n")
            sys.exit(1)
        mode = f"{args.region} region ({len(states)} states)"

    elif args.state:
        # Single state — use scrape_and_insert directly
        state = args.state.strip()
        if "Nigeria" not in state:
            state = f"{state}, Nigeria"
        print(f"\n🗺  Scraping '{category}' in {state}…\n")
        result = await scrape_and_insert(
            category=category,
            location=state,
            max_results=args.max_per_city,
        )
        _print_single_result(result, state)
        return

    else:
        # Default: Abuja only
        states = ["Abuja, Nigeria"]
        mode   = "Abuja (default)"

    # ── Multi-state batch scrape ───────────────────────────────────
    print(f"\n🗺  Scraping '{category}' across {mode}")
    print(f"   Max {args.max_per_city} results per state · {args.delay}s delay\n")
    print("─" * 55)

    result = await scrape_multiple_states(
        category=category,
        states=states,
        max_per_city=args.max_per_city,
        delay_secs=args.delay,
    )

    # ── Summary ───────────────────────────────────────────────────
    print("─" * 55)
    print(f"\n✅  Done!\n")
    print(f"   Category:       {result['category']}")
    print(f"   Cities run:     {result['states_run']}")
    print(f"   Found on Maps:  {result['scraped']}")
    print(f"   New leads:      {result['new']}")
    print(f"   Duplicates:     {result['skipped']}")
    if result["states_failed"]:
        print(f"   Failed states:  {', '.join(result['states_failed'])}")
    print()


def _print_single_result(result: dict, state: str):
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