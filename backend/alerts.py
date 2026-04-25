"""Deal Alert Engine — Flyrr Season 2

Scheduled job that polls the Flipp API for watched products and fires
email + Telegram notifications when a price drops below the user's target.

Run standalone:  python alerts.py
Or import and call check_all_alerts() from a cron / APScheduler job.
"""

import asyncio
import logging
import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── DB ──────────────────────────────────────────────────────────────────────
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ── Email config (set in .env) ───────────────────────────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)

# ── Telegram config (set in .env) ────────────────────────────────────────────
# TELEGRAM_BOT_TOKEN: from @BotFather
# TELEGRAM_CHAT_ID:   your personal chat ID or a group/channel ID
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_API_BASE = "https://api.telegram.org/bot"


# ── Telegram helpers ─────────────────────────────────────────────────────────
def _send_telegram(chat_id: str, text: str, parse_mode: str = "HTML") -> bool:
    """Send a Telegram message via Bot API. Returns True on success."""
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set — skipping Telegram notification")
        return False
    if not chat_id:
        logger.warning("No Telegram chat_id provided — skipping")
        return False
    try:
        url = f"{TELEGRAM_API_BASE}{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
        resp = requests.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        logger.info("Telegram message sent to chat_id %s", chat_id)
        return True
    except Exception as exc:
        logger.error("Telegram send failed: %s", exc)
        return False


def _build_telegram_message(alert: dict, best_hit: dict) -> str:
    """Format a Telegram HTML message for a price drop alert."""
    product = alert["product_name"]
    target = alert["target_price"]
    found_price = best_hit["current_price"]
    merchant = best_hit["merchant"]
    last_seen = alert.get("last_seen_price") or found_price
    savings = round(last_seen - found_price, 2)
    savings_line = f"\n💰 <b>You save ${savings:.2f}</b> vs last seen!" if savings > 0 else ""

    return (
        f"🛒 <b>Flyrr Deal Alert</b>\n\n"
        f"<b>{product}</b>\n"
        f"📍 At <b>{merchant}</b>\n"
        f"💵 Now: <b>${found_price:.2f}</b>\n"
        f"🎯 Your target: ${target:.2f}"
        f"{savings_line}\n\n"
        f"<i>Open Flyrr to add it to your shopping list.</i>"
    )


# ── Email helpers ─────────────────────────────────────────────────────────────
def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an HTML email via SMTP. Returns True on success."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP not configured — skipping email to %s", to_email)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = FROM_EMAIL
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        logger.info("Email sent to %s — %s", to_email, subject)
        return True
    except Exception as exc:
        logger.error("Email send failed: %s", exc)
        return False


def _build_alert_email(alert: dict, best_hit: dict) -> str:
    product = alert["product_name"]
    target = alert["target_price"]
    found_price = best_hit["current_price"]
    merchant = best_hit["merchant"]
    savings = round(alert.get("last_seen_price", found_price) - found_price, 2)
    savings_line = (
        f"<p style='color:#4CAF50;font-size:18px;font-weight:bold;'>"
        f"You save ${savings:.2f} vs last seen price!</p>"
        if savings > 0
        else ""
    )
    img = best_hit.get("image_url", "")
    img_tag = (
        f"<img src='{img}' style='max-width:120px;border-radius:8px;margin:12px 0;' />"
        if img
        else ""
    )
    return f"""
    <html><body style='font-family:sans-serif;max-width:480px;margin:auto;padding:24px;'>
      <h2 style='color:#333;'>🛒 Flyrr Deal Alert</h2>
      <p style='color:#555;'>Great news! A deal you're watching just dropped.</p>
      <div style='background:#f9f9f9;border-radius:12px;padding:20px;margin:16px 0;'>
        {img_tag}
        <h3 style='margin:0 0 8px;color:#222;'>{product}</h3>
        <p style='margin:4px 0;color:#666;'>📍 Available at <strong>{merchant}</strong></p>
        <p style='margin:4px 0;font-size:28px;font-weight:bold;color:#4CAF50;'>${found_price:.2f}</p>
        <p style='margin:4px 0;color:#999;font-size:14px;'>Your target: ${target:.2f}</p>
        {savings_line}
      </div>
      <p style='color:#999;font-size:12px;margin-top:24px;'>
        This alert was sent by Flyrr — your smart grocery companion.<br/>
        To stop alerts for this item, open the app and remove it from your Watchlist.
      </p>
    </body></html>
    """


# ── Price fetch ───────────────────────────────────────────────────────────────
def _fetch_current_price(product_name: str, postal_code: str) -> list[dict]:
    """Hit the Flipp search API and return processed items sorted by price."""
    url = (
        f"https://backflipp.wishabi.com/flipp/items/search"
        f"?locale=en-ca&postal_code={postal_code}&q={product_name}"
    )
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        ecom = resp.json().get("ecom_items", [])
        results = [
            {
                "name": i.get("name", ""),
                "merchant": i.get("merchant", ""),
                "current_price": float(i.get("current_price", 0)),
                "image_url": i.get("image_url", ""),
                "merchant_logo": i.get("merchant_logo", ""),
            }
            for i in ecom
            if float(i.get("current_price", 0)) > 0
        ]
        results.sort(key=lambda x: x["current_price"])
        return results
    except Exception as exc:
        logger.error("Flipp fetch failed for '%s': %s", product_name, exc)
        return []


# ── Core check logic ─────────────────────────────────────────────────────────
async def check_all_alerts() -> dict:
    """Poll prices for every active alert and fire notifications where triggered."""
    alerts = await db.price_alerts.find({"active": True}).to_list(500)
    fired = 0
    checked = 0

    for alert in alerts:
        product_name = alert.get("product_name", "")
        postal_code = alert.get("postal_code", "")
        target_price = float(alert.get("target_price", 0))
        notify_email = alert.get("notify_email", "")
        notify_telegram = alert.get("notify_telegram", "")  # per-alert chat_id override
        telegram_chat_id = notify_telegram or TELEGRAM_CHAT_ID

        if not product_name or not postal_code:
            continue

        checked += 1
        hits = _fetch_current_price(product_name, postal_code)
        if not hits:
            continue

        best = hits[0]  # already sorted cheapest-first
        current_price = best["current_price"]

        update_fields: dict = {
            "last_seen_price": current_price,
            "last_checked_at": datetime.utcnow().isoformat(),
            "best_merchant": best["merchant"],
        }

        # Fire alert when price is AT or BELOW target
        if current_price <= target_price:
            update_fields["last_triggered_at"] = datetime.utcnow().isoformat()
            fired += 1

            channels_fired = []

            # Log notification record
            await db.alert_notifications.insert_one({
                "alert_id": str(alert.get("id", alert.get("_id", ""))),
                "product_name": product_name,
                "found_price": current_price,
                "target_price": target_price,
                "merchant": best["merchant"],
                "triggered_at": datetime.utcnow().isoformat(),
            })

            # Send Telegram notification
            if telegram_chat_id:
                tg_msg = _build_telegram_message(alert, best)
                sent = _send_telegram(telegram_chat_id, tg_msg)
                if sent:
                    channels_fired.append("telegram")

            # Send email notification
            if notify_email:
                subject = f"🛒 Flyrr Alert: {product_name} is now ${current_price:.2f}!"
                html = _build_alert_email(alert, best)
                sent = _send_email(notify_email, subject, html)
                if sent:
                    channels_fired.append("email")

            logger.info(
                "Alert fired for '%s' @ $%.2f (target $%.2f) via %s",
                product_name, current_price, target_price,
                ", ".join(channels_fired) if channels_fired else "no channel configured"
            )

        await db.price_alerts.update_one(
            {"_id": alert["_id"]}, {"$set": update_fields}
        )

    logger.info("Alert check complete: %d checked, %d fired", checked, fired)
    return {"checked": checked, "fired": fired}


# ── Standalone entry ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    asyncio.run(check_all_alerts())
