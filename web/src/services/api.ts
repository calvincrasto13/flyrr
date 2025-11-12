import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { API_URL } from '../utils/constants';
import { SearchRequest, ShoppingList, StoreComparison, SavingsRecord, APIResponse } from '../types';

class APIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // You can add auth tokens here if needed
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse<APIResponse>) => {
        return response;
      },
      (error) => {
        const message = error.response?.data?.error || error.message || 'An error occurred';
        return Promise.reject(new Error(message));
      }
    );
  }

  async searchItems(request: SearchRequest): Promise<ShoppingItem[]> {
    const response = await this.client.post<APIResponse>('/search', request);
    if (response.data.success && response.data.items) {
      return response.data.items;
    }
    throw new Error(response.data.error || 'Failed to search items');
  }

  async createShoppingList(shoppingList: ShoppingList): Promise<ShoppingList> {
    const response = await this.client.post<APIResponse<ShoppingList>>('/shopping-list', shoppingList);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to create shopping list');
  }

  async getShoppingList(listId: string): Promise<ShoppingList> {
    const response = await this.client.get<APIResponse<ShoppingList>>(`/shopping-list/${listId}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get shopping list');
  }

  async getShoppingLists(): Promise<ShoppingList[]> {
    const response = await this.client.get<APIResponse<ShoppingList[]>>('/shopping-lists');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get shopping lists');
  }

  async compareStores(shoppingList: ShoppingList): Promise<StoreComparison> {
    const response = await this.client.post<APIResponse<StoreComparison>>('/compare-stores', shoppingList);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to compare stores');
  }

  async saveSavingsRecord(record: SavingsRecord): Promise<SavingsRecord> {
    const response = await this.client.post<APIResponse<SavingsRecord>>('/savings', record);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to save savings record');
  }

  async getSavingsHistory(): Promise<{ records: SavingsRecord[]; total_savings: number }> {
    const response = await this.client.get<APIResponse<SavingsRecord[]>>('/savings');
    if (response.data.success) {
      return {
        records: response.data.records || [],
        total_savings: response.data.total_savings || 0,
      };
    }
    throw new Error(response.data.error || 'Failed to get savings history');
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
const apiService = new APIService();

export default apiService;