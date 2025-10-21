import type { SavingsRecord } from '../../types';
import styles from './SavingsCard.module.css';

interface SavingsCardProps {
  record: SavingsRecord;
}

export const SavingsCard = ({ record }: SavingsCardProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.date}>{formatDate(record.completed_at)}</span>
        <span className={styles.savings}>+${record.savings.toFixed(2)}</span>
      </div>
      <p className={styles.store}>Shopped at: {record.best_store}</p>
      <p className={styles.total}>Total: ${record.total_cost.toFixed(2)}</p>
    </div>
  );
};
