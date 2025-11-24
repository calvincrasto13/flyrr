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

// Cache utilities with expiry based on earliest valid_to
function saveItemsToCache(query: string, postal: string, items: GroceryItem[]) {
  // Find the earliest valid_to date from all items
  let minValidTo = Infinity;
  items.forEach(item => {
    if (item.valid_to) {
      const validToTime = new Date(item.valid_to).getTime();
      if (validToTime < minValidTo) {
        minValidTo = validToTime;
      }
    }
  });

  const cacheKey = `flipp_${query}_${postal}`;
  const cacheData = {
    items,
    validTo: minValidTo === Infinity ? null : minValidTo,
    timestamp: Date.now(),
  };
  localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  console.log('Cached items with expiry:', new Date(minValidTo).toLocaleString());
}

function loadItemsFromCache(query: string, postal: string): GroceryItem[] | null {
  const cacheKey = `flipp_${query}_${postal}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (!cached) return null;
  
  try {
    const { items, validTo, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache has expired based on earliest valid_to
    if (validTo && now > validTo) {
      console.log('Cache expired based on valid_to date');
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    // Also invalidate if cache is older than 24 hours
    if (now - timestamp > 24 * 60 * 60 * 1000) {
      console.log('Cache expired (24 hours old)');
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    console.log('Loaded from cache:', items.length, 'items');
    return items;
  } catch (error) {
    console.error('Cache parse error:', error);
    localStorage.removeItem(cacheKey);
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
      return cached;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = `https://backflipp.wishabi.com/flipp/items/search?locale=en-ca&postal_code=${postalCode}&q=${query}`;
      console.log('Fetching from API:', url);
      
      const response = await axios.get(url, { timeout: 15000 });
      
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

      console.log('Fetched items:', processedItems.length);

      // Save to cache
      if (processedItems.length > 0) {
        saveItemsToCache(query, postalCode, processedItems);
      }
      
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
