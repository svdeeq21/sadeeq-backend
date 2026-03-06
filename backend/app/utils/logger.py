# svdeeq-backend/app/utils/logger.py
#
# Structured logger that writes to two places simultaneously:
#   1. stdout  (for Render/Koyeb log streaming)
#   2. audit_logs table in Supabase (for dashboard observability)
#
# Usage:
#   from app.utils.logger import log
#   await log.info("AI_REPLIED", lead_id=lead.id, metadata={"latency_ms": 1200})
#   await log.error("LLM_QUOTA_EXCEEDED", metadata={"error": str(e)})

import logging
import sys
from uuid import UUID
from typing import Optional
from app.core.supabase import get_supabase

# Configure stdlib logger for stdout
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
_logger = logging.getLogger("svdeeq")


class AuditLogger:
    """
    Thin wrapper that writes structured events to audit_logs
    and echoes them to stdout.
    """

    async def _write(
        self,
        event_type: str,
        severity: str,
        lead_id: Optional[UUID] = None,
        metadata: Optional[dict] = None,
    ) -> None:
        # Always log to stdout first — if DB write fails we still have logs
        msg = f"[{event_type}]"
        if lead_id:
            msg += f" lead={lead_id}"
        if metadata:
            msg += f" {metadata}"

        level = getattr(logging, severity, logging.INFO)
        _logger.log(level, msg)

        # Write to Supabase audit_logs (best-effort — never raises)
        try:
            db = get_supabase()
            payload = {
                "event_type": event_type,
                "severity":   severity,
                "metadata":   metadata or {},
            }
            if lead_id:
                payload["lead_id"] = str(lead_id)

            db.table("audit_logs").insert(payload).execute()
        except Exception as e:
            _logger.warning(f"Failed to write audit log to DB: {e}")

    async def debug(self, event_type: str, lead_id: Optional[UUID] = None, metadata: Optional[dict] = None):
        await self._write(event_type, "DEBUG", lead_id, metadata)

    async def info(self, event_type: str, lead_id: Optional[UUID] = None, metadata: Optional[dict] = None):
        await self._write(event_type, "INFO", lead_id, metadata)

    async def warn(self, event_type: str, lead_id: Optional[UUID] = None, metadata: Optional[dict] = None):
        await self._write(event_type, "WARN", lead_id, metadata)

    async def error(self, event_type: str, lead_id: Optional[UUID] = None, metadata: Optional[dict] = None):
        await self._write(event_type, "ERROR", lead_id, metadata)

    async def critical(self, event_type: str, lead_id: Optional[UUID] = None, metadata: Optional[dict] = None):
        await self._write(event_type, "CRITICAL", lead_id, metadata)


# Single shared instance
log = AuditLogger()
