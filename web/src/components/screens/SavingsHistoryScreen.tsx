import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Calendar, Store, Receipt } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useGroceryAPI } from '../../hooks/useGroceryAPI';
import { COLORS } from '../../utils/constants';
import { SavingsRecord } from '../../types';
import Button from '../common/Button';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import './SavingsHistoryScreen.css';

const SavingsHistoryScreen: React.FC = () => {
  const navigate = useNavigate();
  const { savingsHistory, setSavingsHistory } = useApp();
  const { loadSavingsHistory, isLoading } = useGroceryAPI();
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      setLocalLoading(true);
      try {
        await loadSavingsHistory();
      } catch (error) {
        console.error('Error loading savings history:', error);
      } finally {
        setLocalLoading(false);
      }
    };

    if (savingsHistory.length === 0) {
      loadHistory();
    }
  }, []);

  const handleGoBack = () => {
    navigate('/');
  };

  const totalSavings = savingsHistory.reduce((sum, record) => sum + (record.savings || 0), 0);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number): string => {
    return `$${price.toFixed(2)}`;
  };

  if (localLoading) {
    return (
      <div className="savings-history-screen">
        <div className="savings-container">
          <LoadingSpinner size="large" text="Loading your savings history..." />
        </div>
      </div>
    );
  }

  return (
    <div className="savings-history-screen">
      <div className="savings-container">
        {/* Header */}
        <div className="savings-header">
          <Button
            onClick={handleGoBack}
            variant="secondary"
            size="small"
            className="back-button"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="savings-title">Savings History</h1>
          <div className="spacer" />
        </div>

        {/* Total Savings Summary */}
        <Card className="total-savings-card">
          <div className="total-savings-content">
            <div className="savings-icon">
              <TrendingUp size={48} color={COLORS.PRIMARY} />
            </div>
            <div className="savings-info">
              <h2 className="total-savings-label">Total Savings</h2>
              <p className="total-savings-amount">{formatPrice(totalSavings)}</p>
              <p className="trips-count">{savingsHistory.length} shopping trips</p>
            </div>
          </div>
        </Card>

        {/* Savings History */}
        {savingsHistory.length === 0 ? (
          <Card className="empty-savings">
            <div className="empty-icon">
              <Receipt size={64} color={COLORS.LIGHT_GRAY} />
            </div>
            <h3 className="empty-title">No shopping trips yet</h3>
            <p className="empty-description">
              Start shopping and saving to see your history here
            </p>
            <Button
              onClick={handleGoBack}
              variant="primary"
              size="medium"
              className="start-shopping-button"
            >
              Start Shopping
            </Button>
          </Card>
        ) : (
          <div className="savings-list">
            <h2 className="list-title">Your Shopping History</h2>
            {savingsHistory.map((record: SavingsRecord, index: number) => (
              <Card key={`${record.id}-${index}`} className="savings-record">
                <div className="record-header">
                  <div className="record-date">
                    <Calendar size={16} color={COLORS.GRAY} />
                    <span>{formatDate(record.completed_at)}</span>
                  </div>
                  <div className="record-savings">
                    <span className="savings-amount">+{formatPrice(record.savings)}</span>
                  </div>
                </div>

                <div className="record-details">
                  <div className="record-store">
                    <Store size={16} color={COLORS.PRIMARY} />
                    <span>{record.best_store}</span>
                  </div>
                  <div className="record-stats">
                    <span className="record-total">Total: {formatPrice(record.total_cost)}</span>
                    {record.items_count && (
                      <span className="record-items">{record.items_count} items</span>
                    )}
                  </div>
                </div>

                {record.potential_costs && Object.keys(record.potential_costs).length > 1 && (
                  <div className="price-comparison">
                    <p className="comparison-title">Store Comparison:</p>
                    <div className="store-prices">
                      {Object.entries(record.potential_costs).map(([store, price]) => (
                        <div
                          key={store}
                          className={`store-price ${store === record.best_store ? 'best-price' : ''}`}
                        >
                          <span className="store-name">{store}</span>
                          <span className="price">{formatPrice(price as number)}</span>
                          {store === record.best_store && (
                            <span className="best-badge">Best</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Stats Summary */}
        {savingsHistory.length > 0 && (
          <Card className="stats-summary">
            <h3 className="stats-title">Shopping Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Average Savings</span>
                <span className="stat-value">
                  {formatPrice(totalSavings / savingsHistory.length)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Trip Cost</span>
                <span className="stat-value">
                  {formatPrice(
                    savingsHistory.reduce((sum, record) => sum + record.total_cost, 0) / savingsHistory.length
                  )}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Items Purchased</span>
                <span className="stat-value">
                  {savingsHistory.reduce((sum, record) => sum + (record.items_count || 0), 0)}
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="loading-overlay">
            <LoadingSpinner size="medium" text="Updating..." />
          </div>
        )}
      </div>
    </div>
  );
};

export default SavingsHistoryScreen;