# svdeeq-backend/app/services/rule_based.py
#
# Last-resort fallback when ALL LLM providers have failed.
# No API calls — pure keyword matching against a hardcoded FAQ.
#
# This is intentionally simple. Its only job is to keep the
# conversation alive and not leave the user with silence.
# If this fires, the admin has already been notified.

from __future__ import annotations


# ── FAQ rules ────────────────────────────────────────────────────
# Each rule has a list of trigger keywords and a response.
# Rules are checked in order — first match wins.
# Keywords are matched against the lowercased user message.

FAQ_RULES: list[dict] = [
    {
        "keywords": ["price", "cost", "how much", "pricing", "budget", "afford"],
        "response": (
            "Our properties range from AED 850,000 for a 1BR up to AED 3.5M+ for penthouses. "
            "I'd love to give you exact figures — our team will follow up with a full price list shortly."
        ),
    },
    {
        "keywords": ["location", "where", "area", "district", "neighbourhood", "community"],
        "response": (
            "We have properties in Dubai Marina, Downtown Dubai, and Business Bay. "
            "Each area has its own character — our team can help you find the best fit for your needs."
        ),
    },
    {
        "keywords": ["visit", "viewing", "see", "tour", "show", "appointment", "schedule"],
        "response": (
            "We'd be happy to arrange a site visit! "
            "Our team will reach out to confirm a convenient time for you."
        ),
    },
    {
        "keywords": ["payment", "installment", "mortgage", "finance", "loan", "bank"],
        "response": (
            "We offer flexible payment plans including 40/60 post-handover and 50/50 options. "
            "We also work with several banks for mortgage financing. Our finance team will be in touch."
        ),
    },
    {
        "keywords": ["bedroom", "1br", "2br", "3br", "studio", "penthouse", "apartment", "villa", "unit"],
        "response": (
            "We have a range of unit types available — studios, 1BR, 2BR, 3BR apartments, and penthouses. "
            "Let our team know your preference and we'll match you with available options."
        ),
    },
    {
        "keywords": ["ready", "handover", "move in", "available", "when"],
        "response": (
            "We have both ready-to-move-in units and off-plan options with Q3/Q4 handover dates. "
            "Our team will confirm the exact availability for your preferred unit type."
        ),
    },
    {
        "keywords": ["contact", "call", "speak", "talk", "agent", "human", "person", "team"],
        "response": (
            "Absolutely — I'll make sure one of our agents reaches out to you directly very shortly."
        ),
    },
    {
        "keywords": ["stop", "unsubscribe", "remove", "opt out", "no more"],
        "response": (
            "Understood — I'll make sure you're removed from our contact list immediately. "
            "You won't receive any further messages from us."
        ),
    },
    {
        "keywords": ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "salam", "salaam"],
        "response": (
            "Hello! Thanks for reaching out to Svdeeq Properties. "
            "Our team will be with you shortly to assist with your property enquiry."
        ),
    },
    {
        "keywords": ["thank", "thanks", "appreciated", "great", "perfect", "wonderful"],
        "response": (
            "You're very welcome! Our team will follow up with you shortly."
        ),
    },
]

# Default response when nothing matches
DEFAULT_RESPONSE = (
    "Thank you for your message. Our team is currently unavailable but will "
    "get back to you as soon as possible. We appreciate your patience."
)


def get_rule_based_response(message: str) -> str:
    """
    Matches the user message against FAQ rules using keyword search.
    Returns the first matching response, or the default if nothing matches.

    Always call this only after all LLM providers have failed.
    """
    lower = message.lower().strip()

    for rule in FAQ_RULES:
        if any(keyword in lower for keyword in rule["keywords"]):
            return rule["response"]

    return DEFAULT_RESPONSE
