// Core data types for flyrr — Canadian Grocery Price Comparison

export interface ShoppingItem {
  id: string;
  global_id: string;
  name: string;
  merchant: string;
  merchant_id?: number;
  current_price: number;
  image_url?: string;
  merchant_logo?: string;
  quantity?: number;
  unit_price?: number;
}

export interface CartItem extends ShoppingItem {
  quantity: number;
  added_at: string;
}

export interface ShoppingList {
  id: string;
  items: CartItem[];
  store_name?: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  completed?: boolean;
}

export interface SavingsRecord {
  id: string;
  best_store: string;
  total_cost: number;
  savings: number;
  completed_at: string;
  shopping_list_id: string;
  potential_costs?: { [store: string]: number };
  items_count?: number;
}

export interface SearchRequest {
  query: string;
  postal_code: string;
}

// ── Product Group types (from /api/search product_groups) ─────────────────────

export interface StoreEntry {
  merchant: string;
  name: string;
  price: number;
  image_url?: string;
  merchant_logo?: string;
  global_id?: string;
  match_confidence?: number;
}

export type MatchMethod = 'embedding_high' | 'embedding_low' | 'claude' | 'single_store' | 'embedding';

export interface ProductGroup {
  canonical_name: string;
  stores: StoreEntry[];
  best_price: number;
  best_merchant: string;
  worst_price: number;
  savings_vs_worst: number;
  match_method: MatchMethod;
  store_count: number;
}

export interface SearchResponse {
  items: ShoppingItem[];
  product_groups: ProductGroup[];
  cross_store_count: number;
}

// ── Price Alert types ──────────────────────────────────────────────────────────

export interface PriceAlert {
  id: string;
  product_name: string;
  postal_code: string;
  target_price: number;
  notify_email?: string;
  active: boolean;
  created_at: string;
  last_seen_price?: number;
  last_checked_at?: string;
  last_triggered_at?: string;
  best_merchant?: string;
}

export interface PriceAlertCreate {
  product_name: string;
  postal_code: string;
  target_price: number;
  notify_email?: string;
}

export interface PriceAlertUpdate {
  target_price?: number;
  notify_email?: string;
  active?: boolean;
}

// ── Store Comparison ───────────────────────────────────────────────────────────

export interface StoreComparison {
  best_store: string;
  best_store_total: number;
  savings: number;
  store_totals: { [store: string]: number };
  theoretical_minimum?: number;
  items?: CartItem[];
}

export interface LocationInfo {
  postal_code: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  items?: ShoppingItem[];
  error?: string;
  message?: string;
  records?: SavingsRecord[];
  total_savings?: number;
}

// ── App Context ────────────────────────────────────────────────────────────────

export interface AppContextType {
  cart: CartItem[];
  postalCode: string;
  locationInfo: LocationInfo | null;
  searchResults: ShoppingItem[];
  productGroups: ProductGroup[];
  crossStoreCount: number;
  shoppingLists: ShoppingList[];
  savingsHistory: SavingsRecord[];
  comparison: StoreComparison | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  addToCart: (item: ShoppingItem, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  clearCart: () => void;
  setPostalCode: (postalCode: string) => void;
  setLocationInfo: (location: LocationInfo) => void;
  setSearchResults: (results: ShoppingItem[], groups?: ProductGroup[], crossStoreCount?: number) => void;
  setComparison: (comparison: StoreComparison | null) => void;
  addShoppingList: (list: ShoppingList) => void;
  addSavingsRecord: (record: SavingsRecord) => void;
  setSavingsHistory: (records: SavingsRecord[]) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps extends ComponentProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  type?: 'button' | 'submit' | 'reset';
}

export interface InputProps extends ComponentProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'number' | 'tel';
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  maxLength?: number;
  onKeyPress?: (e: React.KeyboardEvent) => void;
}

export interface CardProps extends ComponentProps {
  title?: string;
  subtitle?: string;
  image?: string;
  onClick?: () => void;
  hoverable?: boolean;
  /** Escape hatch for callers that need inline styling, e.g. CSS custom
   * properties driving the fyr-rise stagger-entrance animation delay. */
  style?: React.CSSProperties;
}

export interface LoadingSpinnerProps extends ComponentProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
}

// API Error types
export interface APIError {
  message: string;
  status_code?: number;
  error_type?: string;
}

// Store data types
export interface Store {
  id: string;
  name: string;
  address?: string;
  distance?: number;
  logo?: string;
}
