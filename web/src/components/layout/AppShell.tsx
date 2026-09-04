import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import BottomTabBar from '../common/BottomTabBar';
import LocationModal from '../common/LocationModal';
import AppHeader from './AppHeader';
import './AppShell.css';

/**
 * Persistent app chrome: sticky header, the active route via <Outlet/>, and
 * the floating bottom tab bar. Re-keys the content wrapper on pathname so
 * every navigation replays the soft fade/slide-in entrance animation.
 *
 * Also owns the location dialog, which is shown two ways: forced on first run
 * (no saved location, so not dismissible) and on demand from the header.
 */
const AppShell: React.FC = () => {
  const location = useLocation();
  const {
    postalCode,
    locationInfo,
    hydrated,
    hasOnboardedLocation,
    setPostalCode,
    setLocationInfo,
    completeLocationOnboarding,
  } = useApp();

  const [manuallyOpen, setManuallyOpen] = useState(false);

  // Wait for hydration before deciding — otherwise the modal flashes on every
  // load while localStorage is still being read back.
  const needsOnboarding = hydrated && !hasOnboardedLocation && !postalCode;
  const modalOpen = needsOnboarding || manuallyOpen;

  const handleSave = (
    code: string,
    info?: { latitude?: number; longitude?: number; city?: string }
  ) => {
    setPostalCode(code);
    setLocationInfo({
      postal_code: code,
      latitude: info?.latitude,
      longitude: info?.longitude,
      city: info?.city,
    });
    completeLocationOnboarding();
    setManuallyOpen(false);
  };

  return (
    <div className="app-shell">
      <AppHeader
        postalCode={postalCode}
        city={locationInfo?.city}
        onChangeLocation={() => setManuallyOpen(true)}
      />

      <main key={location.pathname} className="app-shell-content fyr-fade-slide-in">
        <Outlet />
      </main>

      <BottomTabBar />

      <LocationModal
        open={modalOpen}
        postalCode={postalCode}
        onSave={handleSave}
        // First run has nothing to fall back to, so it can't be dismissed.
        onClose={needsOnboarding ? undefined : () => setManuallyOpen(false)}
      />
    </div>
  );
};

export default AppShell;
