# svdeeq-backend/app/services/intent_engine.py
"""
Intent Detection Engine — v3
─────────────────────────────
Classifies every inbound message before it reaches the LLM.
Pipeline uses this for hard routing — no LLM involved.

New in v3:
- BUYING_SIGNAL intent (price/timeline/implementation questions)
- BANT flags (budget, authority, need, timeline signals)
- Pain quantification signals
- Expanded goodbye / soft exit detection
"""

import re

# ── Intent constants ──────────────────────────────────────────────
INTENT_STOP          = "STOP"           # wants to be removed
INTENT_NEGATIVE      = "NEGATIVE"       # not interested / goodbye
INTENT_CONFIRM_CALL  = "CONFIRM_CALL"   # agreed to a call
INTENT_BUYING_SIGNAL = "BUYING_SIGNAL"  # asking about price/timeline = ready to buy
INTENT_OBJECTION     = "OBJECTION"      # price/trust/timing objection
INTENT_QUESTION      = "QUESTION"       # asking something general
INTENT_IDENTITY_Q    = "IDENTITY_Q"     # who are you
INTENT_SOURCE_Q      = "SOURCE_Q"       # how did you get my number
INTENT_POSITIVE      = "POSITIVE"       # engaged, interested
INTENT_NEUTRAL       = "NEUTRAL"        # normal reply


# ── Pattern lists ─────────────────────────────────────────────────

_STOP_PATTERNS = [
    r"\bstop\b", r"\bremove me\b", r"\bunsubscribe\b",
    r"\bdon'?t (contact|message|text|call) me\b",
    r"\bleave me alone\b", r"\bno more messages\b",
    r"\btired of (answering|your messages|this)\b",
    r"\bi'?m (not interested|done|finished)\b",
    r"\bblock\b",
]

_NEGATIVE_PATTERNS = [
    r"\bnot (now|ready|interested|for me)\b",
    r"\bmaybe (later|another time)\b",
    r"\bno[,\s]?\s*thank", r"\bno thanks\b",
    r"\bnot (needed|required|relevant)\b",
    r"\bdon'?t (need|want) (this|it|your)\b",
    r"\bpass\b", r"\bnope\b", r"^no+$",
    r"\bwe'?re (fine|okay|good|sorted)\b",
    r"\bnot (the right time|a good time)\b",
    r"\bwe already have\b",
    r"\bnot looking\b", r"\bnot (buying|paying)\b",
    # Polite goodbyes
    r"\bhave a nice day\b", r"\bhave a good day\b",
    r"\bgood day\b", r"\btake care\b",
    r"\bgoodbye\b", r"\bbye bye\b",
    r"\btalk (later|soon)\b", r"\bsee you\b",
    # Defensive/hostile
    r"\bstate your intentions\b",
    r"\bwho (are|sent) you\b",
    r"\bwhy are you (messaging|contacting|texting) me\b",
]

_BUYING_SIGNAL_PATTERNS = [
    # Price signals
    r"\bhow much\b", r"\bwhat.*(cost|price|charge|fee|rate)\b",
    r"\bwhat do you charge\b", r"\bwhat.*(it|this) cost\b",
    r"\baffordable\b", r"\bbudget\b",
    # Timeline signals
    r"\bhow long\b", r"\bwhen (can|could|would) (you|it|we)\b",
    r"\bhow soon\b", r"\btime(line|frame)\b",
    r"\bwhen.*(start|begin|ready|done|finish)\b",
    # Implementation signals
    r"\bhow does (it|this) work\b", r"\bwhat.*(process|steps|involved)\b",
    r"\bwhat do (i|we) need\b", r"\bhow do (i|we) (start|begin|get started)\b",
    r"\bwhat.*(next|happen next)\b",
    # Integration signals
    r"\bwork with\b", r"\bintegrate\b", r"\bcompatible\b",
    r"\bconnect(ed)? to\b",
]

_OBJECTION_PATTERNS = [
    # Price objections
    r"\btoo expensive\b", r"\bcan'?t afford\b", r"\bout of (my |our )?(budget|price range)\b",
    r"\bthat'?s (a lot|too much)\b", r"\bsounds expensive\b",
    # Trust objections
    r"\bhow do (i|we) know\b", r"\bproof\b", r"\bworks?\b.*\?",
    r"\bseen (it|this) (work|before)\b", r"\bguarantee\b",
    r"\bother (clients?|customers?|businesses?)\b",
    # Authority objections
    r"\bneed to (check|ask|speak|talk) (with|to) (my )?(boss|manager|partner|team|husband|wife)\b",
    r"\bnot (my |the )?decision\b", r"\bsomeone else\b",
    r"\bask (my |the )?(boss|partner|team)\b",
    # Timing objections
    r"\bnot (right now|at the moment|yet)\b",
    r"\btoo busy\b", r"\bmaybe (next|in a few)\b",
    r"\bwait (a bit|for now)\b",
]

_CONFIRM_CALL_PATTERNS = [
    r"\byes\b", r"\byeah\b", r"\byep\b", r"\bsure\b",
    r"\bokay\b", r"\bok\b", r"\balright\b", r"\baight\b",
    r"\blet'?s (do it|go|talk|chat)\b",
    r"\bsounds good\b", r"\bi'?m (in|interested|down)\b",
    r"\bgo ahead\b", r"\bproceed\b", r"\bcount me in\b",
    r"\bbook\b", r"\bschedule\b", r"\bconfirm\b",
    r"\bwhen.*call\b", r"\bwhat.*time\b",
    r"\btomorrow\b", r"\btoday\b", r"\bweekend\b",
    r"\bsaturday\b", r"\bsunday\b", r"\bmonday\b",
    r"\btuesday\b", r"\bwednesday\b", r"\bthursday\b", r"\bfriday\b",
    r"\d{1,2}(:\d{2})?(am|pm)\b",
    r"\bworks for me\b", r"\bi'?ll (call|reach out|contact)\b",
    r"\bthat('?s| is) fine\b", r"\bsound(s)? good\b",
    r"\bi agree\b", r"\blet'?s do\b",
]

_IDENTITY_PATTERNS = [
    r"\bwho are you\b", r"\bwhat are you\b",
    r"\bare you (a bot|an? ai|human|real)\b",
    r"\bwho (is this|am i (talking|speaking) to)\b",
    r"\bwhat('?s| is) this\b",
]

_SOURCE_PATTERNS = [
    r"\bhow (did you get|do you have) my (number|contact|details)\b",
    r"\bwhere did you get\b",
    r"\bwho gave you\b",
]

# BANT detection — not intents but flags used to enrich lead profile
_BUDGET_SIGNALS   = [r"\bbudget\b", r"\bafford\b", r"\bcost\b", r"\bprice\b", r"\bexpensive\b", r"\bcheap\b"]
_AUTHORITY_SIGNALS = [r"\bmy (boss|manager|partner|director|ceo|owner)\b", r"\bi decide\b", r"\bi'?m (the owner|in charge)\b", r"\bneed (to ask|approval)\b"]
_URGENCY_SIGNALS  = [r"\burgent\b", r"\basap\b", r"\bimmediately\b", r"\bright away\b", r"\bthis (week|month)\b", r"\bsoon\b"]
_PAIN_QUANTITY_SIGNALS = [r"\b\d+\s*(hours?|days?|messages?|orders?|requests?|customers?)\b", r"\bevery day\b", r"\bdaily\b", r"\bper (day|week|month)\b"]


# ── Helpers ───────────────────────────────────────────────────────

def _matches(text: str, patterns: list[str]) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


# ── Core classifier ───────────────────────────────────────────────

def detect_intent(text: str) -> str:
    t = text.strip().lower()

    if _matches(t, _STOP_PATTERNS):
        return INTENT_STOP

    if _matches(t, _NEGATIVE_PATTERNS):
        return INTENT_NEGATIVE

    # Buying signals take priority over objections
    if _matches(t, _BUYING_SIGNAL_PATTERNS):
        return INTENT_BUYING_SIGNAL

    if _matches(t, _OBJECTION_PATTERNS):
        return INTENT_OBJECTION

    if _matches(t, _CONFIRM_CALL_PATTERNS):
        return INTENT_CONFIRM_CALL

    if _matches(t, _IDENTITY_PATTERNS):
        return INTENT_IDENTITY_Q

    if _matches(t, _SOURCE_PATTERNS):
        return INTENT_SOURCE_Q

    return INTENT_NEUTRAL


def is_hard_exit(intent: str) -> bool:
    return intent == INTENT_STOP


def is_soft_exit(intent: str) -> bool:
    return intent == INTENT_NEGATIVE


def is_buying_signal(intent: str) -> bool:
    """Lead is asking about price/timeline/implementation — switch to close mode."""
    return intent == INTENT_BUYING_SIGNAL


def is_objection(intent: str) -> bool:
    return intent == INTENT_OBJECTION


def is_call_confirmed(intent: str, text: str) -> bool:
    """Strict check — must be CONFIRM_CALL + short + no question mark."""
    if intent != INTENT_CONFIRM_CALL:
        return False
    if "?" in text:
        return False
    if len(text.split()) > 25:
        return False
    return True


# ── BANT flags ────────────────────────────────────────────────────

def detect_bant_flags(messages: list[dict]) -> dict:
    """
    Scan conversation history for BANT signals.
    Returns flags used to enrich lead profile and guide conversation.
    """
    combined = " ".join(
        m.get("content", "") for m in messages if m.get("sender") == "USER"
    ).lower()

    return {
        "has_budget_signal":    _matches(combined, _BUDGET_SIGNALS),
        "has_authority_signal": _matches(combined, _AUTHORITY_SIGNALS),
        "has_urgency_signal":   _matches(combined, _URGENCY_SIGNALS),
        "has_pain_quantity":    _matches(combined, _PAIN_QUANTITY_SIGNALS),
        "low_authority":        bool(re.search(r"need to (check|ask|speak|talk) (with|to) (my )?(boss|manager|partner)", combined, re.IGNORECASE)),
    }


# ── Lead profile extractor ────────────────────────────────────────

def extract_lead_profile(messages: list[dict]) -> dict:
    """
    Parse conversation history to build a structured lead profile.
    Used to prevent re-asking questions already answered.
    """
    profile = {
        "business_described":  False,
        "problem_identified":  False,
        "current_system_known": False,
        "name_confirmed":      None,
        "pain_point_text":     None,
        "objections":          [],
    }

    user_messages = [m["content"] for m in messages if m.get("sender") == "USER"]
    combined      = " ".join(user_messages).lower()

    business_signals = [
        r"\bwe (do|sell|offer|provide|run|own|operate)\b",
        r"\bmy (business|company|shop|store|school|clinic|restaurant)\b",
        r"\bi (run|own|manage|work at)\b",
        r"\bwe are (a|an)\b", r"\bit'?s a\b",
    ]
    if _matches(combined, business_signals) or len(user_messages) >= 2:
        profile["business_described"] = True

    problem_signals = [
        r"\bproblem\b", r"\bchallenge\b", r"\bissue\b", r"\bstruggl\b",
        r"\bmanual\b", r"\btime.consum\b", r"\brepetitive\b",
        r"\bhard to\b", r"\bdifficult\b", r"\btoo much\b",
        r"\boverwhel\b", r"\bcannot (handle|manage|keep up)\b",
        r"\b(keep|keeping) track\b",
    ]
    if _matches(combined, problem_signals):
        profile["problem_identified"] = True

    system_signals = [
        r"\bwhatsapp\b", r"\bmanually\b", r"\bspreadsheet\b",
        r"\bnotebook\b", r"\bexcel\b", r"\bpen and paper\b",
        r"\bphone calls?\b", r"\bsms\b", r"\bno system\b",
    ]
    if _matches(combined, system_signals):
        profile["current_system_known"] = True

    # Name correction
    name_correction = re.search(
        r"my name is ([A-Z][a-z]+)", " ".join(user_messages), re.IGNORECASE
    )
    if name_correction:
        profile["name_confirmed"] = name_correction.group(1).strip()

    for msg in messages:
        if msg.get("sender") == "USER":
            text = msg.get("content", "")
            m = re.search(r"it'?s ([A-Z][a-z]+)(,| not)", text, re.IGNORECASE)
            if m:
                profile["name_confirmed"] = m.group(1)

    # Pain point text extraction
    pain_keywords = [
        r"\bproblem\b", r"\bchallenge\b", r"\bstruggl\b", r"\bissue\b",
        r"\bdifficult\b", r"\bhard to\b", r"\btoo much\b", r"\bmanually\b",
        r"\btime.consum\b", r"\bkeep track\b", r"\boverwhel\b",
    ]
    for msg in messages:
        if msg.get("sender") == "USER" and len(msg.get("content", "")) > 20:
            text = msg["content"]
            if any(re.search(p, text, re.IGNORECASE) for p in pain_keywords):
                profile["pain_point_text"] = text[:300]
                break

    # Objections
    objection_keywords = [
        r"\balready have\b", r"\bnot interested\b", r"\bno thanks\b",
        r"\btoo expensive\b", r"\bcan'?t afford\b", r"\bnot now\b",
        r"\bmaybe later\b", r"\bdon'?t need\b", r"\bwe'?re fine\b",
        r"\bnot looking\b",
    ]
    for msg in messages:
        if msg.get("sender") == "USER":
            text = msg.get("content", "")
            for p in objection_keywords:
                if re.search(p, text, re.IGNORECASE):
                    profile["objections"].append(text[:150])
                    break

    return profile


# ── Canned responses for hard-coded intents ───────────────────────

CANNED_IDENTITY = (
    "I'm an AI assistant reaching out on behalf of Sadiq Shehu — "
    "he builds custom AI automation for businesses. "
    "Is automating any part of your operations something you've thought about?"
)

CANNED_SOURCE = (
    "Your business came up while we were looking for companies that might benefit "
    "from AI automation. If it's not relevant, just say the word and I'll leave you be."
)
