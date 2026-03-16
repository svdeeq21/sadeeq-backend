# svdeeq-backend/app/services/intent_engine.py
"""
Intent Detection Engine
────────────────────────
Classifies every inbound message before it reaches the LLM.
The pipeline uses this to make hard routing decisions — no LLM involved.
"""

import re

# ── Intent constants ──────────────────────────────────────────────
INTENT_STOP         = "STOP"          # wants to be removed
INTENT_NEGATIVE     = "NEGATIVE"      # not interested / rejected call
INTENT_CONFIRM_CALL = "CONFIRM_CALL"  # agreed to a call
INTENT_QUESTION     = "QUESTION"      # asking something
INTENT_IDENTITY_Q   = "IDENTITY_Q"   # "what are you / who are you"
INTENT_SOURCE_Q     = "SOURCE_Q"     # "how did you get my number"
INTENT_POSITIVE     = "POSITIVE"      # engaged, interested
INTENT_NEUTRAL      = "NEUTRAL"       # normal reply, keep going


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
    r"\bpass\b", r"\bnope\b", r"^no+$",        # "nooo", "noooo" etc.
    r"\bwe'?re (fine|okay|good|sorted)\b",
    r"\bnot (the right time|a good time)\b",
    r"\bwe already have\b", r"\bwe use\b",
    r"\bnot looking\b", r"\bnot (buying|paying)\b",
    # Polite goodbyes — treat as negative, stop messaging
    r"\bhave a nice day\b", r"\bhave a good day\b",
    r"\bgood day\b", r"\btake care\b",
    r"\bgoodbye\b", r"\bbye bye\b",
    r"\btalk (later|soon)\b", r"\bsee you\b",
    r"\bstate your intentions\b",
    r"\bwho (are|sent) you\b",
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
    r"\d{1,2}(:\d{2})?(am|pm)\b",   # time like 7pm, 9:00am
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
    r"\bwhy are you (messaging|contacting|texting) me\b",
]


# ── Core classifier ───────────────────────────────────────────────

def detect_intent(text: str) -> str:
    """
    Classify the intent of an inbound message.
    Returns one of the INTENT_* constants.
    Priority order matters — STOP > NEGATIVE > CONFIRM > IDENTITY > SOURCE > NEUTRAL
    """
    t = text.strip().lower()

    if _matches(t, _STOP_PATTERNS):
        return INTENT_STOP

    if _matches(t, _NEGATIVE_PATTERNS):
        return INTENT_NEGATIVE

    if _matches(t, _CONFIRM_CALL_PATTERNS):
        return INTENT_CONFIRM_CALL

    if _matches(t, _IDENTITY_PATTERNS):
        return INTENT_IDENTITY_Q

    if _matches(t, _SOURCE_PATTERNS):
        return INTENT_SOURCE_Q

    return INTENT_NEUTRAL


def is_hard_exit(intent: str) -> bool:
    """Returns True if the bot should stop the conversation immediately."""
    return intent in (INTENT_STOP,)


def is_soft_exit(intent: str) -> bool:
    """Returns True if the bot should acknowledge rejection and go NURTURE."""
    return intent in (INTENT_NEGATIVE,)


def is_call_confirmed(intent: str, message_text: str) -> bool:
    """
    Strict call confirmation — requires BOTH intent match AND
    the message to be short/direct (not a question or long explanation).
    Prevents hallucinated agreements.
    """
    if intent != INTENT_CONFIRM_CALL:
        return False
    # Reject if message is a question (they're clarifying, not confirming)
    if "?" in message_text:
        return False
    # Reject if message is long (likely explaining context, not agreeing)
    if len(message_text.split()) > 20:
        return False
    return True


# ── Lead profile extractor ────────────────────────────────────────

def extract_lead_profile(messages: list[dict]) -> dict:
    """
    Parse conversation history to build a structured lead profile.
    Used to prevent re-asking questions already answered.
    """
    profile = {
        "business_described": False,
        "problem_identified": False,
        "current_system_known": False,
        "name_confirmed": None,   # exact spelling if user corrected it
    }

    user_messages = [m["content"] for m in messages if m.get("sender") == "USER"]
    combined = " ".join(user_messages).lower()

    # Business described?
    business_signals = [
        r"\bwe (do|sell|offer|provide|run|own|operate)\b",
        r"\bmy (business|company|shop|store|school|clinic|restaurant)\b",
        r"\bi (run|own|manage|work at)\b",
        r"\bwe are (a|an)\b",
        r"\bit'?s a\b",
    ]
    if _matches(combined, business_signals) or len(user_messages) >= 2:
        profile["business_described"] = True

    # Problem identified?
    problem_signals = [
        r"\bproblem\b", r"\bchallenge\b", r"\bissue\b", r"\bstruggl\b",
        r"\bmanual\b", r"\btime.consum\b", r"\brepetitive\b",
        r"\bhard to\b", r"\bdifficult\b", r"\btoo much\b",
        r"\boverwhel\b", r"\bcannot (handle|manage|keep up)\b",
        r"\b(keep|keeping) track\b",
    ]
    if _matches(combined, problem_signals):
        profile["problem_identified"] = True

    # Current system known?
    system_signals = [
        r"\bwhatsapp\b", r"\bmanually\b", r"\bspreadsheet\b",
        r"\bnotebook\b", r"\bexcel\b", r"\bpen and paper\b",
        r"\bphone calls?\b", r"\bno system\b", r"\bwe just\b",
    ]
    if _matches(combined, system_signals):
        profile["current_system_known"] = True

    # Name correction?
    name_correction = re.search(
        r"my name is ([A-Z][a-z]+)", " ".join(user_messages), re.IGNORECASE
    )
    if name_correction:
        profile["name_confirmed"] = name_correction.group(1).strip()

    # Also catch "it's X not Y" name correction pattern per-message
    for msg in messages:
        if msg.get("sender") == "USER":
            text = msg.get("content", "")
            m = re.search(r"it['s]* ([A-Z][a-z]+)(,| not)", text, re.IGNORECASE)
            if m:
                profile["name_confirmed"] = m.group(1)

    # ── Extract pain point text ──────────────────────────────
    # Grab the first user message that describes a problem in their own words.
    pain_keywords = [
        r"problem", r"challenge", r"struggl", r"issue",
        r"difficult", r"hard to", r"too much", r"manually",
        r"time.consum", r"keep track", r"overwhel",
    ]
    for msg in messages:
        if msg.get("sender") == "USER" and len(msg.get("content", "")) > 20:
            text = msg["content"]
            if any(re.search(p, text, re.IGNORECASE) for p in pain_keywords):
                profile["pain_point_text"] = text[:300]
                break

    # ── Extract objections ───────────────────────────────────
    objection_keywords = [
        r"already have", r"not interested", r"no thanks",
        r"too expensive", r"can'?t afford", r"not now",
        r"maybe later", r"don'?t need", r"we'?re fine",
        r"not looking",
    ]
    objections_found = []
    for msg in messages:
        if msg.get("sender") == "USER":
            text = msg.get("content", "")
            for p in objection_keywords:
                if re.search(p, text, re.IGNORECASE):
                    objections_found.append(text[:150])
                    break
    if objections_found:
        profile["objections"] = objections_found

    return profile


# ── Canned responses for hard-coded intents ──────────────────────

CANNED_RESPONSES = {
    INTENT_IDENTITY_Q: (
        "I'm Sadiq's assistant — I help businesses explore how AI automation "
        "can save time and reduce manual work. Sadiq is an AI developer who "
        "builds custom automation systems for businesses."
    ),
    INTENT_SOURCE_Q: (
        "We came across your business while researching companies in your "
        "industry. We reach out to businesses we think could benefit from "
        "AI automation. If you'd rather not hear from us, just say so and "
        "we'll stop immediately."
    ),
}


def get_canned_response(intent: str) -> str | None:
    return CANNED_RESPONSES.get(intent)


# ── Helpers ───────────────────────────────────────────────────────

def _matches(text: str, patterns: list[str]) -> bool:
    return any(re.search(p, text) for p in patterns)