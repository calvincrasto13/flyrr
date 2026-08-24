import React from 'react';
import { MapPin, ChevronDown, ShoppingBasket } from 'lucide-react';
import './AppHeader.css';

interface AppHeaderProps {
  postalCode: string;
  city?: string;
  onChangeLocation: () => void;
}

/** Format "L4W3H8" for display as "L4W 3H8". */
const formatPostalCode = (code: string) =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

/**
 * Sticky top bar carrying the brand mark and the location control. Location
 * lives here rather than in a hero block so it stays reachable from every
 * screen without consuming vertical space on the home feed.
 */
const AppHeader: React.FC<AppHeaderProps> = ({ postalCode, city, onChangeLocation }) => (
  <header className="app-header">
    <div className="app-header-brand">
      <ShoppingBasket size={20} strokeWidth={2.4} />
      <span>flyrr</span>
    </div>

    <button
      className="app-header-location"
      onClick={onChangeLocation}
      aria-label={
        postalCode
          ? `Change location, currently ${formatPostalCode(postalCode)}`
          : 'Set your location'
      }
    >
      <MapPin size={15} strokeWidth={2.4} />
      <span className="app-header-location-text">
        {city || (postalCode ? formatPostalCode(postalCode) : 'Set location')}
      </span>
      <ChevronDown size={14} strokeWidth={2.4} className="app-header-location-caret" />
    </button>
  </header>
);

export default AppHeader;
