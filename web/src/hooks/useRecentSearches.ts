import { useCallback, useEffect, useState } from 'react';
import { MAX_RECENT_SEARCHES, STORAGE_KEYS } from '../utils/constants';

interface UseRecentSearchesReturn {
  recentSearches: string[];
  addRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
}

const read = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * Search history backing the typeahead, persisted to localStorage.
 *
 * Reads lazily on first render rather than in an effect so the suggestion list
 * is populated on the very first keystroke instead of one render behind.
 */
export const useRecentSearches = (): UseRecentSearchesReturn => {
  const [recentSearches, setRecentSearches] = useState<string[]>(read);

  // Keep multiple mounted SearchBars (and other tabs) in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.RECENT_SEARCHES) setRecentSearches(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addRecentSearch = useCallback((term: string) => {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return;

    setRecentSearches((previous) => {
      const next = [normalized, ...previous.filter((t) => t !== normalized)].slice(
        0,
        MAX_RECENT_SEARCHES
      );
      try {
        localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(next));
      } catch {
        // Private-mode / quota failures shouldn't break search itself.
      }
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.RECENT_SEARCHES);
    } catch {
      // Best-effort; the in-memory list is cleared regardless.
    }
    setRecentSearches([]);
  }, []);

  return { recentSearches, addRecentSearch, clearRecentSearches };
};
