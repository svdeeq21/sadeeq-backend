# =========================
# INTENT ENGINE v2 (ROBUST)
# =========================

import re

class IntentEngine:
    def __init__(self):
        # Order matters: higher priority first
        self.intent_priority = [
            "OBJECTION",
            "BUY_SIGNAL",
            "CLARIFICATION",
            "CONTEXT",
            "NEGATIVE",
            "AFFIRMATION",
            "NEUTRAL"
        ]

        # Patterns are deliberately overlapping — priority resolves conflicts
        self.intent_patterns = {
            "OBJECTION": [
                r"\b(not sure|don't think|won't work|not for me|too expensive|no budget|already have|we already use|we're fine|no need|later|maybe later)\b",
                r"\b(how do i know|what if|sounds risky|is this legit)\b",
                r"\b(my type of business|won't apply|different industry)\b"
            ],

            "BUY_SIGNAL": [
                r"\b(how much|price|cost|pricing)\b",
                r"\b(show me|let me see|how does it work|demo)\b",
                r"\b(i'm interested|this sounds good|i want this|let's do it)\b",
                r"\b(when can we start|how do we start)\b"
            ],

            "CLARIFICATION": [
                r"\b(what do you mean|how does that work|can you explain|i don't get it)\b",
                r"\b(what exactly|like how|in what way)\b"
            ],

            "CONTEXT": [
                r"\b(i run|we run|i have|we have|my business|our business)\b",
                r"\b(customers|clients|orders|messages|sales)\b"
            ],

            "NEGATIVE": [
                r"\b(no|nah|not really|don't want|not interested)\b"
            ],

            "AFFIRMATION": [
                r"\b(yes|yeah|yh|yep|true|exactly|right|makes sense)\b"
            ]
        }

    def detect_intent(self, message: str) -> dict:
        message_lower = message.lower()

        detected = []

        # Step 1: Match all possible intents
        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower):
                    detected.append(intent)
                    break  # avoid duplicate matches per intent

        # Step 2: Resolve priority
        for intent in self.intent_priority:
            if intent in detected:
                primary_intent = intent
                break
        else:
            primary_intent = "NEUTRAL"

        # Step 3: Extract useful signals
        signals = self.extract_signals(message_lower)

        return {
            "intent": primary_intent,
            "all_detected": detected,
            "signals": signals
        }

    def extract_signals(self, message: str) -> dict:
        return {
            "mentions_price": bool(re.search(r"\b(price|cost|how much)\b", message)),
            "mentions_time": bool(re.search(r"\b(when|how long|time)\b", message)),
            "mentions_business": bool(re.search(r"\b(business|customers|clients|orders)\b", message)),
            "skepticism": bool(re.search(r"\b(not sure|how do i know|what if)\b", message)),
            "urgency": bool(re.search(r"\b(now|asap|quickly|immediately)\b", message))
        }
    # ... inside your IntentEngine class ...
    def is_hard_exit(self, intent_data: dict) -> bool:
        # Check if the primary intent is NEGATIVE
        # You can expand this logic later
        return intent_data.get("intent") == "NEGATIVE"
    
    # bottom of intent_engine.py
# ... all your class code above ...

# 1. Create the single instance the app will use
engine = IntentEngine()

# 2. Map the module-level function calls to the class methods
def detect_intent(message: str) -> dict:
    return engine.detect_intent(message)

def is_hard_exit(intent_data: dict) -> bool:
    # IMPORTANT: Ensure this matches the method name in your class
    return engine.is_hard_exit(intent_data)

def get_canned_response(intent_data) -> str | None:
    """
    Returns a hardcoded reply for identity/source questions so we don't waste
    an LLM call. Returns None for everything else.
    """
    intent = intent_data.get("intent") if isinstance(intent_data, dict) else intent_data
    canned = {
        "WHO_ARE_YOU": "I'm Sadiq's assistant, reaching out on his behalf. He's an AI and software engineer who helps businesses automate and grow.",
        "ARE_YOU_AI":  "I'm a virtual assistant helping Sadiq manage his outreach. Sadiq himself will be on your call.",
        "HOW_DID_YOU_GET_MY_NUMBER": "We came across your business and thought there might be a good fit. Happy to stop if it's not a good time!",
    }
    return canned.get(intent)


def extract_lead_profile(messages: list) -> dict:
    """
    Scans conversation history and extracts structured profile data to
    prevent the bot from re-asking questions already answered.
    """
    profile = {
        "business_described": False,
        "problem_identified": False,
        "name_confirmed": None,
        "pain_point_text": None,
        "objections": [],
    }

    business_patterns = [
        r"\b(i run|we run|i have|we have|my business|our business|i own|we own)\b",
        r"\b(pharmacy|clinic|restaurant|shop|store|school|hotel|logistics|delivery)\b",
    ]
    problem_patterns = [
        r"\b(problem|issue|challenge|struggle|difficult|hard time|losing|miss)\b",
        r"\b(manual|by hand|slow|too busy|overwhelmed|no time|staff)\b",
    ]
    objection_patterns = [
        r"\b(too expensive|no budget|not sure|maybe later|need to think|not ready)\b",
        r"\b(already have|we use|don't need|not interested)\b",
    ]

    for m in messages:
        if m.get("sender") != "USER":
            continue
        text = (m.get("content") or "").lower()

        if any(re.search(p, text) for p in business_patterns):
            profile["business_described"] = True

        if any(re.search(p, text) for p in problem_patterns):
            profile["problem_identified"] = True
            if not profile["pain_point_text"]:
                profile["pain_point_text"] = m.get("content", "")[:200]

        for p in objection_patterns:
            if re.search(p, text):
                obj = m.get("content", "")[:100]
                if obj not in profile["objections"]:
                    profile["objections"].append(obj)

    return profile


def detect_bant_flags(messages: list) -> dict:
    """
    Detects Budget / Authority / Need / Timeline signals in conversation.
    """
    flags = {
        "has_budget_signal": False,
        "has_authority_signal": False,
        "has_need_signal": False,
        "has_timeline_signal": False,
    }

    for m in messages:
        if m.get("sender") != "USER":
            continue
        text = (m.get("content") or "").lower()

        if re.search(r"\b(budget|afford|spend|invest|price|cost|how much)\b", text):
            flags["has_budget_signal"] = True
        if re.search(r"\b(i decide|my decision|i'm the owner|i run|founder|ceo|director)\b", text):
            flags["has_authority_signal"] = True
        if re.search(r"\b(need|want|looking for|trying to|help with)\b", text):
            flags["has_need_signal"] = True
        if re.search(r"\b(soon|asap|this month|quickly|urgent|now)\b", text):
            flags["has_timeline_signal"] = True

    return flags


def is_call_confirmed(intent_data, message: str) -> bool:
    """
    Returns True only if the lead has genuinely confirmed a call.
    Used as a guardrail to prevent LLM from hallucinating bookings.
    """
    intent = intent_data.get("intent") if isinstance(intent_data, dict) else intent_data
    if intent == "BUY_SIGNAL":
        confirm_patterns = [r"\b(yes|sure|okay|ok|let'?s do it|book|schedule|when|set it up)\b"]
        return any(re.search(p, message.lower()) for p in confirm_patterns)
    return False