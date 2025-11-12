// Core data types for Smart Grocery Saver application

export interface ShoppingItem {
  id: string;
  global_id: string;
  name: string;
  merchant: string;
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

export interface SearchResult {
  items: ShoppingItem[];
  total_results: number;
  search_time: string;
}

export interface StoreComparison {
  best_store: string;
  best_store_total: number;
  savings: number;
  store_totals: { [store: string]: number };
  items: CartItem[];
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

export interface AppContextType {
  cart: CartItem[];
  postalCode: string;
  locationInfo: LocationInfo | null;
  searchResults: ShoppingItem[];
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
  setSearchResults: (results: ShoppingItem[]) => void;
  setComparison: (comparison: StoreComparison | null) => void;
  addShoppingList: (list: ShoppingList) => void;
  addSavingsRecord: (record: SavingsRecord) => void;
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