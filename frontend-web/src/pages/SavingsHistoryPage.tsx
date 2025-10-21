import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  loadSavingsHistory,
  selectSavingsHistory,
  selectTotalSavings,
  selectSavingsLoading,
  selectSavingsError,
} from '../store/slices/savingsSlice';
import { SavingsCard } from '../components/SavingsCard/SavingsCard';
import { LoadingSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import styles from './SavingsHistoryPage.module.css';

export const SavingsHistoryPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const savingsHistory = useAppSelector(selectSavingsHistory);
  const totalSavings = useAppSelector(selectTotalSavings);
  const loading = useAppSelector(selectSavingsLoading);
  const error = useAppSelector(selectSavingsError);

  useEffect(() => {
    dispatch(loadSavingsHistory());
  }, [dispatch]);

  if (loading && savingsHistory.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate('/')} className={styles.backButton}>
          ← Back
        </button>
        <h1 className={styles.title}>Savings History</h1>
        <div className={styles.spacer} />
      </div>

      <div className={styles.totalCard}>
        <span className={styles.totalIcon}>📈</span>
        <p className={styles.totalLabel}>Total Lifetime Savings</p>
        <p className={styles.totalAmount}>${totalSavings.toFixed(2)}</p>
      </div>

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <button
            onClick={() => dispatch(loadSavingsHistory())}
            className="button button-primary"
          >
            Try Again
          </button>
        </div>
      )}

      {!error && savingsHistory.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📋</span>
          <p className={styles.emptyText}>No shopping trips yet</p>
          <p className={styles.emptySubtext}>
            Start shopping and saving to see your history here
          </p>
          <button
            onClick={() => navigate('/')}
            className="button button-primary"
          >
            Start Shopping
          </button>
        </div>
      )}

      {!error && savingsHistory.length > 0 && (
        <div className={styles.historyList}>
          <h2 className={styles.historyTitle}>Your Shopping Trips</h2>
          {savingsHistory.map((record) => (
            <SavingsCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
};
