import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomTabBar from '../common/BottomTabBar';
import './AppShell.css';

/**
 * Persistent app chrome: renders the active route via <Outlet/> and mounts
 * the floating bottom tab bar. Re-keys the content wrapper on pathname so
 * every navigation replays the soft fade/slide-in entrance animation.
 */
const AppShell: React.FC = () => {
  const location = useLocation();

  return (
    <div className="app-shell">
      <main key={location.pathname} className="app-shell-content fyr-fade-slide-in">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
};

export default AppShell;
