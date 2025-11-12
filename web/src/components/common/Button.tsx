import React from 'react';
import { Loader2 } from 'lucide-react';
import { ButtonProps } from '../../types';
import { COLORS } from '../../utils/constants';
import './Button.css';

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'medium',
  type = 'button',
  className = '',
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'secondary':
        return 'button-secondary';
      case 'danger':
        return 'button-danger';
      default:
        return 'button-primary';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'button-small';
      case 'large':
        return 'button-large';
      default:
        return 'button-medium';
    }
  };

  const classes = [
    'button',
    getVariantClass(),
    getSizeClass(),
    disabled && 'button-disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && (
        <Loader2 className="button-spinner" size={size === 'small' ? 16 : 20} />
      )}
      <span className="button-content">{children}</span>
    </button>
  );
};

export default Button;