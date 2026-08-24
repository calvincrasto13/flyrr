import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { CategoryFacet } from '../../types';
import './CategoryRefiner.css';

interface CategoryRefinerProps {
  categories: CategoryFacet[];
  /** Currently applied category key, or null for "everything". */
  active: string | null;
  onChange: (key: string | null) => void;
  /** Shows the "Did you mean…" prompt when the query was genuinely ambiguous. */
  ambiguous?: boolean;
  query?: string;
  totalCount: number;
}

/**
 * Category refinement chips for a search result set.
 *
 * Exists because a query like "cream" legitimately matches dairy cream, ice
 * cream, skin cream and a cream-coloured handbag. Narrowing the query text
 * can't fix this — Flipp keyword-matches, so "cream dairy" returns ice cream
 * and "whipping cream" returns nothing — so the broad result set is kept and
 * filtered here instead.
 */
const CategoryRefiner: React.FC<CategoryRefinerProps> = ({
  categories,
  active,
  onChange,
  ambiguous = false,
  query,
  totalCount,
}) => {
  // One category means there is nothing to disambiguate.
  if (categories.length <= 1) return null;

  return (
    <div className="category-refiner">
      {ambiguous && !active && (
        <p className="category-refiner-prompt">
          <SlidersHorizontal size={15} />
          <span>
            {query ? <>&ldquo;{query}&rdquo; matches several kinds of product.</> : 'Results span several categories.'}{' '}
            <strong>Which did you mean?</strong>
          </span>
        </p>
      )}

      <div className="category-chips" role="group" aria-label="Filter results by category">
        <button
          type="button"
          className={`category-chip${active === null ? ' is-active' : ''}`}
          onClick={() => onChange(null)}
          aria-pressed={active === null}
        >
          All
          <span className="category-chip-count">{totalCount}</span>
        </button>

        {categories.map((category) => (
          <button
            key={category.key}
            type="button"
            className={`category-chip${active === category.key ? ' is-active' : ''}`}
            onClick={() => onChange(active === category.key ? null : category.key)}
            aria-pressed={active === category.key}
          >
            {category.label}
            <span className="category-chip-count">{category.count}</span>
            {active === category.key && <X size={13} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryRefiner;
