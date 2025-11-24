import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  id: string;
  global_id: string;
  name: string;
  merchant: string;
  merchant_id: number;
  current_price: number;
  image_url?: string;
  quantity: number;
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

export interface LocationInfo {
  postal_code: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  province?: string;
}

interface AppContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateCartItemQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  searchResults: any[];
  setSearchResults: (results: any[]) => void;
  postalCode: string;
  setPostalCode: (code: string) => void;
  locationInfo: LocationInfo | null;
  setLocationInfo: (info: LocationInfo | null) => void;
  savingsHistory: SavingsRecord[];
  addSavingsRecord: (record: SavingsRecord) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [postalCode, setPostalCode] = useState('');
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [savingsHistory, setSavingsHistory] = useState<SavingsRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('grocery_cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
        console.log('Cart loaded from localStorage');
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('grocery_cart', JSON.stringify(cart));
      console.log('Cart saved to localStorage');
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }, [cart]);

  // Load savings history from localStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('savings_history');
      if (savedHistory) {
        setSavingsHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Error loading savings history:', error);
    }
  }, []);

  // Save savings history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('savings_history', JSON.stringify(savingsHistory));
    } catch (error) {
      console.error('Error saving savings history:', error);
    }
  }, [savingsHistory]);

  const addToCart = (item: CartItem) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.global_id === item.global_id);
      if (existingItem) {
        return prevCart.map(cartItem =>
          cartItem.global_id === item.global_id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.global_id !== itemId));
  };

  const updateCartItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.global_id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('grocery_cart');
  };

  const addSavingsRecord = (record: SavingsRecord) => {
    setSavingsHistory(prev => [record, ...prev]);
  };

  return (
    <AppContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateCartItemQuantity,
        clearCart,
        searchResults,
        setSearchResults,
        postalCode,
        setPostalCode,
        locationInfo,
        setLocationInfo,
        savingsHistory,
        addSavingsRecord,
        isLoading,
        setIsLoading,
        error,
        setError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
