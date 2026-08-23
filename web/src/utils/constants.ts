// Application constants

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const APP_ROUTES = {
  HOME: '/',
  SEARCH: '/search',
  CART: '/cart',
  SHOPPING: '/shopping',
  SAVINGS: '/savings',
} as const;

// Kept in sync with the CSS custom properties in src/styles/tokens.css.
// lucide-react icons take a JS color string (not a CSS var), so this object
// stays as the JS-side mirror of the same palette; tokens.css remains the
// source of truth for anything styled in CSS.
export const COLORS = {
  PRIMARY: '#34a853',
  SECONDARY: '#ff9f43',
  DANGER: '#f4463c',
  SUCCESS: '#34a853',
  WARNING: '#ff9f43',
  INFO: '#3b82f6',
  LIGHT: '#fbfaf8',
  WHITE: '#ffffff',
  BLACK: '#1f2333',
  GRAY: '#6b7280',
  LIGHT_GRAY: '#9ca3af',
  BORDER: '#eef0f2',
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