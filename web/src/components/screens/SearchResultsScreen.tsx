import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Plus, Minus, Store, Image as ImageIcon, Search } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { COLORS } from '../../utils/constants';
import Button from '../common/Button';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import './SearchResultsScreen.css';

const SearchResultsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { searchResults, cart, addToCart, removeFromCart, updateQuantity, isLoading } = useApp();

  const handleGoBack = () => {
    navigate('/');
  };

  const getItemQuantity = (globalId: string): number => {
    const item = cart.find(i => i.global_id === globalId);
    return item ? item.quantity : 0;
  };

  const handleAddToCart = (item: any) => {
    addToCart(item, 1);
  };

  const handleUpdateQuantity = (item: any, delta: number) => {
    const cartItem = cart.find(i => i.global_id === item.global_id);
    if (cartItem) {
      const newQuantity = cartItem.quantity + delta;
      if (newQuantity <= 0) {
        removeFromCart(cartItem.id);
      } else {
        updateQuantity(cartItem.id, delta);
      }
    } else if (delta > 0) {
      addToCart(item, delta);
    }
  };

  const getCheapestPrice = (): number => {
    return searchResults.length > 0 ? searchResults[0].current_price : 0;
  };

  const formatPrice = (price: number): string => {
    return `$${price.toFixed(2)}`;
  };

  if (isLoading && searchResults.length === 0) {
    return (
      <div className="search-results-screen">
        <div className="search-results-container">
          <LoadingSpinner size="large" text="Searching for items..." />
        </div>
      </div>
    );
  }

  const cheapestPrice = getCheapestPrice();

  return (
    <div className="search-results-screen">
      <div className="search-results-container">
        {/* Header */}
        <div className="search-header">
          <Button
            onClick={handleGoBack}
            variant="secondary"
            size="small"
            className="back-button"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="search-title">Search Results</h1>
          <div className="spacer" />
        </div>

        {/* Results */}
        {searchResults.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Search size={64} color={COLORS.LIGHT_GRAY} />
            </div>
            <h2 className="empty-title">No items found</h2>
            <p className="empty-description">
              Try adjusting your search terms or checking your location
            </p>
            <Button
              onClick={handleGoBack}
              variant="primary"
              size="medium"
              className="try-again-button"
            >
              Try Again
            </Button>
          </div>
        ) : (
          <div className="results-list">
            {searchResults.map((item, index) => {
              const isCheapest = index === 0 && item.current_price === cheapestPrice;
              const priceDifference = item.current_price - cheapestPrice;
              const quantityInCart = getItemQuantity(item.global_id);

              return (
                <Card key={item.global_id} className="product-card">
                  {isCheapest && (
                    <div className="best-price-badge">
                      <Trophy size={16} color="#FFD700" />
                      <span>Best Price</span>
                    </div>
                  )}

                  <div className="product-content">
                    <div className="product-image-container">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="product-image"
                        />
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
                          <img
                            src={item.merchant_logo}
                            alt={item.merchant}
                            className="store-logo"
                          />
                        ) : (
                          <Store size={16} color={COLORS.GRAY} />
                        )}
                        <span className="store-name">{item.merchant}</span>
                      </div>

                      <div className="price-row">
                        <span className="product-price">{formatPrice(item.current_price)}</span>
                        {!isCheapest && priceDifference > 0 && (
                          <span className="price-difference">
                            +{formatPrice(priceDifference)} vs cheapest
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cart Controls */}
                  <div className="cart-controls">
                    {quantityInCart > 0 ? (
                      <div className="quantity-controls">
                        <Button
                          onClick={() => handleUpdateQuantity(item, -1)}
                          variant="secondary"
                          size="small"
                          className="quantity-button"
                        >
                          <Minus size={16} />
                        </Button>
                        <div className="quantity-display">
                          <span className="quantity-number">{quantityInCart}</span>
                          <span className="quantity-label">in cart</span>
                        </div>
                        <Button
                          onClick={() => handleUpdateQuantity(item, 1)}
                          variant="secondary"
                          size="small"
                          className="quantity-button"
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleAddToCart(item)}
                        variant="primary"
                        size="medium"
                        className="add-button"
                      >
                        <Plus size={16} />
                        Add to Cart
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && searchResults.length > 0 && (
          <div className="loading-overlay">
            <LoadingSpinner size="medium" text="Updating..." />
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResultsScreen;