from fastapi import FastAPI, HTTPException
from starlette.middleware.cors import CORSMiddleware
import requests
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
import json
import os

# In-memory storage for demo
shopping_data = {
    "lists": [],
    "savings": []
}

# Initialize FastAPI app
app = FastAPI(title="Smart Grocery Saver API - Simple Demo")

# Models
class SearchRequest(BaseModel):
    query: str
    postal_code: str

class ShoppingItem(BaseModel):
    global_id: str
    name: str
    merchant: str
    current_price: float
    image_url: Optional[str] = None
    quantity: int = 1

class ShoppingList(BaseModel):
    id: str
    items: List[ShoppingItem]
    created_at: str
    completed: bool = False

class SavingsRecord(BaseModel):
    id: str
    best_store: str
    total_cost: float
    savings: float
    completed_at: str
    items_count: int

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
@app.get("/")
async def root():
    return {"message": "Smart Grocery Saver API - Simple Demo Version"}

@app.get("/api/")
async def api_root():
    return {"message": "Grocery Price Comparison API - Simple Demo"}

@app.post("/api/search")
async def search_items(request: SearchRequest):
    """Search for items using Flipp API"""
    try:
        print(f"Searching for: {request.query} in {request.postal_code}")

        # Mock search results for demo if API fails
        mock_items = [
            {
                'global_id': 'demo_1',
                'name': f'{request.query.title()} - Demo Product 1',
                'merchant': 'Demo Store A',
                'merchant_id': 1,
                'merchant_logo': '',
                'current_price': 2.99,
                'image_url': 'https://via.placeholder.com/150x150',
                'description': 'Demo product for testing'
            },
            {
                'global_id': 'demo_2',
                'name': f'{request.query.title()} - Demo Product 2',
                'merchant': 'Demo Store B',
                'merchant_id': 2,
                'merchant_logo': '',
                'current_price': 3.49,
                'image_url': 'https://via.placeholder.com/150x150',
                'description': 'Demo product for testing'
            },
            {
                'global_id': 'demo_3',
                'name': f'{request.query.title()} - Demo Product 3',
                'merchant': 'Demo Store C',
                'merchant_id': 3,
                'merchant_logo': '',
                'current_price': 2.49,
                'image_url': 'https://via.placeholder.com/150x150',
                'description': 'Demo product for testing'
            }
        ]

        # Try real API first
        try:
            url = f"https://backflipp.wishabi.com/flipp/items/search?locale=en-ca&postal_code={request.postal_code}&q={request.query}"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                ecom_items = data.get('ecom_items', [])
                if ecom_items:
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
        except Exception as api_error:
            print(f"API call failed, using mock data: {api_error}")

        # Return mock data sorted by price
        mock_items.sort(key=lambda x: x['current_price'])
        return {'success': True, 'items': mock_items}

    except Exception as e:
        print(f"Error in search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/shopping-list")
async def create_shopping_list(shopping_list: ShoppingList):
    """Create or update shopping list"""
    try:
        shopping_data["lists"].append(shopping_list.dict())
        return {'success': True, 'shopping_list': shopping_list}
    except Exception as e:
        print(f"Error creating shopping list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/shopping-list/{list_id}")
async def get_shopping_list(list_id: str):
    """Get shopping list by ID"""
    try:
        for lst in shopping_data["lists"]:
            if lst["id"] == list_id:
                return {'success': True, 'shopping_list': lst}
        return {'success': False, 'message': 'Shopping list not found'}
    except Exception as e:
        print(f"Error getting shopping list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/shopping-lists")
async def get_all_shopping_lists():
    """Get all shopping lists"""
    try:
        active_lists = [lst for lst in shopping_data["lists"] if not lst.get("completed", False)]
        return {'success': True, 'lists': active_lists}
    except Exception as e:
        print(f"Error getting shopping lists: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compare-stores")
async def compare_stores(shopping_list: ShoppingList):
    """Compare prices across stores for the shopping list"""
    try:
        # Group items by store and calculate totals
        store_totals = {}

        for item in shopping_list.items:
            merchant = item.merchant
            price = item.current_price * item.quantity

            if merchant not in store_totals:
                store_totals[merchant] = 0

            store_totals[merchant] += price

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
            'savings': savings
        }
    except Exception as e:
        print(f"Error comparing stores: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/savings")
async def save_savings_record(record: SavingsRecord):
    """Save a completed shopping trip with savings"""
    try:
        shopping_data["savings"].append(record.dict())

        # Mark shopping list as completed
        for lst in shopping_data["lists"]:
            if lst["id"] == record.id:
                lst["completed"] = True
                break

        return {'success': True, 'record': record}
    except Exception as e:
        print(f"Error saving savings record: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/savings")
async def get_savings_history():
    """Get savings history"""
    try:
        records = shopping_data["savings"]
        total_savings = sum(record.get('savings', 0) for record in records)

        return {
            'success': True,
            'records': records,
            'total_savings': total_savings
        }
    except Exception as e:
        print(f"Error getting savings history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting Smart Grocery Saver API (Simple Demo Version)")
    print("This is a demo version with mock data")
    print("API will be available at: http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)