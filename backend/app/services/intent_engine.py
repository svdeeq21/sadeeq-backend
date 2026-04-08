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
engine = IntentEngine()

def detect_intent(message: str) -> dict:
    return engine.detect_intent(message)