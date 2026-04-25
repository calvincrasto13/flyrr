"""Flyrr Background Scheduler — Season 2

Runs the deal alert check every 30 minutes using APScheduler.
Start this alongside the FastAPI server:

    # In one terminal:
    uvicorn server:app --reload

    # In another terminal (or the same process via startup event):
    python scheduler.py

Or add run_scheduler() to server startup via asyncio.create_task().
"""

import asyncio
import logging
import os
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from alerts import check_all_alerts

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# How often to poll prices (minutes). Override with ALERT_INTERVAL_MINUTES in .env
INTERVAL_MINUTES = int(os.getenv("ALERT_INTERVAL_MINUTES", 30))


async def scheduled_check():
    """Wrapper so APScheduler can call our async alert check."""
    try:
        logger.info("[Scheduler] Running deal alert check...")
        result = await check_all_alerts()
        logger.info("[Scheduler] Done — checked=%d fired=%d", result["checked"], result["fired"])
    except Exception as exc:
        logger.error("[Scheduler] Alert check failed: %s", exc)


def create_scheduler() -> AsyncIOScheduler:
    """Build and return a configured scheduler (does not start it)."""
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        scheduled_check,
        trigger=IntervalTrigger(minutes=INTERVAL_MINUTES),
        id="deal_alert_check",
        name="Flyrr Deal Alert Check",
        replace_existing=True,
        max_instances=1,  # prevent overlapping runs
    )
    return scheduler


async def run_scheduler():
    """Start the scheduler and keep it running (use as main async entry point)."""
    scheduler = create_scheduler()
    scheduler.start()
    logger.info(
        "[Scheduler] Started — deal alerts will check every %d minutes",
        INTERVAL_MINUTES
    )
    try:
        # Run first check immediately on startup
        await scheduled_check()
        # Then keep the event loop alive for periodic checks
        while True:
            await asyncio.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        logger.info("[Scheduler] Shutting down...")
        scheduler.shutdown()


if __name__ == "__main__":
    asyncio.run(run_scheduler())
