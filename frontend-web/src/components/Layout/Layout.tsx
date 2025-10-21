import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { selectCartItemCount } from '../../store/slices/cartSlice';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const cartItemCount = useAppSelector(selectCartItemCount);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link to="/" className={styles.logo}>
            <span className={styles.logoIcon}>🛒</span>
            <span className={styles.logoText}>Smart Grocery Saver</span>
          </Link>

          <nav className={styles.nav}>
            <Link
              to="/"
              className={`${styles.navLink} ${isActive('/') ? styles.navLinkActive : ''}`}
            >
              <span className={styles.navIcon}>🏠</span>
              <span className={styles.navText}>Home</span>
            </Link>

            <Link
              to="/cart"
              className={`${styles.navLink} ${isActive('/cart') ? styles.navLinkActive : ''}`}
            >
              <span className={styles.navIcon}>🛒</span>
              <span className={styles.navText}>Cart</span>
              {cartItemCount > 0 && (
                <span className={styles.badge}>{cartItemCount}</span>
              )}
            </Link>

            <Link
              to="/savings"
              className={`${styles.navLink} ${isActive('/savings') ? styles.navLinkActive : ''}`}
            >
              <span className={styles.navIcon}>💰</span>
              <span className={styles.navText}>Savings</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
};
