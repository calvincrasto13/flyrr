import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, TrendingUp, Bell, RefreshCw, Tag } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useGroceryAPI } from '../../hooks/useGroceryAPI';
import { useDeals } from '../../hooks/useDeals';
import apiService from '../../services/api';
import { Deal, ShoppingItem } from '../../types';
import SearchBar from '../common/SearchBar';
import DealCard from '../common/DealCard';
import StatTile from '../common/StatTile';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import './HomeScreen.css';

/** Deals and cart items are different shapes; the cart only needs these fields. */
const dealToShoppingItem = (deal: Deal): ShoppingItem => ({
  id: deal.id,
  global_id: deal.global_id,
  name: deal.name,
  merchant: deal.merchant,
  merchant_id: deal.merchant_id,
  merchant_logo: deal.merchant_logo,
  current_price: deal.current_price,
  image_url: deal.image_url,
});

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { cart, postalCode, savingsHistory, isLoading, error, addToCart } = useApp();
  const { searchItems } = useGroceryAPI();
  const { deals, merchants, totalFound, isLoading: dealsLoading, error: dealsError, reload } =
    useDeals(postalCode);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeAlertsCount, setActiveAlertsCount] = useState<number | null>(null);

  const totalSavings = savingsHistory.reduce((sum, r) => sum + (r.savings || 0), 0);

  useEffect(() => {
    let cancelled = false;
    apiService
      .getAlerts()
      .then((alerts) => {
        if (!cancelled) setActiveAlertsCount(alerts.filter((a) => a.active).length);
      })
      .catch(() => {
        if (!cancelled) setActiveAlertsCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = async (query: string, category?: string) => {
    if (!query.trim() || !postalCode.trim()) return;
    try {
      const response = await searchItems(query, postalCode);
      if (response.product_groups.length > 0 || response.items.length > 0) {
        // A category chosen from the dropdown arrives as route state and is
        // applied as the initial filter on the results screen.
        navigate('/search', category ? { state: { category } } : undefined);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  return (
    <div className="home-screen">
      <div className="home-container">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={handleSearch}
          disabled={isLoading || !postalCode}
        />

        {error && <div className="error-message"><span>{error}</span></div>}

        <div className="quick-stats-row">
          <StatTile
            icon={ShoppingCart}
            label="Items in Cart"
            value={cart.length}
            tone="mint"
            onClick={() => navigate('/cart')}
          />
          <StatTile
            icon={TrendingUp}
            label="Total Saved"
            value={`$${totalSavings.toFixed(2)}`}
            tone="blush"
            onClick={() => navigate('/savings')}
          />
          <StatTile
            icon={Bell}
            label="Active Alerts"
            value={activeAlertsCount ?? 0}
            loading={activeAlertsCount === null}
            tone="warning"
            onClick={() => navigate('/alerts')}
          />
        </div>

        {/* ── Nearby deals ─────────────────────────────────────────────── */}
        <section className="deals-section">
          <header className="deals-header">
            <div>
              <h2 className="deals-title">
                <Tag size={18} />
                Deals near you
              </h2>
              {!dealsLoading && deals.length > 0 && (
                <p className="deals-subtitle">
                  {totalFound} offers across {merchants.length} store
                  {merchants.length === 1 ? '' : 's'}
                </p>
              )}
            </div>
            <button
              className="deals-refresh"
              onClick={reload}
              disabled={dealsLoading}
              aria-label="Refresh deals"
              type="button"
            >
              <RefreshCw size={16} className={dealsLoading ? 'is-spinning' : undefined} />
            </button>
          </header>

          {dealsLoading && (
            <div className="deals-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="deal-skeleton">
                  <Skeleton height="120px" />
                  <Skeleton height="14px" width="55%" />
                  <Skeleton height="14px" width="90%" />
                  <Skeleton height="18px" width="40%" />
                </div>
              ))}
            </div>
          )}

          {!dealsLoading && dealsError && (
            <EmptyState
              icon={Tag}
              title="Couldn't load deals"
              description={dealsError}
              action={{ label: 'Try again', onClick: reload }}
            />
          )}

          {!dealsLoading && !dealsError && deals.length === 0 && (
            <EmptyState
              icon={Tag}
              title={postalCode ? 'No deals found nearby' : 'Set your location first'}
              description={
                postalCode
                  ? "We couldn't find flyer deals for this postal code. Try a different location or search for a specific item."
                  : 'Add a postal code and we’ll show the best flyer deals at stores near you.'
              }
            />
          )}

          {!dealsLoading && !dealsError && deals.length > 0 && (
            <div className="deals-grid">
              {deals.map((deal, index) => (
                <DealCard
                  key={`${deal.id}-${deal.merchant}-${index}`}
                  deal={deal}
                  index={index}
                  onAdd={(d) => addToCart(dealToShoppingItem(d))}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default HomeScreen;
