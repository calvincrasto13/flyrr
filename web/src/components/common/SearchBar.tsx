import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Clock, X, SlidersHorizontal } from 'lucide-react';
import {
  AMBIGUOUS_TERMS,
  CATEGORY_LABELS,
  GROCERY_SUGGESTIONS,
} from '../../utils/constants';
import { useRecentSearches } from '../../hooks/useRecentSearches';
import './SearchBar.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  /** `category` is a pre-selected refinement for known-ambiguous terms. */
  onSubmit: (query: string, category?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxSuggestions?: number;
}

interface Suggestion {
  term: string;
  recent: boolean;
  /** Set on disambiguation rows, e.g. cream → Dairy & Eggs. */
  category?: string;
  categoryLabel?: string;
}

/**
 * Search input with local typeahead.
 *
 * Suggestions are ranked prefix-first, then substring, with recent searches
 * floated to the top — a prefix match on what you typed is nearly always the
 * intended term, so plain `includes` ordering would bury it.
 */
const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Search milk, eggs, coffee…',
  maxSuggestions = 7,
}) => {
  const { recentSearches, addRecentSearch, clearRecentSearches } = useRecentSearches();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [indexedValue, setIndexedValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset the keyboard cursor whenever the query changes, since the list it
  // pointed into is gone. Adjusted during render (React's documented pattern
  // for derived state) rather than in an effect, which would cost an extra
  // render pass on every keystroke.
  if (indexedValue !== value) {
    setIndexedValue(value);
    setActiveIndex(-1);
  }

  const suggestions = useMemo<Suggestion[]>(() => {
    const query = value.trim().toLowerCase();

    // An exact hit on a known-ambiguous term takes over the dropdown: asking
    // "which cream?" up front beats returning skin cream, ice cream and a
    // handbag in one list.
    const ambiguous = AMBIGUOUS_TERMS[query];
    if (ambiguous) {
      return [
        { term: query, recent: false },
        ...ambiguous.map((category) => ({
          term: query,
          recent: false,
          category,
          categoryLabel: CATEGORY_LABELS[category] ?? category,
        })),
      ];
    }

    // Empty field: offer history first, topped up with common staples.
    if (!query) {
      const recent = recentSearches.map((term) => ({ term, recent: true }));
      const filler = GROCERY_SUGGESTIONS.filter(
        (term) => !recentSearches.includes(term)
      )
        .slice(0, maxSuggestions - recent.length)
        .map((term) => ({ term, recent: false }));
      return [...recent, ...filler].slice(0, maxSuggestions);
    }

    const pool = [
      ...recentSearches.map((term) => ({ term, recent: true })),
      ...GROCERY_SUGGESTIONS.filter((term) => !recentSearches.includes(term)).map(
        (term) => ({ term, recent: false })
      ),
    ];

    const scored = pool
      .map((entry) => {
        const index = entry.term.toLowerCase().indexOf(query);
        return { entry, index };
      })
      .filter(({ index }) => index !== -1)
      // Prefix matches first, then recents, then alphabetical for stability.
      .sort((a, b) => {
        const aPrefix = a.index === 0 ? 0 : 1;
        const bPrefix = b.index === 0 ? 0 : 1;
        if (aPrefix !== bPrefix) return aPrefix - bPrefix;
        if (a.entry.recent !== b.entry.recent) return a.entry.recent ? -1 : 1;
        return a.entry.term.localeCompare(b.entry.term);
      });

    // Don't show a lone suggestion identical to what's already typed.
    const results = scored.map(({ entry }) => entry);
    if (results.length === 1 && results[0].term.toLowerCase() === query) return [];
    return results.slice(0, maxSuggestions);
  }, [value, recentSearches, maxSuggestions]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const commit = (term: string, category?: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    onChange(trimmed);
    addRecentSearch(trimmed);
    setOpen(false);
    setActiveIndex(-1);
    onSubmit(trimmed, category);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const picked = activeIndex >= 0 ? suggestions[activeIndex] : null;
      commit(picked ? picked.term : value, picked?.category);
      return;
    }

    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown') setOpen(true);
      return;
    }

    e.preventDefault();
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    // Wrap through -1 so the user can step back out to their raw text.
    const next = activeIndex + delta;
    setActiveIndex(next < -1 ? suggestions.length - 1 : next >= suggestions.length ? -1 : next);
  };

  const showDropdown = open && suggestions.length > 0;

  return (
    <div className="search-bar" ref={containerRef}>
      <div className="search-bar-field">
        <Search size={18} className="search-bar-icon" aria-hidden="true" />
        <input
          className="search-bar-input"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `search-suggestion-${activeIndex}` : undefined
          }
        />
        {value && (
          <button
            className="search-bar-clear"
            onClick={() => {
              onChange('');
              setOpen(true);
            }}
            aria-label="Clear search"
            type="button"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showDropdown && (
        <ul className="search-suggestions" id="search-suggestions" role="listbox">
          {!value.trim() && recentSearches.length > 0 && (
            <li className="search-suggestions-header" role="presentation">
              <span>Recent</span>
              <button onClick={clearRecentSearches} type="button">Clear</button>
            </li>
          )}
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.term}-${suggestion.category ?? 'all'}`}
              id={`search-suggestion-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`search-suggestion${index === activeIndex ? ' is-active' : ''}`}
              // mousedown fires before the input's blur, so the click isn't
              // swallowed by the dropdown closing first.
              onMouseDown={(e) => {
                e.preventDefault();
                commit(suggestion.term, suggestion.category);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {suggestion.category ? (
                <SlidersHorizontal size={15} />
              ) : suggestion.recent ? (
                <Clock size={15} />
              ) : (
                <Search size={15} />
              )}
              <span>{suggestion.term}</span>
              {suggestion.categoryLabel && (
                <span className="search-suggestion-category">{suggestion.categoryLabel}</span>
              )}
              {!suggestion.category && AMBIGUOUS_TERMS[suggestion.term] && (
                <span className="search-suggestion-hint">everything</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;
