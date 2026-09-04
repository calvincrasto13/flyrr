import React from 'react';
import { ShoppingCart, Store } from 'lucide-react';
import { ShoppingItem } from '../../types';
import Button from './Button';
import QuantityStepper from './QuantityStepper';
import './ProductCard.css';

const FALLBACK_IMAGE = 'https://via.placeholder.com/200x150?text=No+Image';

interface ProductCardProps {
  product: ShoppingItem;
  /** Current quantity of this product already in the cart, 0 if none */
  cartQuantity?: number;
  onAdd: (product: ShoppingItem) => void;
  onIncrement: (product: ShoppingItem) => void;
  onDecrement: (product: ShoppingItem) => void;
  className?: string;
}

/**
 * Product tile used for the Search Results flat/"All Items" view. Shows a
 * quantity stepper once the item is in the cart instead of a static
 * "✓ In Cart" label, so quantity can be adjusted right from the results grid.
 */
const ProductCard: React.FC<ProductCardProps> = ({
  product,
  cartQuantity = 0,
  onAdd,
  onIncrement,
  onDecrement,
  className = '',
}) => {
  const isOutOfStock = product.quantity !== undefined && product.quantity <= 0;

  return (
    <div className={`product-card ${className}`}>
      <div className="product-image-container">
        <img
          src={product.image_url || FALLBACK_IMAGE}
          alt={product.name}
          className="product-image"
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
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
          <span className="price-value">${product.current_price.toFixed(2)}</span>
        </div>

        <div className="product-action">
          {isOutOfStock ? (
            <div className="out-of-stock-text">Currently Unavailable</div>
          ) : cartQuantity > 0 ? (
            <QuantityStepper
              value={cartQuantity}
              onIncrement={() => onIncrement(product)}
              onDecrement={() => onDecrement(product)}
              label={product.name}
              className="product-card-stepper"
            />
          ) : (
            <Button onClick={() => onAdd(product)} variant="primary" size="medium" className="add-to-cart-btn">
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
