import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, Trash2, Plus, RefreshCw, CheckCircle } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { PriceAlert, PriceAlertCreate } from '../../types';
import apiService from '../../services/api';
import Button from '../common/Button';
import Card from '../common/Card';
import Input from '../common/Input';
import Badge from '../common/Badge';
import EmptyState from '../common/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import './PriceAlertsScreen.css';

const PriceAlertsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { postalCode } = useApp();

  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<{ checked: number; fired: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create form state
  const [formProduct, setFormProduct] = useState('');
  const [formPostalCode, setFormPostalCode] = useState(postalCode || '');
  const [formTargetPrice, setFormTargetPrice] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.getAlerts();
      setAlerts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProduct.trim() || !formPostalCode.trim() || !formTargetPrice) return;

    const targetPrice = parseFloat(formTargetPrice);
    if (isNaN(targetPrice) || targetPrice <= 0) {
      setError('Please enter a valid target price');
      return;
    }

    setFormSubmitting(true);
    setError(null);
    try {
      const payload: PriceAlertCreate = {
        product_name: formProduct.trim(),
        postal_code: formPostalCode.trim().toUpperCase().replace(/\s/g, ''),
        target_price: targetPrice,
        notify_email: formEmail.trim() || undefined,
      };
      const newAlert = await apiService.createAlert(payload);
      setAlerts(prev => [newAlert, ...prev]);
      setFormProduct('');
      setFormTargetPrice('');
      setFormEmail('');
      setSuccessMsg('Alert created successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleAlert = async (alert: PriceAlert) => {
    try {
      await apiService.updateAlert(alert.id, { active: !alert.active });
      setAlerts(prev =>
        prev.map(a => (a.id === alert.id ? { ...a, active: !a.active } : a))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update alert');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await apiService.deleteAlert(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert');
    }
  };

  const handleCheckAlerts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiService.triggerAlertCheck();
      setCheckResult(result);
      await loadAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check alerts');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="alerts-screen">
      <div className="alerts-container">
        {/* Header */}
        <div className="alerts-header">
          <Button onClick={() => navigate('/')} variant="secondary" size="small">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="alerts-title">Price Alerts</h1>
          <Button
            onClick={handleCheckAlerts}
            variant="secondary"
            size="small"
            disabled={isLoading}
            loading={isLoading}
          >
            <RefreshCw size={18} />
          </Button>
        </div>

        {error && <div className="alerts-error">{error}</div>}
        {successMsg && (
          <div className="alerts-success">
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}
        {checkResult && (
          <div className="alerts-check-result">
            Checked {checkResult.checked} alert{checkResult.checked !== 1 ? 's' : ''} —{' '}
            <strong>{checkResult.fired}</strong> triggered
          </div>
        )}

        {/* Create Alert Form */}
        <Card className="create-alert-card">
          <h2 className="create-alert-title">
            <Plus size={18} /> Create New Alert
          </h2>
          <form onSubmit={handleCreateAlert} className="create-alert-form">
            <Input
              value={formProduct}
              onChange={setFormProduct}
              placeholder="e.g., Tropicana Orange Juice"
              label="Product Name"
              required
              disabled={formSubmitting}
            />
            <Input
              value={formPostalCode}
              onChange={setFormPostalCode}
              placeholder="e.g., L4W3H8"
              label="Postal Code"
              required
              maxLength={10}
              disabled={formSubmitting}
            />
            <Input
              value={formTargetPrice}
              onChange={setFormTargetPrice}
              placeholder="e.g., 3.99"
              label="Target Price ($)"
              type="number"
              required
              disabled={formSubmitting}
            />
            <Input
              value={formEmail}
              onChange={setFormEmail}
              placeholder="you@example.com (optional)"
              label="Notify Email"
              type="email"
              disabled={formSubmitting}
            />
            <Button
              onClick={() => {}}
              type="submit"
              variant="primary"
              size="medium"
              disabled={formSubmitting || !formProduct.trim() || !formPostalCode.trim() || !formTargetPrice}
              loading={formSubmitting}
            >
              <Bell size={16} /> Create Alert
            </Button>
          </form>
        </Card>

        {/* Alert List */}
        {isLoading && alerts.length === 0 ? (
          <LoadingSpinner size="large" text="Loading alerts..." />
        ) : alerts.length === 0 ? (
          <EmptyState icon={Bell} title="No price alerts yet" description="Create one above to get notified on a price drop" />
        ) : (
          <div className="alerts-list">
            <h2 className="alerts-list-title">Active Alerts ({alerts.filter(a => a.active).length})</h2>
            {alerts.map((alert, idx) => {
              const targetHit = alert.last_seen_price != null && alert.last_seen_price <= alert.target_price;
              return (
              <Card
                key={alert.id}
                className={`alert-card fyr-rise ${!alert.active ? 'alert-card--inactive' : ''}`}
                style={{ '--i': idx } as React.CSSProperties}
              >
                <div className="alert-top">
                  <div className="alert-info">
                    <h3 className="alert-product">{alert.product_name}</h3>
                    <div className="alert-meta">
                      <span className="alert-postal">{alert.postal_code}</span>
                      {alert.notify_email && (
                        <span className="alert-email">{alert.notify_email}</span>
                      )}
                    </div>
                    {targetHit && (
                      <Badge variant="success" pulse className="target-hit-badge">
                        Target hit!
                      </Badge>
                    )}
                  </div>
                  <div className="alert-price-col">
                    <div className="alert-target">Target: <strong>${alert.target_price.toFixed(2)}</strong></div>
                    {alert.last_seen_price != null && (
                      <div className={`alert-current ${targetHit ? 'price-hit' : ''}`}>
                        Now: ${alert.last_seen_price.toFixed(2)}
                        {alert.best_merchant && <span className="at-merchant"> @ {alert.best_merchant}</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="alert-bottom">
                  <div className="alert-dates">
                    <span>Checked: {formatDate(alert.last_checked_at)}</span>
                    {alert.last_triggered_at && (
                      <span className="triggered-at">Triggered: {formatDate(alert.last_triggered_at)}</span>
                    )}
                  </div>
                  <div className="alert-actions">
                    <button
                      className={`toggle-alert-btn ${alert.active ? 'active' : 'inactive'}`}
                      onClick={() => handleToggleAlert(alert)}
                      title={alert.active ? 'Pause alert' : 'Resume alert'}
                    >
                      {alert.active ? <Bell size={16} /> : <BellOff size={16} />}
                    </button>
                    <button
                      className="delete-alert-btn"
                      onClick={() => handleDeleteAlert(alert.id)}
                      title="Delete alert"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceAlertsScreen;
