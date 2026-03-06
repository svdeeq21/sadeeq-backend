# svdeeq-backend/app/routers/health.py
#
# GET /health
#
# Two purposes:
#   1. Uptime ping — keeps Render/Koyeb free tier awake
#      (configure your ping service to hit /health every 14 minutes)
#   2. Dashboard status banner — the CRM frontend polls this to show
#      WA connection state, DB health, and LLM quota warnings

from fastapi import APIRouter
from app.core.config import get_settings
from app.core.supabase import get_supabase
from app.services.whatsapp import get_wa_connection_status
from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Returns system status. Called by:
      - External ping service (no auth required — uptime check)
      - CRM dashboard status banner (polls every 30s)
    """

    # Database health — quick query
    db_status = "healthy"
    try:
        db = get_supabase()
        db.table("leads").select("id").limit(1).execute()
    except Exception as e:
        db_status = f"error: {str(e)[:60]}"

    # WhatsApp connection status
    wa_status = await get_wa_connection_status()

    return HealthResponse(
        status="ok" if db_status == "healthy" and wa_status == "CONNECTED" else "degraded",
        environment=settings.app_env,
        db=db_status,
        wa=wa_status,
    )
