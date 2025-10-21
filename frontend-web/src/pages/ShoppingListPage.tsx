import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  selectCartItems,
  selectComparison,
  selectBestStore,
  clearCart,
} from '../store/slices/cartSlice';
import { saveShopping, selectSavingsLoading } from '../store/slices/savingsSlice';
import { LoadingSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import styles from './ShoppingListPage.module.css';

export const ShoppingListPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const cartItems = useAppSelector(selectCartItems);
  const comparison = useAppSelector(selectComparison);
  const bestStore = useAppSelector(selectBestStore);
  const loading = useAppSelector(selectSavingsLoading);

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Redirect if no comparison or empty cart
    if (!comparison || cartItems.length === 0) {
      navigate('/cart');
    }
  }, [comparison, cartItems, navigate]);

  const handleToggleItem = (itemId: string) => {
    setCheckedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const allChecked = cartItems.length > 0 && cartItems.every((item) => checkedItems.has(item.id));
  const checkedCount = checkedItems.size;

  const handleCompleteShopping = async () => {
    if (!comparison) return;

    const savingsRecord = {
      id: Date.now().toString(),
      shopping_list_id: Date.now().toString(),
      best_store: comparison.best_store,
      total_cost: comparison.best_store_total,
      potential_costs: comparison.store_totals,
      savings: comparison.savings,
      completed_at: new Date().toISOString(),
    };

    try {
      await dispatch(saveShopping(savingsRecord)).unwrap();
      dispatch(clearCart());
      navigate('/savings');
    } catch (error) {
      alert('Failed to save shopping trip. Please try again.');
    }
  };

  if (!comparison || cartItems.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate('/cart')} className={styles.backButton}>
          ← Back
        </button>
        <h1 className={styles.title}>Shopping List</h1>
        <div className={styles.spacer} />
      </div>

      <div className={styles.storeCard}>
        <span className={styles.storeIcon}>🏪</span>
        <p className={styles.storeName}>Shopping at: {bestStore}</p>
      </div>

      <div className={styles.progressCard}>
        <p className={styles.progressText}>
          {checkedCount} of {cartItems.length} items checked
        </p>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(checkedCount / cartItems.length) * 100}%` }}
          />
        </div>
      </div>

      <div className={styles.itemsList}>
        {cartItems.map((item) => {
          const isChecked = checkedItems.has(item.id);

          return (
            <div
              key={item.id}
              onClick={() => handleToggleItem(item.id)}
              className={`${styles.item} ${isChecked ? styles.itemChecked : ''}`}
            >
              <div className={styles.checkbox}>
                {isChecked && <span className={styles.checkmark}>✓</span>}
              </div>
              <div className={styles.itemInfo}>
                <p className={`${styles.itemName} ${isChecked ? styles.itemNameChecked : ''}`}>
                  {item.name}
                </p>
                <p className={styles.itemDetails}>
                  Qty: {item.quantity} | ${item.current_price.toFixed(2)} each
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {allChecked && (
        <button
          onClick={handleCompleteShopping}
          className={styles.completeButton}
          disabled={loading}
        >
          {loading ? (
            'Saving...'
          ) : (
            <>
              <span className={styles.buttonIcon}>✓</span>
              Complete Shopping
            </>
          )}
        </button>
      )}
    </div>
  );
};
