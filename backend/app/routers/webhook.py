# svdeeq-backend/app/routers/webhook.py
#
# Single endpoint: POST /webhook/whatsapp
#
# Evolution API posts here for every WA event.
# We verify the signature, return 200 immediately, then
# process the message as a background task so Evolution
# doesn't time out waiting for us.

import json
from fastapi import APIRouter, Request, BackgroundTasks, Depends
from app.core.security import verify_webhook_signature
from app.models.schemas import WAWebhookPayload
from app.services.message_pipeline import process_inbound_message
from app.utils.logger import log

router = APIRouter(prefix="/webhook", tags=["webhook"])

# Events we care about — ignore all others
HANDLED_EVENTS = {"messages.upsert"}


@router.post("/whatsapp")
async def whatsapp_webhook(
    request:    Request,
    background: BackgroundTasks,
    raw_body:   bytes = Depends(verify_webhook_signature),
):
    """
    Receives all Evolution API webhook events.

    Flow:
      1. Signature already verified by verify_webhook_signature dependency
      2. Parse raw body into WAWebhookPayload
      3. Filter to message events only
      4. Hand off to pipeline as background task
      5. Return 200 immediately
    """

    # Parse payload
    try:
        data = json.loads(raw_body)
        payload = WAWebhookPayload(**data)
    except Exception as e:
        await log.warn("WEBHOOK_PARSE_ERROR", metadata={"error": str(e)})
        # Still return 200 so Evolution doesn't retry endlessly
        return {"status": "parse_error"}

    # Ignore events we don't handle (connection events, status updates, etc.)
    if payload.event not in HANDLED_EVENTS:
        return {"status": "ignored", "event": payload.event}

    # Ignore messages sent BY us (fromMe=True) to prevent echo loops
    if payload.data.key.get("fromMe"):
        return {"status": "ignored", "reason": "own_message"}

    # Queue processing as a background task — respond immediately
    background.add_task(process_inbound_message, payload)

    return {"status": "queued"}
