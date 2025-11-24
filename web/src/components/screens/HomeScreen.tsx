import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, TrendingUp, MapPin, Search } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useLocation } from '../../hooks/useLocation';
import { useGroceryAPI } from '../../hooks/useGroceryAPI';
import { COLORS } from '../../utils/constants';
import NavBar from '../common/NavBar';
import Button from '../common/Button';
import Input from '../common/Input';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import './HomeScreen.css';

const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
const { 
  cart, 
  postalCode, 
  setPostalCode, 
  setLocationInfo, 
  savingsHistory, 
  isLoading, 
  setIsLoading,
  error,
  setError,
  setSearchResults 
} = useApp();
  const { getCurrentLocation } = useLocation();
  const { searchItems } = useGroceryAPI();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [totalSavings, setTotalSavings] = useState(0);

  // Calculate total savings from history
  useEffect(() => {
    const total = savingsHistory.reduce((sum, record) => sum + (record.savings || 0), 0);
    setTotalSavings(total);
  }, [savingsHistory]);

  // Handle location permission and get current location
  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const location = await getCurrentLocation();
      if (location) {
        setPostalCode(location.postal_code);
        setLocationInfo(location);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  // Handle search
// Handle search
const handleSearch = async () => {
  if (!searchQuery.trim() || !postalCode.trim()) {
    setError('Please enter both a search term and postal code');
    return;
  }

  setIsLoading(true);
  setError(null);

  try {
    const results = await searchItems(searchQuery, postalCode);
    
    // Save results to context
    setSearchResults(results);
    
    if (results.length > 0) {
      navigate('/search');
    } else {
      setError('No items found. Try searching for something else.');
    }
  } catch (error: any) {
    console.error('Search error:', error);
    setError(error.message || 'Failed to search items. Please try again.');
  } finally {
    setIsLoading(false);
  }
};




  // Handle navigation to cart
  const handleNavigateToCart = () => {
    navigate('/cart');
  };

  // Handle navigation to savings
  const handleNavigateToSavings = () => {
    navigate('/savings');
  };

  // Handle key press in search input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <>
      <NavBar />
      <div className="home-screen">
        <div className="home-container">
          {/* Header */}
          <div className="home-header">
            <div className="header-icon">
              <ShoppingCart size={48} color={COLORS.PRIMARY} />
            </div>
            <h1 className="home-title">Smart Grocery Saver</h1>
            <p className="home-subtitle">Find the best deals around you</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message">
              <span>{error}</span>
            </div>
          )}

          {/* Location Card */}
          <Card className="location-card">
            <h2 className="card-title">Your Location</h2>
            <div className="location-input-container">
              <Input
                value={postalCode}
                onChange={setPostalCode}
                placeholder="Enter Postal Code (e.g., L4W3H8)"
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
              placeholder="e.g., milk, bread, eggs"
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

          {/* Stats Container */}
          <div className="stats-container">
            <Card className="stat-card">
              <div className="stat-icon">
                <ShoppingCart size={32} color={COLORS.PRIMARY} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{cart.length}</div>
                <div className="stat-label">Items in Cart</div>
              </div>
            </Card>

            <Card className="stat-card">
              <div className="stat-icon">
                <TrendingUp size={32} color={COLORS.SECONDARY} />
              </div>
              <div className="stat-content">
                <div className="stat-number">${totalSavings.toFixed(2)}</div>
                <div className="stat-label">Total Saved</div>
              </div>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <Button
              onClick={handleNavigateToCart}
              variant="secondary"
              size="large"
              className="action-button"
            >
              <ShoppingCart size={20} />
              View Cart ({cart.length})
            </Button>

            <Button
              onClick={handleNavigateToSavings}
              variant="secondary"
              size="large"
              className="action-button"
            >
              <TrendingUp size={20} />
              Savings History
            </Button>
          </div>

          {/* Loading Overlay */}
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
    </>
  );
};

export default HomeScreen;
