// Application constants

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const APP_ROUTES = {
  HOME: '/',
  SEARCH: '/search',
  CART: '/cart',
  SHOPPING: '/shopping',
  SAVINGS: '/savings',
} as const;

export const COLORS = {
  PRIMARY: '#4CAF50',
  SECONDARY: '#FF9800',
  DANGER: '#f44336',
  SUCCESS: '#4CAF50',
  WARNING: '#FF9800',
  INFO: '#2196F3',
  LIGHT: '#f5f5f5',
  WHITE: '#ffffff',
  BLACK: '#333333',
  GRAY: '#666666',
  LIGHT_GRAY: '#999999',
  BORDER: '#e0e0e0',
} as const;

export const BREAKPOINTS = {
  MOBILE: '768px',
  TABLET: '1024px',
  DESKTOP: '1200px',
} as const;

export const STORAGE_KEYS = {
  POSTAL_CODE: 'postalCode',
  SHOPPING_CART: 'shoppingCart',
  LOCATION_INFO: 'locationInfo',
} as const;

export const DEFAULT_CURRENCY = 'CAD';
export const CURRENCY_SYMBOL = '$';

export const LOADING_MESSAGES = {
  SEARCHING: 'Searching for items...',
  COMPARING: 'Comparing store prices...',
  LOCATION: 'Getting your location...',
  SAVING: 'Saving your data...',
} as const;