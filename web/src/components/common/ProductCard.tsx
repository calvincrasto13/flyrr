import React from 'react';
import { ShoppingCart, Store } from 'lucide-react';
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
  unit?: string;
  manufacturing_date?: string;
  expiring_date?: string;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  inCart?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, inCart = false }) => {
  const isOutOfStock = product.quantity !== undefined && product.quantity <= 0;

  return (
    <div className="product-card">
      <div className="product-image-container">
        <img
          src={product.image_url || 'https://via.placeholder.com/200x150?text=No+Image'}
          alt={product.name}
          className="product-image"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x150?text=No+Image';
          }}
        />
        {isOutOfStock && <div className="out-of-stock-badge">Out of Stock</div>}
      </div>

      <div className="product-content">
        <h4 className="product-name">{product.name}</h4>

        <div className="product-merchant">
          <Store size={16} />
          <span>{product.merchant}</span>
        </div>

        <div className="product-price">
          <span className="price-label">Price:</span>
          <span className="price-value">${product.current_price.toFixed(2)}</span>
          {product.unit && <span className="price-unit">/ {product.unit}</span>}
        </div>

        {product.quantity !== undefined && (
          <div className="product-quantity">
            <span className="quantity-label">Available:</span>
            <span className={`quantity-value ${isOutOfStock ? 'out-of-stock' : ''}`}>
              {product.quantity} units
            </span>
          </div>
        )}

        {product.expiring_date && (
          <div className="product-expiry">
            <span className="expiry-label">Exp:</span>
            <span className="expiry-value">{product.expiring_date}</span>
          </div>
        )}

        <div className="product-action">
          {isOutOfStock ? (
            <div className="out-of-stock-text">Currently Unavailable</div>
          ) : inCart ? (
            <div className="in-cart-text">✓ In Cart</div>
          ) : (
            <Button
              onClick={() => onAddToCart(product)}
              variant="primary"
              size="medium"
              className="add-to-cart-btn"
            >
              <ShoppingCart size={18} />
              Add to Cart
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
