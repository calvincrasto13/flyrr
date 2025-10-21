import axios from 'axios';
import type {
  SearchRequest,
  SearchResponse,
  CompareStoresRequest,
  StoreComparison,
  SaveShoppingRequest,
  SavingsRecord,
  SavingsHistoryResponse,
} from '../types';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    } else if (!error.response) {
      throw new Error('Unable to connect to server. Please check your internet connection.');
    } else if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    throw error;
  }
);

/**
 * Search for grocery items by query and postal code
 */
export const searchItems = async (
  request: SearchRequest
): Promise<SearchResponse> => {
  try {
    const response = await apiClient.post('/api/search', request);
    return response.data;
  } catch (error) {
    console.error('Error searching items:', error);
    throw error;
  }
};

/**
 * Compare prices across stores for cart items
 */
export const compareStores = async (
  request: CompareStoresRequest
): Promise<StoreComparison> => {
  try {
    if (!request.items || request.items.length === 0) {
      throw new Error('Cart is empty');
    }

    const response = await apiClient.post('/api/compare-stores', request);
    return response.data;
  } catch (error) {
    console.error('Error comparing stores:', error);
    throw error;
  }
};

/**
 * Save completed shopping trip
 */
export const saveShopping = async (
  request: SaveShoppingRequest
): Promise<SavingsRecord> => {
  try {
    const response = await apiClient.post('/api/savings', request);
    return response.data;
  } catch (error) {
    console.error('Error saving shopping trip:', error);
    throw error;
  }
};

/**
 * Load savings history
 */
export const loadSavingsHistory = async (): Promise<SavingsHistoryResponse> => {
  try {
    const response = await apiClient.get('/api/savings');
    return response.data;
  } catch (error) {
    console.error('Error loading savings history:', error);
    throw error;
  }
};
