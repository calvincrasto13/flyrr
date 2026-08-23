import React from 'react';
import { Minus, Plus } from 'lucide-react';
import './QuantityStepper.css';

interface QuantityStepperProps {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  size?: 'small' | 'medium';
  /** Label read by screen readers, e.g. "Bananas quantity" */
  label?: string;
  className?: string;
}

/**
 * Pill-shaped quantity stepper (light-green fill) used anywhere an item's
 * cart quantity can be adjusted — cart rows, search result rows/cards.
 * The value pops with a small scale-bounce on every change via a
 * remount-keyed span, no JS timers needed.
 */
const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  onIncrement,
  onDecrement,
  size = 'medium',
  label,
  className = '',
}) => {
  const classes = ['quantity-stepper', `quantity-stepper--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="group" aria-label={label}>
      <button
        type="button"
        className="quantity-stepper-btn"
        onClick={onDecrement}
        aria-label={label ? `Decrease ${label}` : 'Decrease quantity'}
      >
        <Minus size={size === 'small' ? 14 : 16} strokeWidth={2.5} />
      </button>
      <span key={value} className="quantity-stepper-value fyr-pop">
        {value}
      </span>
      <button
        type="button"
        className="quantity-stepper-btn"
        onClick={onIncrement}
        aria-label={label ? `Increase ${label}` : 'Increase quantity'}
      >
        <Plus size={size === 'small' ? 14 : 16} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default QuantityStepper;
