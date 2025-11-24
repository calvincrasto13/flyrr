import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, MapPin } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import './NavBar.css';

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const { cart } = useApp();

  return (
    <nav className="navbar-simple">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-brand" onClick={() => navigate('/')}>
          <ShoppingCart size={28} className="logo-icon" />
          <span className="brand-text">Flyrr</span>
        </div>

        {/* Cart Icon */}
        <div className="navbar-actions">
          <button className="cart-button" onClick={() => navigate('/cart')}>
            <ShoppingCart size={24} />
            {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
