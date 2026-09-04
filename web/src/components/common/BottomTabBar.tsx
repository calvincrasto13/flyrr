import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingCart, Bell, TrendingUp } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import './BottomTabBar.css';

interface TabDef {
  to: string;
  label: string;
  icon: React.ElementType;
}

const TABS: TabDef[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/cart', label: 'Cart', icon: ShoppingCart },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/savings', label: 'Savings', icon: TrendingUp },
];

/**
 * Floating 5-tab bottom navigation mapped to flyrr's real areas. The
 * in-store shopping checklist (/shopping) is a transient sub-flow of Cart
 * reached via the "Let's Go Shopping!" button, so it has no dedicated tab —
 * but the Cart tab stays highlighted while on it so navigation never looks
 * "lost". Active state is computed from useLocation() (not NavLink's own
 * isActive) so that extra rule re-evaluates correctly on every route change.
 */
const BottomTabBar: React.FC = () => {
  const { cart } = useApp();
  const { pathname } = useLocation();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const isTabActive = (to: string) => {
    if (to === '/') return pathname === '/';
    if (to === '/cart') return pathname === '/cart' || pathname === '/shopping';
    return pathname === to;
  };

  return (
    <nav className="tab-bar" aria-label="Primary">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={`tab-item${isTabActive(to) ? ' tab-item--active' : ''}`}
        >
          <span className="tab-item-icon">
            <Icon size={22} strokeWidth={2.25} />
            {to === '/cart' && cartCount > 0 && (
              <span className="tab-item-badge">{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </span>
          <span className="tab-item-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomTabBar;
