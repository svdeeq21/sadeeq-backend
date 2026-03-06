# svdeeq-backend/main.py
#
# FastAPI application entry point.
# Mounts all routers and configures startup behaviour.
#
# To run locally:
#   uvicorn main:app --reload --port 8000

# svdeeq-backend/main.py  (updated — replace your existing main.py with this)
#
# Added: custom HTTP exception handler so 409 duplicate responses
# return a JSON body containing lead_id, which Apps Script reads.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException as FastAPIHTTPException
from app.core.config import get_settings
from app.routers import webhook, leads, health

settings = get_settings()

app = FastAPI(
    title="Svdeeq-Bot API",
    version="2.0.0",
    description="AI WhatsApp Receptionist & CRM Backend",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://svdeeq-crm.vercel.app",  # replace with your Vercel URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)

# ── Custom exception handler ──────────────────────────────────────
# Ensures 409 duplicate responses include lead_id in the body
# so the Apps Script can record it in the sheet.

@app.exception_handler(FastAPIHTTPException)
async def http_exception_handler(request, exc: FastAPIHTTPException):
    body = {"detail": exc.detail}
    # For 409 duplicates, surface the lead_id from the response header
    if exc.status_code == 409 and exc.headers and "X-Lead-Id" in exc.headers:
        body["lead_id"] = exc.headers["X-Lead-Id"]
    return JSONResponse(
        status_code=exc.status_code,
        content=body,
        headers=dict(exc.headers) if exc.headers else {},
    )

# ── Routers ───────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(webhook.router)
app.include_router(leads.router)


@app.get("/")
async def root():
    return {"service": "svdeeq-bot", "version": "2.0.0", "status": "running"}
