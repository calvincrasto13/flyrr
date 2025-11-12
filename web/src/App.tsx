import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import HomeScreen from './components/screens/HomeScreen';
import SearchResultsScreen from './components/screens/SearchResultsScreen';
import CartScreen from './components/screens/CartScreen';
import ShoppingListScreen from './components/screens/ShoppingListScreen';
import SavingsHistoryScreen from './components/screens/SavingsHistoryScreen';
import './App.css';

function App() {
  return (
    <AppProvider>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/search" element={<SearchResultsScreen />} />
            <Route path="/cart" element={<CartScreen />} />
            <Route path="/shopping" element={<ShoppingListScreen />} />
            <Route path="/savings" element={<SavingsHistoryScreen />} />
          </Routes>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;
