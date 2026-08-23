import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Trash2, ShoppingCart } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useGroceryAPI } from '../../hooks/useGroceryAPI';
import Button from '../common/Button';
import Card from '../common/Card';
import QuantityStepper from '../common/QuantityStepper';
import EmptyState from '../common/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import './CartScreen.css';

const CartScreen: React.FC = () => {
  const navigate = useNavigate();
  const { cart, comparison, removeFromCart, updateQuantity, clearCart, isLoading } = useApp();
  const { compareStores } = useGroceryAPI();
  const [localLoading, setLocalLoading] = useState(false);

  const cartTotal = cart.reduce((sum, item) => sum + item.current_price * item.quantity, 0);

  // Subtotal per store
  const storeTotals: Record<string, number> = {};
  for (const item of cart) {
    storeTotals[item.merchant] = (storeTotals[item.merchant] || 0) + item.current_price * item.quantity;
  }

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    const item = cart.find((i) => i.id === itemId);
    if (item && item.quantity + delta <= 0) {
      removeFromCart(itemId);
    } else {
      updateQuantity(itemId, delta);
    }
  };

  const handleCompareStores = async () => {
    if (cart.length === 0) return;
    setLocalLoading(true);
    try {
      await compareStores(cart);
    } catch (error) {
      console.error('Error comparing stores:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  const formatPrice = (price: number): string => `$${price.toFixed(2)}`;

  if (isLoading && cart.length === 0) {
    return (
      <div className="cart-screen">
        <div className="cart-container">
          <LoadingSpinner size="large" text="Loading your cart..." />
        </div>
      </div>
    );
  }

  return (
    <div className="cart-screen">
      <div className="cart-container">
        {/* Header */}
        <div className="cart-header">
          <Button onClick={() => navigate('/')} variant="secondary" size="small" className="back-button">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="cart-title">Shopping Cart</h1>
          <div className="spacer" />
        </div>

        {cart.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Your cart is empty"
            description="Add items from the search results to get started"
            action={{ label: 'Shop Now', onClick: () => navigate('/') }}
          />
        ) : (
          <div className="cart-content">
            {/* Cart Items */}
            <div className="cart-items">
              {cart.map((item, idx) => (
                <Card
                  key={item.id}
                  className="cart-item fyr-rise"
                  style={{ '--i': idx } as React.CSSProperties}
                >
                  <div className="item-info">
                    <h3 className="item-name">{item.name}</h3>
                    <p className="item-store">{item.merchant}</p>
                    <p className="item-price-details">
                      {formatPrice(item.current_price)} × {item.quantity} = {formatPrice(item.current_price * item.quantity)}
                    </p>
                  </div>

                  <div className="item-actions">
                    <QuantityStepper
                      value={item.quantity}
                      onIncrement={() => handleUpdateQuantity(item.id, 1)}
                      onDecrement={() => handleUpdateQuantity(item.id, -1)}
                      label={item.name}
                    />
                    <Button
                      onClick={() => removeFromCart(item.id)}
                      variant="danger"
                      size="small"
                      className="remove-button"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Subtotals per store */}
            {Object.keys(storeTotals).length > 1 && (
              <Card className="store-subtotals-card">
                <h3 className="subtotals-title">Subtotal by Store</h3>
                {Object.entries(storeTotals).map(([store, total]) => (
                  <div key={store} className="subtotal-row">
                    <span className="subtotal-store">{store}</span>
                    <span className="subtotal-amount">{formatPrice(total)}</span>
                  </div>
                ))}
              </Card>
            )}

            {/* Cart Total */}
            <Card className="total-card">
              <div className="total-row">
                <span className="total-label">Cart Total:</span>
                <span className="total-amount">{formatPrice(cartTotal)}</span>
              </div>
            </Card>

            {/* Store Comparison Result */}
            {comparison && (
              <Card className="comparison-card">
                <h2 className="comparison-title">Best Store Comparison</h2>
                <div className="best-store-highlight">
                  <Trophy size={32} color="#f5b301" />
                  <div className="best-store-info">
                    <h3 className="best-store-name">{comparison.best_store}</h3>
                    <p className="best-store-price">{formatPrice(comparison.best_store_total)}</p>
                  </div>
                </div>
                {comparison.savings > 0 && (
                  <div className="savings-text">
                    You could save {formatPrice(comparison.savings)} shopping here vs. the most expensive option!
                  </div>
                )}
                <div className="store-list">
                  {Object.entries(comparison.store_totals)
                    .sort(([, a], [, b]) => (a as number) - (b as number))
                    .map(([store, total]) => (
                      <div key={store} className={`store-item ${store === comparison.best_store ? 'store-item--best' : ''}`}>
                        <span className="store-name">{store}</span>
                        <span className="store-price">{formatPrice(total as number)}</span>
                      </div>
                    ))}
                </div>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="action-buttons">
              <Button
                onClick={handleCompareStores}
                disabled={localLoading || cart.length === 0}
                loading={localLoading}
                variant="primary"
                size="large"
                className="compare-button"
              >
                Compare Stores
              </Button>
              {comparison && (
                <Button
                  onClick={() => navigate('/shopping')}
                  variant="secondary"
                  size="large"
                  className="shopping-button"
                >
                  <ShoppingCart size={20} />
                  Let's Go Shopping!
                </Button>
              )}
              <button className="clear-link" onClick={clearCart}>
                <Trash2 size={14} />
                Clear Cart
              </button>
            </div>
          </div>
        )}

        {(isLoading || localLoading) && cart.length > 0 && (
          <div className="loading-overlay">
            <LoadingSpinner size="medium" text="Processing..." />
          </div>
        )}
      </div>
    </div>
  );
};

export default CartScreen;
