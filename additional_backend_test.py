#!/usr/bin/env python3
"""
Additional Backend API Testing for edge cases and data persistence
"""

import requests
import json
import uuid
from datetime import datetime

BACKEND_URL = "https://smartbasket-7.preview.emergentagent.com/api"

def test_data_persistence():
    """Test that data persists correctly in MongoDB"""
    print("🔍 Testing Data Persistence...")
    
    # Create a shopping list
    list_id = str(uuid.uuid4())
    shopping_list = {
        "id": list_id,
        "items": [
            {
                "id": str(uuid.uuid4()),
                "global_id": "persist_test_1",
                "name": "Test Persistence Item",
                "merchant": "Test Store",
                "merchant_id": 999,
                "current_price": 9.99,
                "quantity": 1
            }
        ],
        "created_at": datetime.utcnow().isoformat(),
        "completed": False
    }
    
    # Create the list
    response = requests.post(f"{BACKEND_URL}/shopping-list", json=shopping_list)
    if response.status_code != 200:
        print(f"❌ Failed to create shopping list: {response.text}")
        return False
    
    # Retrieve all lists and verify our list exists
    response = requests.get(f"{BACKEND_URL}/shopping-lists")
    if response.status_code != 200:
        print(f"❌ Failed to retrieve shopping lists: {response.text}")
        return False
    
    data = response.json()
    found_list = None
    for lst in data.get('lists', []):
        if lst.get('id') == list_id:
            found_list = lst
            break
    
    if not found_list:
        print(f"❌ Created shopping list not found in database")
        return False
    
    print(f"✅ Data persistence test passed - shopping list persisted correctly")
    return True

def test_shopping_list_completion():
    """Test that shopping lists are marked as completed correctly"""
    print("🔍 Testing Shopping List Completion...")
    
    # Create a shopping list
    list_id = str(uuid.uuid4())
    shopping_list = {
        "id": list_id,
        "items": [
            {
                "id": str(uuid.uuid4()),
                "global_id": "completion_test_1",
                "name": "Test Completion Item",
                "merchant": "Test Store",
                "merchant_id": 888,
                "current_price": 5.99,
                "quantity": 1
            }
        ],
        "created_at": datetime.utcnow().isoformat(),
        "completed": False
    }
    
    # Create the list
    response = requests.post(f"{BACKEND_URL}/shopping-list", json=shopping_list)
    if response.status_code != 200:
        print(f"❌ Failed to create shopping list: {response.text}")
        return False
    
    # Save a savings record (this should mark the list as completed)
    savings_record = {
        "id": str(uuid.uuid4()),
        "shopping_list_id": list_id,
        "best_store": "Test Store",
        "total_cost": 5.99,
        "potential_costs": {"Test Store": 5.99},
        "savings": 0.0,
        "completed_at": datetime.utcnow().isoformat()
    }
    
    response = requests.post(f"{BACKEND_URL}/savings", json=savings_record)
    if response.status_code != 200:
        print(f"❌ Failed to save savings record: {response.text}")
        return False
    
    # Check that the shopping list is no longer in the active lists (completed=False)
    response = requests.get(f"{BACKEND_URL}/shopping-lists")
    if response.status_code != 200:
        print(f"❌ Failed to retrieve shopping lists: {response.text}")
        return False
    
    data = response.json()
    for lst in data.get('lists', []):
        if lst.get('id') == list_id:
            print(f"❌ Completed shopping list still appears in active lists")
            return False
    
    print(f"✅ Shopping list completion test passed - list marked as completed")
    return True

def test_empty_search():
    """Test search with empty or invalid queries"""
    print("🔍 Testing Edge Cases for Search...")
    
    # Test empty query
    response = requests.post(f"{BACKEND_URL}/search", json={"query": "", "postal_code": "L4W3H8"})
    if response.status_code == 200:
        data = response.json()
        if data.get("success"):
            print(f"✅ Empty query handled gracefully - returned {len(data.get('items', []))} items")
        else:
            print(f"❌ Empty query failed: {data}")
            return False
    else:
        print(f"❌ Empty query returned error: {response.status_code}")
        return False
    
    # Test very specific query that might not have results
    response = requests.post(f"{BACKEND_URL}/search", json={"query": "xyzabc123nonexistent", "postal_code": "L4W3H8"})
    if response.status_code == 200:
        data = response.json()
        if data.get("success"):
            print(f"✅ Non-existent item query handled gracefully - returned {len(data.get('items', []))} items")
        else:
            print(f"❌ Non-existent item query failed: {data}")
            return False
    else:
        print(f"❌ Non-existent item query returned error: {response.status_code}")
        return False
    
    return True

def main():
    """Run additional tests"""
    print("🧪 Running Additional Backend Tests...")
    print("=" * 60)
    
    tests = [
        test_data_persistence,
        test_shopping_list_completion,
        test_empty_search
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 60)
    print(f"📊 Additional Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All additional tests passed!")
        return True
    else:
        print(f"⚠️  {total - passed} additional tests failed.")
        return False

if __name__ == "__main__":
    main()