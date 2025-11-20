import { useState, useCallback } from 'react';
import axios from 'axios';

export interface GroceryItem {
  global_id: string;
  name: string;
  merchant: string;
  merchant_id: number;
  current_price: number;
  image_url?: string;
  description?: string;
  merchant_logo?: string;
  valid_to?: string;
}

// Cache utilities
function saveItemsToCache(query: string, postal: string, items: GroceryItem[]) {
  const cacheKey = `flipp_${query}_${postal}`;
  const cacheData = {
    items,
    timestamp: Date.now(),
  };
  localStorage.setItem(cacheKey, JSON.stringify(cacheData));
}

function loadItemsFromCache(query: string, postal: string): GroceryItem[] | null {
  const cacheKey = `flipp_${query}_${postal}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (!cached) return null;
  
  try {
    const { items, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Filter out expired items based on valid_to
    const validItems = items.filter((item: GroceryItem) => {
      if (!item.valid_to) return true;
      return new Date(item.valid_to).getTime() > now;
    });
    
    // If cache is older than 1 hour or no valid items, return null
    if (now - timestamp > 3600000 || validItems.length === 0) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return validItems;
  } catch (error) {
    console.error('Cache parse error:', error);
    return null;
  }
}

export const useGroceryAPI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchItems = useCallback(async (query: string, postalCode: string): Promise<GroceryItem[]> => {
    // Check cache first
    const cached = loadItemsFromCache(query, postalCode);
    if (cached && cached.length > 0) {
      console.log('Loaded from cache:', cached.length, 'items');
      return cached;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = `https://backflipp.wishabi.com/flipp/items/search?locale=en-ca&postal_code=${postalCode}&q=${query}`;
      const response = await axios.get(url, { timeout: 10000 });
      
      const ecomItems = response.data.ecom_items || [];
      
      // Process and filter items
      const processedItems: GroceryItem[] = ecomItems
        .filter((item: any) => item.current_price > 0)
        .map((item: any) => ({
          global_id: item.global_id || '',
          name: item.name || '',
          merchant: item.merchant || '',
          merchant_id: item.merchant_id || 0,
          current_price: parseFloat(item.current_price) || 0,
          image_url: item.image_url || '',
          description: item.description || '',
          merchant_logo: item.merchant_logo || '',
          valid_to: item.valid_to || '',
        }))
        .sort((a, b) => a.current_price - b.current_price);

      // Save to cache
      saveItemsToCache(query, postalCode, processedItems);
      
      return processedItems;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to search items';
      setError(errorMessage);
      console.error('API Error:', err);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { searchItems, isLoading, error };
};
