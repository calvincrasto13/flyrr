import React from 'react';
import { ShoppingCart, Store, Crown } from 'lucide-react';
import Button from './Button';
import './ProductCard.css';

export interface Product {
  global_id: string;
  name: string;
  merchant: string;
  merchant_id: number;
  current_price: number;
  image_url?: string;
  quantity?: number;
  valid_to?: string;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  inCart?: boolean;
  isLowestPrice?: boolean;
  priceComparison?: number; // Difference from lowest price
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onAddToCart, 
  inCart = false,
  isLowestPrice = false,
  priceComparison = 0
}) => {
  const isOutOfStock = product.quantity !== undefined && product.quantity <= 0;

  return (
    <div className="product-card-clean">
      {/* Product Image */}
      <div className="product-image-wrapper">
        <img
          src={product.image_url || 'https://via.placeholder.com/200x200?text=No+Image'}
          alt={product.name}
          className="product-img"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x200?text=No+Image';
          }}
        />
      </div>

      {/* Product Details */}
      <div className="product-details">
        <div className="product-header">
          <h3 className="product-title">{product.name}</h3>
          
          {/* Lowest Price Badge */}
          {isLowestPrice && (
            <div className="lowest-badge">
              <Crown size={14} />
              Lowest price
            </div>
          )}
        </div>

        {/* Store Name */}
        <div className="store-label">
          <Store size={14} />
          <span>{product.merchant}</span>
        </div>

        {/* Price */}
        <div className="price-info">
          <span className="price-amount">${product.current_price.toFixed(2)}</span>
        </div>

        {/* Price Comparison */}
        {!isLowestPrice && priceComparison > 0 && (
          <div className="price-diff">
            +${priceComparison.toFixed(2)} more expensive
          </div>
        )}

        {/* Add to Cart Button */}
        <div className="card-action">
          {isOutOfStock ? (
            <div className="unavailable-btn">Unavailable</div>
          ) : inCart ? (
            <div className="added-btn">✓ In Cart</div>
          ) : (
            <button 
              className="add-cart-btn"
              onClick={() => onAddToCart(product)}
            >
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
