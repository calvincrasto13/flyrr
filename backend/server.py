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

# Models
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

# Routes
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
        
        # Process and return ecom items (grocery products)
        ecom_items = data.get('ecom_items', [])
        processed_items = []
        
        for item in ecom_items:
            processed_items.append({
                'global_id': item.get('global_id', ''),
                'name': item.get('name', ''),
                'merchant': item.get('merchant', ''),
                'merchant_id': item.get('merchant_id', 0),
                'current_price': float(item.get('current_price', 0)),
                'image_url': item.get('image_url', ''),
                'description': item.get('description', ''),
            })
        
        return {'success': True, 'items': processed_items}
    except Exception as e:
        logging.error(f"Error searching items: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/shopping-list")
async def create_shopping_list(shopping_list: ShoppingList):
    """Create or update shopping list"""
    try:
        list_dict = shopping_list.dict()
        await db.shopping_lists.update_one(
            {'id': shopping_list.id},
            {'$set': list_dict},
            upsert=True
        )
        return {'success': True, 'shopping_list': shopping_list}
    except Exception as e:
        logging.error(f"Error saving shopping list: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/shopping-list/{list_id}")
async def get_shopping_list(list_id: str):
    """Get shopping list by ID"""
    try:
        shopping_list = await db.shopping_lists.find_one({'id': list_id})
        if not shopping_list:
            return {'success': False, 'message': 'Shopping list not found'}
        return {'success': True, 'shopping_list': shopping_list}
    except Exception as e:
        logging.error(f"Error getting shopping list: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/shopping-lists")
async def get_all_shopping_lists():
    """Get all shopping lists"""
    try:
        lists = await db.shopping_lists.find({'completed': False}).sort('created_at', -1).to_list(100)
        # Convert ObjectId to string for JSON serialization
        for lst in lists:
            if '_id' in lst:
                lst['_id'] = str(lst['_id'])
        return {'success': True, 'lists': lists}
    except Exception as e:
        logging.error(f"Error getting shopping lists: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/compare-stores")
async def compare_stores(shopping_list: ShoppingList):
    """Compare prices across stores for the shopping list"""
    try:
        # Group items by store and calculate totals
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
                'name': item.name,
                'price': item.current_price,
                'quantity': item.quantity,
                'total': price
            })
        
        # Find best store (lowest total)
        if store_totals:
            best_store = min(store_totals.items(), key=lambda x: x[1])
            best_store_name = best_store[0]
            best_store_total = best_store[1]
            
            # Calculate potential savings
            worst_store_total = max(store_totals.values())
            savings = worst_store_total - best_store_total
        else:
            best_store_name = None
            best_store_total = 0
            savings = 0
        
        return {
            'success': True,
            'best_store': best_store_name,
            'best_store_total': best_store_total,
            'store_totals': store_totals,
            'item_by_store': item_by_store,
            'savings': savings
        }
    except Exception as e:
        logging.error(f"Error comparing stores: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/savings")
async def save_savings_record(record: SavingsRecord):
    """Save a completed shopping trip with savings"""
    try:
        record_dict = record.dict()
        await db.savings_records.insert_one(record_dict)
        
        # Mark shopping list as completed
        await db.shopping_lists.update_one(
            {'id': record.shopping_list_id},
            {'$set': {'completed': True}}
        )
        
        return {'success': True, 'record': record}
    except Exception as e:
        logging.error(f"Error saving savings record: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/savings")
async def get_savings_history():
    """Get savings history"""
    try:
        records = await db.savings_records.find().sort('completed_at', -1).to_list(100)
        # Convert ObjectId to string for JSON serialization
        for record in records:
            if '_id' in record:
                record['_id'] = str(record['_id'])
        total_savings = sum(record.get('savings', 0) for record in records)
        
        return {
            'success': True,
            'records': records,
            'total_savings': total_savings
        }
    except Exception as e:
        logging.error(f"Error getting savings history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()