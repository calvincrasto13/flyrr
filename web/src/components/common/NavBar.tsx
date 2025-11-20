import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, Search } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import './NavBar.css';

interface NavBarProps {
  onSearch?: (query: string, type: 'category' | 'product') => void;
}

const NavBar: React.FC<NavBarProps> = ({ onSearch }) => {
  const navigate = useNavigate();
  const { cart } = useApp();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchType, setSearchType] = React.useState<'category' | 'product'>('product');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearch) {
        onSearch(searchQuery, searchType);
      } else {
        navigate(`/search?q=${searchQuery}&type=${searchType}`);
      }
    }
  };

  return (
    <nav className="navbar navbar-dark bg-dark">
      <div className="navbar-container">
        <div className="navbar-brand" onClick={() => navigate('/')}>
          <ShoppingCart size={32} color="#ffc107" />
          <span className="brand-text">Flyrr</span>
        </div>

        <form className="navbar-search" onSubmit={handleSearch}>
          <input
            type="text"
            className="search-input"
            placeholder="Search for products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="search-select"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as 'category' | 'product')}
          >
            <option value="product">Product</option>
            <option value="category">Category</option>
          </select>
          <button type="submit" className="search-button">
            <Search size={20} />
          </button>
        </form>

        <div className="navbar-actions">
          <button className="nav-btn" onClick={() => navigate('/cart')}>
            <ShoppingCart size={20} />
            <span>Cart</span>
            {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
          </button>
          <button className="nav-btn" onClick={() => navigate('/profile')}>
            <User size={20} />
            <span>Profile</span>
          </button>
          <button className="nav-btn logout-btn" onClick={() => navigate('/logout')}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
