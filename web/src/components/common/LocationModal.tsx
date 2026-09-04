import React, { useEffect, useRef, useState } from 'react';
import { MapPin, X, Navigation, Check } from 'lucide-react';
import { useLocation } from '../../hooks/useLocation';
import Button from './Button';
import './LocationModal.css';

interface LocationModalProps {
  open: boolean;
  /** Current saved postal code, pre-filled when editing from settings. */
  postalCode: string;
  onSave: (postalCode: string, locationInfo?: { latitude?: number; longitude?: number; city?: string }) => void;
  /** Omitted on first run — there is nothing to fall back to, so the modal
   * cannot be dismissed until a location is chosen. */
  onClose?: () => void;
}

const POSTAL_PATTERN = /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/;

/**
 * Location capture, shown full-screen on first launch and as a dismissible
 * dialog when changing location later. Offers browser geolocation with manual
 * postal-code entry as the always-available fallback.
 */
const LocationModal: React.FC<LocationModalProps> = ({ open, postalCode, onSave, onClose }) => {
  const { getCurrentLocation, getLocationFromPostalCode } = useLocation();
  const [value, setValue] = useState(postalCode);
  const [error, setError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dismissible = !!onClose;

  // Re-sync and focus whenever the dialog is (re)opened.
  useEffect(() => {
    if (!open) return;
    setValue(postalCode);
    setError(null);
    const id = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [open, postalCode]);

  // Escape closes only when there's a saved location to fall back to.
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose!();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  // Lock background scroll while the dialog is up.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const handleDetect = async () => {
    setDetecting(true);
    setError(null);
    try {
      const location = await getCurrentLocation();
      if (location?.postal_code) {
        setValue(location.postal_code);
        onSave(location.postal_code, location);
      } else {
        setError('Could not detect your location. Enter your postal code below.');
      }
    } catch {
      setError('Location detection failed. Enter your postal code below.');
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    const trimmed = value.trim().toUpperCase();
    if (!POSTAL_PATTERN.test(trimmed)) {
      setError('Enter a valid Canadian postal code, e.g. L4W 3H8');
      return;
    }

    setSaving(true);
    setError(null);
    // Geocode for the city label, but never block saving on it — the postal
    // code alone is all the deals feed actually needs.
    try {
      const info = await getLocationFromPostalCode(trimmed);
      onSave(trimmed.replace(/\s/g, ''), info ?? undefined);
    } catch {
      onSave(trimmed.replace(/\s/g, ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="location-modal-overlay"
      onClick={dismissible ? onClose : undefined}
      role="presentation"
    >
      <div
        className="location-modal fyr-fade-slide-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {dismissible && (
          <button className="location-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        )}

        <div className="location-modal-icon">
          <MapPin size={30} strokeWidth={2.2} />
        </div>

        <h2 id="location-modal-title" className="location-modal-title">
          {dismissible ? 'Change your location' : 'Where are you shopping?'}
        </h2>
        <p className="location-modal-subtitle">
          We use your postal code to find flyer deals at stores near you.
        </p>

        <Button
          onClick={handleDetect}
          disabled={detecting || saving}
          loading={detecting}
          variant="primary"
          size="large"
          className="location-modal-detect"
        >
          <Navigation size={18} />
          {detecting ? 'Detecting…' : 'Use my current location'}
        </Button>

        <div className="location-modal-divider"><span>or enter it manually</span></div>

        <input
          ref={inputRef}
          className="location-modal-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          placeholder="L4W 3H8"
          maxLength={7}
          autoComplete="postal-code"
          aria-invalid={!!error}
          disabled={detecting || saving}
        />

        {error && <p className="location-modal-error">{error}</p>}

        <Button
          onClick={handleSave}
          disabled={detecting || saving || !value.trim()}
          loading={saving}
          variant="primary"
          size="large"
          className="location-modal-save"
        >
          <Check size={18} />
          {saving ? 'Saving…' : 'Save location'}
        </Button>

        <p className="location-modal-footnote">
          You can change this any time from the header.
        </p>
      </div>
    </div>
  );
};

export default LocationModal;
