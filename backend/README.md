# Svdeeq-Bot · FastAPI Backend

AI WhatsApp Receptionist backend. Receives Evolution API webhooks,
runs the RAG pipeline, and exposes endpoints for the CRM dashboard.

---

## Local setup

```bash
cd svdeeq-backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # fill in your keys
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

## File structure

```
main.py                        ← app entry point
app/
  core/
    config.py                  ← all env vars (pydantic-settings)
    supabase.py                ← single DB client (service_role)
    security.py                ← webhook HMAC verification + admin key
  routers/
    webhook.py                 ← POST /webhook/whatsapp
    leads.py                   ← GET/PATCH /leads
    health.py                  ← GET /health
  services/
    message_pipeline.py        ← 10-step pipeline orchestrator
    rag.py                     ← embed + vector search
    llm.py                     ← Gemini prompt + fallback
    whatsapp.py                ← Evolution API sender + anti-ban
    memory.py                  ← context fetch + summary update
    escalation.py              ← escalation triggers + ai_paused check
  models/
    schemas.py                 ← all Pydantic models
  utils/
    logger.py                  ← structured logging → audit_logs table
    retry.py                   ← exponential backoff decorator
```

---

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | None | Uptime ping + system status |
| POST | `/webhook/whatsapp` | HMAC signature | Evolution API inbound messages |
| GET | `/leads` | X-Admin-Key | List all leads |
| GET | `/leads/{id}` | X-Admin-Key | Single lead detail |
| GET | `/leads/{id}/messages` | X-Admin-Key | Conversation transcript |
| PATCH | `/leads/{id}/pause` | X-Admin-Key | Toggle AI pause |

---

## Message pipeline (10 steps)

```
1.  Receive webhook
2.  Store inbound message immediately
3.  Check ai_paused flag
4.  Check rate limit (5 msg/min per lead)
5.  Retrieve context (recent window + summary)
6.  Vector search knowledge base
7.  Call Gemini LLM
8.  Store AI response
9.  Send via Evolution API
10. Log latency + RAG score to audit_logs
```

---

## Escalation triggers

| Trigger | Action |
|---------|--------|
| Media message received | Escalate → HUMAN_REQUIRED |
| No RAG match (low confidence) | Escalate → HUMAN_REQUIRED |
| LLM quota exceeded (429) | Fallback reply + Escalate |
| User says "speak to a human" etc. | Escalate immediately |
| Admin toggles pause in dashboard | ai_paused=TRUE, AI stops |

---

## Deployment (Render free tier)

1. Push to GitHub
2. New Web Service → connect repo
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add all env vars from `.env.example` in Render dashboard
6. Set up a free ping service (e.g. UptimeRobot) to hit `/health` every 14 minutes to prevent sleep

---

## Anti-ban notes

- All outbound messages include a randomised 1.5–4s delay
- First outreach messages get a 2.5–6s delay
- No links allowed in outreach messages
- Daily cap enforced via `outreach_daily_caps` table (starts at 10/day)
- Cap auto-ramps +10/day up to a max of 50
- Delivery failures trigger exponential backoff (3 attempts max)
- After 3 failures: lead marked INVALID_NUMBER
