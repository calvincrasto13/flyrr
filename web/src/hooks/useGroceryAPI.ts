import { useState, useCallback } from 'react';
import { ShoppingItem, ShoppingList, StoreComparison, SavingsRecord, SearchRequest } from '../types';
import apiService from '../services/api';
import { useApp } from '../contexts/AppContext';

interface UseGroceryAPIReturn {
  searchItems: (query: string, postalCode: string) => Promise<ShoppingItem[]>;
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

  // Search for grocery items
  const searchItems = useCallback(async (query: string, postalCode: string): Promise<ShoppingItem[]> => {
    if (!query.trim() || !postalCode.trim()) {
      setError('Please enter both search term and postal code');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const searchRequest: SearchRequest = {
        query: query.trim(),
        postal_code: postalCode.trim().toUpperCase().replace(/\s/g, ''),
      };

      const results = await apiService.searchItems(searchRequest);
      setSearchResults(results);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search items';
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [setSearchResults]);

  // Compare stores for cart items
  const compareStores = useCallback(async (cart: ShoppingItem[]): Promise<StoreComparison> => {
    if (cart.length === 0) {
      setError('Your cart is empty. Please add items to compare stores.');
      throw new Error('Cart is empty');
    }

    setIsLoading(true);
    setError(null);

    try {
      const shoppingList: ShoppingList = {
        id: Date.now().toString(),
        items: cart,
        total_amount: cart.reduce((sum, item) => sum + item.current_price * item.quantity, 0),
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
  }, [setComparison]);

  // Save shopping trip and savings
  const saveSavings = useCallback(async (record: SavingsRecord): Promise<void> => {
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
  }, [addSavingsRecord]);

  // Load savings history
  const loadSavingsHistory = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const { records, total_savings } = await apiService.getSavingsHistory();
      setSavingsHistory(records);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load savings history';
      setError(errorMessage);
      // Don't throw here - it's okay if we can't load history
    } finally {
      setIsLoading(false);
    }
  }, [setSavingsHistory]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

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