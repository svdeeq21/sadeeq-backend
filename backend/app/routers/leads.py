# svdeeq-backend/app/routers/leads.py
#
# Endpoints consumed by the Next.js CRM dashboard.
# All routes require the X-Admin-Key header.
#
#   GET  /leads              — list all leads (with message counts)
#   GET  /leads/{id}         — single lead detail
#   GET  /leads/{id}/messages — full conversation transcript
#   PATCH /leads/{id}/pause  — toggle ai_paused (dashboard pause button)

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import require_admin_key
from app.core.supabase import get_supabase
from app.models.schemas import LeadPauseUpdate
from app.utils.logger import log

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("")
async def list_leads(_: str = Depends(require_admin_key)):
    """
    Returns all leads joined with their session message count.
    Sorted by last activity descending.
    """
    db = get_supabase()

    result = (
        db.table("leads")
        .select("""
            id, name, phone_number, status, ai_paused,
            location, budget_range, interest_type,
            created_at, updated_at,
            sessions (message_count, last_activity)
        """)
        .order("created_at", desc=True)
        .execute()
    )

    # Flatten sessions join for frontend convenience
    leads = []
    for row in (result.data or []):
        session = (row.pop("sessions", None) or [{}])
        session = session[0] if isinstance(session, list) else session
        row["message_count"] = session.get("message_count", 0)
        row["last_activity"]  = session.get("last_activity")
        # Mask phone number for frontend (show first 4 + last 2 digits)
        phone = row.get("phone_number", "")
        row["phone_display"] = phone[:4] + "×" * (len(phone) - 6) + phone[-2:] if len(phone) > 6 else "××××"
        leads.append(row)

    return {"leads": leads, "total": len(leads)}


@router.get("/{lead_id}")
async def get_lead(lead_id: UUID, _: str = Depends(require_admin_key)):
    """Returns a single lead with full session details."""
    db = get_supabase()

    result = (
        db.table("leads")
        .select("""
            id, name, phone_number, status, ai_paused,
            location, budget_range, interest_type,
            source, created_at, updated_at,
            sessions (message_count, last_activity, conversation_summary)
        """)
        .eq("id", str(lead_id))
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    return result.data


@router.get("/{lead_id}/messages")
async def get_messages(
    lead_id: UUID,
    limit:   int = 50,
    _: str = Depends(require_admin_key),
):
    """
    Returns the conversation transcript for a lead.
    Ordered oldest → newest for correct chat display.
    """
    db = get_supabase()

    result = (
        db.table("messages")
        .select("id, sender, content, message_type, timestamp, latency_ms")
        .eq("lead_id", str(lead_id))
        .order("timestamp", desc=False)
        .limit(limit)
        .execute()
    )

    return {"messages": result.data or [], "lead_id": str(lead_id)}


@router.patch("/{lead_id}/pause")
async def toggle_pause(
    lead_id: UUID,
    body:    LeadPauseUpdate,
    _: str = Depends(require_admin_key),
):
    """
    Toggles ai_paused for a lead.
    Called by the ⏸ Pause AI / ▶ Resume AI button in the dashboard.

    When pausing:   status → AI_PAUSED
    When resuming:  status → AI_RESPONDED (AI will reply to next message)
    """
    db = get_supabase()

    new_status = "AI_PAUSED" if body.ai_paused else "AI_RESPONDED"

    result = (
        db.table("leads")
        .update({"ai_paused": body.ai_paused, "status": new_status})
        .eq("id", str(lead_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    await log.info(
        "AI_PAUSED" if body.ai_paused else "AI_RESUMED",
        lead_id=lead_id,
        metadata={"triggered_by": "admin_dashboard"},
    )

    return {"lead_id": str(lead_id), "ai_paused": body.ai_paused, "status": new_status}


# svdeeq-backend/app/routers/leads.py
#
# ADD THIS ENDPOINT to the existing leads.py router.
# Paste it below the existing routes — the router and imports are already there.
#
# This endpoint is called exclusively by the Google Apps Script.
# It receives a new lead, deduplicates by phone number, and inserts
# into Supabase. The Apps Script writes the returned lead_id back
# into the sheet for traceability.

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.security import require_admin_key
from app.core.supabase import get_supabase
from app.utils.logger import log


# ── Ingest schema ─────────────────────────────────────────────────
# Add this to app/models/schemas.py as well (shown below)

class LeadIngestRequest(BaseModel):
    name:          str
    phone_number:  str
    opted_in:      bool
    location:      Optional[str] = None
    budget_range:  Optional[str] = None
    interest_type: Optional[str] = None
    source:        Optional[str] = "google_sheets"
    external_id:   Optional[str] = None    # e.g. "sheet_row_14"


class LeadIngestResponse(BaseModel):
    lead_id:   str
    status:    str    # "created" | "already_exists"
    message:   str


# ── Endpoint ──────────────────────────────────────────────────────
# Add this to the existing leads router in app/routers/leads.py

@router.post("/ingest", response_model=LeadIngestResponse, status_code=201)
async def ingest_lead(
    body: LeadIngestRequest,
    _: str = Depends(require_admin_key),
):
    """
    Called by Google Apps Script when a new row is added to the sheet.

    Behaviour:
    - If the phone number already exists → returns 409 with existing lead_id
      (Apps Script treats 409 as success and records the existing ID)
    - If opted_in is False → returns 400 (Apps Script marks row as SKIPPED)
    - Otherwise → inserts lead, returns 201 with new lead_id

    The lead starts with status=PENDING.
    The outreach module (future) will pick it up and send the first message.
    """
    db = get_supabase()

    # Safety gate — never ingest a lead who hasn't opted in
    if not body.opted_in:
        raise HTTPException(
            status_code=400,
            detail="Lead has not opted in — cannot ingest",
        )

    # Deduplication check — phone number is unique in the leads table
    existing = (
        db.table("leads")
        .select("id, status")
        .eq("phone_number", body.phone_number)
        .maybe_single()
        .execute()
    )

    if existing.data:
        lead_id = existing.data["id"]
        await log.info(
            "LEAD_INGEST_DUPLICATE",
            lead_id=UUID(lead_id),
            metadata={"phone_prefix": body.phone_number[:6], "source": body.source},
        )
        # Return 409 so Apps Script knows it's a duplicate
        raise HTTPException(
            status_code=409,
            detail=f"Lead already exists",
            headers={"X-Lead-Id": lead_id},   # Apps Script can read this header
        )
        # Note: the Apps Script also parses the 409 response body,
        # so we also include lead_id in a custom exception handler.
        # See the note at the bottom of this file.

    # Insert new lead
    insert_data = {
        "name":          body.name,
        "phone_number":  body.phone_number,
        "status":        "PENDING",
        "opted_in":      True,
        "ai_paused":     False,
        "source":        body.source or "google_sheets",
    }

    # Only include optional fields if they have values
    if body.location:      insert_data["location"]      = body.location
    if body.budget_range:  insert_data["budget_range"]  = body.budget_range
    if body.interest_type: insert_data["interest_type"] = body.interest_type
    if body.external_id:   insert_data["external_id"]   = body.external_id

    result = db.table("leads").insert(insert_data).execute()

    if not result.data:
        await log.error(
            "LEAD_INGEST_FAILED",
            metadata={"phone_prefix": body.phone_number[:6]},
        )
        raise HTTPException(status_code=500, detail="Failed to insert lead")

    lead_id = result.data[0]["id"]

    await log.info(
        "LEAD_INGESTED",
        lead_id=UUID(lead_id),
        metadata={
            "name":         body.name,
            "phone_prefix": body.phone_number[:6],
            "source":       body.source,
        },
    )

    return LeadIngestResponse(
        lead_id=lead_id,
        status="created",
        message=f"Lead {body.name} ingested successfully",
    )


# ── NOTE: 409 response body ───────────────────────────────────────
# The HTTPException for duplicates above doesn't return a JSON body
# with lead_id. To fix this properly, add a custom exception handler
# in main.py:
#
# from fastapi.responses import JSONResponse
# from fastapi.exceptions import HTTPException as FastAPIHTTPException
#
# @app.exception_handler(FastAPIHTTPException)
# async def http_exception_handler(request, exc):
#     body = {"detail": exc.detail}
#     # If it's a 409, include the lead_id from the header
#     if exc.status_code == 409 and "X-Lead-Id" in (exc.headers or {}):
#         body["lead_id"] = exc.headers["X-Lead-Id"]
#     return JSONResponse(status_code=exc.status_code, content=body, headers=exc.headers or {})
#
# This lets the Apps Script read lead_id from the 409 response body.
