import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import {
  AppContextType,
  CartItem,
  ShoppingItem,
  ShoppingList,
  StoreComparison,
  LocationInfo,
  SavingsRecord,
  ProductGroup,
} from '../types';
import { STORAGE_KEYS } from '../utils/constants';

// ── State ─────────────────────────────────────────────────────────────────────

interface AppState {
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
}

// ── Actions ───────────────────────────────────────────────────────────────────

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'SET_POSTAL_CODE'; payload: string }
  | { type: 'SET_LOCATION_INFO'; payload: LocationInfo | null }
  | { type: 'SET_SEARCH_RESULTS'; payload: { items: ShoppingItem[]; groups: ProductGroup[]; crossStoreCount: number } }
  | { type: 'SET_COMPARISON'; payload: StoreComparison | null }
  | { type: 'SET_SAVINGS_HISTORY'; payload: SavingsRecord[] }
  | { type: 'ADD_TO_CART'; payload: { item: ShoppingItem; quantity?: number } }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { itemId: string; delta: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'ADD_SAVINGS_RECORD'; payload: SavingsRecord };

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState: AppState = {
  cart: [],
  postalCode: '',
  locationInfo: null,
  searchResults: [],
  productGroups: [],
  crossStoreCount: 0,
  shoppingLists: [],
  savingsHistory: [],
  comparison: null,
  isLoading: false,
  error: null,
};

// ── Reducer ───────────────────────────────────────────────────────────────────

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'SET_CART':
      return { ...state, cart: action.payload };

    case 'SET_POSTAL_CODE':
      return { ...state, postalCode: action.payload };

    case 'SET_LOCATION_INFO':
      return { ...state, locationInfo: action.payload };

    case 'SET_SEARCH_RESULTS':
      return {
        ...state,
        searchResults: action.payload.items,
        productGroups: action.payload.groups,
        crossStoreCount: action.payload.crossStoreCount,
      };

    case 'SET_COMPARISON':
      return { ...state, comparison: action.payload };

    case 'SET_SAVINGS_HISTORY':
      return { ...state, savingsHistory: action.payload };

    case 'ADD_TO_CART': {
      const { item, quantity = 1 } = action.payload;
      const existingItem = state.cart.find(i => i.global_id === item.global_id && i.merchant === item.merchant);

      let newCart: CartItem[];
      if (existingItem) {
        newCart = state.cart.map(i =>
          i.global_id === item.global_id && i.merchant === item.merchant
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      } else {
        newCart = [
          ...state.cart,
          {
            ...item,
            quantity,
            added_at: new Date().toISOString(),
            id: `${item.global_id}-${item.merchant}-${Date.now()}`,
          },
        ];
      }
      return { ...state, cart: newCart };
    }

    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter(item => item.id !== action.payload) };

    case 'UPDATE_QUANTITY': {
      const { itemId, delta } = action.payload;
      const newCart = state.cart
        .map(item => {
          if (item.id === itemId) {
            const newQuantity = item.quantity + delta;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
      return { ...state, cart: newCart };
    }

    case 'CLEAR_CART':
      return { ...state, cart: [], comparison: null };

    case 'ADD_SAVINGS_RECORD':
      return { ...state, savingsHistory: [action.payload, ...state.savingsHistory] };

    default:
      return state;
  }
};

// ── Context ───────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Restore persisted data on mount
  useEffect(() => {
    try {
      const savedPostalCode = localStorage.getItem(STORAGE_KEYS.POSTAL_CODE);
      const savedCart = localStorage.getItem(STORAGE_KEYS.SHOPPING_CART);
      const savedLocation = localStorage.getItem(STORAGE_KEYS.LOCATION_INFO);

      if (savedPostalCode) dispatch({ type: 'SET_POSTAL_CODE', payload: savedPostalCode });
      if (savedCart) dispatch({ type: 'SET_CART', payload: JSON.parse(savedCart) });
      if (savedLocation) dispatch({ type: 'SET_LOCATION_INFO', payload: JSON.parse(savedLocation) });
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }, []);

  // Persist cart
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SHOPPING_CART, JSON.stringify(state.cart));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  }, [state.cart]);

  // Persist postal code
  useEffect(() => {
    try {
      if (state.postalCode) {
        localStorage.setItem(STORAGE_KEYS.POSTAL_CODE, state.postalCode);
      }
    } catch (error) {
      console.error('Error saving postal code:', error);
    }
  }, [state.postalCode]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const addToCart = (item: ShoppingItem, quantity?: number) =>
    dispatch({ type: 'ADD_TO_CART', payload: { item, quantity } });

  const removeFromCart = (itemId: string) =>
    dispatch({ type: 'REMOVE_FROM_CART', payload: itemId });

  const updateQuantity = (itemId: string, delta: number) =>
    dispatch({ type: 'UPDATE_QUANTITY', payload: { itemId, delta } });

  const clearCart = () => dispatch({ type: 'CLEAR_CART' });

  const setPostalCode = (postalCode: string) =>
    dispatch({ type: 'SET_POSTAL_CODE', payload: postalCode });

  const setLocationInfo = (locationInfo: LocationInfo) => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCATION_INFO, JSON.stringify(locationInfo));
    } catch {}
    dispatch({ type: 'SET_LOCATION_INFO', payload: locationInfo });
  };

  const setSearchResults = (
    items: ShoppingItem[],
    groups: ProductGroup[] = [],
    crossStoreCount: number = 0
  ) => dispatch({ type: 'SET_SEARCH_RESULTS', payload: { items, groups, crossStoreCount } });

  const setComparison = (comparison: StoreComparison | null) =>
    dispatch({ type: 'SET_COMPARISON', payload: comparison });

  const addShoppingList = (_list: ShoppingList) => {
    // No-op placeholder — shopping lists are persisted via the API
  };

  const addSavingsRecord = (record: SavingsRecord) =>
    dispatch({ type: 'ADD_SAVINGS_RECORD', payload: record });

  const setSavingsHistory = (records: SavingsRecord[]) =>
    dispatch({ type: 'SET_SAVINGS_HISTORY', payload: records });

  const clearError = () => dispatch({ type: 'SET_ERROR', payload: null });

  const setLoading = (loading: boolean) =>
    dispatch({ type: 'SET_LOADING', payload: loading });

  const contextValue: AppContextType = {
    ...state,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setPostalCode,
    setLocationInfo,
    setSearchResults,
    setComparison,
    addShoppingList,
    addSavingsRecord,
    setSavingsHistory,
    clearError,
    setLoading,
  };

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
