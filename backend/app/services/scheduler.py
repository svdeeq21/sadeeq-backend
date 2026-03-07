# svdeeq-backend/app/services/scheduler.py
#
# Background scheduler — runs outreach cycle every 20-40 minutes.
# Started once when the FastAPI app boots up.
# Uses asyncio so it doesn't block the main server.

import asyncio
import random
from app.services.outreach import run_outreach_cycle
from app.utils.logger import log

# Random interval between cycles (seconds)
MIN_INTERVAL = 20 * 60   # 20 minutes
MAX_INTERVAL = 40 * 60   # 40 minutes

_scheduler_task = None


async def _scheduler_loop() -> None:
    """Runs forever, firing outreach cycle at random human-like intervals."""
    await log.info("SCHEDULER_STARTED", metadata={"min_mins": 20, "max_mins": 40})

    while True:
        try:
            await run_outreach_cycle()
        except Exception as e:
            await log.warn("SCHEDULER_CYCLE_ERROR", metadata={"error": str(e)})

        # Random human-like delay before next cycle
        interval = random.randint(MIN_INTERVAL, MAX_INTERVAL)
        await asyncio.sleep(interval)


def start_scheduler() -> None:
    """
    Call this once from main.py on app startup.
    Creates the background task.
    """
    global _scheduler_task
    loop = asyncio.get_event_loop()
    _scheduler_task = loop.create_task(_scheduler_loop())


def stop_scheduler() -> None:
    """Call on app shutdown."""
    global _scheduler_task
    if _scheduler_task:
        _scheduler_task.cancel()
        _scheduler_task = None
