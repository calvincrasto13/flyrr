"""
dev_server.py — local development harness for the flyrr web client

`server.py` is the production application: it requires MongoDB at import time
and loads sentence-transformers for the semantic matching pipeline. Neither is
practical for front-end work, so this harness serves the same HTTP surface with:

  - REAL Flipp data for /api/search and /api/deals (identical to production)
  - lightweight token-overlap grouping instead of embeddings + Claude
  - in-memory dicts instead of MongoDB (state resets on restart)

Run it with:
    python -m uvicorn dev_server:app --reload --port 8000

This is a development convenience only — it is NOT the production server, and
its grouping is intentionally cruder than the real semantic matcher.
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, FastAPI, HTTPException
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from categorizer import build_category_facets, categorize_items, is_ambiguous
from deals import fetch_nearby_deals

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("flyrr.dev")

app = FastAPI(title="flyrr API (dev harness)", version="2.0.0-dev")
api_router = APIRouter(prefix="/api")

_thread_pool = ThreadPoolExecutor(max_workers=4)

# ── In-memory stores (stand in for MongoDB collections) ───────────────────────

_db: Dict[str, List[Dict[str, Any]]] = {
    "shopping_lists": [],
    "savings": [],
    "alerts": [],
    "notifications": [],
}

_stats: Dict[str, Any] = {
    "total_searches": 0,
    "total_product_groups": 0,
    "total_cross_store_matches": 0,
    "total_claude_calls": 0,
}


# ── Models ────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    postal_code: str


class PriceAlertCreate(BaseModel):
    product_name: str
    postal_code: str
    target_price: float
    notify_email: Optional[str] = None


class PriceAlertUpdate(BaseModel):
    target_price: Optional[float] = None
    notify_email: Optional[str] = None
    active: Optional[bool] = None


# ── Lightweight grouping (stand-in for the semantic matcher) ──────────────────

_STOPWORDS = {
    "the", "and", "with", "for", "of", "or", "a", "an", "ml", "g", "kg", "l",
    "pack", "size", "ct", "count", "each", "lb", "oz",
}


def _tokens(name: str) -> set:
    """Normalized content words used as the crude matching key."""
    words = re.findall(r"[a-z]+", name.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


def _group_products(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Bucket items by their two most distinctive tokens.

    This is a deliberately simple stand-in — the production grouper uses
    embeddings with a Claude tie-breaker. Good enough to exercise the
    cross-store UI, not good enough to ship.
    """
    buckets: Dict[tuple, List[Dict[str, Any]]] = defaultdict(list)
    for item in items:
        key = tuple(sorted(_tokens(item.get("name", "")))[:2])
        if not key:
            key = (item.get("name", "").lower()[:12],)
        buckets[key].append(item)

    groups: List[Dict[str, Any]] = []
    for members in buckets.values():
        by_price = sorted(members, key=lambda i: i["current_price"])
        best, worst = by_price[0], by_price[-1]

        stores: List[Dict[str, Any]] = []
        seen_merchants: set = set()
        for member in by_price:
            merchant = member.get("merchant", "")
            if merchant in seen_merchants:
                continue
            seen_merchants.add(merchant)
            stores.append({
                "merchant": merchant,
                "name": member.get("name", ""),
                "price": member["current_price"],
                "image_url": member.get("image_url", ""),
                "merchant_logo": member.get("merchant_logo", ""),
                "global_id": member.get("global_id", ""),
                "match_confidence": 0.75,
            })

        # A group's category is whichever its members agree on most often.
        member_categories = [m.get("category", "other") for m in members]
        group_category = max(set(member_categories), key=member_categories.count)

        groups.append({
            "category": group_category,
            "canonical_name": best.get("name", ""),
            "stores": stores,
            "best_price": best["current_price"],
            "best_merchant": best.get("merchant", ""),
            "worst_price": worst["current_price"],
            "savings_vs_worst": round(worst["current_price"] - best["current_price"], 2),
            "match_method": "single_store" if len(stores) == 1 else "embedding_low",
            "store_count": len(stores),
        })

    groups.sort(key=lambda g: -g["savings_vs_worst"])
    return groups


# ── Routes ────────────────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "flyrr Grocery Price Comparison API v2 (dev harness)"}


@api_router.post("/search")
async def search_items(request: SearchRequest):
    """Search real Flipp listings, then group them with the crude dev matcher."""
    try:
        response = requests.get(
            "https://backflipp.wishabi.com/flipp/items/search",
            params={
                "locale": "en-ca",
                "postal_code": request.postal_code,
                "q": request.query,
            },
            timeout=10,
        )
        response.raise_for_status()
        ecom_items = response.json().get("ecom_items", [])

        processed: List[Dict[str, Any]] = []
        for item in ecom_items:
            price = float(item.get("current_price", 0) or 0)
            if price <= 0:
                continue
            processed.append({
                "global_id": item.get("global_id", ""),
                "name": item.get("name", ""),
                "merchant": item.get("merchant", ""),
                "merchant_id": item.get("merchant_id", 0),
                "merchant_logo": item.get("merchant_logo", ""),
                "current_price": price,
                "image_url": item.get("image_url", ""),
                "description": item.get("description", ""),
            })

        processed.sort(key=lambda x: x["current_price"])

        # Classify before grouping so groups can inherit their members' category.
        categorize_items(processed)
        category_facets = build_category_facets(processed)

        loop = asyncio.get_event_loop()
        product_groups = await loop.run_in_executor(
            _thread_pool, _group_products, processed
        )
        cross_store_count = sum(1 for g in product_groups if g["store_count"] > 1)

        _stats["total_searches"] += 1
        _stats["total_product_groups"] += len(product_groups)
        _stats["total_cross_store_matches"] += cross_store_count

        return {
            "success": True,
            "items": processed,
            "product_groups": product_groups,
            "cross_store_count": cross_store_count,
            "categories": category_facets,
            "ambiguous": is_ambiguous(category_facets),
        }
    except Exception as e:
        logger.error("Search error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/deals")
async def get_nearby_deals(postal_code: str, limit: int = 24):
    """Best advertised flyer deals near a postal code — real Flipp data."""
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _thread_pool, lambda: fetch_nearby_deals(postal_code, limit=limit)
        )
        return {"success": True, **result}
    except Exception as e:
        logger.error("Deals error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Shopping lists ────────────────────────────────────────────────────────────

@api_router.post("/shopping-list")
async def create_shopping_list(shopping_list: Dict[str, Any]):
    shopping_list.setdefault("id", str(uuid.uuid4()))
    _db["shopping_lists"] = [
        l for l in _db["shopping_lists"] if l.get("id") != shopping_list["id"]
    ]
    _db["shopping_lists"].append(shopping_list)
    return {"success": True, "shopping_list": shopping_list}


@api_router.get("/shopping-lists")
async def get_all_shopping_lists():
    lists = [l for l in _db["shopping_lists"] if not l.get("completed")]
    return {"success": True, "lists": list(reversed(lists))}


@api_router.get("/shopping-list/{list_id}")
async def get_shopping_list(list_id: str):
    for l in _db["shopping_lists"]:
        if l.get("id") == list_id:
            return {"success": True, "shopping_list": l}
    raise HTTPException(status_code=404, detail="Shopping list not found")


# ── Store comparison ──────────────────────────────────────────────────────────

@api_router.post("/compare-stores")
async def compare_stores(shopping_list: Dict[str, Any]):
    """Total the cart per merchant using the prices already attached to items."""
    items = shopping_list.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="Shopping list is empty")

    store_totals: Dict[str, float] = defaultdict(float)
    theoretical_minimum = 0.0
    for item in items:
        qty = item.get("quantity", 1) or 1
        price = float(item.get("current_price", 0) or 0)
        store_totals[item.get("merchant", "Unknown")] += price * qty
        theoretical_minimum += price * qty

    rounded = {k: round(v, 2) for k, v in store_totals.items()}
    best_store = min(rounded, key=rounded.get)

    return {
        "success": True,
        "best_store": best_store,
        "best_store_total": rounded[best_store],
        "savings": round(max(rounded.values()) - rounded[best_store], 2),
        "store_totals": rounded,
        "theoretical_minimum": round(theoretical_minimum, 2),
    }


# ── Savings ───────────────────────────────────────────────────────────────────

@api_router.post("/savings")
async def save_savings_record(record: Dict[str, Any]):
    record.setdefault("id", str(uuid.uuid4()))
    record.setdefault("completed_at", datetime.utcnow().isoformat())
    _db["savings"].append(record)
    return {"success": True, "record": record}


@api_router.get("/savings")
async def get_savings_history():
    records = list(reversed(_db["savings"]))
    total = round(sum(float(r.get("savings", 0) or 0) for r in records), 2)
    return {"success": True, "records": records, "total_savings": total}


# ── Price alerts ──────────────────────────────────────────────────────────────

@api_router.post("/alerts")
async def create_alert(alert: PriceAlertCreate):
    record = {
        "id": str(uuid.uuid4()),
        **alert.model_dump(),
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    _db["alerts"].append(record)
    return {"success": True, "alert": record}


@api_router.get("/alerts")
async def get_alerts():
    return {"success": True, "alerts": list(reversed(_db["alerts"]))}


@api_router.patch("/alerts/{alert_id}")
async def update_alert(alert_id: str, update: PriceAlertUpdate):
    for record in _db["alerts"]:
        if record["id"] == alert_id:
            record.update(
                {k: v for k, v in update.model_dump().items() if v is not None}
            )
            return {"success": True}
    raise HTTPException(status_code=404, detail="Alert not found")


@api_router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    before = len(_db["alerts"])
    _db["alerts"] = [a for a in _db["alerts"] if a["id"] != alert_id]
    if len(_db["alerts"]) == before:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}


@api_router.post("/alerts/check")
async def trigger_alert_check():
    """Re-price each active alert against live Flipp data."""
    checked = fired = 0
    for alert in _db["alerts"]:
        if not alert.get("active"):
            continue
        checked += 1
        try:
            response = requests.get(
                "https://backflipp.wishabi.com/flipp/items/search",
                params={
                    "locale": "en-ca",
                    "postal_code": alert["postal_code"],
                    "q": alert["product_name"],
                },
                timeout=10,
            )
            prices = [
                float(i.get("current_price", 0) or 0)
                for i in response.json().get("ecom_items", [])
                if float(i.get("current_price", 0) or 0) > 0
            ]
            if not prices:
                continue
            best = min(prices)
            alert["last_seen_price"] = best
            alert["last_checked_at"] = datetime.utcnow().isoformat()
            if best <= alert["target_price"]:
                alert["last_triggered_at"] = datetime.utcnow().isoformat()
                fired += 1
        except Exception as e:
            logger.warning("Alert check failed for %s: %s", alert.get("id"), e)

    return {"success": True, "checked": checked, "fired": fired}


@api_router.get("/alerts/notifications")
async def get_alert_notifications():
    return {"success": True, "notifications": list(reversed(_db["notifications"]))}


# ── Stats ─────────────────────────────────────────────────────────────────────

@api_router.get("/stats")
async def get_stats():
    return {
        "success": True,
        **_stats,
        "estimated_claude_cost": 0.0,
        "cache_stats": {"note": "dev harness — semantic matcher not loaded"},
        "max_claude_calls_per_request": 0,
    }


# ── App setup ─────────────────────────────────────────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown():
    _thread_pool.shutdown(wait=False)
