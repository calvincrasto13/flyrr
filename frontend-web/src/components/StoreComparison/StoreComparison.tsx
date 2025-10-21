import type { StoreComparison as StoreComparisonType } from '../../types';
import styles from './StoreComparison.module.css';

interface StoreComparisonProps {
  comparison: StoreComparisonType;
}

export const StoreComparison = ({ comparison }: StoreComparisonProps) => {
  // Convert store_totals object to sorted array
  const sortedStores = Object.entries(comparison.store_totals)
    .map(([store, total]) => ({ store, total: total as number }))
    .sort((a, b) => a.total - b.total);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Best Store Comparison</h3>

      <div className={styles.bestStore}>
        <span className={styles.trophy}>🏆</span>
        <div className={styles.bestStoreInfo}>
          <p className={styles.bestStoreName}>{comparison.best_store}</p>
          <p className={styles.bestStorePrice}>
            ${comparison.best_store_total.toFixed(2)}
          </p>
        </div>
      </div>

      <p className={styles.savings}>
        You could save ${comparison.savings.toFixed(2)} shopping here!
      </p>

      <div className={styles.storeList}>
        <h4 className={styles.storeListTitle}>All Store Totals:</h4>
        {sortedStores.map((store) => (
          <div
            key={store.store}
            className={`${styles.storeItem} ${
              store.store === comparison.best_store ? styles.storeItemBest : ''
            }`}
          >
            <span className={styles.storeName}>{store.store}</span>
            <span className={styles.storePrice}>${store.total.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
