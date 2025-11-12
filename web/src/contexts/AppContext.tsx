import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppContextType, CartItem, ShoppingItem, StoreComparison, LocationInfo, SavingsRecord } from '../types';
import { STORAGE_KEYS } from '../utils/constants';

// State interface
interface AppState {
  cart: CartItem[];
  postalCode: string;
  locationInfo: LocationInfo | null;
  searchResults: ShoppingItem[];
  shoppingLists: SavingsRecord[];
  savingsHistory: SavingsRecord[];
  comparison: StoreComparison | null;
  isLoading: boolean;
  error: string | null;
}

// Action types
type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'SET_POSTAL_CODE'; payload: string }
  | { type: 'SET_LOCATION_INFO'; payload: LocationInfo | null }
  | { type: 'SET_SEARCH_RESULTS'; payload: ShoppingItem[] }
  | { type: 'SET_COMPARISON'; payload: StoreComparison | null }
  | { type: 'SET_SAVINGS_HISTORY'; payload: SavingsRecord[] }
  | { type: 'ADD_TO_CART'; payload: { item: ShoppingItem; quantity?: number } }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { itemId: string; delta: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'ADD_SAVINGS_RECORD'; payload: SavingsRecord };

// Initial state
const initialState: AppState = {
  cart: [],
  postalCode: '',
  locationInfo: null,
  searchResults: [],
  shoppingLists: [],
  savingsHistory: [],
  comparison: null,
  isLoading: false,
  error: null,
};

// Reducer function
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
      return { ...state, searchResults: action.payload };

    case 'SET_COMPARISON':
      return { ...state, comparison: action.payload };

    case 'SET_SAVINGS_HISTORY':
      return { ...state, savingsHistory: action.payload };

    case 'ADD_TO_CART': {
      const { item, quantity = 1 } = action.payload;
      const existingItem = state.cart.find(i => i.global_id === item.global_id);

      let newCart: CartItem[];
      if (existingItem) {
        newCart = state.cart.map(i =>
          i.global_id === item.global_id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      } else {
        newCart = [...state.cart, {
          ...item,
          quantity,
          added_at: new Date().toISOString(),
          id: Date.now().toString()
        }];
      }

      return { ...state, cart: newCart };
    }

    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter(item => item.id !== action.payload)
      };

    case 'UPDATE_QUANTITY': {
      const { itemId, delta } = action.payload;
      const newCart = state.cart.map(item => {
        if (item.id === itemId) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      });

      return { ...state, cart: newCart };
    }

    case 'CLEAR_CART':
      return { ...state, cart: [], comparison: null };

    case 'ADD_SAVINGS_RECORD':
      return {
        ...state,
        savingsHistory: [action.payload, ...state.savingsHistory],
      };

    default:
      return state;
  }
};

// Context provider
const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load saved data from localStorage
  useEffect(() => {
    const loadSavedData = () => {
      try {
        const savedPostalCode = localStorage.getItem(STORAGE_KEYS.POSTAL_CODE);
        const savedCart = localStorage.getItem(STORAGE_KEYS.SHOPPING_CART);
        const savedLocation = localStorage.getItem(STORAGE_KEYS.LOCATION_INFO);

        if (savedPostalCode) {
          dispatch({ type: 'SET_POSTAL_CODE', payload: savedPostalCode });
        }
        if (savedCart) {
          dispatch({ type: 'SET_CART', payload: JSON.parse(savedCart) });
        }
        if (savedLocation) {
          dispatch({ type: 'SET_LOCATION_INFO', payload: JSON.parse(savedLocation) });
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    };

    loadSavedData();
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SHOPPING_CART, JSON.stringify(state.cart));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  }, [state.cart]);

  // Save postal code to localStorage whenever it changes
  useEffect(() => {
    try {
      if (state.postalCode) {
        localStorage.setItem(STORAGE_KEYS.POSTAL_CODE, state.postalCode);
      }
    } catch (error) {
      console.error('Error saving postal code:', error);
    }
  }, [state.postalCode]);

  // Context actions
  const actions: Omit<AppContextType, keyof AppState> = {
    addToCart: (item: ShoppingItem, quantity?: number) => {
      dispatch({ type: 'ADD_TO_CART', payload: { item, quantity } });
    },

    removeFromCart: (itemId: string) => {
      dispatch({ type: 'REMOVE_FROM_CART', payload: itemId });
    },

    updateQuantity: (itemId: string, delta: number) => {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { itemId, delta } });
    },

    clearCart: () => {
      dispatch({ type: 'CLEAR_CART' });
    },

    setPostalCode: (postalCode: string) => {
      dispatch({ type: 'SET_POSTAL_CODE', payload: postalCode });
    },

    setLocationInfo: (locationInfo: LocationInfo) => {
      try {
        localStorage.setItem(STORAGE_KEYS.LOCATION_INFO, JSON.stringify(locationInfo));
      } catch (error) {
        console.error('Error saving location info:', error);
      }
      dispatch({ type: 'SET_LOCATION_INFO', payload: locationInfo });
    },

    setSearchResults: (results: ShoppingItem[]) => {
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });
    },

    setComparison: (comparison: StoreComparison | null) => {
      dispatch({ type: 'SET_COMPARISON', payload: comparison });
    },

    addShoppingList: (list: SavingsRecord) => {
      // This would add to shopping lists if needed
      console.log('Shopping list added:', list);
    },

    addSavingsRecord: (record: SavingsRecord) => {
      dispatch({ type: 'ADD_SAVINGS_RECORD', payload: record });
    },

    clearError: () => {
      dispatch({ type: 'SET_ERROR', payload: null });
    },

    setLoading: (loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    },
  };

  const contextValue: AppContextType = {
    ...state,
    ...actions,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Hook to use the context
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};