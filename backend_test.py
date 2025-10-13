#!/usr/bin/env python3
"""
Backend API Testing for Grocery Price Comparison App
Tests all API endpoints and functionality
"""

import requests
import json
import uuid
from datetime import datetime
import sys

# Backend URL from frontend/.env
BACKEND_URL = "https://smartbasket-7.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.shopping_list_id = None
        
    def log_test(self, test_name, success, message, response_data=None):
        """Log test results"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'response_data': response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if response_data and not success:
            print(f"   Response: {response_data}")
    
    def test_root_endpoint(self):
        """Test GET /api/ - Health check"""
        try:
            response = self.session.get(f"{BACKEND_URL}/")
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "Grocery Price Comparison API":
                    self.log_test("Root Endpoint", True, "Health check successful", data)
                    return True
                else:
                    self.log_test("Root Endpoint", False, f"Unexpected response: {data}", data)
                    return False
            else:
                self.log_test("Root Endpoint", False, f"HTTP {response.status_code}: {response.text}", response.text)
                return False
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Exception: {str(e)}")
            return False
    
    def test_search_endpoint(self):
        """Test POST /api/search - Search for grocery items"""
        test_cases = [
            {"query": "milk", "postal_code": "L4W3H8"},
            {"query": "bread", "postal_code": "L4W3H8"},
            {"query": "eggs", "postal_code": "M5V3A8"},
            {"query": "chicken", "postal_code": "K1A0A6"}
        ]
        
        all_passed = True
        for test_case in test_cases:
            try:
                response = self.session.post(
                    f"{BACKEND_URL}/search",
                    json=test_case,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") and "items" in data:
                        items = data["items"]
                        if len(items) > 0:
                            # Check if items have required fields
                            first_item = items[0]
                            required_fields = ['global_id', 'name', 'merchant', 'merchant_id', 'current_price']
                            missing_fields = [field for field in required_fields if field not in first_item]
                            
                            if not missing_fields:
                                self.log_test(f"Search - {test_case['query']}", True, 
                                            f"Found {len(items)} items with all required fields")
                            else:
                                self.log_test(f"Search - {test_case['query']}", False, 
                                            f"Missing fields in response: {missing_fields}", first_item)
                                all_passed = False
                        else:
                            self.log_test(f"Search - {test_case['query']}", True, 
                                        "No items found (acceptable for some queries)")
                    else:
                        self.log_test(f"Search - {test_case['query']}", False, 
                                    f"Invalid response format: {data}", data)
                        all_passed = False
                else:
                    self.log_test(f"Search - {test_case['query']}", False, 
                                f"HTTP {response.status_code}: {response.text}", response.text)
                    all_passed = False
                    
            except Exception as e:
                self.log_test(f"Search - {test_case['query']}", False, f"Exception: {str(e)}")
                all_passed = False
        
        return all_passed
    
    def test_shopping_list_creation(self):
        """Test POST /api/shopping-list - Create shopping list"""
        try:
            # Create a test shopping list
            self.shopping_list_id = str(uuid.uuid4())
            shopping_list = {
                "id": self.shopping_list_id,
                "items": [
                    {
                        "id": str(uuid.uuid4()),
                        "global_id": "test_global_1",
                        "name": "Organic Milk 2L",
                        "merchant": "Loblaws",
                        "merchant_id": 1,
                        "current_price": 4.99,
                        "image_url": "https://example.com/milk.jpg",
                        "quantity": 2
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "global_id": "test_global_2", 
                        "name": "Whole Wheat Bread",
                        "merchant": "Metro",
                        "merchant_id": 2,
                        "current_price": 3.49,
                        "image_url": "https://example.com/bread.jpg",
                        "quantity": 1
                    }
                ],
                "created_at": datetime.utcnow().isoformat(),
                "completed": False
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/shopping-list",
                json=shopping_list,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("Shopping List Creation", True, "Shopping list created successfully", data)
                    return True
                else:
                    self.log_test("Shopping List Creation", False, f"API returned success=false: {data}", data)
                    return False
            else:
                self.log_test("Shopping List Creation", False, 
                            f"HTTP {response.status_code}: {response.text}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Shopping List Creation", False, f"Exception: {str(e)}")
            return False
    
    def test_get_shopping_lists(self):
        """Test GET /api/shopping-lists - Get all shopping lists"""
        try:
            response = self.session.get(f"{BACKEND_URL}/shopping-lists")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "lists" in data:
                    lists = data["lists"]
                    self.log_test("Get Shopping Lists", True, f"Retrieved {len(lists)} shopping lists")
                    return True
                else:
                    self.log_test("Get Shopping Lists", False, f"Invalid response format: {data}", data)
                    return False
            else:
                self.log_test("Get Shopping Lists", False, 
                            f"HTTP {response.status_code}: {response.text}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Get Shopping Lists", False, f"Exception: {str(e)}")
            return False
    
    def test_compare_stores(self):
        """Test POST /api/compare-stores - Compare prices across stores"""
        try:
            # Use the shopping list created earlier
            shopping_list = {
                "id": self.shopping_list_id or str(uuid.uuid4()),
                "items": [
                    {
                        "id": str(uuid.uuid4()),
                        "global_id": "test_global_1",
                        "name": "Organic Milk 2L",
                        "merchant": "Loblaws",
                        "merchant_id": 1,
                        "current_price": 4.99,
                        "quantity": 2
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "global_id": "test_global_2",
                        "name": "Whole Wheat Bread", 
                        "merchant": "Metro",
                        "merchant_id": 2,
                        "current_price": 3.49,
                        "quantity": 1
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "global_id": "test_global_3",
                        "name": "Free Range Eggs",
                        "merchant": "Loblaws", 
                        "merchant_id": 1,
                        "current_price": 5.99,
                        "quantity": 1
                    }
                ]
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/compare-stores",
                json=shopping_list,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    required_fields = ['best_store', 'best_store_total', 'store_totals', 'item_by_store', 'savings']
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        # Verify calculations
                        expected_loblaws_total = (4.99 * 2) + (5.99 * 1)  # 15.97
                        expected_metro_total = 3.49 * 1  # 3.49
                        
                        store_totals = data['store_totals']
                        if abs(store_totals.get('Loblaws', 0) - expected_loblaws_total) < 0.01:
                            self.log_test("Compare Stores", True, 
                                        f"Store comparison successful. Best store: {data['best_store']}, "
                                        f"Total: ${data['best_store_total']:.2f}, Savings: ${data['savings']:.2f}")
                            return True
                        else:
                            self.log_test("Compare Stores", False, 
                                        f"Calculation error. Expected Loblaws: {expected_loblaws_total}, "
                                        f"Got: {store_totals.get('Loblaws', 0)}", data)
                            return False
                    else:
                        self.log_test("Compare Stores", False, 
                                    f"Missing fields in response: {missing_fields}", data)
                        return False
                else:
                    self.log_test("Compare Stores", False, f"API returned success=false: {data}", data)
                    return False
            else:
                self.log_test("Compare Stores", False, 
                            f"HTTP {response.status_code}: {response.text}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Compare Stores", False, f"Exception: {str(e)}")
            return False
    
    def test_savings_record(self):
        """Test POST /api/savings - Save completed shopping trip"""
        try:
            savings_record = {
                "id": str(uuid.uuid4()),
                "shopping_list_id": self.shopping_list_id or str(uuid.uuid4()),
                "best_store": "Metro",
                "total_cost": 15.47,
                "potential_costs": {
                    "Loblaws": 18.96,
                    "Metro": 15.47
                },
                "savings": 3.49,
                "completed_at": datetime.utcnow().isoformat()
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/savings",
                json=savings_record,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("Save Savings Record", True, "Savings record saved successfully", data)
                    return True
                else:
                    self.log_test("Save Savings Record", False, f"API returned success=false: {data}", data)
                    return False
            else:
                self.log_test("Save Savings Record", False, 
                            f"HTTP {response.status_code}: {response.text}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Save Savings Record", False, f"Exception: {str(e)}")
            return False
    
    def test_get_savings_history(self):
        """Test GET /api/savings - Get savings history"""
        try:
            response = self.session.get(f"{BACKEND_URL}/savings")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "records" in data and "total_savings" in data:
                    records = data["records"]
                    total_savings = data["total_savings"]
                    self.log_test("Get Savings History", True, 
                                f"Retrieved {len(records)} savings records, Total savings: ${total_savings:.2f}")
                    return True
                else:
                    self.log_test("Get Savings History", False, f"Invalid response format: {data}", data)
                    return False
            else:
                self.log_test("Get Savings History", False, 
                            f"HTTP {response.status_code}: {response.text}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Get Savings History", False, f"Exception: {str(e)}")
            return False
    
    def test_error_handling(self):
        """Test error handling for invalid inputs"""
        try:
            # Test invalid search request
            response = self.session.post(
                f"{BACKEND_URL}/search",
                json={"invalid": "data"},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code in [400, 422]:  # Expected validation error
                self.log_test("Error Handling - Invalid Search", True, "Properly handled invalid search request")
                return True
            else:
                self.log_test("Error Handling - Invalid Search", False, 
                            f"Expected 400/422, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Error Handling", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print(f"\n🧪 Starting Backend API Tests for Grocery Price Comparison App")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 80)
        
        tests = [
            self.test_root_endpoint,
            self.test_search_endpoint,
            self.test_shopping_list_creation,
            self.test_get_shopping_lists,
            self.test_compare_stores,
            self.test_savings_record,
            self.test_get_savings_history,
            self.test_error_handling
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
            print()  # Add spacing between tests
        
        print("=" * 80)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Backend API is working correctly.")
            return True
        else:
            print(f"⚠️  {total - passed} tests failed. Check the details above.")
            return False

def main():
    """Main function to run tests"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Print detailed results
    print("\n📋 Detailed Test Results:")
    print("-" * 50)
    for result in tester.test_results:
        status = "✅" if result['success'] else "❌"
        print(f"{status} {result['test']}: {result['message']}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())