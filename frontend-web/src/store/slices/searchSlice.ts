import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState, SearchState, SearchRequest } from '../../types';
import * as api from '../../services/api';

const initialState: SearchState = {
  query: '',
  results: [],
  loading: false,
  error: null,
};

// Async thunks
export const searchItems = createAsyncThunk(
  'search/searchItems',
  async (request: SearchRequest) => {
    const response = await api.searchItems(request);
    return response.items;
  }
);

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
    },
    clearResults: (state) => {
      state.results = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchItems.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchItems.fulfilled, (state, action) => {
        state.loading = false;
        state.results = action.payload;
      })
      .addCase(searchItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to search items';
      });
  },
});

export const { setQuery, clearResults } = searchSlice.actions;

// Selectors
export const selectSearchResults = (state: RootState) => state.search.results;
export const selectSearchQuery = (state: RootState) => state.search.query;
export const selectSearchLoading = (state: RootState) => state.search.loading;
export const selectSearchError = (state: RootState) => state.search.error;

export default searchSlice.reducer;
