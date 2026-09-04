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
  LOCATION_ONBOARDED: 'locationOnboarded',
  RECENT_SEARCHES: 'recentSearches',
} as const;

/** How many past searches to keep for the suggestion dropdown. */
export const MAX_RECENT_SEARCHES = 6;

/**
 * Terms that mean several unrelated things in a grocery flyer feed, mapped to
 * the categories worth offering up front.
 *
 * These refine by *category filter*, never by appending words to the query —
 * Flipp keyword-matches, so "cream dairy" actually returns ice cream and
 * "whipping cream" returns nothing at all. The query stays broad; the category
 * does the narrowing once results are back.
 */
export const AMBIGUOUS_TERMS: Record<string, string[]> = {
  cream: ['dairy_eggs', 'frozen', 'health_beauty'],
  butter: ['dairy_eggs', 'pantry', 'health_beauty'],
  chocolate: ['snacks', 'bakery', 'beverages'],
  orange: ['produce', 'beverages'],
  apple: ['produce', 'non_grocery'],
  soap: ['health_beauty', 'household'],
  oil: ['pantry', 'health_beauty', 'non_grocery'],
  soda: ['beverages', 'pantry'],
  powder: ['pantry', 'health_beauty', 'baby'],
  bar: ['snacks', 'health_beauty'],
  water: ['beverages', 'health_beauty'],
  milk: ['dairy_eggs', 'health_beauty'],
  salt: ['pantry', 'health_beauty'],
  spray: ['pantry', 'household', 'health_beauty'],
};

/** Category keys → display labels. Mirrors CATEGORY_LABELS in backend/categorizer.py. */
export const CATEGORY_LABELS: Record<string, string> = {
  dairy_eggs: 'Dairy & Eggs',
  frozen: 'Frozen & Ice Cream',
  bakery: 'Bakery',
  produce: 'Fruit & Vegetables',
  meat_seafood: 'Meat & Seafood',
  pantry: 'Pantry',
  beverages: 'Drinks',
  snacks: 'Snacks & Sweets',
  health_beauty: 'Health & Beauty',
  household: 'Household',
  baby: 'Baby',
  pet: 'Pet',
  non_grocery: 'Not Groceries',
  other: 'Other',
};

/**
 * Local autocomplete vocabulary. Typeahead runs against this list rather than
 * the network — Flipp has no suggest endpoint, and a request per keystroke
 * would be both slow and wasteful for what is essentially a fixed vocabulary.
 */
export const GROCERY_SUGGESTIONS: string[] = [
  'apples', 'avocado', 'bacon', 'bagels', 'bananas', 'beef', 'berries',
  'bread', 'broccoli', 'butter', 'carrots', 'cereal', 'cheese', 'chicken',
  'chips', 'chocolate', 'coffee', 'cookies', 'cream cheese', 'crackers',
  'detergent', 'diapers', 'eggs', 'flour', 'frozen pizza', 'granola',
  'grapes', 'ground beef', 'ham', 'ice cream', 'juice', 'ketchup', 'lettuce',
  'milk', 'mushrooms', 'oatmeal', 'olive oil', 'onions', 'orange juice',
  'oranges', 'pasta', 'pasta sauce', 'peanut butter', 'peppers', 'pizza',
  'pork', 'potatoes', 'rice', 'salmon', 'salsa', 'sausage', 'shrimp',
  'soap', 'soup', 'spinach', 'strawberries', 'sugar', 'tea', 'tomatoes',
  'toilet paper', 'tortillas', 'tuna', 'turkey', 'water', 'yogurt',
];

export const DEFAULT_CURRENCY = 'CAD';
export const CURRENCY_SYMBOL = '$';

export const LOADING_MESSAGES = {
  SEARCHING: 'Searching for items...',
  COMPARING: 'Comparing store prices...',
  LOCATION: 'Getting your location...',
  SAVING: 'Saving your data...',
} as const;