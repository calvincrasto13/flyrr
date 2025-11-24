import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import NavBar from '../common/NavBar';
import ProductGroupCard from '../common/ProductGroupCard';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import './SearchResultsScreen.css';

interface GroupedProduct {
  productName: string;
  items: any[];
  lowestPrice: number;
  image: string;
}

const SearchResultsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { searchResults, cart, addToCart, isLoading } = useApp();
  const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>([]);

  // Group products by name and sort stores by price
  useEffect(() => {
    if (searchResults.length > 0) {
      const groups: Record<string, any[]> = {};

      // Group items by product name
      searchResults.forEach(item => {
        const productName = item.name.trim();
        if (!groups[productName]) {
          groups[productName] = [];
        }
        groups[productName].push(item);
      });

      // Convert to array and process each group
      const groupedArray = Object.entries(groups).map(([productName, items]) => {
        // Sort items by price (lowest first)
        const sortedItems = items.sort((a, b) => a.current_price - b.current_price);
        
        return {
          productName,
          items: sortedItems,
          lowestPrice: sortedItems[0].current_price,
          image: sortedItems[0].image_url || '',
        };
      });

      // Sort groups by lowest price
      groupedArray.sort((a, b) => a.lowestPrice - b.lowestPrice);

      setGroupedProducts(groupedArray);
    }
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
          <div className="loading-container">
            <LoadingSpinner size="large" text="Finding the best deals..." />
          </div>
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
            <Button onClick={() => navigate('/')} variant="secondary" className="back-btn">
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
          <div className="results-header">
            <Button onClick={() => navigate('/')} variant="secondary" size="medium" className="back-btn">
              <ArrowLeft size={20} />
              Back
            </Button>
            <h1 className="results-count">{groupedProducts.length} products found</h1>
          </div>

          {/* Grouped Products */}
          <div className="products-list">
            {groupedProducts.map((group, index) => (
              <ProductGroupCard
                key={`${group.productName}-${index}`}
                productName={group.productName}
                items={group.items}
                image={group.image}
                onAddToCart={handleAddToCart}
                isInCart={isInCart}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default SearchResultsScreen;
