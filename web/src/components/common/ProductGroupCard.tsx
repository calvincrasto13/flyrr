import React, { useState } from 'react';
import { Store, Crown, ChevronDown, ChevronUp } from 'lucide-react';
import './ProductGroupCard.css';

interface ProductGroupCardProps {
  productName: string;
  items: any[];
  image: string;
  onAddToCart: (item: any) => void;
  isInCart: (itemId: string) => boolean;
}

const ProductGroupCard: React.FC<ProductGroupCardProps> = ({
  productName,
  items,
  image,
  onAddToCart,
  isInCart,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const lowestPrice = items[0].current_price;

  return (
    <div className="product-group-card">
      {/* Main Product Header */}
      <div className="product-group-header">
        <div className="product-main-info">
          {/* Product Image */}
          <div className="product-group-image">
            <img
              src={image || 'https://via.placeholder.com/120x120?text=No+Image'}
              alt={productName}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/120x120?text=No+Image';
              }}
            />
          </div>

          {/* Product Name and Count */}
          <div className="product-group-details">
            <h3 className="product-group-name">{productName}</h3>
            <p className="store-count">{items.length} store{items.length > 1 ? 's' : ''} available</p>
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <button 
          className="expand-button"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </button>
      </div>

      {/* Store Items List */}
      <div className={`store-items-list ${isExpanded ? 'expanded' : ''}`}>
        {items.map((item, index) => {
          const isLowest = index === 0;
          const priceDiff = item.current_price - lowestPrice;
          const inCart = isInCart(item.global_id);

          return (
            <div key={item.global_id} className={`store-item ${isLowest ? 'lowest' : ''}`}>
              {/* Store Info */}
              <div className="store-item-info">
                <div className="store-name-row">
                  <Store size={16} className="store-icon" />
                  <span className="store-name">{item.merchant}</span>
                  {isLowest && (
                    <div className="lowest-badge-inline">
                      <Crown size={12} />
                      Lowest
                    </div>
                  )}
                </div>
                
                {/* Price */}
                <div className="price-row">
                  <span className="price-value">${item.current_price.toFixed(2)}</span>
                  {!isLowest && priceDiff > 0 && (
                    <span className="price-difference">+${priceDiff.toFixed(2)}</span>
                  )}
                </div>
              </div>

              {/* Add to Cart Button */}
              <div className="store-item-action">
                {inCart ? (
                  <div className="in-cart-label">✓ In Cart</div>
                ) : (
                  <button 
                    className="add-to-cart-small"
                    onClick={() => onAddToCart(item)}
                  >
                    Add to Cart
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductGroupCard;
