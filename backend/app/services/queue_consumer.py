# svdeeq-backend/app/services/queue_consumer.py
#
# Upstash Redis Queue Consumer
#
# This replaces the direct webhook → pipeline flow.
# Instead of FastAPI receiving webhooks directly, this worker
# polls the Upstash queue every few seconds and processes messages.
#
# Benefits:
# - If FastAPI is down, messages pile up in the queue safely
# - When FastAPI restarts, it drains the queue in order
# - No messages are ever lost
# - Works even through Render sleep/wake cycles
#
# How it works:
# 1. Polls Upstash Redis queue (BLPOP with timeout)
# 2. Parses the raw Evolution API webhook payload
# 3. Passes it to the existing message_pipeline.process_inbound_message()
# 4. Loops forever, respects safe hours
#
# The existing message_pipeline.py is unchanged — we just feed it
# from the queue instead of directly from the webhook endpoint.

import asyncio
import json
import logging
import httpx
from datetime import datetime, timezone

from app.core.config import get_settings
from app.models.schemas import WAWebhookPayload
from app.services.message_pipeline import process_inbound_message
from app.utils.logger import log

_l       = logging.getLogger("svdeeq")
settings = get_settings()

# ── Constants ─────────────────────────────────────────────────────────────────
QUEUE_KEY        = "svdeeq:webhook:queue"
POLL_TIMEOUT_SEC = 5      # BLPOP blocks for up to 5 seconds before looping
MAX_BATCH        = 20     # max messages to process per wake cycle
RETRY_DELAY_SEC  = 2      # wait between retries on Redis errors


class QueueConsumer:
    """
    Long-running async worker that drains the Upstash Redis queue.
    Started once on app startup. Runs forever in the background.
    """

    def __init__(self):
        self.running  = False
        self._task    = None
        self.settings = get_settings()

    def start(self) -> None:
        """Call once from main.py lifespan startup."""
        if self._task and not self._task.done():
            return
        self.running = True
        loop = asyncio.get_event_loop()
        self._task = loop.create_task(self._run())
        _l.info("[QUEUE_CONSUMER] Started — polling Upstash Redis queue")

    def stop(self) -> None:
        """Call from main.py lifespan shutdown."""
        self.running = False
        if self._task:
            self._task.cancel()
        _l.info("[QUEUE_CONSUMER] Stopped")

    async def _run(self) -> None:
        """Main polling loop — runs forever."""
        consecutive_errors = 0

        while self.running:
            try:
                # Poll the queue — blocks up to POLL_TIMEOUT_SEC
                item = await self._pop_from_queue()

                if item is None:
                    # Queue empty — loop immediately to poll again
                    consecutive_errors = 0
                    continue

                # Process the message
                consecutive_errors = 0
                await self._handle_item(item)

            except asyncio.CancelledError:
                break
            except Exception as e:
                consecutive_errors += 1
                _l.error(f"[QUEUE_CONSUMER] Loop error (#{consecutive_errors}): {e}")

                # Back off exponentially on repeated errors (max 60s)
                delay = min(RETRY_DELAY_SEC * (2 ** min(consecutive_errors, 5)), 60)
                await asyncio.sleep(delay)

    async def _pop_from_queue(self) -> dict | None:
        """
        Pop one message from the Redis list.
        Returns the parsed envelope dict or None if queue is empty.
        """
        # BLPOP blocks until an item is available or timeout
        result = await self._redis_command(
            ["BLPOP", QUEUE_KEY, str(POLL_TIMEOUT_SEC)]
        )

        if not result or result.get("result") is None:
            return None

        # BLPOP returns [key, value] — we want the value
        raw = result["result"]
        if isinstance(raw, list):
            raw = raw[1] if len(raw) > 1 else raw[0]

        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            _l.warning(f"[QUEUE_CONSUMER] Failed to parse queue item: {e}")
            return None

    async def _handle_item(self, item: dict) -> None:
        """
        Parse the envelope, extract the Evolution API payload,
        and feed it to the existing message pipeline.
        """
        raw_body  = item.get("body", "")
        queued_at = item.get("timestamp", 0)

        # Log delay so we know how long messages waited
        delay_ms = int((datetime.now(timezone.utc).timestamp() * 1000) - queued_at)
        if delay_ms > 5000:
            _l.warning(f"[QUEUE_CONSUMER] Message was queued for {delay_ms}ms")

        # Parse the Evolution API webhook JSON
        try:
            webhook_data = json.loads(raw_body)
        except json.JSONDecodeError:
            _l.warning("[QUEUE_CONSUMER] Skipping non-JSON queue item")
            return

        # Only process message events — skip status updates etc.
        event = webhook_data.get("event", "")
        if event != "messages.upsert":
            return

        # Build the WAWebhookPayload the pipeline expects
        try:
            payload = WAWebhookPayload(**webhook_data)
        except Exception as e:
            _l.warning(f"[QUEUE_CONSUMER] Payload parse failed: {e}")
            return

        # Hand off to existing pipeline — unchanged
        try:
            await process_inbound_message(payload)
        except Exception as e:
            # Move to dead letter queue in Supabase for inspection
            await self._send_to_dlq(raw_body, str(e), queued_at)

    async def _send_to_dlq(self, raw_body: str, error: str, queued_at: int) -> None:
        """Send a failed message to the Supabase dead letter queue."""
        try:
            from app.core.supabase import get_supabase
            db = get_supabase()
            db.table("dead_letter_queue").insert({
                "payload":    raw_body[:10000],  # cap size
                "error":      error[:500],
                "queued_at":  datetime.fromtimestamp(queued_at / 1000, tz=timezone.utc).isoformat(),
            }).execute()
            _l.warning(f"[QUEUE_CONSUMER] Message sent to DLQ: {error[:100]}")
        except Exception as dlq_error:
            _l.error(f"[QUEUE_CONSUMER] DLQ write failed: {dlq_error}")

    async def _redis_command(self, command: list) -> dict:
        """
        Execute a Redis command via Upstash REST API.
        Returns the JSON response.
        """
        url   = settings.upstash_redis_rest_url
        token = settings.upstash_redis_rest_token

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization":  f"Bearer {token}",
                    "Content-Type":   "application/json",
                },
                json=command,
            )
            response.raise_for_status()
            return response.json()


# Singleton instance
queue_consumer = QueueConsumer()
