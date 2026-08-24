import React, { useMemo, useState } from 'react';
import { useLocation as useRouterLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Trophy,
  Store,
  Search,
  Zap,
  Brain,
  ShoppingCart,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { ProductGroup, StoreEntry, ShoppingItem } from '../../types';
import { COLORS } from '../../utils/constants';
import Button from '../common/Button';
import Card from '../common/Card';
import Badge from '../common/Badge';
import QuantityStepper from '../common/QuantityStepper';
import EmptyState from '../common/EmptyState';
import ProductCard from '../common/ProductCard';
import CategoryRefiner from '../common/CategoryRefiner';
import Skeleton from '../common/Skeleton';
import LoadingSpinner from '../common/LoadingSpinner';
import './SearchResultsScreen.css';

// ── Helper: match-method label and icon ───────────────────────────────────────

const MatchMethodBadge: React.FC<{ method: string }> = ({ method }) => {
  if (method === 'single_store') return null;

  const label =
    method === 'claude'
      ? 'AI matched'
      : method.startsWith('embedding')
      ? 'Semantic match'
      : 'Matched';

  const Icon = method === 'claude' ? Brain : Zap;
  const colorClass = method === 'claude' ? 'badge-claude' : 'badge-embedding';

  return (
    <span className={`match-method-badge ${colorClass}`}>
      <Icon size={11} />
      {label}
    </span>
  );
};

// ── Helper: store row inside a product group card ─────────────────────────────

interface StoreRowProps {
  store: StoreEntry;
  isBest: boolean;
  onAdd: (store: StoreEntry) => void;
  onUpdate: (store: StoreEntry, delta: number) => void;
  quantityInCart: number;
}

const StoreRow: React.FC<StoreRowProps> = ({ store, isBest, onAdd, onUpdate, quantityInCart }) => (
  <div className={`store-row ${isBest ? 'store-row--best' : ''}`}>
    <div className="store-row-info">
      <div className="store-row-merchant">
        {store.merchant_logo ? (
          <img src={store.merchant_logo} alt={store.merchant} className="store-logo-sm" />
        ) : (
          <Store size={14} color={COLORS.GRAY} />
        )}
        <span className="store-row-name">{store.merchant}</span>
        {isBest && (
          <span className="best-price-tag">
            <Trophy size={12} color="#f5b301" /> Best
          </span>
        )}
      </div>
      <div className="store-row-product-name">{store.name}</div>
      {store.match_confidence !== undefined && (
        <div className="match-confidence">{Math.round(store.match_confidence * 100)}% match</div>
      )}
    </div>

    <div className="store-row-right">
      <span className="store-row-price">${store.price.toFixed(2)}</span>
      {quantityInCart > 0 ? (
        <QuantityStepper
          value={quantityInCart}
          size="small"
          onIncrement={() => onUpdate(store, 1)}
          onDecrement={() => onUpdate(store, -1)}
          label={store.name}
        />
      ) : (
        <button className="add-btn-sm" onClick={() => onAdd(store)}>
          Add
        </button>
      )}
    </div>
  </div>
);

// ── Main screen ───────────────────────────────────────────────────────────────

const SearchResultsScreen: React.FC = () => {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const {
    productGroups,
    crossStoreCount,
    searchResults,
    searchCategories,
    searchAmbiguous,
    searchQuery,
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    isLoading,
  } = useApp();

  // A category picked from the search dropdown arrives as route state and
  // becomes the initial filter.
  const routeCategory = (routerLocation.state as { category?: string } | null)?.category ?? null;

  const [viewMode, setViewMode] = useState<'groups' | 'flat'>('groups');
  const [activeCategory, setActiveCategory] = useState<string | null>(routeCategory);

  // A new search invalidates the previous filter — its categories may not
  // even exist in the new result set.
  const [categoriesOf, setCategoriesOf] = useState(searchQuery);
  if (categoriesOf !== searchQuery) {
    setCategoriesOf(searchQuery);
    setActiveCategory(null);
  }

  const visibleGroups = useMemo(
    () =>
      activeCategory
        ? productGroups.filter((g) => g.category === activeCategory)
        : productGroups,
    [productGroups, activeCategory]
  );

  const visibleItems = useMemo(
    () =>
      activeCategory
        ? searchResults.filter((i) => i.category === activeCategory)
        : searchResults,
    [searchResults, activeCategory]
  );

  const getCartQuantity = (globalId: string, merchant: string): number => {
    const item = cart.find(i => i.global_id === globalId && i.merchant === merchant);
    return item ? item.quantity : 0;
  };

  const getCartQuantityByGlobalId = (globalId: string): number => {
    const item = cart.find(i => i.global_id === globalId);
    return item ? item.quantity : 0;
  };

  const handleAddStoreEntry = (store: StoreEntry) => {
    addToCart({
      id: store.global_id || `${store.merchant}-${store.name}`,
      global_id: store.global_id || `${store.merchant}-${store.name}`,
      name: store.name,
      merchant: store.merchant,
      merchant_id: 0,
      current_price: store.price,
      image_url: store.image_url,
      merchant_logo: store.merchant_logo,
    });
  };

  const handleUpdateStoreEntry = (store: StoreEntry, delta: number) => {
    const globalId = store.global_id || `${store.merchant}-${store.name}`;
    const cartItem = cart.find(i => i.global_id === globalId && i.merchant === store.merchant);
    if (cartItem) {
      const newQty = cartItem.quantity + delta;
      if (newQty <= 0) {
        removeFromCart(cartItem.id);
      } else {
        updateQuantity(cartItem.id, delta);
      }
    } else if (delta > 0) {
      handleAddStoreEntry(store);
    }
  };

  const handleAddFlatItem = (item: ShoppingItem) => addToCart(item, 1);

  const handleUpdateFlatItem = (item: ShoppingItem, delta: number) => {
    const cartItem = cart.find(i => i.global_id === item.global_id);
    if (cartItem) {
      const newQty = cartItem.quantity + delta;
      if (newQty <= 0) removeFromCart(cartItem.id);
      else updateQuantity(cartItem.id, delta);
    } else if (delta > 0) {
      addToCart(item, 1);
    }
  };

  if (isLoading && productGroups.length === 0 && searchResults.length === 0) {
    return (
      <div className="search-results-screen">
        <div className="search-results-container">
          <p className="search-loading-text">Searching and matching products across stores…</p>
          <div className="results-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <Skeleton height={120} radius="var(--radius-lg)" />
                <Skeleton height={14} width="80%" />
                <Skeleton height={14} width="50%" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasGroups = productGroups.length > 0;
  const hasResults = searchResults.length > 0;

  return (
    <div className="search-results-screen">
      <div className="search-results-container">
        {/* Header */}
        <div className="search-header">
          <Button onClick={() => navigate('/')} variant="secondary" size="small" className="back-button">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="search-title">Search Results</h1>
          <Button onClick={() => navigate('/cart')} variant="secondary" size="small" className="cart-button">
            <ShoppingCart size={20} />
            {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
          </Button>
        </div>

        {/* Category refinement — the answer to ambiguous queries like "cream" */}
        <CategoryRefiner
          categories={searchCategories}
          active={activeCategory}
          onChange={setActiveCategory}
          ambiguous={searchAmbiguous}
          query={searchQuery}
          totalCount={searchResults.length}
        />

        {/* Summary bar */}
        {hasGroups && (
          <div className="results-summary">
            <span className="summary-text">
              {visibleGroups.length} product{visibleGroups.length !== 1 ? 's' : ''} found
              {crossStoreCount > 0 && (
                <> &mdash; <strong>{crossStoreCount}</strong> matched across stores</>
              )}
            </span>
            <div className="view-toggle">
              <button
                className={`toggle-btn ${viewMode === 'groups' ? 'active' : ''}`}
                onClick={() => setViewMode('groups')}
              >
                Grouped
              </button>
              <button
                className={`toggle-btn ${viewMode === 'flat' ? 'active' : ''}`}
                onClick={() => setViewMode('flat')}
              >
                All Items
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasGroups && !hasResults && (
          <EmptyState
            icon={Search}
            title="No items found"
            description="Try adjusting your search terms or checking your postal code"
            action={{ label: 'Try Again', onClick: () => navigate('/') }}
          />
        )}

        {/* Filter matched nothing in the current view */}
        {activeCategory &&
          (viewMode === 'groups' ? visibleGroups.length === 0 : visibleItems.length === 0) && (
            <EmptyState
              icon={Search}
              title="Nothing in this category"
              description="No results here for that refinement. Pick another category, or show everything."
              action={{ label: 'Show all results', onClick: () => setActiveCategory(null) }}
            />
          )}

        {/* Product Group Cards */}
        {hasGroups && viewMode === 'groups' && (
          <div className="results-list">
            {visibleGroups.map((group: ProductGroup, idx: number) => {
              const percentOff =
                group.savings_vs_worst > 0 && group.worst_price > 0
                  ? Math.round((group.savings_vs_worst / group.worst_price) * 100)
                  : 0;

              return (
                <Card
                  key={`${group.canonical_name}-${idx}`}
                  className="product-group-card fyr-rise"
                  style={{ '--i': idx } as React.CSSProperties}
                >
                  {percentOff > 0 && (
                    <div className="group-discount-badge">
                      <Badge variant="discount">-{percentOff}%</Badge>
                    </div>
                  )}

                  <div className="group-header">
                    <div className="group-title-row">
                      <h3 className="group-canonical-name">{group.canonical_name}</h3>
                      <MatchMethodBadge method={group.match_method} />
                    </div>

                    {group.savings_vs_worst > 0 && (
                      <Badge variant="success">Save ${group.savings_vs_worst.toFixed(2)}</Badge>
                    )}
                  </div>

                  {/* Store image (from best store) */}
                  {group.stores[0]?.image_url && (
                    <div className="group-image-container">
                      <img src={group.stores[0].image_url} alt={group.canonical_name} className="group-image" />
                    </div>
                  )}

                  {/* Store rows — sorted cheapest first by the backend */}
                  <div className="store-rows">
                    {group.stores.map((store, sIdx) => (
                      <StoreRow
                        key={`${store.merchant}-${sIdx}`}
                        store={store}
                        isBest={store.merchant === group.best_merchant && store.price === group.best_price}
                        onAdd={handleAddStoreEntry}
                        onUpdate={handleUpdateStoreEntry}
                        quantityInCart={getCartQuantity(
                          store.global_id || `${store.merchant}-${store.name}`,
                          store.merchant
                        )}
                      />
                    ))}
                  </div>

                  {group.store_count === 1 && (
                    <div className="single-store-note">Only available at {group.best_merchant}</div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Flat list */}
        {hasResults && (!hasGroups || viewMode === 'flat') && (
          <div className="results-grid">
            {visibleItems.map((item, idx) => (
              <div
                key={item.global_id || idx}
                className="fyr-rise"
                style={{ '--i': idx } as React.CSSProperties}
              >
                <ProductCard
                  product={item}
                  cartQuantity={getCartQuantityByGlobalId(item.global_id)}
                  onAdd={handleAddFlatItem}
                  onIncrement={(p) => handleUpdateFlatItem(p, 1)}
                  onDecrement={(p) => handleUpdateFlatItem(p, -1)}
                />
              </div>
            ))}
          </div>
        )}

        {isLoading && (productGroups.length > 0 || searchResults.length > 0) && (
          <div className="loading-overlay">
            <LoadingSpinner size="medium" text="Updating..." />
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResultsScreen;
