from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
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


# ── Existing routes ───────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "Grocery Price Comparison API"}

@api_router.post("/search")
async def search_items(request: SearchRequest):
    """Search for items using Flipp API"""
    try:
        url = f"https://backflipp.wishabi.com/flipp/items/search?locale=en-ca&postal_code={request.postal_code}&q={request.query}"
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
        return {'success': True, 'items': processed_items}
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
    try:
        store_totals = {}
        item_by_store = {}
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
        if store_totals:
            best_store = min(store_totals.items(), key=lambda x: x[1])
            best_store_name, best_store_total = best_store
            worst_store_total = max(store_totals.values())
            savings = worst_store_total - best_store_total
        else:
            best_store_name = None
            best_store_total = 0
            savings = 0
        return {
            'success': True, 'best_store': best_store_name,
            'best_store_total': best_store_total,
            'store_totals': store_totals,
            'item_by_store': item_by_store,
            'savings': savings
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


# ── Semantic Matching Routes ───────────────────────────────────────────────────

@api_router.post("/match")
async def match_products(request: MatchRequest):
    """
    Score a single pair of product names through the three-layer pipeline:
    embedding similarity → optional Claude escalation → SQLite cache.
    """
    try:
        from semantic_matcher import get_matcher
        matcher = get_matcher()
        result = matcher.match(request.name_a, request.name_b)
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
        best = matcher.find_best_match(request.query, request.catalog)
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
