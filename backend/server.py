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

# Thread pool for running blocking matcher calls without blocking the async loop
_thread_pool = ThreadPoolExecutor(max_workers=4)

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ── Models ────────────────────────────────────────────────────────────────────

class ShoppingItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    global_id: str
    name: str
    merchant: str
    merchant_id: int
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

# ── Deal Alert Models ─────────────────────────────────────────────────────────

class PriceAlertCreate(BaseModel):
    product_name: str
    postal_code: str
    target_price: float
    notify_email: Optional[str] = None

class PriceAlertUpdate(BaseModel):
    target_price: Optional[float] = None
    notify_email: Optional[str] = None
    active: Optional[bool] = None

# ── Semantic Matching Models ──────────────────────────────────────────────────

class MatchRequest(BaseModel):
    name_a: str
    name_b: str

class BestMatchRequest(BaseModel):
    query: str
    catalog: List[str]


# ── Cross-Store Grouping Logic ────────────────────────────────────────────────

def _group_products_across_stores(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Given a flat list of products from multiple stores (raw Flipp results),
    use the semantic matcher to group items that represent the same product
    across different merchants.

    Algorithm:
      1. Split items by merchant into per-store catalogs.
      2. Pick the store with the most items as the reference store.
      3. For every reference item, run find_best_match against each other store's catalog.
      4. Build a product group: {canonical_name, stores: [...], best_price, savings}.
      5. Items that matched are removed from other stores' candidate pools to avoid
         double-counting the same match.

    Returns a list of product groups sorted by savings opportunity (desc).
    """
    from semantic_matcher import get_matcher
    matcher = get_matcher()

    # Split by merchant
    by_merchant: Dict[str, List[Dict]] = {}
    for item in items:
        m = item["merchant"]
        by_merchant.setdefault(m, []).append(item)

    merchants = list(by_merchant.keys())
    if len(merchants) < 2:
        # Nothing to cross-reference — return single-store groups
        return [
            {
                "canonical_name": item["name"],
                "stores": [{
                    "merchant": item["merchant"],
                    "name": item["name"],
                    "price": item["current_price"],
                    "image_url": item.get("image_url", ""),
                    "merchant_logo": item.get("merchant_logo", ""),
                    "global_id": item.get("global_id", ""),
                }],
                "best_price": item["current_price"],
                "best_merchant": item["merchant"],
                "worst_price": item["current_price"],
                "savings_vs_worst": 0.0,
                "match_method": "single_store",
            }
            for item in items
        ]

    # Reference store = most items (best anchor catalog)
    ref_merchant = max(by_merchant, key=lambda m: len(by_merchant[m]))
    ref_items = by_merchant[ref_merchant]
    other_merchants = [m for m in merchants if m != ref_merchant]

    # Track which items from other stores have already been matched
    matched_ids: Dict[str, set] = {m: set() for m in other_merchants}

    groups = []

    for ref_item in ref_items:
        group_stores = [{
            "merchant": ref_item["merchant"],
            "name": ref_item["name"],
            "price": ref_item["current_price"],
            "image_url": ref_item.get("image_url", ""),
            "merchant_logo": ref_item.get("merchant_logo", ""),
            "global_id": ref_item.get("global_id", ""),
        }]
        methods_used = set()

        for other_merchant in other_merchants:
            # Build catalog of unmatched items from this store
            available = [
                it for it in by_merchant[other_merchant]
                if it.get("global_id", it["name"]) not in matched_ids[other_merchant]
            ]
            if not available:
                continue

            catalog_names = [it["name"] for it in available]
            best = matcher.find_best_match(ref_item["name"], catalog_names)

            if best and best["is_match"]:
                # Find the full item dict for the matched name
                matched_item = next(
                    (it for it in available if it["name"] == best["matched_name"]),
                    None
                )
                if matched_item:
                    uid = matched_item.get("global_id", matched_item["name"])
                    matched_ids[other_merchant].add(uid)
                    group_stores.append({
                        "merchant": matched_item["merchant"],
                        "name": matched_item["name"],
                        "price": matched_item["current_price"],
                        "image_url": matched_item.get("image_url", ""),
                        "merchant_logo": matched_item.get("merchant_logo", ""),
                        "global_id": matched_item.get("global_id", ""),
                        "match_confidence": round(best["confidence"], 3),
                    })
                    methods_used.add(best["method"])

        prices = [s["price"] for s in group_stores]
        best_store = min(group_stores, key=lambda s: s["price"])
        worst_price = max(prices)
        best_price = min(prices)

        groups.append({
            "canonical_name": ref_item["name"],
            "stores": sorted(group_stores, key=lambda s: s["price"]),
            "best_price": best_price,
            "best_merchant": best_store["merchant"],
            "worst_price": worst_price,
            "savings_vs_worst": round(worst_price - best_price, 2),
            "match_method": "claude" if "claude" in methods_used else
                            "embedding" if methods_used else "single_store",
            "store_count": len(group_stores),
        })

    # Also add unmatched items from other stores as single-store groups
    for other_merchant in other_merchants:
        for item in by_merchant[other_merchant]:
            uid = item.get("global_id", item["name"])
            if uid not in matched_ids[other_merchant]:
                groups.append({
                    "canonical_name": item["name"],
                    "stores": [{
                        "merchant": item["merchant"],
                        "name": item["name"],
                        "price": item["current_price"],
                        "image_url": item.get("image_url", ""),
                        "merchant_logo": item.get("merchant_logo", ""),
                        "global_id": item.get("global_id", ""),
                    }],
                    "best_price": item["current_price"],
                    "best_merchant": item["merchant"],
                    "worst_price": item["current_price"],
                    "savings_vs_worst": 0.0,
                    "match_method": "single_store",
                    "store_count": 1,
                })

    # Sort by savings opportunity — biggest savings first
    groups.sort(key=lambda g: g["savings_vs_worst"], reverse=True)
    return groups


# ── Routes ────────────────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "Grocery Price Comparison API"}


@api_router.post("/search")
async def search_items(request: SearchRequest):
    """
    Search for items using the Flipp API, then run the semantic matching pipeline
    to group equivalent products across different stores.

    Response includes:
      - `items`: flat list sorted by price (backwards compatible)
      - `product_groups`: cross-store matched groups, sorted by savings opportunity
      - `cross_store_count`: number of groups that appear in 2+ stores
    """
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

        # Run semantic grouping in thread pool (SentenceTransformer is CPU-bound)
        loop = asyncio.get_event_loop()
        product_groups = await loop.run_in_executor(
            _thread_pool,
            _group_products_across_stores,
            processed_items
        )

        cross_store_count = sum(1 for g in product_groups if g["store_count"] > 1)

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
    try:
        shopping_list = await db.shopping_lists.find_one({'id': list_id})
        if not shopping_list:
            return {'success': False, 'message': 'Shopping list not found'}
        return {'success': True, 'shopping_list': shopping_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/shopping-lists")
async def get_all_shopping_lists():
    try:
        lists = await db.shopping_lists.find({'completed': False}).sort('created_at', -1).to_list(100)
        for lst in lists:
            if '_id' in lst:
                lst['_id'] = str(lst['_id'])
        return {'success': True, 'lists': lists}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/compare-stores")
async def compare_stores(shopping_list: ShoppingList):
    """
    Compare prices across stores for items in a shopping list.
    Groups items by merchant and finds the cheapest store overall.
    Also computes potential_savings_if_split: how much you'd save buying
    each item at its cheapest store individually.
    """
    try:
        store_totals = {}
        item_by_store = {}
        cheapest_per_item = []

        for item in shopping_list.items:
            merchant = item.merchant
            price = item.current_price * item.quantity
            if merchant not in store_totals:
                store_totals[merchant] = 0
                item_by_store[merchant] = []
            store_totals[merchant] += price
            item_by_store[merchant].append({
                'name': item.name, 'price': item.current_price,
                'quantity': item.quantity, 'total': price
            })
            cheapest_per_item.append(item.current_price * item.quantity)

        if store_totals:
            best_store = min(store_totals.items(), key=lambda x: x[1])
            best_store_name, best_store_total = best_store
            worst_store_total = max(store_totals.values())
            savings = worst_store_total - best_store_total
            # Theoretical minimum: buy each item at cheapest available price
            theoretical_minimum = sum(cheapest_per_item)
        else:
            best_store_name = None
            best_store_total = 0
            savings = 0
            theoretical_minimum = 0

        return {
            'success': True,
            'best_store': best_store_name,
            'best_store_total': best_store_total,
            'store_totals': store_totals,
            'item_by_store': item_by_store,
            'savings': savings,
            'theoretical_minimum': theoretical_minimum,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/savings")
async def save_savings_record(record: SavingsRecord):
    try:
        record_dict = record.dict()
        await db.savings_records.insert_one(record_dict)
        await db.shopping_lists.update_one(
            {'id': record.shopping_list_id}, {'$set': {'completed': True}}
        )
        return {'success': True, 'record': record}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/savings")
async def get_savings_history():
    try:
        records = await db.savings_records.find().sort('completed_at', -1).to_list(100)
        for record in records:
            if '_id' in record:
                record['_id'] = str(record['_id'])
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
    """Manually trigger an alert check (can also be called by a cron job)."""
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
    Used to cross-reference the same product across different store search results.
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
    and the Claude call rate. Useful for monitoring pipeline cost efficiency.
    """
    try:
        from semantic_matcher import get_matcher
        matcher = get_matcher()
        stats = matcher.get_cache_stats()
        return {"success": True, **stats}
    except Exception as e:
        logging.error(f"Cache stats error: {e}")
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
    client.close()
    _thread_pool.shutdown(wait=False)
