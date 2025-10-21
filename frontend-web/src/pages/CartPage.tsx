import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  selectCartItems,
  selectCartTotal,
  selectComparison,
  selectCartLoading,
  updateQuantity,
  removeFromCart,
  compareStores,
} from '../store/slices/cartSlice';
import { ItemCard } from '../components/ItemCard/ItemCard';
import { StoreComparison } from '../components/StoreComparison/StoreComparison';
import { LoadingSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import styles from './CartPage.module.css';

export const CartPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const cartItems = useAppSelector(selectCartItems);
  const cartTotal = useAppSelector(selectCartTotal);
  const comparison = useAppSelector(selectComparison);
  const loading = useAppSelector(selectCartLoading);

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    dispatch(updateQuantity({ id: itemId, delta }));
  };

  const handleRemoveItem = (itemId: string) => {
    if (window.confirm('Remove this item from cart?')) {
      dispatch(removeFromCart(itemId));
    }
  };

  const handleCompareStores = () => {
    if (cartItems.length === 0) {
      alert('Please add items to your cart first');
      return;
    }
    dispatch(compareStores(cartItems));
  };

  const handleGoShopping = () => {
    navigate('/shopping');
  };

  if (cartItems.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={() => navigate('/')} className={styles.backButton}>
            ← Back
          </button>
          <h1 className={styles.title}>Shopping Cart</h1>
          <div className={styles.spacer} />
        </div>

        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🛒</span>
          <p className={styles.emptyText}>Your cart is empty</p>
          <button
            onClick={() => navigate('/')}
            className="button button-primary"
          >
            Start Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate('/')} className={styles.backButton}>
          ← Back
        </button>
        <h1 className={styles.title}>Shopping Cart</h1>
        <div className={styles.spacer} />
      </div>

      <div className={styles.cartItems}>
        {cartItems.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            mode="cart"
            onUpdateQuantity={(delta) => handleUpdateQuantity(item.id, delta)}
            onRemove={() => handleRemoveItem(item.id)}
          />
        ))}
      </div>

      <div className={styles.totalCard}>
        <span className={styles.totalLabel}>Cart Total:</span>
        <span className={styles.totalAmount}>${cartTotal.toFixed(2)}</span>
      </div>

      {comparison && <StoreComparison comparison={comparison} />}

      <div className={styles.actions}>
        {!comparison && (
          <button
            onClick={handleCompareStores}
            className="button button-primary"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Comparing...' : 'Compare Stores'}
          </button>
        )}

        {comparison && (
          <button
            onClick={handleGoShopping}
            className={styles.shoppingButton}
          >
            <span className={styles.buttonIcon}>🛍️</span>
            Let's Go Shopping!
          </button>
        )}
      </div>

      {loading && <LoadingSpinner size="small" />}
    </div>
  );
};
