import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  selectPostalCode,
  setPostalCode,
} from '../store/slices/userSlice';
import { selectCartItemCount } from '../store/slices/cartSlice';
import { selectTotalSavings } from '../store/slices/savingsSlice';
import { SearchBar } from '../components/SearchBar/SearchBar';
import { PostalCodeInput } from '../components/PostalCodeInput/PostalCodeInput';
import styles from './HomePage.module.css';

export const HomePage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const postalCode = useAppSelector(selectPostalCode);
  const cartItemCount = useAppSelector(selectCartItemCount);
  const totalSavings = useAppSelector(selectTotalSavings);

  const [error, setError] = useState<string | null>(null);

  const handlePostalCodeChange = (newPostalCode: string) => {
    dispatch(setPostalCode(newPostalCode));
    setError(null);
  };

  const handleSearch = (query: string) => {
    if (!postalCode.trim()) {
      setError('Please enter a postal code first');
      return;
    }

    if (!query.trim()) {
      setError('Please enter a search term');
      return;
    }

    setError(null);
    navigate(`/search?q=${encodeURIComponent(query)}&postal=${encodeURIComponent(postalCode)}`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.icon}>🛒</span>
        <h1 className={styles.title}>Smart Grocery Saver</h1>
        <p className={styles.subtitle}>Find the best deals around you</p>
      </div>

      <div className={styles.card}>
        <PostalCodeInput
          value={postalCode}
          onChange={handlePostalCodeChange}
        />
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Search for Items</h2>
        <SearchBar
          onSearch={handleSearch}
          placeholder="e.g., milk, bread, eggs"
        />
        {error && <p className={styles.error}>{error}</p>}
      </div>

      <div className={styles.statsContainer}>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>🛒</span>
          <p className={styles.statNumber}>{cartItemCount}</p>
          <p className={styles.statLabel}>Items in Cart</p>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>💰</span>
          <p className={styles.statNumber}>${totalSavings.toFixed(2)}</p>
          <p className={styles.statLabel}>Total Saved</p>
        </div>
      </div>

      <div className={styles.actionButtons}>
        <button
          onClick={() => navigate('/cart')}
          className={`${styles.actionButton} ${styles.secondaryButton}`}
        >
          <span className={styles.buttonIcon}>🛒</span>
          <span>View Cart ({cartItemCount})</span>
        </button>

        <button
          onClick={() => navigate('/savings')}
          className={`${styles.actionButton} ${styles.secondaryButton}`}
        >
          <span className={styles.buttonIcon}>📊</span>
          <span>Savings History</span>
        </button>
      </div>
    </div>
  );
};
