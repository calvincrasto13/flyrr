"""
server.py — flyrr FastAPI application

All API routes for the flyrr Canadian grocery price comparison service.
Business logic lives in dedicated modules:
  - semantic_matcher.py  — three-layer product matching pipeline
  - product_grouper.py   — union-find cross-store grouping (Priority 2)
  - alerts.py            — price-drop alert engine
  - scheduler.py         — APScheduler background polling
"""

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Thread pool for CPU-bound embedding work
_thread_pool = ThreadPoolExecutor(max_workers=4)

# ── Runtime stats (in-memory, reset on restart) ───────────────────────────────
_stats: Dict[str, Any] = {
    "total_searches": 0,
    "total_product_groups": 0,
    "total_cross_store_matches": 0,
    "total_claude_calls": 0,
}

MAX_CLAUDE_CALLS_PER_REQUEST: int = int(os.getenv("MAX_CLAUDE_CALLS_PER_REQUEST", "5"))
CLAUDE_COST_PER_CALL: float = 0.00025  # Haiku pricing

app = FastAPI(title="flyrr API", version="2.0.0")
api_router = APIRouter(prefix="/api")


# ── Models ────────────────────────────────────────────────────────────────────

class ShoppingItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    global_id: str
    name: str
    merchant: str
    merchant_id: int = 0
    current_price: float
    image_url: Optional[str] = None
    quantity: int = 1

class ShoppingList(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[ShoppingItem] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed: bool = False

class SavingsRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shopping_list_id: str
    best_store: str
    total_cost: float
    potential_costs: dict
    savings: float
    completed_at: datetime = Field(default_factory=datetime.utcnow)

class SearchRequest(BaseModel):
    query: str
    postal_code: str

class AddItemRequest(BaseModel):
    item: ShoppingItem

class PriceAlertCreate(BaseModel):
    product_name: str
    postal_code: str
    target_price: float
    notify_email: Optional[str] = None

class PriceAlertUpdate(BaseModel):
    target_price: Optional[float] = None
    notify_email: Optional[str] = None
    active: Optional[bool] = None

class MatchRequest(BaseModel):
    name_a: str
    name_b: str

class BestMatchRequest(BaseModel):
    query: str
    catalog: List[str]


# ── Cross-Store Grouping (thin wrapper calling product_grouper) ───────────────

def _run_grouping(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Run the improved union-find cross-store grouping in a thread-pool worker.
    Returns a dict with 'groups' and 'claude_calls_used'.
    """
    from semantic_matcher import get_matcher
    from product_grouper import group_products_across_stores

    matcher = get_matcher()
    groups, claude_calls_used = group_products_across_stores(
        items, matcher, max_claude_calls=MAX_CLAUDE_CALLS_PER_REQUEST
    )
    return {"groups": groups, "claude_calls_used": claude_calls_used}


# ── Routes ────────────────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    """Health-check / root endpoint."""
    return {"message": "flyrr Grocery Price Comparison API v2"}


@api_router.post("/search")
async def search_items(request: SearchRequest):
    """
    Search for items using the Flipp API, then run the semantic matching
    pipeline to group equivalent products across different stores.

    Response fields:
      - ``items``             — flat list sorted by price (backwards-compatible)
      - ``product_groups``    — cross-store matched groups, sorted by savings
      - ``cross_store_count`` — number of groups appearing in 2+ stores
    """
    global _stats
    try:
        url = (
            f"https://backflipp.wishabi.com/flipp/items/search"
            f"?locale=en-ca&postal_code={request.postal_code}&q={request.query}"
        )
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        ecom_items = data.get('ecom_items', [])

        processed_items = []
        for item in ecom_items:
            current_price = float(item.get('current_price', 0))
            if current_price <= 0:
                continue
            processed_items.append({
                'global_id': item.get('global_id', ''),
                'name': item.get('name', ''),
                'merchant': item.get('merchant', ''),
                'merchant_id': item.get('merchant_id', 0),
                'merchant_logo': item.get('merchant_logo', ''),
                'current_price': current_price,
                'image_url': item.get('image_url', ''),
                'description': item.get('description', ''),
            })

        processed_items.sort(key=lambda x: x['current_price'])

        # Run improved grouping in thread pool (CPU-bound)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _thread_pool, _run_grouping, processed_items
        )
        product_groups = result["groups"]
        claude_calls_used = result["claude_calls_used"]

        cross_store_count = sum(1 for g in product_groups if g["store_count"] > 1)

        # Update runtime stats
        _stats["total_searches"] += 1
        _stats["total_product_groups"] += len(product_groups)
        _stats["total_cross_store_matches"] += cross_store_count
        _stats["total_claude_calls"] += claude_calls_used

        return {
            'success': True,
            'items': processed_items,
            'product_groups': product_groups,
            'cross_store_count': cross_store_count,
        }

    except Exception as e:
        logging.error(f"Error searching items: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/shopping-list")
async def create_shopping_list(shopping_list: ShoppingList):
    """Upsert a shopping list to MongoDB."""
    try:
        list_dict = shopping_list.dict()
        await db.shopping_lists.update_one(
            {'id': shopping_list.id}, {'$set': list_dict}, upsert=True
        )
        return {'success': True, 'shopping_list': shopping_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/shopping-list/{list_id}")
async def get_shopping_list(list_id: str):
    """Fetch a shopping list by ID."""
    try:
        shopping_list = await db.shopping_lists.find_one({'id': list_id})
        if not shopping_list:
            return {'success': False, 'message': 'Shopping list not found'}
        shopping_list.pop('_id', None)
        return {'success': True, 'shopping_list': shopping_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/shopping-lists")
async def get_all_shopping_lists():
    """Return all incomplete shopping lists, newest first."""
    try:
        lists = await db.shopping_lists.find({'completed': False}).sort('created_at', -1).to_list(100)
        for lst in lists:
            lst.pop('_id', None)
        return {'success': True, 'lists': lists}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/compare-stores")
async def compare_stores(shopping_list: ShoppingList):
    """
    Compare prices across stores for items in a shopping list.
    Groups items by merchant and finds the cheapest store overall.
    Also computes ``potential_savings_if_split``: how much you'd save buying
    each item at its cheapest store individually.
    """
    try:
        store_totals: Dict[str, float] = {}
        item_by_store: Dict[str, list] = {}
        cheapest_per_item = []

        for item in shopping_list.items:
            merchant = item.merchant
            price = item.current_price * item.quantity
            store_totals.setdefault(merchant, 0.0)
            item_by_store.setdefault(merchant, [])
            store_totals[merchant] += price
            item_by_store[merchant].append({
                'name': item.name, 'price': item.current_price,
                'quantity': item.quantity, 'total': price
            })
            cheapest_per_item.append(item.current_price * item.quantity)

        if store_totals:
            best_store_name, best_store_total = min(store_totals.items(), key=lambda x: x[1])
            worst_store_total = max(store_totals.values())
            savings = worst_store_total - best_store_total
            theoretical_minimum = sum(cheapest_per_item)
        else:
            best_store_name = None
            best_store_total = 0.0
            savings = 0.0
            theoretical_minimum = 0.0

        return {
            'success': True,
            'best_store': best_store_name,
            'best_store_total': best_store_total,
            'store_totals': store_totals,
            'savings': savings,
            'theoretical_minimum': theoretical_minimum,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/savings")
async def save_savings_record(record: SavingsRecord):
    """Persist a completed savings record and mark the shopping list as done."""
    try:
        record_dict = record.dict()
        await db.savings_records.insert_one(record_dict)
        await db.shopping_lists.update_one(
            {'id': record.shopping_list_id}, {'$set': {'completed': True}}
        )
        record_dict.pop('_id', None)
        return {'success': True, 'record': record_dict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/savings")
async def get_savings_history():
    """Return savings history and cumulative total."""
    try:
        records = await db.savings_records.find().sort('completed_at', -1).to_list(100)
        for record in records:
            record.pop('_id', None)
        total_savings = sum(record.get('savings', 0) for record in records)
        return {'success': True, 'records': records, 'total_savings': total_savings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Deal Alert Routes ─────────────────────────────────────────────────────────

@api_router.post("/alerts")
async def create_alert(alert: PriceAlertCreate):
    """Create a new price-drop watch for a product."""
    try:
        doc = {
            "id": str(uuid.uuid4()),
            "product_name": alert.product_name,
            "postal_code": alert.postal_code,
            "target_price": alert.target_price,
            "notify_email": alert.notify_email,
            "active": True,
            "created_at": datetime.utcnow().isoformat(),
            "last_seen_price": None,
            "last_checked_at": None,
            "last_triggered_at": None,
            "best_merchant": None,
        }
        await db.price_alerts.insert_one(doc)
        doc.pop("_id", None)
        return {"success": True, "alert": doc}
    except Exception as e:
        logging.error(f"Error creating alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/alerts")
async def get_alerts():
    """Return all price alerts sorted newest-first."""
    try:
        alerts = await db.price_alerts.find().sort("created_at", -1).to_list(200)
        for a in alerts:
            a.pop("_id", None)
        return {"success": True, "alerts": alerts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.patch("/alerts/{alert_id}")
async def update_alert(alert_id: str, update: PriceAlertUpdate):
    """Toggle active state or update target price / email."""
    try:
        fields = {k: v for k, v in update.dict().items() if v is not None}
        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        result = await db.price_alerts.update_one({"id": alert_id}, {"$set": fields})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    """Permanently remove an alert."""
    try:
        result = await db.price_alerts.delete_one({"id": alert_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/alerts/check")
async def trigger_alert_check():
    """Manually trigger an alert check (also called by the APScheduler cron job)."""
    try:
        from alerts import check_all_alerts
        result = await check_all_alerts()
        return {"success": True, **result}
    except Exception as e:
        logging.error(f"Alert check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/alerts/notifications")
async def get_alert_notifications():
    """Return recent alert notification history."""
    try:
        notifs = await db.alert_notifications.find().sort("triggered_at", -1).to_list(100)
        for n in notifs:
            n.pop("_id", None)
        return {"success": True, "notifications": notifs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Semantic Matching Routes ──────────────────────────────────────────────────

@api_router.post("/match")
async def match_products(request: MatchRequest):
    """
    Score a single pair of product names through the three-layer pipeline:
    embedding similarity → optional Claude escalation → SQLite cache.
    """
    try:
        from semantic_matcher import get_matcher
        matcher = get_matcher()
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _thread_pool, lambda: matcher.match(request.name_a, request.name_b)
        )
        return {"success": True, **result}
    except Exception as e:
        logging.error(f"Match error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/match/best")
async def find_best_match(request: BestMatchRequest):
    """
    Find the best semantic match for a query product name from a catalog list.
    Returns the highest-confidence match, or null if nothing clears the threshold.
    """
    try:
        from semantic_matcher import get_matcher
        matcher = get_matcher()
        loop = asyncio.get_event_loop()
        best = await loop.run_in_executor(
            _thread_pool, lambda: matcher.find_best_match(request.query, request.catalog)
        )
        return {"success": True, "match": best}
    except Exception as e:
        logging.error(f"Best match error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/match/cache/stats")
async def get_match_cache_stats():
    """
    Return SQLite cache analytics — total scored pairs, Claude call count,
    and the Claude call rate.
    """
    try:
        from semantic_matcher import get_matcher
        matcher = get_matcher()
        stats = matcher.get_cache_stats()
        return {"success": True, **stats}
    except Exception as e:
        logging.error(f"Cache stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Stats Endpoint (Priority 4) ───────────────────────────────────────────────

@api_router.get("/stats")
async def get_stats():
    """
    Return aggregate runtime statistics for this server instance.

    Fields:
      - ``total_searches``          — total /api/search calls served
      - ``total_product_groups``    — total product groups built across all searches
      - ``total_cross_store_matches`` — groups that appeared in 2+ stores
      - ``total_claude_calls``      — Claude API calls made by the grouper
      - ``estimated_claude_cost``   — estimated cost at $0.00025/call (Haiku)
      - ``cache_stats``             — SQLite cache analytics from the matcher
      - ``max_claude_calls_per_request`` — current Claude budget cap
    """
    try:
        from semantic_matcher import get_matcher
        matcher = get_matcher()
        cache_stats = matcher.get_cache_stats()

        return {
            "success": True,
            **_stats,
            "estimated_claude_cost": round(_stats["total_claude_calls"] * CLAUDE_COST_PER_CALL, 6),
            "cache_stats": cache_stats,
            "max_claude_calls_per_request": MAX_CLAUDE_CALLS_PER_REQUEST,
        }
    except Exception as e:
        logging.error(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── App setup ─────────────────────────────────────────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    """Clean up resources on shutdown."""
    client.close()
    _thread_pool.shutdown(wait=False)
