# svdeeq-backend/app/services/opportunity_analyzer.py
#
# Hooze Enterprises - AI Opportunity Analyzer (v7 - Grand Slam Edition)
#
# For every new lead, before the first message goes out:
#   1. Maps their industry to lost time/revenue bottlenecks
#   2. Asks the LLM to generate outcome-focused system suggestions
#   3. Generates a personalized, low-friction opening hypothesis
#   4. Saves everything to the leads table in Supabase
#
# This feeds the C.L.O.S.E.R. engine with the exact angle needed to pitch.

import json
from uuid import UUID
from app.core.supabase import get_supabase
from app.core.config import get_settings
from app.utils.logger import log

settings = get_settings()

# ── Industry → The "Invisible Money" Bottlenecks ─────────────────────────────
#
# Instead of mapping to "lack of automation", we map to lost time and lost revenue.

INDUSTRY_PROFILES: dict[str, dict] = {
    # Food & Beverage
    "bakery": {
        "bottlenecks": ["losing orders during rush hours because staff can't reply fast enough", "wasting hours manually confirming payments", "abandoned carts from slow replies"],
        "opening_hook": "how they manage to not lose orders when things get crazy busy",
    },
    "restaurant": {
        "bottlenecks": ["staff ignoring the phone/WhatsApp during peak hours", "losing walk-ins because reservations aren't captured instantly", "wasting time answering 'what's on the menu'"],
        "opening_hook": "how they handle reservations and inquiries when the floor is packed",
    },
    "food": {
        "bottlenecks": ["missed deliveries due to manual tracking", "customers getting angry about slow updates", "staff tied up taking orders instead of working"],
        "opening_hook": "how they stop orders from falling through the cracks",
    },
    "catering": {
        "bottlenecks": ["wasting hours going back and forth on event quotes", "losing high-ticket bookings to caterers who reply faster", "chasing manual payments"],
        "opening_hook": "how much time they spend manually doing quotes and event bookings",
    },

    # Retail & E-commerce
    "retail": {
        "bottlenecks": ["paying staff to answer the same 'do you have this in size M' questions all day", "losing impulse buyers because replies take hours", "zero abandoned cart follow-up"],
        "opening_hook": "how they handle the flood of repetitive product questions",
    },
    "fashion": {
        "bottlenecks": ["hours wasted on sizing and availability questions", "losing sales because customers don't wait for a reply", "no system to re-engage past buyers"],
        "opening_hook": "how much time their team wastes answering sizing questions",
    },
    "pharmacy": {
        "bottlenecks": ["pharmacists wasting time answering 'do you have this drug' on WhatsApp", "losing sales to pharmacies down the street who reply faster", "no automated refill reminders"],
        "opening_hook": "how they manage constant stock inquiries without distracting the pharmacists",
    },
    "supermarket": {
        "bottlenecks": ["wasting time on pricing inquiries", "no digital system to push promotions to local buyers", "poor customer support routing"],
        "opening_hook": "how they handle customer inquiries without tying up floor staff",
    },

    # Health & Wellness
    "clinic": {
        "bottlenecks": ["receptionists overwhelmed with calls", "losing money on no-shows because there are no automated reminders", "patients frustrated by long wait times to book"],
        "opening_hook": "how they handle booking inquiries and stop no-shows",
    },
    "hospital": {
        "bottlenecks": ["chaotic patient routing", "admin staff bogged down with basic triage questions", "billing confusion leading to delayed payments"],
        "opening_hook": "their biggest bottleneck in routing patient inquiries efficiently",
    },
    "gym": {
        "bottlenecks": ["losing trial memberships because follow-ups don't happen instantly", "chasing monthly payments manually", "trainers wasting time scheduling instead of training"],
        "opening_hook": "how they capture and follow up with new membership inquiries",
    },
    "spa": {
        "bottlenecks": ["empty slots due to manual booking friction", "lost revenue from no-shows", "spending hours confirming appointments by hand"],
        "opening_hook": "how they keep their calendar full and handle no-shows",
    },

    # Professional Services
    "law": {
        "bottlenecks": ["highly paid lawyers wasting time on unqualified leads", "hours spent chasing clients for basic documents", "clients constantly asking for case updates"],
        "opening_hook": "how much time they waste doing initial consultations with unqualified leads",
    },
    "accounting": {
        "bottlenecks": ["chasing clients for receipts and documents every month", "answering the same basic tax questions", "missing deadlines due to manual tracking"],
        "opening_hook": "how they manage to collect client documents without chasing them constantly",
    },
    "consulting": {
        "bottlenecks": ["leads going cold because follow-up isn't systematized", "spending hours on proposals for tire-kickers", "inconsistent client onboarding"],
        "opening_hook": "how they qualify leads before jumping on a consultation call",
    },
    "insurance": {
        "bottlenecks": ["agents wasting time on basic policy questions", "losing renewals because reminders aren't automated", "slow quote generation losing the deal"],
        "opening_hook": "how they handle basic policy questions and renewal reminders",
    },

    # Real Estate
    "real estate": {
        "bottlenecks": ["agents wasting weekends showing houses to unqualified tire-kickers", "leads going cold because they weren't captured instantly", "manual document chasing"],
        "opening_hook": "how they filter out tire-kickers before scheduling property viewings",
    },
    "property": {
        "bottlenecks": ["tenant maintenance requests getting lost in WhatsApp", "chasing rent manually", "vacancies sitting too long due to poor lead capture"],
        "opening_hook": "how they handle tenant complaints and maintenance requests efficiently",
    },

    # Education
    "school": {
        "bottlenecks": ["admin staff wasting hours answering the same admission questions", "chasing parents for school fees manually", "chaotic event notifications"],
        "opening_hook": "how much time their admin spends answering repetitive admission questions",
    },
    "university": {
        "bottlenecks": ["students getting frustrated by slow replies from departments", "admission teams overwhelmed by inquiry volume", "lost documents"],
        "opening_hook": "how they route massive volumes of student inquiries to the right departments",
    },
    "tutoring": {
        "bottlenecks": ["wasting time scheduling and rescheduling sessions", "chasing parents for payments", "no automated progress reports"],
        "opening_hook": "how they handle session scheduling without going back and forth",
    },

    # Logistics & Transport
    "logistics": {
        "bottlenecks": ["customer support tied up answering 'where is my package'", "dispatchers overwhelmed coordinating drivers", "lost proof of deliveries"],
        "opening_hook": "how they handle the constant 'where is my package' questions",
    },
    "transport": {
        "bottlenecks": ["manual booking causing double bookings", "drivers waiting around because of poor coordination", "customers frustrated by no updates"],
        "opening_hook": "how they handle bookings and driver dispatch during peak times",
    },

    # Agriculture
    "farm": {
        "bottlenecks": ["produce spoiling because buyers aren't secured fast enough", "managing logistics and orders manually", "chasing payments from distributors"],
        "opening_hook": "how they manage buyer orders and logistics efficiently",
    },
    "agriculture": {
        "bottlenecks": ["inefficient supply chain tracking", "losing out on market prices due to slow communication", "manual order taking"],
        "opening_hook": "their biggest challenge managing the supply chain and buyer orders",
    },

    # General fallback
    "default": {
        "bottlenecks": ["losing customers to competitors who reply faster", "staff tied up doing manual data entry instead of revenue-generating work", "leads falling through the cracks"],
        "opening_hook": "what their most time-consuming operational bottleneck is",
    },
}

def _match_industry(industry: str | None) -> dict:
    """Match industry string to a profile. Fuzzy — checks for keywords."""
    if not industry:
        return INDUSTRY_PROFILES["default"]

    low = industry.lower()
    for key in INDUSTRY_PROFILES:
        if key in low:
            return INDUSTRY_PROFILES[key]

    # Broader fuzzy match
    if any(w in low for w in ["food", "eat", "cafe", "snack", "sweet", "candy", "bake", "pizza"]):
        return INDUSTRY_PROFILES["bakery"]
    if any(w in low for w in ["health", "medical", "doctor", "nurse", "pharma", "dentist"]):
        return INDUSTRY_PROFILES["clinic"]
    if any(w in low for w in ["sell", "shop", "store", "market", "vendor", "clothing"]):
        return INDUSTRY_PROFILES["retail"]
    if any(w in low for w in ["teach", "learn", "educat", "train", "coach", "course"]):
        return INDUSTRY_PROFILES["school"]
    if any(w in low for w in ["deliver", "ship", "courier", "cargo", "freight", "truck"]):
        return INDUSTRY_PROFILES["logistics"]
    if any(w in low for w in ["house", "land", "plot", "estate", "apartment", "rent", "broker"]):
        return INDUSTRY_PROFILES["real estate"]

    return INDUSTRY_PROFILES["default"]


async def analyze_lead(lead: dict) -> dict:
    """
    Main entry point. Generates a full opportunity analysis for a lead.
    """
    name          = lead.get("name") or "the business owner"
    first_name    = name.split()[0]
    business_name = lead.get("business_name") or "their business"
    industry      = lead.get("industry") or ""
    location      = lead.get("location") or ""

    profile = _match_industry(industry)

    # ── Try LLM for richer analysis ──────────────────────────
    try:
        analysis = await _llm_analyze(
            first_name=first_name,
            business_name=business_name,
            industry=industry or "business",
            location=location,
            profile=profile,
        )
    except Exception as e:
        await log.warn("ANALYZER_LLM_FAILED", metadata={"error": str(e), "lead": lead.get("id")})
        # Fall back to rule-based analysis
        analysis = _rule_based_analysis(business_name, industry, profile)

    return analysis


async def _llm_analyze(
    first_name: str,
    business_name: str,
    industry: str,
    location: str,
    profile: dict,
) -> dict:
    """Ask the LLM to generate a specific analysis for this business."""
    from google import genai

    client = genai.Client(api_key=settings.gemini_api_key)

    bottlenecks_str = "\n".join(f"- {b}" for b in profile["bottlenecks"])
    loc_str = f" in {location}" if location else ""

    prompt = f"""You are an elite sales strategist for Hooze Enterprises, a high-end tech agency that builds automated systems (Websites, n8n workflows, AI bots) to buy back time and increase revenue for businesses.

Business: {business_name}{loc_str}
Industry: {industry}
Owner first name: {first_name}

Likely revenue/time leaks for this industry:
{bottlenecks_str}

Respond ONLY with valid JSON. Use outcome language throughout — what the business GETS, not the tech stack they use. No tech jargon (no 'API', 'n8n', 'LLM').

{{
  "pain_point": "One sentence describing the invisible money or time this business is losing right now. E.g. 'During rush hour, customers asking about availability are waiting too long and going to competitors.'",
  "suggested_solutions": [
    "What the business experiences after the system is built. E.g. 'Customers get instant answers 24/7 without staff lifting a finger.'",
    "Second outcome from a different angle — e.g. 'All data entry between their apps happens automatically in the background, saving 15 hours a week.'",
    "Third outcome — e.g. 'Leads are captured and qualified instantly through a custom platform, stopping money from falling through the cracks.'"
  ],
  "opportunity_analysis": "2-3 sentences on WHY this business is a strong fit. Focus on the gap between their manual process and what our systems can do to scale their revenue. Speak like a high-level consultant.",
  "industry_opening_variant": "One cold opening message. STRICT RULES: (1) Do NOT mention Sadiq, AI, websites, or automation. (2) Start with observation language — e.g. 'I've been looking into how [industry] handle...' — NOT 'most businesses'. (3) Ask ONE conversational question about their bottleneck — aim for a natural reply. (4) Keep it casual. Example: 'Hi {first_name}, I've been looking into how pharmacies handle customer requests — quick one, do people usually get frustrated waiting for a reply during rush hour at {business_name}?' Max 2 sentences."
}}

Valid JSON only. No markdown fences. No preamble.
"""

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
    )

    text = response.text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    result = json.loads(text)

    # Validate required keys
    required = ["pain_point", "suggested_solutions", "opportunity_analysis", "industry_opening_variant"]
    for key in required:
        if key not in result:
            raise ValueError(f"Missing key in LLM response: {key}")

    return result


def _rule_based_analysis(business_name: str, industry: str, profile: dict) -> dict:
    """Fallback when LLM is unavailable. Uses the industry profile directly with high-ticket copy."""
    bottleneck = profile["bottlenecks"][0]
    
    # Outcome-led solutions
    solutions = [
        f"Customers get an instant, flawless experience 24/7, solving the issue of {profile['bottlenecks'][0]}",
        f"Staff get their time back instead of dealing with {profile['bottlenecks'][1]}",
        f"The business plugs the revenue leak caused by {profile['bottlenecks'][2]} using background systems",
    ]

    return {
        "pain_point": (
            f"They are likely losing revenue and burning staff time because {bottleneck}."
        ),
        "suggested_solutions": solutions,
        "opportunity_analysis": (
            f"{business_name} is operating with friction. By relying on manual effort for {industry or 'these'} tasks, "
            f"they are capping their own growth. A custom system would capture that lost revenue and free up their team."
        ),
        "industry_opening_variant": (
            f"I was looking at how {industry or 'local businesses'} handle "
            f"{profile['opening_hook']} — "
            f"does that ever become a bottleneck at {business_name}?"
        ),
    }


async def run_and_save(lead: dict) -> bool:
    """
    Run the analyzer for a lead and save results to Supabase.
    Called before first outreach message is sent.
    """
    lead_id = lead.get("id")
    if not lead_id:
        return False

    if lead.get("opportunity_analysis"):
        return True

    try:
        analysis = await analyze_lead(lead)

        db = get_supabase()
        from datetime import datetime, timezone

        db.table("leads").update({
            "pain_point":               analysis["pain_point"],
            "suggested_solutions":      analysis["suggested_solutions"],
            "opportunity_analysis":     analysis["opportunity_analysis"],
            "industry_opening_variant": analysis["industry_opening_variant"],
            "analysis_generated_at":    datetime.now(timezone.utc).isoformat(),
        }).eq("id", lead_id).execute()

        await log.info(
            "OPPORTUNITY_ANALYSIS_SAVED",
            lead_id=lead_id,
            metadata={
                "industry": lead.get("industry"),
                "pain_point_preview": analysis["pain_point"][:60],
            },
        )
        return True

    except Exception as e:
        await log.warn(
            "OPPORTUNITY_ANALYSIS_FAILED",
            lead_id=lead_id,
            metadata={"error": str(e)},
        )
        return False