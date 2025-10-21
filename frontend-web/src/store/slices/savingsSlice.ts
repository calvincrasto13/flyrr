import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState, SavingsState, SaveShoppingRequest } from '../../types';
import * as api from '../../services/api';

const initialState: SavingsState = {
  history: [],
  totalSavings: 0,
  loading: false,
  error: null,
};

// Async thunks
export const loadSavingsHistory = createAsyncThunk(
  'savings/loadHistory',
  async () => {
    const response = await api.loadSavingsHistory();
    return response;
  }
);

export const saveShopping = createAsyncThunk(
  'savings/saveShopping',
  async (request: SaveShoppingRequest) => {
    const response = await api.saveShopping(request);
    return response;
  }
);

const savingsSlice = createSlice({
  name: 'savings',
  initialState,
  reducers: {
    clearHistory: (state) => {
      state.history = [];
      state.totalSavings = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load savings history
      .addCase(loadSavingsHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadSavingsHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.history = action.payload.records;
        state.totalSavings = action.payload.total_savings;
      })
      .addCase(loadSavingsHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load savings history';
      })
      // Save shopping
      .addCase(saveShopping.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveShopping.fulfilled, (state, action) => {
        state.loading = false;
        // Add new record to history and update total
        state.history.unshift(action.payload);
        state.totalSavings += action.payload.savings;
      })
      .addCase(saveShopping.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to save shopping trip';
      });
  },
});

export const { clearHistory } = savingsSlice.actions;

// Selectors
export const selectSavingsHistory = (state: RootState) =>
  state.savings.history.sort(
    (a, b) =>
      new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  );
export const selectTotalSavings = (state: RootState) =>
  state.savings.totalSavings;
export const selectSavingsLoading = (state: RootState) => state.savings.loading;
export const selectSavingsError = (state: RootState) => state.savings.error;

export default savingsSlice.reducer;
