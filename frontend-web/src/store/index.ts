import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage for web

import cartReducer from './slices/cartSlice';
import searchReducer from './slices/searchSlice';
import userReducer from './slices/userSlice';
import savingsReducer from './slices/savingsSlice';

// Persist config for cart and user slices
const cartPersistConfig = {
  key: 'cart',
  storage,
};

const userPersistConfig = {
  key: 'user',
  storage,
};

// Create persisted reducers
const persistedCartReducer = persistReducer(cartPersistConfig, cartReducer);
const persistedUserReducer = persistReducer(userPersistConfig, userReducer);

// Combine all reducers
const rootReducer = combineReducers({
  cart: persistedCartReducer,
  search: searchReducer,
  user: persistedUserReducer,
  savings: savingsReducer,
});

// Configure store
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

// Create persistor
export const persistor = persistStore(store);

// Infer types from store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
