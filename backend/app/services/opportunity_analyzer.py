# svdeeq-backend/app/services/opportunity_analyzer.py
#
# AI Opportunity Analyzer
#
# For every new lead, before the first message goes out:
#   1. Maps their industry to known operational bottlenecks
#   2. Asks the LLM to generate specific automation suggestions
#   3. Generates a personalized opening hypothesis for the bot
#   4. Saves everything to the leads table in Supabase
#
# This means when a lead replies, the bot already knows:
#   - What their likely pain point is
#   - What automation solution to pitch
#   - What question to ask first (based on the hypothesis)

import json
from uuid import UUID
from app.core.supabase import get_supabase
from app.core.config import get_settings
from app.utils.logger import log

settings = get_settings()

# ── Industry → Known Pain Points ─────────────────────────────
#
# Manually curated map of industry → common operational bottlenecks.
# The LLM uses this as a starting hypothesis before generating
# more specific suggestions.

INDUSTRY_PROFILES: dict[str, dict] = {
    # Food & Beverage
    "bakery": {
        "bottlenecks": ["manual order collection via WhatsApp", "no order confirmation system", "tracking payments manually", "managing peak-period demand"],
        "hypothesis":  "they likely receive orders through WhatsApp messages and track them manually, especially during busy periods",
        "opening_hook": "how they currently manage incoming orders",
    },
    "restaurant": {
        "bottlenecks": ["high volume of customer inquiries", "manual reservation management", "no automated menu responses", "slow order confirmation"],
        "hypothesis":  "they probably handle reservations and menu inquiries manually and struggle during peak hours",
        "opening_hook": "how they handle customer inquiries and reservations",
    },
    "food": {
        "bottlenecks": ["manual order tracking", "customer follow-ups", "inventory management", "delivery coordination"],
        "hypothesis":  "they likely manage orders and deliveries manually with no automated system",
        "opening_hook": "their biggest challenge managing orders and customer communication",
    },
    "catering": {
        "bottlenecks": ["event booking management", "client communication", "payment tracking", "staff coordination"],
        "hypothesis":  "they probably manage event bookings and client communication manually",
        "opening_hook": "how they handle event bookings and client follow-ups",
    },

    # Retail & E-commerce
    "retail": {
        "bottlenecks": ["customer inquiry volume", "inventory tracking", "order status updates", "abandoned cart recovery"],
        "hypothesis":  "they likely deal with high customer inquiry volume and manual inventory updates",
        "opening_hook": "how they handle customer inquiries and stock management",
    },
    "fashion": {
        "bottlenecks": ["product inquiry responses", "size availability questions", "order tracking", "return handling"],
        "hypothesis":  "they probably spend a lot of time answering repetitive product and availability questions",
        "opening_hook": "how much time they spend responding to product inquiries",
    },
    "pharmacy": {
        "bottlenecks": ["prescription inquiry handling", "stock availability questions", "pricing inquiries", "customer reminders"],
        "hypothesis":  "they likely handle many repetitive stock and pricing inquiries manually",
        "opening_hook": "how they manage customer inquiries and stock tracking",
    },
    "supermarket": {
        "bottlenecks": ["customer price inquiries", "stock management", "delivery coordination", "promotional communication"],
        "hypothesis":  "they probably deal with high volumes of repetitive customer inquiries",
        "opening_hook": "how they handle customer inquiries and promotions",
    },

    # Health & Wellness
    "clinic": {
        "bottlenecks": ["appointment scheduling", "patient reminders", "follow-up management", "medical record queries"],
        "hypothesis":  "they likely manage appointments manually and miss follow-up reminders",
        "opening_hook": "how they currently handle appointment scheduling and patient reminders",
    },
    "hospital": {
        "bottlenecks": ["appointment booking", "patient triage queries", "department routing", "billing inquiries"],
        "hypothesis":  "they probably have high inquiry volume across multiple departments with manual routing",
        "opening_hook": "their biggest challenge managing patient inquiries and appointments",
    },
    "gym": {
        "bottlenecks": ["membership inquiries", "class scheduling", "payment reminders", "trainer booking"],
        "hypothesis":  "they likely handle membership and class booking inquiries manually",
        "opening_hook": "how they manage class bookings and membership inquiries",
    },
    "spa": {
        "bottlenecks": ["appointment booking", "service inquiries", "reminder messages", "no-show management"],
        "hypothesis":  "they probably deal with appointment no-shows and manual booking management",
        "opening_hook": "how they handle bookings and reduce no-shows",
    },

    # Professional Services
    "law": {
        "bottlenecks": ["initial client qualification", "document collection", "case status inquiries", "appointment scheduling"],
        "hypothesis":  "they likely spend time on initial consultations that could be pre-qualified",
        "opening_hook": "how they handle initial client inquiries and qualification",
    },
    "accounting": {
        "bottlenecks": ["document collection", "deadline reminders", "client status updates", "repetitive tax queries"],
        "hypothesis":  "they probably spend time chasing clients for documents and answering repetitive questions",
        "opening_hook": "how they manage document collection and client communication",
    },
    "consulting": {
        "bottlenecks": ["lead qualification", "proposal follow-ups", "client onboarding", "project status updates"],
        "hypothesis":  "they likely struggle with lead qualification and consistent follow-up",
        "opening_hook": "how they qualify leads and follow up on proposals",
    },
    "insurance": {
        "bottlenecks": ["quote generation", "policy inquiries", "claims status updates", "renewal reminders"],
        "hypothesis":  "they probably handle many repetitive policy and claims inquiries manually",
        "opening_hook": "how they handle policy inquiries and renewal reminders",
    },

    # Real Estate
    "real estate": {
        "bottlenecks": ["high volume of unqualified inquiries", "property viewing scheduling", "follow-up on interested buyers", "document collection"],
        "hypothesis":  "they likely deal with many unqualified property inquiries that waste time",
        "opening_hook": "how they qualify property inquiries and schedule viewings",
    },
    "property": {
        "bottlenecks": ["tenant inquiries", "maintenance request handling", "payment reminders", "vacancy marketing"],
        "hypothesis":  "they probably manage tenant communication and maintenance requests manually",
        "opening_hook": "how they handle tenant inquiries and maintenance requests",
    },

    # Education
    "school": {
        "bottlenecks": ["parent inquiry handling", "enrollment processing", "fee payment reminders", "event notifications"],
        "hypothesis":  "they likely spend a lot of time on parent inquiries and manual fee reminders",
        "opening_hook": "how they handle parent inquiries and fee collection",
    },
    "university": {
        "bottlenecks": ["student inquiry routing", "admission processing", "exam schedule queries", "department communication"],
        "hypothesis":  "they probably deal with high volume student inquiries across many departments",
        "opening_hook": "how they manage student inquiries and information routing",
    },
    "tutoring": {
        "bottlenecks": ["session booking", "student progress tracking", "payment collection", "parent communication"],
        "hypothesis":  "they likely manage sessions and parent communication manually",
        "opening_hook": "how they handle session bookings and parent updates",
    },

    # Logistics & Transport
    "logistics": {
        "bottlenecks": ["shipment status inquiries", "driver coordination", "delivery confirmation", "customer notifications"],
        "hypothesis":  "they probably handle many repetitive shipment status inquiries manually",
        "opening_hook": "how they manage shipment inquiries and customer notifications",
    },
    "transport": {
        "bottlenecks": ["booking management", "driver assignment", "route optimization", "customer notifications"],
        "hypothesis":  "they likely manage bookings and driver assignments manually",
        "opening_hook": "how they handle bookings and coordinate drivers",
    },

    # Agriculture
    "farm": {
        "bottlenecks": ["produce order management", "buyer communication", "market price updates", "logistics coordination"],
        "hypothesis":  "they probably manage produce orders and buyer communication manually",
        "opening_hook": "how they handle produce orders and buyer communication",
    },
    "agriculture": {
        "bottlenecks": ["supply chain communication", "order tracking", "payment collection", "market access"],
        "hypothesis":  "they likely struggle with connecting to buyers and managing orders efficiently",
        "opening_hook": "their biggest challenge managing orders and buyer relationships",
    },

    # General fallback
    "default": {
        "bottlenecks": ["manual customer communication", "repetitive inquiry handling", "follow-up management", "data tracking"],
        "hypothesis":  "they likely spend significant time on manual communication and follow-up tasks",
        "opening_hook": "their most time-consuming daily task",
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
    if any(w in low for w in ["food", "eat", "cafe", "snack", "sweet", "candy", "bake"]):
        return INDUSTRY_PROFILES["bakery"]
    if any(w in low for w in ["health", "medical", "doctor", "nurse", "pharma"]):
        return INDUSTRY_PROFILES["clinic"]
    if any(w in low for w in ["sell", "shop", "store", "market", "vendor"]):
        return INDUSTRY_PROFILES["retail"]
    if any(w in low for w in ["teach", "learn", "educat", "train", "coach"]):
        return INDUSTRY_PROFILES["school"]
    if any(w in low for w in ["deliver", "ship", "courier", "cargo", "freight"]):
        return INDUSTRY_PROFILES["logistics"]
    if any(w in low for w in ["house", "land", "plot", "estate", "apartment", "rent"]):
        return INDUSTRY_PROFILES["real estate"]

    return INDUSTRY_PROFILES["default"]


async def analyze_lead(lead: dict) -> dict:
    """
    Main entry point. Generates a full opportunity analysis for a lead.

    Returns:
      {
        "pain_point": str,               # Most likely pain point
        "suggested_solutions": [str],    # List of automation ideas
        "opportunity_analysis": str,     # Full narrative analysis
        "industry_opening_variant": str, # Personalized first message hypothesis
      }
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

    prompt = f"""You are building sales intelligence for a business consultant.

Business: {business_name}{loc_str}
Industry: {industry}
Owner first name: {first_name}

Likely pain points for this industry:
{bottlenecks_str}

Respond ONLY with valid JSON. Use outcome language throughout — what the business GETS, not what a system DOES.

{{
  "pain_point": "One sentence in plain human language describing what this business is probably losing or struggling with right now. E.g. 'Customers asking about drug availability on WhatsApp often wait too long and go elsewhere.' No tech jargon.",
  "suggested_solutions": [
    "What the business experiences after the solution — not the feature. E.g. 'Customers get instant answers to availability and pricing questions on WhatsApp without any staff involvement.'",
    "Second outcome from a different angle — e.g. 'Orders during busy periods are captured and confirmed automatically so nothing is missed.'",
    "Third outcome — e.g. 'Staff stop spending hours on repetitive WhatsApp messages and focus on work that needs a human.'"
  ],
  "opportunity_analysis": "2-3 sentences on WHY this business is a strong fit. Focus on the gap between their current manual process and what is possible. Speak in their language — not tech language.",
  "industry_opening_variant": "One WhatsApp cold opening message. STRICT RULES: (1) Do NOT mention Sadiq, AI, or automation. (2) Start with observation/proximity language — e.g. 'I've been looking into how [industry] businesses handle...' or 'I came across {business_name}...' — NOT 'most businesses'. (3) Ask ONE easy conversational question about their situation — aim for a natural reply like 'yeah we do' not a yes/no survey. (4) Soft tone — not accusatory. Example: 'Hi {first_name}, I've been looking into how pharmacies handle customer requests on WhatsApp — quick one, do people usually wait a while before getting a reply at {business_name}?' Max 2 sentences, under 40 words. Sound like a real human who noticed something specific."
}}

EXAMPLES OF GOOD VS BAD LANGUAGE:
Bad pain_point: "Manual order management inefficiency"
Good pain_point: "During busy periods, orders come in faster than staff can reply and some customers don't wait"

Bad solution: "AI chatbot for order automation"
Good solution: "Every WhatsApp order is automatically received, confirmed, and logged — even during rush hours when staff are overwhelmed"

Bad opening: "Hi, Sadiq builds AI systems that help businesses automate workflows."
Good opening: "Most food businesses lose orders during busy periods because customers don't get a fast enough reply — is that something that happens at {business_name}?"

Valid JSON only. No markdown, no preamble."""

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
    """Fallback when LLM is unavailable. Uses the industry profile directly."""
    bottleneck = profile["bottlenecks"][0]
    solutions = [
        f"Automate {profile['bottlenecks'][0]} using an AI WhatsApp assistant",
        f"Build a system to handle {profile['bottlenecks'][1]} without manual effort",
        f"Create automated follow-up sequences to manage {profile['bottlenecks'][2]}",
    ]
    # Outcome-led solutions — what they GET, not what the system DOES
    solutions = [
        f"Customers get instant replies to {profile['bottlenecks'][0]} without staff being involved",
        f"Staff stop spending hours on {profile['bottlenecks'][1]} and focus on work that needs a human",
        f"Nothing falls through the cracks during busy periods when {profile['bottlenecks'][2]} spikes",
    ]

    return {
        "pain_point": (
            f"During busy periods, {profile['bottlenecks'][0]} piles up faster than staff can handle it "
            f"— some customers don't wait and go elsewhere."
        ),
        "suggested_solutions": solutions,
        "opportunity_analysis": (
            f"{business_name} is dealing with the same challenge most {industry or 'businesses'} face — "
            f"{profile['bottlenecks'][0]} handled manually means slower responses, missed opportunities, "
            f"and staff time spent on repetitive work instead of what actually grows the business."
        ),
        "industry_opening_variant": (
            f"I've been looking into how {industry or 'businesses like yours'} handle "
            f"{profile['opening_hook']} — "
            f"does that ever get hard to keep up with at {business_name}?"
        ),
    }


async def run_and_save(lead: dict) -> bool:
    """
    Run the analyzer for a lead and save results to Supabase.
    Called before first outreach message is sent.
    Returns True if analysis was saved successfully.
    """
    lead_id = lead.get("id")
    if not lead_id:
        return False

    # Skip if already analyzed
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
