# svdeeq-backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException as FastAPIHTTPException
from app.core.config import get_settings
from app.routers import webhook, leads, health
from app.services.scheduler import start_scheduler, stop_scheduler  # NEW

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
    "https://svdeeq-crm.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)

# ── Custom exception handler ──────────────────────────────────────
@app.exception_handler(FastAPIHTTPException)
async def http_exception_handler(request, exc: FastAPIHTTPException):
    body = {"detail": exc.detail}
    if exc.status_code == 409 and exc.headers and "X-Lead-Id" in exc.headers:
        body["lead_id"] = exc.headers["X-Lead-Id"]
    return JSONResponse(
        status_code=exc.status_code,
        content=body,
        headers=dict(exc.headers) if exc.headers else {},
    )

# ── Startup / Shutdown ────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    start_scheduler()


@app.on_event("shutdown")
async def shutdown_event():
    stop_scheduler()

# ── Routers ───────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(webhook.router)
app.include_router(leads.router)


@app.get("/")
async def root():
    return {"service": "svdeeq-bot", "version": "2.0.0", "status": "running"}