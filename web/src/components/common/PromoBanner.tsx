import React from 'react';
import { ShoppingBasket, MapPin } from 'lucide-react';
import Input from './Input';
import Button from './Button';
import './PromoBanner.css';

interface PromoBannerProps {
  title: string;
  subtitle?: string;
  postalCode: string;
  onPostalCodeChange: (value: string) => void;
  onUseLocation: () => void;
  locationLoading?: boolean;
  disabled?: boolean;
}

/**
 * Home screen hero: soft blush-to-mint gradient card with a big friendly
 * headline and the postal-code entry embedded directly inside it, replacing
 * the two separate plain cards the screen used before.
 */
const PromoBanner: React.FC<PromoBannerProps> = ({
  title,
  subtitle,
  postalCode,
  onPostalCodeChange,
  onUseLocation,
  locationLoading = false,
  disabled = false,
}) => (
  <div className="promo-banner">
    <div className="promo-banner-icon">
      <ShoppingBasket size={32} strokeWidth={2} />
    </div>
    <h1 className="promo-banner-title">{title}</h1>
    {subtitle && <p className="promo-banner-subtitle">{subtitle}</p>}

    <div className="promo-banner-location">
      <Input
        value={postalCode}
        onChange={onPostalCodeChange}
        placeholder="Postal Code (e.g., L4W 3H8)"
        maxLength={10}
        disabled={disabled || locationLoading}
        className="promo-banner-input"
      />
      <Button
        onClick={onUseLocation}
        disabled={disabled || locationLoading}
        loading={locationLoading}
        variant="primary"
        size="medium"
        className="promo-banner-location-btn"
      >
        <MapPin size={18} />
        {locationLoading ? '' : 'Use My Location'}
      </Button>
    </div>
  </div>
);

export default PromoBanner;
