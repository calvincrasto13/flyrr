import { useState } from 'react';
import { getPostalCodeFromLocation } from '../../utils/geolocation';
import styles from './PostalCodeInput.module.css';

interface PostalCodeInputProps {
  value: string;
  onChange: (postalCode: string) => void;
}

export const PostalCodeInput = ({ value, onChange }: PostalCodeInputProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUseLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      const postalCode = await getPostalCodeFromLocation();
      onChange(postalCode);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <label htmlFor="postalCode" className={styles.label}>
        Your Location
      </label>
      <div className={styles.inputContainer}>
        <input
          id="postalCode"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="Enter Postal Code (e.g., L4W3H8)"
          className={styles.input}
        />
        <button
          type="button"
          onClick={handleUseLocation}
          className={styles.locationButton}
          disabled={loading}
          title="Use my current location"
        >
          {loading ? '...' : '📍'}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.info}>Getting your location...</p>}
    </div>
  );
};
