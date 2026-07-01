import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Trophy,
  Plus,
  Minus,
  Store,
  Image as ImageIcon,
  Search,
  Tag,
  Zap,
  Brain,
  ShoppingCart,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { ProductGroup, StoreEntry } from '../../types';
import { COLORS } from '../../utils/constants';
import Button from '../common/Button';
import Card from '../common/Card';
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
  groupId: string;
  onAdd: (store: StoreEntry) => void;
  onUpdate: (store: StoreEntry, delta: number) => void;
  quantityInCart: number;
}

const StoreRow: React.FC<StoreRowProps> = ({
  store,
  isBest,
  onAdd,
  onUpdate,
  quantityInCart,
}) => (
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
            <Trophy size={12} color="#FFD700" /> Best
          </span>
        )}
      </div>
      <div className="store-row-product-name">{store.name}</div>
      {store.match_confidence !== undefined && (
        <div className="match-confidence">
          {Math.round(store.match_confidence * 100)}% match
        </div>
      )}
    </div>

    <div className="store-row-right">
      <span className="store-row-price">${store.price.toFixed(2)}</span>
      {quantityInCart > 0 ? (
        <div className="quantity-controls-sm">
          <button className="qty-btn" onClick={() => onUpdate(store, -1)}>
            <Minus size={13} />
          </button>
          <span className="qty-num">{quantityInCart}</span>
          <button className="qty-btn" onClick={() => onUpdate(store, 1)}>
            <Plus size={13} />
          </button>
        </div>
      ) : (
        <button className="add-btn-sm" onClick={() => onAdd(store)}>
          <Plus size={13} /> Add
        </button>
      )}
    </div>
  </div>
);

// ── Main screen ───────────────────────────────────────────────────────────────

const SearchResultsScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    productGroups,
    crossStoreCount,
    searchResults,
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    isLoading,
  } = useApp();

  const [viewMode, setViewMode] = useState<'groups' | 'flat'>('groups');

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

  const handleAddFlatItem = (item: any) => addToCart(item, 1);

  const handleUpdateFlatItem = (item: any, delta: number) => {
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
          <LoadingSpinner size="large" text="Searching and matching products across stores..." />
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

        {/* Summary bar */}
        {hasGroups && (
          <div className="results-summary">
            <span className="summary-text">
              {productGroups.length} product{productGroups.length !== 1 ? 's' : ''} found
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
          <div className="empty-state">
            <div className="empty-icon"><Search size={64} color={COLORS.LIGHT_GRAY} /></div>
            <h2 className="empty-title">No items found</h2>
            <p className="empty-description">
              Try adjusting your search terms or checking your postal code
            </p>
            <Button onClick={() => navigate('/')} variant="primary" size="medium">
              Try Again
            </Button>
          </div>
        )}

        {/* Product Group Cards */}
        {hasGroups && viewMode === 'groups' && (
          <div className="results-list">
            {productGroups.map((group: ProductGroup, idx: number) => (
              <Card key={`${group.canonical_name}-${idx}`} className="product-group-card">
                <div className="group-header">
                  <div className="group-title-row">
                    <h3 className="group-canonical-name">{group.canonical_name}</h3>
                    <MatchMethodBadge method={group.match_method} />
                  </div>

                  {group.savings_vs_worst > 0 && (
                    <div className="savings-badge">
                      <Tag size={14} />
                      Save ${group.savings_vs_worst.toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Store image (from best store) */}
                {group.stores[0]?.image_url && (
                  <div className="group-image-container">
                    <img
                      src={group.stores[0].image_url}
                      alt={group.canonical_name}
                      className="group-image"
                    />
                  </div>
                )}

                {/* Store rows — sorted cheapest first by the backend */}
                <div className="store-rows">
                  {group.stores.map((store, sIdx) => (
                    <StoreRow
                      key={`${store.merchant}-${sIdx}`}
                      store={store}
                      isBest={store.merchant === group.best_merchant && store.price === group.best_price}
                      groupId={`${group.canonical_name}-${idx}`}
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
            ))}
          </div>
        )}

        {/* Flat list fallback */}
        {hasResults && (!hasGroups || viewMode === 'flat') && (
          <div className="results-list">
            {searchResults.map((item, idx) => {
              const qty = getCartQuantityByGlobalId(item.global_id);
              return (
                <Card key={item.global_id || idx} className="product-card">
                  <div className="product-content">
                    <div className="product-image-container">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="product-image" />
                      ) : (
                        <div className="product-image-placeholder">
                          <ImageIcon size={40} color={COLORS.LIGHT_GRAY} />
                        </div>
                      )}
                    </div>
                    <div className="product-details">
                      <h3 className="product-name">{item.name}</h3>
                      <div className="product-store">
                        {item.merchant_logo ? (
                          <img src={item.merchant_logo} alt={item.merchant} className="store-logo" />
                        ) : (
                          <Store size={16} color={COLORS.GRAY} />
                        )}
                        <span className="store-name">{item.merchant}</span>
                      </div>
                      <span className="product-price">${item.current_price.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="cart-controls">
                    {qty > 0 ? (
                      <div className="quantity-controls">
                        <Button onClick={() => handleUpdateFlatItem(item, -1)} variant="secondary" size="small">
                          <Minus size={16} />
                        </Button>
                        <span className="quantity-number">{qty}</span>
                        <Button onClick={() => handleUpdateFlatItem(item, 1)} variant="secondary" size="small">
                          <Plus size={16} />
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={() => handleAddFlatItem(item)} variant="primary" size="medium" className="add-button">
                        <Plus size={16} /> Add to Cart
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
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
