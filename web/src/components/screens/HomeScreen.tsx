import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, TrendingUp, MapPin, Search, Bell } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useLocation } from '../../hooks/useLocation';
import { useGroceryAPI } from '../../hooks/useGroceryAPI';
import { COLORS } from '../../utils/constants';
import Button from '../common/Button';
import Input from '../common/Input';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import './HomeScreen.css';

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { cart, postalCode, setPostalCode, setLocationInfo, savingsHistory, isLoading, error } = useApp();
  const { getCurrentLocation } = useLocation();
  const { searchItems } = useGroceryAPI();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  const totalSavings = savingsHistory.reduce((sum, r) => sum + (r.savings || 0), 0);

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
        {/* Header */}
        <div className="home-header">
          <div className="header-icon">
            <ShoppingCart size={48} color={COLORS.PRIMARY} />
          </div>
          <h1 className="home-title">flyrr</h1>
          <p className="home-subtitle">Canadian grocery price comparison</p>
        </div>

        {error && <div className="error-message"><span>{error}</span></div>}

        {/* Location Card */}
        <Card className="location-card">
          <h2 className="card-title">Your Location</h2>
          <div className="location-input-container">
            <Input
              value={postalCode}
              onChange={setPostalCode}
              placeholder="Postal Code (e.g., L4W 3H8)"
              label="Postal Code"
              maxLength={10}
              disabled={locationLoading}
              className="location-input"
            />
            <Button
              onClick={handleGetCurrentLocation}
              disabled={locationLoading}
              loading={locationLoading}
              variant="secondary"
              size="medium"
              className="location-button"
            >
              <MapPin size={20} />
              {locationLoading ? '' : 'Use My Location'}
            </Button>
          </div>
        </Card>

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

        {/* Stats */}
        <div className="stats-container">
          <Card className="stat-card">
            <div className="stat-icon"><ShoppingCart size={32} color={COLORS.PRIMARY} /></div>
            <div className="stat-content">
              <div className="stat-number">{cart.length}</div>
              <div className="stat-label">Items in Cart</div>
            </div>
          </Card>
          <Card className="stat-card">
            <div className="stat-icon"><TrendingUp size={32} color={COLORS.SECONDARY} /></div>
            <div className="stat-content">
              <div className="stat-number">${totalSavings.toFixed(2)}</div>
              <div className="stat-label">Total Saved</div>
            </div>
          </Card>
        </div>

        {/* Navigation */}
        <div className="action-buttons">
          <Button onClick={() => navigate('/cart')} variant="secondary" size="large" className="action-button">
            <ShoppingCart size={20} />
            View Cart ({cart.length})
          </Button>
          <Button onClick={() => navigate('/savings')} variant="secondary" size="large" className="action-button">
            <TrendingUp size={20} />
            Savings History
          </Button>
          <Button onClick={() => navigate('/alerts')} variant="secondary" size="large" className="action-button">
            <Bell size={20} />
            Price Alerts
          </Button>
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
