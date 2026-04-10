# =========================
# INTENT ENGINE v3 (OBJECTION-AWARE)
# =========================

import re

class IntentEngine:
    def __init__(self):
        self.intent_priority = [
            "HARD_EXIT",
            "OBJECTION",
            "BUY_SIGNAL",
            "CLARIFICATION",
            "CONTEXT",
            "NEGATIVE",
            "AFFIRMATION",
            "NEUTRAL"
        ]

        self.intent_patterns = {
            "HARD_EXIT": [
                r"\b(stop messaging|stop texting|remove me|take me off|unsubscribe|leave me alone|not interested at all|absolutely not|never contact|do not contact)\b",
            ],

            "OBJECTION": [
                r"\b(not sure|don't think|won't work|not for me|too expensive|no budget|already have|we already use|we're fine|no need|later|maybe later)\b",
                r"\b(how do i know|what if|sounds risky|is this legit|prove it)\b",
                r"\b(my type of business|won't apply|different industry|doesn't apply)\b",
                r"\b(not the right time|busy right now|come back later|not now)\b",
            ],

            "BUY_SIGNAL": [
                r"\b(how much|price|cost|pricing|what's the fee)\b",
                r"\b(show me|let me see|how does it work|demo|example)\b",
                r"\b(i'm interested|this sounds good|i want this|let's do it|sign me up)\b",
                r"\b(when can we start|how do we start|what's next|next step)\b",
            ],

            "CLARIFICATION": [
                r"\b(what do you mean|how does that work|can you explain|i don't get it|elaborate)\b",
                r"\b(what exactly|like how|in what way|what kind)\b",
            ],

            "CONTEXT": [
                r"\b(i run|we run|i have|we have|my business|our business|i own|we own)\b",
                r"\b(customers|clients|orders|messages|sales|staff|team)\b",
            ],

            "NEGATIVE": [
                r"\b(no|nah|not really|don't want|no thanks)\b",
            ],

            "AFFIRMATION": [
                r"\b(yes|yeah|yh|yep|true|exactly|right|makes sense|okay|ok|sure)\b",
            ],
        }

        # Objection sub-type patterns — used AFTER an OBJECTION is detected
        self.objection_type_patterns = {
            "price":         r"\b(too expensive|no budget|can't afford|cost too much|price|how much|costly|not worth)\b",
            "timing":        r"\b(not now|busy|later|not the right time|come back|next month|next quarter|not ready)\b",
            "trust":         r"\b(how do i know|is this legit|sounds risky|prove it|seen this before|scam|real|guarantee)\b",
            "already_sorted":r"\b(already have|we use|we have a team|sorted|covered|in place|we're fine|don't need)\b",
            "relevance":     r"\b(not my industry|won't apply|different|doesn't fit|not applicable|my type of business)\b",
            "vague":         r".*",  # fallback — matches anything
        }

    def detect_intent(self, message: str) -> dict:
        message_lower = message.lower()
        detected = []

        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower):
                    detected.append(intent)
                    break

        for intent in self.intent_priority:
            if intent in detected:
                primary_intent = intent
                break
        else:
            primary_intent = "NEUTRAL"

        signals = self.extract_signals(message_lower)

        return {
            "intent": primary_intent,
            "all_detected": detected,
            "signals": signals,
        }

    def classify_objection(self, message: str) -> str:
        """
        When an OBJECTION is detected, classify WHICH type it is.
        Returns one of: price | timing | trust | already_sorted | relevance | vague
        """
        text = message.lower()
        for obj_type, pattern in self.objection_type_patterns.items():
            if obj_type == "vague":
                continue
            if re.search(pattern, text):
                return obj_type
        return "vague"

    def extract_signals(self, message: str) -> dict:
        return {
            "mentions_price":    bool(re.search(r"\b(price|cost|how much|fee)\b", message)),
            "mentions_time":     bool(re.search(r"\b(when|how long|time|timeline)\b", message)),
            "mentions_business": bool(re.search(r"\b(business|customers|clients|orders|staff)\b", message)),
            "skepticism":        bool(re.search(r"\b(not sure|how do i know|what if|is this legit)\b", message)),
            "urgency":           bool(re.search(r"\b(now|asap|quickly|immediately|urgent)\b", message)),
        }

    def is_hard_exit(self, intent_data: dict) -> bool:
        intent = intent_data.get("intent") if isinstance(intent_data, dict) else intent_data
        return intent in ("HARD_EXIT", "NEGATIVE")


# ── Module-level singleton ────────────────────────────────────────────────────
engine = IntentEngine()


def detect_intent(message: str) -> dict:
    return engine.detect_intent(message)

def classify_objection(message: str) -> str:
    return engine.classify_objection(message)

def is_hard_exit(intent_data) -> bool:
    return engine.is_hard_exit(intent_data)

def get_canned_response(intent_data) -> str | None:
    """Hardcoded replies for identity/source questions — saves an LLM call."""
    intent = intent_data.get("intent") if isinstance(intent_data, dict) else intent_data
    canned = {
        "WHO_ARE_YOU":               "I'm Sadiq's assistant, reaching out on his behalf. He's an AI and software engineer who helps businesses automate and grow.",
        "ARE_YOU_AI":                "I'm a virtual assistant helping Sadiq manage his outreach. Sadiq himself will be on your call.",
        "HOW_DID_YOU_GET_MY_NUMBER": "We came across your business and thought there might be a good fit. Happy to stop if it's not a good time!",
    }
    return canned.get(intent)

def extract_lead_profile(messages: list) -> dict:
    """Scans conversation history for structured profile data."""
    profile = {
        "business_described": False,
        "problem_identified":  False,
        "name_confirmed":      None,
        "pain_point_text":     None,
        "objections":          [],
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
    """Detects Budget / Authority / Need / Timeline signals."""
    flags = {
        "has_budget_signal":    False,
        "has_authority_signal": False,
        "has_need_signal":      False,
        "has_timeline_signal":  False,
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
    """Guardrail — only True if lead has genuinely confirmed a call."""
    intent = intent_data.get("intent") if isinstance(intent_data, dict) else intent_data
    if intent == "BUY_SIGNAL":
        confirm_patterns = [r"\b(yes|sure|okay|ok|let'?s do it|book|schedule|when|set it up)\b"]
        return any(re.search(p, message.lower()) for p in confirm_patterns)
    return False
