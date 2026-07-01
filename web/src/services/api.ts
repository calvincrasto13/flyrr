import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { API_URL } from '../utils/constants';
import {
  SearchRequest,
  SearchResponse,
  ShoppingList,
  StoreComparison,
  SavingsRecord,
  APIResponse,
  PriceAlert,
  PriceAlertCreate,
  PriceAlertUpdate,
} from '../types';

class APIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor — surface backend error messages
    this.client.interceptors.response.use(
      (response: AxiosResponse<APIResponse>) => response,
      (error) => {
        const message =
          error.response?.data?.detail ||
          error.response?.data?.error ||
          error.message ||
          'An error occurred';
        return Promise.reject(new Error(message));
      }
    );
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async searchItems(request: SearchRequest): Promise<SearchResponse> {
    const response = await this.client.post<any>('/search', request);
    if (response.data.success) {
      return {
        items: response.data.items || [],
        product_groups: response.data.product_groups || [],
        cross_store_count: response.data.cross_store_count || 0,
      };
    }
    throw new Error(response.data.error || 'Failed to search items');
  }

  // ── Shopping List ─────────────────────────────────────────────────────────

  async createShoppingList(shoppingList: ShoppingList): Promise<ShoppingList> {
    const response = await this.client.post<any>('/shopping-list', shoppingList);
    if (response.data.success) {
      return response.data.shopping_list || shoppingList;
    }
    throw new Error(response.data.error || 'Failed to create shopping list');
  }

  async getShoppingList(listId: string): Promise<ShoppingList> {
    const response = await this.client.get<any>(`/shopping-list/${listId}`);
    if (response.data.success) {
      return response.data.shopping_list;
    }
    throw new Error(response.data.error || 'Failed to get shopping list');
  }

  async getShoppingLists(): Promise<ShoppingList[]> {
    const response = await this.client.get<any>('/shopping-lists');
    if (response.data.success) {
      return response.data.lists || [];
    }
    throw new Error(response.data.error || 'Failed to get shopping lists');
  }

  // ── Store Comparison ──────────────────────────────────────────────────────

  async compareStores(shoppingList: ShoppingList): Promise<StoreComparison> {
    const response = await this.client.post<any>('/compare-stores', shoppingList);
    if (response.data.success) {
      return {
        best_store: response.data.best_store,
        best_store_total: response.data.best_store_total,
        savings: response.data.savings,
        store_totals: response.data.store_totals,
        theoretical_minimum: response.data.theoretical_minimum,
      };
    }
    throw new Error(response.data.error || 'Failed to compare stores');
  }

  // ── Savings ───────────────────────────────────────────────────────────────

  async saveSavingsRecord(record: SavingsRecord): Promise<SavingsRecord> {
    const response = await this.client.post<any>('/savings', record);
    if (response.data.success) {
      return response.data.record || record;
    }
    throw new Error(response.data.error || 'Failed to save savings record');
  }

  async getSavingsHistory(): Promise<{ records: SavingsRecord[]; total_savings: number }> {
    const response = await this.client.get<any>('/savings');
    if (response.data.success) {
      return {
        records: response.data.records || [],
        total_savings: response.data.total_savings || 0,
      };
    }
    throw new Error(response.data.error || 'Failed to get savings history');
  }

  // ── Price Alerts ──────────────────────────────────────────────────────────

  async createAlert(alert: PriceAlertCreate): Promise<PriceAlert> {
    const response = await this.client.post<any>('/alerts', alert);
    if (response.data.success) {
      return response.data.alert;
    }
    throw new Error(response.data.error || 'Failed to create alert');
  }

  async getAlerts(): Promise<PriceAlert[]> {
    const response = await this.client.get<any>('/alerts');
    if (response.data.success) {
      return response.data.alerts || [];
    }
    throw new Error(response.data.error || 'Failed to get alerts');
  }

  async updateAlert(alertId: string, update: PriceAlertUpdate): Promise<void> {
    const response = await this.client.patch<any>(`/alerts/${alertId}`, update);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update alert');
    }
  }

  async deleteAlert(alertId: string): Promise<void> {
    const response = await this.client.delete<any>(`/alerts/${alertId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete alert');
    }
  }

  async triggerAlertCheck(): Promise<{ checked: number; fired: number }> {
    const response = await this.client.post<any>('/alerts/check');
    if (response.data.success) {
      return { checked: response.data.checked || 0, fired: response.data.fired || 0 };
    }
    throw new Error(response.data.error || 'Failed to trigger alert check');
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(): Promise<any> {
    const response = await this.client.get<any>('/stats');
    if (response.data.success) {
      return response.data;
    }
    throw new Error(response.data.error || 'Failed to get stats');
  }

  // ── Health ────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

const apiService = new APIService();
export default apiService;
