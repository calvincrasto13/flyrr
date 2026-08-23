import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, TrendingUp, Bell, Search } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useLocation } from '../../hooks/useLocation';
import { useGroceryAPI } from '../../hooks/useGroceryAPI';
import apiService from '../../services/api';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import PromoBanner from '../common/PromoBanner';
import StatTile from '../common/StatTile';
import LoadingSpinner from '../common/LoadingSpinner';
import './HomeScreen.css';

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { cart, postalCode, setPostalCode, setLocationInfo, savingsHistory, isLoading, error } = useApp();
  const { getCurrentLocation } = useLocation();
  const { searchItems } = useGroceryAPI();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [activeAlertsCount, setActiveAlertsCount] = useState<number | null>(null);

  const totalSavings = savingsHistory.reduce((sum, r) => sum + (r.savings || 0), 0);

  // Lightweight fetch, mirrors the pattern PriceAlertsScreen already uses —
  // kept as local state rather than global AppContext state to stay minimal.
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

  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const location = await getCurrentLocation();
      if (location) {
        setPostalCode(location.postal_code);
        setLocationInfo(location);
      }
    } catch (err) {
      console.error('Error getting location:', err);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !postalCode.trim()) return;
    try {
      const response = await searchItems(searchQuery, postalCode);
      if (response.product_groups.length > 0 || response.items.length > 0) {
        navigate('/search');
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="home-screen">
      <div className="home-container">
        <PromoBanner
          title="flyrr"
          subtitle="Find the best grocery deals near you"
          postalCode={postalCode}
          onPostalCodeChange={setPostalCode}
          onUseLocation={handleGetCurrentLocation}
          locationLoading={locationLoading}
        />

        {error && <div className="error-message"><span>{error}</span></div>}

        {/* Search Card */}
        <Card className="search-card">
          <h2 className="card-title">Search for Items</h2>
          <Input
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="e.g., orange juice, milk, eggs"
            label="What are you looking for?"
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button
            onClick={handleSearch}
            disabled={isLoading || !searchQuery.trim() || !postalCode.trim()}
            loading={isLoading}
            variant="primary"
            size="medium"
            className="search-button"
          >
            <Search size={20} />
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </Card>

        {/* Quick Stats */}
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

        {(isLoading || locationLoading) && (
          <div className="loading-overlay">
            <LoadingSpinner
              size="large"
              text={isLoading ? 'Searching for items...' : 'Getting your location...'}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeScreen;
