import React from 'react';
import { LucideIcon } from 'lucide-react';
import Button from './Button';
import './EmptyState.css';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Consolidates the empty-state blocks that were duplicated across Search
 * Results, Cart, Savings History and Price Alerts into one shared pattern.
 */
const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, className = '' }) => (
  <div className={`empty-state ${className}`}>
    <div className="empty-state-icon">
      <Icon size={40} strokeWidth={1.75} />
    </div>
    <p className="empty-state-title">{title}</p>
    {description && <p className="empty-state-description">{description}</p>}
    {action && (
      <Button onClick={action.onClick} variant="secondary" size="medium" className="empty-state-action">
        {action.label}
      </Button>
    )}
  </div>
);

export default EmptyState;
