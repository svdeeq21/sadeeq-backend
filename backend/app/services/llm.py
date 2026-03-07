# svdeeq-backend/app/services/llm.py
from __future__ import annotations

import httpx
from google import genai
from google.genai import types

from app.core.config import get_settings
from app.models.schemas import ConversationContext
from app.services.rule_based import get_rule_based_response
from app.utils.logger import log

settings = get_settings()
_gemini = genai.Client(api_key=settings.gemini_api_key)


# ── System prompt ────────────────────────────────────────────────
SYSTEM_PROMPT = """You are the outreach assistant for Sadiq Shehu.

Sadiq Shehu is an AI/ML Engineer, Software Engineer, and Web Developer who builds intelligent software systems for businesses.

Your role is to have natural conversations with potential business leads, understand what they do, identify opportunities where software, AI, or automation could help them, and move the conversation toward scheduling a call with Sadiq.

You are NOT a salesperson pushing services. You are a helpful assistant exploring whether there is a potential fit.

-----------------------------

ABOUT SADIQ

Sadiq builds three types of systems:

1. AI Systems
AI chatbots, RAG systems, document intelligence tools, NLP pipelines, predictive ML models, and AI integrations into products.

2. Workflow Automation
Automated lead handling, CRM integrations, automated reporting, API integrations, and AI-powered workflow automation.

3. Web Platforms
SaaS products, backend APIs, internal dashboards, scalable web applications, and AI-powered platforms.

Portfolio:
https://sadiqshehu.vercel.app

-----------------------------

SOCIAL PROOF (REFERENCE NATURALLY)

You may reference these projects when relevant:

• University AI Chatbot for the Air Force Institute of Technology that helps students quickly access admission and campus information.

• Malaria Prediction Machine Learning Model demonstrating predictive healthcare analytics.

• AI Document RAG Platform where users upload documents, generate summaries, and chat with them using AI. Includes authentication and Flutterwave payment integration.

• AI Lead Messenger System that automatically reaches out to leads, qualifies them, and schedules calls.

Do NOT list projects unless they are relevant to the conversation.

-----------------------------

CONVERSATION OBJECTIVE

Your goal is to guide the conversation through these stages:

1. Greeting
2. Business discovery
3. Problem discovery
4. Suggest possible automation or AI solution
5. Mention relevant project example
6. Invite them to schedule a call with Sadiq

Do NOT skip steps.

Never pitch services before understanding the lead's business.

-----------------------------

CONVERSATION RULES

• Keep replies short and natural (1-3 sentences unless detail is required).
• Sound human and conversational, not robotic or overly formal.
• Do NOT overwhelm the lead with technical explanations.
• Ask questions that help understand the lead's business and workflow.
• Move the conversation forward with each message.

-----------------------------

MEMORY RULES

You are given the recent conversation history.

Always read it before replying.

You must:

• Never repeat the same question twice.
• Never repeat the same reply.
• Reference information the lead has already shared.
• Build on what they previously said.

Examples:

"Since you mentioned you run an online store..."
"Based on what you said about handling customer inquiries..."

-----------------------------

CALL INVITATION RULES

Only suggest scheduling a call if:

• The lead expresses interest
• The lead mentions a problem
• The lead asks about services
• The lead asks about pricing or timelines

When inviting a call, ask for:

• preferred time
• timezone
• short description of what they want to build or automate

-----------------------------

ANTI-SPAM RULES

Do NOT send multiple messages in a row.

Do NOT pressure the lead.

If they say they are not interested, politely acknowledge and end the conversation.

If they ask to stop messaging:

Reply exactly:

"Understood, I'll stop messaging you."

Then stop responding.

-----------------------------

SAFETY RULES

• Never invent services.
• Never invent pricing.
• Never promise timelines.
• Never claim guaranteed results.
• If a technical question is too complex, say Sadiq will discuss it during the call.

-----------------------------

IDENTITY RULES

• You are Sadiq's assistant.
• Never claim to be Sadiq.
• Never mention being an AI unless directly asked.

-----------------------------

NAME RULE

Address the lead by their first name only.

If they have multiple names, use the first one consistently unless they ask to be addressed differently.

-----------------------------

LINK RULE

Do not send links unless the lead explicitly asks for Sadiq's work.

If asked, share:

https://sadiqshehu.vercel.app
"""


# ── Prompt builder ───────────────────────────────────────────────

def _build_prompt(context: ConversationContext, user_message: str) -> str:
    parts = []

    if context.summary:
        parts.append(f"## Conversation so far\n{context.summary}")

    if context.recent:
        history = "\n".join(
            f"{m['role']}: {m['content']}" for m in context.recent
        )
        parts.append(f"## Recent messages\n{history}")

    if context.rag_chunks:
        kb_text = "\n\n".join(
            f"[{c.document_name}]\n{c.content}" for c in context.rag_chunks
        )
        parts.append(f"## Relevant knowledge\n{kb_text}")

    parts.append(f"## Lead's message\n{context.lead_name}: {user_message}")
    parts.append("## Your reply (as Sadiq's assistant)")

    return "\n\n".join(parts)


# ── Provider 1: Gemini ───────────────────────────────────────────

async def _try_gemini(prompt: str) -> str:
    response = _gemini.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=500,
            temperature=0.7,
        ),
    )
    text = response.text.strip()
    if not text:
        raise ValueError("Gemini returned empty response")
    return text


# ── Provider 2: Groq ─────────────────────────────────────────────

async def _try_groq(prompt: str) -> str:
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type":  "application/json",
    }
    payload = {
        "model": settings.groq_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        "max_tokens":  500,
        "temperature": 0.7,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload, headers=headers)

    if response.status_code != 200:
        raise RuntimeError(f"Groq error {response.status_code}: {response.text[:200]}")

    text = response.json()["choices"][0]["message"]["content"].strip()
    if not text:
        raise ValueError("Groq returned empty response")
    return text


# ── Provider 3: HuggingFace ──────────────────────────────────────

async def _try_huggingface(prompt: str) -> str:
    model = settings.huggingface_model
    url   = f"https://router.huggingface.co/hf-inference/models/{model}"
    headers = {
        "Authorization": f"Bearer {settings.huggingface_api_key}",
        "Content-Type":  "application/json",
    }
    full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}\n\nAssistant:"
    payload = {
        "inputs": full_prompt,
        "parameters": {
            "max_new_tokens":   300,
            "temperature":      0.7,
            "return_full_text": False,
        },
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload, headers=headers)

    if response.status_code != 200:
        raise RuntimeError(f"HuggingFace error {response.status_code}: {response.text[:200]}")

    data = response.json()
    text = data[0].get("generated_text", "").strip() if isinstance(data, list) and data else ""
    if not text:
        raise ValueError("HuggingFace returned empty response")
    return text


# ── Admin notification ───────────────────────────────────────────

async def _notify_admin(provider_used: str, failed_providers: list[str], lead_id) -> None:
    await log.warn(
        "LLM_FALLBACK_USED",
        lead_id=lead_id,
        metadata={
            "provider_used":    provider_used,
            "failed_providers": failed_providers,
        },
    )

    if not settings.admin_whatsapp_number:
        return

    try:
        from app.services.whatsapp import send_message
        from uuid import UUID

        alert_text = (
            f"⚠️ *Svdeeq-Bot Alert*\n\n"
            f"LLM fallback triggered.\n"
            f"Failed: {', '.join(failed_providers)}\n"
            f"Using: *{provider_used}*\n"
            f"Lead: `{lead_id}`\n\n"
            f"Check your API quotas."
        )
        await send_message(
            phone_number=settings.admin_whatsapp_number,
            text=alert_text,
            lead_id=UUID(int=0),
        )
    except Exception as e:
        await log.warn("ADMIN_NOTIFY_FAILED", metadata={"error": str(e)})


# ── Main entry point ─────────────────────────────────────────────

async def generate_reply(
    context:      ConversationContext,
    user_message: str,
) -> tuple[str, str]:
    prompt           = _build_prompt(context, user_message)
    failed_providers: list[str] = []

    # Level 1: Gemini
    try:
        reply = await _try_gemini(prompt)
        await log.info("LLM_REPLY_GENERATED", lead_id=context.lead_id,
                       metadata={"provider": "gemini", "preview": reply[:80]})
        return reply, "gemini"
    except Exception as e:
        failed_providers.append("gemini")
        await log.warn("LLM_PROVIDER_FAILED", lead_id=context.lead_id,
                       metadata={"provider": "gemini", "error": str(e)[:120]})

    # Level 2: Groq
    try:
        reply = await _try_groq(prompt)
        await _notify_admin("groq", failed_providers, context.lead_id)
        await log.info("LLM_REPLY_GENERATED", lead_id=context.lead_id,
                       metadata={"provider": "groq", "preview": reply[:80]})
        return reply, "groq"
    except Exception as e:
        failed_providers.append("groq")
        await log.warn("LLM_PROVIDER_FAILED", lead_id=context.lead_id,
                       metadata={"provider": "groq", "error": str(e)[:120]})

    # Level 3: HuggingFace
    try:
        reply = await _try_huggingface(prompt)
        await _notify_admin("huggingface", failed_providers, context.lead_id)
        await log.info("LLM_REPLY_GENERATED", lead_id=context.lead_id,
                       metadata={"provider": "huggingface", "preview": reply[:80]})
        return reply, "huggingface"
    except Exception as e:
        failed_providers.append("huggingface")
        await log.warn("LLM_PROVIDER_FAILED", lead_id=context.lead_id,
                       metadata={"provider": "huggingface", "error": str(e)[:120]})

    # Level 4: Rule-based (always succeeds)
    reply = get_rule_based_response(user_message)
    await _notify_admin("rule_based", failed_providers, context.lead_id)
    await log.warn("LLM_ALL_PROVIDERS_FAILED", lead_id=context.lead_id,
                   metadata={"failed": failed_providers})
    return reply, "rule_based"


# ── Summary generation ───────────────────────────────────────────

async def generate_summary(transcript: str) -> str:
    prompt = (
        "Summarise the following business outreach conversation in 3-5 sentences. "
        "Include: what the lead's business does, any problems they mentioned, "
        "their level of interest in AI or automation, and any next steps agreed.\n\n"
        f"{transcript}\n\nSummary:"
    )

    try:
        response = _gemini.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
        return response.text.strip()
    except Exception:
        pass

    try:
        return await _try_groq(prompt)
    except Exception as e:
        await log.warn("SUMMARY_GENERATION_FAILED", metadata={"error": str(e)})
        return ""