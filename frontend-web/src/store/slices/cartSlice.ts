import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState, CartState, ShoppingItem, StoreComparison, CompareStoresRequest } from '../../types';
import * as api from '../../services/api';

const initialState: CartState = {
  items: [],
  comparison: null,
  loading: false,
  error: null,
};

// Async thunks
export const compareStores = createAsyncThunk(
  'cart/compareStores',
  async (items: ShoppingItem[]) => {
    const request: CompareStoresRequest = {
      id: Date.now().toString(),
      items,
      created_at: new Date().toISOString(),
      completed: false,
    };
    const response = await api.compareStores(request);
    return response;
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<ShoppingItem>) => {
      const existingItem = state.items.find(
        (i) => i.global_id === action.payload.global_id
      );

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({
          ...action.payload,
          quantity: 1,
          id: Date.now().toString(),
        });
      }

      // Clear comparison when cart changes
      state.comparison = null;
    },
    updateQuantity: (
      state,
      action: PayloadAction<{ id: string; delta: number }>
    ) => {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) {
        item.quantity = Math.max(1, item.quantity + action.payload.delta);
      }

      // Clear comparison when cart changes
      state.comparison = null;
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.id !== action.payload);

      // Clear comparison when cart changes
      state.comparison = null;
    },
    clearCart: (state) => {
      state.items = [];
      state.comparison = null;
    },
    clearComparison: (state) => {
      state.comparison = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(compareStores.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(compareStores.fulfilled, (state, action) => {
        state.loading = false;
        state.comparison = action.payload;
      })
      .addCase(compareStores.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to compare stores';
      });
  },
});

export const {
  addToCart,
  updateQuantity,
  removeFromCart,
  clearCart,
  clearComparison,
} = cartSlice.actions;

// Selectors
export const selectCartItems = (state: RootState) => state.cart.items;
export const selectCartItemCount = (state: RootState) =>
  state.cart.items.reduce((sum, item) => sum + item.quantity, 0);
export const selectCartTotal = (state: RootState) =>
  state.cart.items.reduce(
    (sum, item) => sum + item.current_price * item.quantity,
    0
  );
export const selectComparison = (state: RootState) => state.cart.comparison;
export const selectBestStore = (state: RootState) =>
  state.cart.comparison?.best_store;
export const selectCartLoading = (state: RootState) => state.cart.loading;

export default cartSlice.reducer;
