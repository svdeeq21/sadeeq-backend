# svdeeq-backend/app/services/llm.py
#
# LLM fallback chain — replaces the previous single-provider llm.py.
#
# Chain order (as configured):
#   1. Gemini 1.5 Flash   (Google AI Studio)
#   2. Groq / Llama 3     (Groq Cloud)
#   3. HuggingFace        (Inference API)
#   4. Rule-based FAQ     (no LLM — keyword matching, always succeeds)
#
# Triggers: any error from a provider (429, 500, timeout, etc.)
# Admin notification: sent whenever any fallback level is used.
#
# New env vars needed (add to .env.example):
#   GROQ_API_KEY=your-groq-api-key
#   GROQ_MODEL=llama3-8b-8192
#   HUGGINGFACE_API_KEY=your-hf-api-key
#   HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2
#   ADMIN_WHATSAPP_NUMBER=+2348012345678   ← where to send admin alerts

from __future__ import annotations

import httpx
import google.generativeai as genai

from app.core.config import get_settings
from app.models.schemas import ConversationContext
from app.services.rule_based import get_rule_based_response
from app.utils.logger import log

settings = get_settings()
genai.configure(api_key=settings.gemini_api_key)


# ── Shared system prompt ─────────────────────────────────────────
SYSTEM_PROMPT = """You are an AI outreach assistant representing Sadiq Shehu, an AI/ML Engineer, Software Engineer, and Web Developer.

Your job is to start conversations with potential clients, understand their business, identify problems you can solve, and move them toward a call with Sadiq.

About Sadiq:
- Builds AI systems: chatbots, RAG systems, document intelligence, NLP pipelines, predictive ML models
- Builds workflow automation: automated lead handling, CRM integrations, data pipelines, AI-powered automation
- Builds web platforms: SaaS apps, backend APIs, dashboards, AI-powered web applications
- Portfolio: https://sadiqshehu.vercel.app

Past projects (use as social proof when relevant):
- University AI Chatbot for Air Force Institute of Technology — helped students access admissions and campus information instantly
- Malaria Prediction ML Model — predictive modeling for healthcare
- AI Document RAG Platform — users upload documents, chat with them, get summaries. Built with Flutterwave payments and subscription tiers.
- Lead Messenger System — AI-powered WhatsApp outreach and qualification system (the system you're running on right now)

Conversation flow:
1. Greet warmly, introduce yourself as Sadiq's assistant
2. Ask what their business does
3. Listen for pain points — manual processes, customer communication, data handling, repetitive tasks
4. Suggest a relevant solution from Sadiq's services
5. Reference a past project as proof
6. Invite them to schedule a call with Sadiq

Rules:
- Be concise. 2-3 sentences per reply unless detail is needed.
- Never invent services, prices, or timelines Sadiq hasn't confirmed.
- Always address the lead by their first name.
- Never send links or files — text only. Exception: share the portfolio link only when asked.
- If they ask to stop receiving messages, reply "Understood, I'll stop messaging you." and nothing else.
- If they ask a technical question beyond your knowledge, say Sadiq will address it on the call.
- Never mention you are an AI unless directly asked.
"""


# ── Prompt builder (shared across all providers) ─────────────────

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
    parts.append("## Your reply (as Svdeeq assistant)")

    return "\n\n".join(parts)


# ── Provider 1: Gemini ───────────────────────────────────────────

async def _try_gemini(prompt: str) -> str:
    """
    Calls Google Gemini 1.5 Flash.
    Raises on any error — caller handles the fallback.
    """
    model = genai.GenerativeModel(
        model_name=settings.gemini_model,
        system_instruction=SYSTEM_PROMPT,
    )
    response = model.generate_content(prompt)
    text = response.text.strip()
    if not text:
        raise ValueError("Gemini returned empty response")
    return text


# ── Provider 2: Groq ─────────────────────────────────────────────

async def _try_groq(prompt: str) -> str:
    """
    Calls Groq Cloud (Llama 3 8B by default — fast and free-tier generous).
    Uses the OpenAI-compatible REST API that Groq exposes.
    Raises on any error.
    """
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
        "max_tokens":   500,
        "temperature":  0.7,
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
    """
    Calls HuggingFace Inference API.
    Slower than Gemini/Groq but almost always available on free tier.
    Raises on any error.
    """
    model  = settings.huggingface_model
    url    = f"https://router.huggingface.co/hf-inference/models/{model}"

    headers = {
        "Authorization": f"Bearer {settings.huggingface_api_key}",
        "Content-Type":  "application/json",
    }

    # HuggingFace Inference API uses a simple inputs field
    # We prepend the system prompt into the user prompt since
    # the raw inference API doesn't have a system role.
    full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}\n\nAssistant:"

    payload = {
        "inputs":     full_prompt,
        "parameters": {
            "max_new_tokens": 300,
            "temperature":    0.7,
            "return_full_text": False,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:  # HF can be slow, 30s timeout
        response = await client.post(url, json=payload, headers=headers)

    if response.status_code != 200:
        raise RuntimeError(f"HuggingFace error {response.status_code}: {response.text[:200]}")

    data = response.json()

    # HF returns a list of generated texts
    if isinstance(data, list) and data:
        text = data[0].get("generated_text", "").strip()
    else:
        text = ""

    if not text:
        raise ValueError("HuggingFace returned empty response")

    return text


# ── Admin notification ───────────────────────────────────────────

async def _notify_admin(provider_used: str, failed_providers: list[str], lead_id) -> None:
    """
    Sends an internal alert when a fallback provider is used.
    Writes to audit_logs (always) and sends a WhatsApp message
    to the admin number if configured.
    """
    await log.warn(
        "LLM_FALLBACK_USED",
        lead_id=lead_id,
        metadata={
            "provider_used":    provider_used,
            "failed_providers": failed_providers,
        },
    )

    # WhatsApp admin alert (only if admin number is configured)
    if not settings.admin_whatsapp_number:
        return

    try:
        # Import here to avoid circular dependency
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
            lead_id=UUID(int=0),  # system message, no real lead_id
        )
    except Exception as e:
        await log.warn(
            "ADMIN_NOTIFY_FAILED",
            metadata={"error": str(e)},
        )


# ── Main entry point ─────────────────────────────────────────────

async def generate_reply(
    context:      ConversationContext,
    user_message: str,
) -> tuple[str, str]:
    """
    Attempts to generate a reply by walking down the fallback chain.

    Returns:
        (reply_text: str, provider_used: str)
        provider_used is one of: "gemini", "groq", "huggingface", "rule_based"

    Never raises — the rule-based fallback always succeeds.
    """
    prompt          = _build_prompt(context, user_message)
    failed_providers: list[str] = []

    # ── Level 1: Gemini ──────────────────────────────────────────
    try:
        reply = await _try_gemini(prompt)
        await log.info(
            "LLM_REPLY_GENERATED",
            lead_id=context.lead_id,
            metadata={"provider": "gemini", "preview": reply[:80]},
        )
        return reply, "gemini"

    except Exception as e:
        failed_providers.append("gemini")
        await log.warn(
            "LLM_PROVIDER_FAILED",
            lead_id=context.lead_id,
            metadata={"provider": "gemini", "error": str(e)[:120]},
        )

    # ── Level 2: Groq ────────────────────────────────────────────
    try:
        reply = await _try_groq(prompt)
        await _notify_admin("groq", failed_providers, context.lead_id)
        await log.info(
            "LLM_REPLY_GENERATED",
            lead_id=context.lead_id,
            metadata={"provider": "groq", "preview": reply[:80]},
        )
        return reply, "groq"

    except Exception as e:
        failed_providers.append("groq")
        await log.warn(
            "LLM_PROVIDER_FAILED",
            lead_id=context.lead_id,
            metadata={"provider": "groq", "error": str(e)[:120]},
        )

    # ── Level 3: HuggingFace ─────────────────────────────────────
    try:
        reply = await _try_huggingface(prompt)
        await _notify_admin("huggingface", failed_providers, context.lead_id)
        await log.info(
            "LLM_REPLY_GENERATED",
            lead_id=context.lead_id,
            metadata={"provider": "huggingface", "preview": reply[:80]},
        )
        return reply, "huggingface"

    except Exception as e:
        failed_providers.append("huggingface")
        await log.warn(
            "LLM_PROVIDER_FAILED",
            lead_id=context.lead_id,
            metadata={"provider": "huggingface", "error": str(e)[:120]},
        )

    # ── Level 4: Rule-based (always succeeds) ────────────────────
    reply = get_rule_based_response(user_message)
    await _notify_admin("rule_based", failed_providers, context.lead_id)
    await log.warn(
        "LLM_ALL_PROVIDERS_FAILED",
        lead_id=context.lead_id,
        metadata={"failed": failed_providers},
    )
    return reply, "rule_based"


# ── Summary generation (used by memory.py) ───────────────────────

async def generate_summary(transcript: str) -> str:
    """
    Compresses a conversation transcript into a persistent summary.
    Tries Gemini first, then Groq. Returns empty string if both fail
    (old summary is kept in that case).
    """
    prompt = (
        "Summarise the following real estate enquiry conversation in 3-5 sentences. "
        "Include: what the lead is looking for, their budget if mentioned, "
        "their location preference, and any key decisions or commitments made.\n\n"
        f"{transcript}\n\nSummary:"
    )

    # Try Gemini
    try:
        model    = genai.GenerativeModel(model_name=settings.gemini_model)
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        pass

    # Try Groq
    try:
        return await _try_groq(prompt)
    except Exception as e:
        await log.warn("SUMMARY_GENERATION_FAILED", metadata={"error": str(e)})
        return ""  # Keep the old summary
