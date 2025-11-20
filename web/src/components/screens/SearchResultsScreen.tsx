import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Store } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import NavBar from '../common/NavBar';
import ProductCard from '../common/ProductCard';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import './SearchResultsScreen.css';

const SearchResultsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { searchResults, cart, addToCart, isLoading } = useApp();
  const [groupedItems, setGroupedItems] = useState<Record<string, any[]>>({});

  // Group items by merchant
  useEffect(() => {
    const grouped = searchResults.reduce((acc, item) => {
      const merchant = item.merchant || 'Other';
      if (!acc[merchant]) acc[merchant] = [];
      acc[merchant].push(item);
      return acc;
    }, {} as Record<string, any[]>);
    
    setGroupedItems(grouped);
  }, [searchResults]);

  const handleAddToCart = (item: any) => {
    addToCart({
      id: item.global_id,
      global_id: item.global_id,
      name: item.name,
      merchant: item.merchant,
      merchant_id: item.merchant_id,
      current_price: item.current_price,
      image_url: item.image_url,
      quantity: 1,
    });
  };

  const isInCart = (itemId: string) => {
    return cart.some(cartItem => cartItem.global_id === itemId);
  };

  if (isLoading) {
    return (
      <>
        <NavBar />
        <div className="search-results-screen">
          <LoadingSpinner size="large" text="Loading products..." />
        </div>
      </>
    );
  }

  if (searchResults.length === 0) {
    return (
      <>
        <NavBar />
        <div className="search-results-screen">
          <div className="container">
            <Button onClick={() => navigate('/')} variant="secondary">
              <ArrowLeft size={20} />
              Back to Home
            </Button>
            <div className="no-results">
              <h2>No items found</h2>
              <p>Try searching for something else</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <div className="search-results-screen">
        <div className="container">
          <div className="header-section">
            <Button onClick={() => navigate('/')} variant="secondary" size="medium">
              <ArrowLeft size={20} />
              Back
            </Button>
            <h2>Search Results ({searchResults.length} items)</h2>
          </div>

          {/* Group products by merchant */}
          {Object.entries(groupedItems).map(([merchant, items]) => (
            <div key={merchant} className="merchant-group">
              <div className="merchant-header">
                <Store size={24} />
                <h3>{merchant}</h3>
                <span className="item-count">({items.length} items)</span>
              </div>
              
              <div className="products-grid">
                {items.map((item) => (
                  <ProductCard
                    key={item.global_id}
                    product={{
                      ...item,
                      quantity: 100,
                      expiring_date: item.valid_to 
                        ? new Date(item.valid_to).toLocaleDateString()
                        : undefined,
                    }}
                    onAddToCart={() => handleAddToCart(item)}
                    inCart={isInCart(item.global_id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default SearchResultsScreen;
