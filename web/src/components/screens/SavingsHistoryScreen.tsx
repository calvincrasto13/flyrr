import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Calendar, Store, Receipt } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useGroceryAPI } from '../../hooks/useGroceryAPI';
import { COLORS } from '../../utils/constants';
import { SavingsRecord } from '../../types';
import Button from '../common/Button';
import Card from '../common/Card';
import Badge from '../common/Badge';
import StatTile from '../common/StatTile';
import EmptyState from '../common/EmptyState';
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
  const totalItems = savingsHistory.reduce((sum, record) => sum + (record.items_count || 0), 0);
  const avgTripCost =
    savingsHistory.length > 0
      ? savingsHistory.reduce((sum, record) => sum + record.total_cost, 0) / savingsHistory.length
      : 0;

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

        {/* Total Savings Summary — the screen's hero */}
        <Card className="total-savings-card">
          <div className="total-savings-content">
            <div className="savings-icon">
              <TrendingUp size={44} color="#ffffff" />
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
          <EmptyState
            icon={Receipt}
            title="No shopping trips yet"
            description="Start shopping and saving to see your history here"
            action={{ label: 'Start Shopping', onClick: handleGoBack }}
          />
        ) : (
          <div className="savings-list">
            <h2 className="list-title">Your Shopping History</h2>
            {savingsHistory.map((record: SavingsRecord, index: number) => (
              <Card
                key={`${record.id}-${index}`}
                className="savings-record fyr-rise"
                style={{ '--i': index } as React.CSSProperties}
              >
                <div className="record-header">
                  <div className="record-date">
                    <Calendar size={16} color={COLORS.GRAY} />
                    <span>{formatDate(record.completed_at)}</span>
                  </div>
                  <Badge variant="success">+{formatPrice(record.savings)}</Badge>
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
                          className={`store-price-row ${store === record.best_store ? 'best-price' : ''}`}
                        >
                          <span className="store-price-name">{store}</span>
                          <span className="store-price-value">{formatPrice(price as number)}</span>
                          {store === record.best_store && <Badge variant="success">Best</Badge>}
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
          <div className="stats-summary">
            <h3 className="stats-title">Shopping Statistics</h3>
            <div className="stats-grid">
              <StatTile
                icon={TrendingUp}
                label="Average Savings"
                value={formatPrice(totalSavings / savingsHistory.length)}
                tone="mint"
              />
              <StatTile icon={Store} label="Average Trip Cost" value={formatPrice(avgTripCost)} tone="blush" />
              <StatTile icon={Receipt} label="Total Items Purchased" value={totalItems} tone="warning" />
            </div>
          </div>
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
