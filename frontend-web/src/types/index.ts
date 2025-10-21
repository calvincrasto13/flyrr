// Core data types from backend API

export interface ShoppingItem {
  id: string;
  global_id: string;
  name: string;
  merchant: string;
  merchant_id: string;
  merchant_logo?: string;
  current_price: number;
  image_url?: string;
  quantity: number;
}

export interface ShoppingList {
  id: string;
  items: ShoppingItem[];
  created_at: string;
  completed: boolean;
}

export interface SavingsRecord {
  id: string;
  shopping_list_id: string;
  best_store: string;
  total_cost: number;
  potential_costs: Record<string, number>;
  savings: number;
  completed_at: string;
}

export interface StoreComparison {
  success: boolean;
  best_store: string;
  best_store_total: number;
  savings: number;
  store_totals: Record<string, number>;
}

// Redux state types

export interface CartState {
  items: ShoppingItem[];
  comparison: StoreComparison | null;
  loading: boolean;
  error: string | null;
}

export interface SearchState {
  query: string;
  results: ShoppingItem[];
  loading: boolean;
  error: string | null;
}

export interface UserState {
  postalCode: string;
  lastLocation: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface SavingsState {
  history: SavingsRecord[];
  totalSavings: number;
  loading: boolean;
  error: string | null;
}

export interface RootState {
  cart: CartState;
  search: SearchState;
  user: UserState;
  savings: SavingsState;
}

// API request/response types

export interface SearchRequest {
  query: string;
  postal_code: string;
}

export interface SearchResponse {
  success: boolean;
  items: ShoppingItem[];
}

export interface CompareStoresRequest {
  id: string;
  items: ShoppingItem[];
  created_at: string;
  completed: boolean;
}

export interface SaveShoppingRequest {
  id: string;
  shopping_list_id: string;
  best_store: string;
  total_cost: number;
  potential_costs: Record<string, number>;
  savings: number;
  completed_at: string;
}

export interface SavingsHistoryResponse {
  success: boolean;
  records: SavingsRecord[];
  total_savings: number;
}
