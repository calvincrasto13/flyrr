import { useState, useCallback } from 'react';
import { ShoppingItem, ShoppingList, StoreComparison, SavingsRecord, SearchResponse } from '../types';
import apiService from '../services/api';
import { useApp } from '../contexts/AppContext';

interface UseGroceryAPIReturn {
  searchItems: (query: string, postalCode: string) => Promise<SearchResponse>;
  compareStores: (cart: ShoppingItem[]) => Promise<StoreComparison>;
  saveSavings: (record: SavingsRecord) => Promise<void>;
  loadSavingsHistory: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export const useGroceryAPI = (): UseGroceryAPIReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setSearchResults, setComparison, addSavingsRecord, setSavingsHistory } = useApp();

  // Search for grocery items — returns full SearchResponse including product_groups
  const searchItems = useCallback(
    async (query: string, postalCode: string): Promise<SearchResponse> => {
      if (!query.trim() || !postalCode.trim()) {
        setError('Please enter both a search term and a postal code');
        return {
          items: [],
          product_groups: [],
          cross_store_count: 0,
          categories: [],
          ambiguous: false,
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await apiService.searchItems({
          query: query.trim(),
          postal_code: postalCode.trim().toUpperCase().replace(/\s/g, ''),
        });

        // Store both flat items and grouped results in context
        setSearchResults(
          response.items,
          response.product_groups,
          response.cross_store_count,
          response.categories,
          response.ambiguous,
          query.trim()
        );
        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to search items';
        setError(errorMessage);
        return {
          items: [],
          product_groups: [],
          cross_store_count: 0,
          categories: [],
          ambiguous: false,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [setSearchResults]
  );

  // Compare stores for cart items
  const compareStores = useCallback(
    async (cart: ShoppingItem[]): Promise<StoreComparison> => {
      if (cart.length === 0) {
        setError('Your cart is empty. Please add items to compare stores.');
        throw new Error('Cart is empty');
      }

      setIsLoading(true);
      setError(null);

      try {
        const shoppingList: ShoppingList = {
          id: Date.now().toString(),
          items: cart as any,
          total_amount: cart.reduce(
            (sum, item) => sum + item.current_price * (item.quantity ?? 1),
            0
          ),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed: false,
        };

        const comparison = await apiService.compareStores(shoppingList);
        setComparison(comparison);
        return comparison;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to compare stores';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setComparison]
  );

  // Save a completed shopping trip and its savings
  const saveSavings = useCallback(
    async (record: SavingsRecord): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const savedRecord = await apiService.saveSavingsRecord(record);
        addSavingsRecord(savedRecord);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save savings record';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [addSavingsRecord]
  );

  // Load savings history from the backend
  const loadSavingsHistory = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const { records } = await apiService.getSavingsHistory();
      setSavingsHistory(records);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load savings history';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [setSavingsHistory]);

  const clearError = useCallback(() => setError(null), []);

  return {
    searchItems,
    compareStores,
    saveSavings,
    loadSavingsHistory,
    isLoading,
    error,
    clearError,
  };
};
