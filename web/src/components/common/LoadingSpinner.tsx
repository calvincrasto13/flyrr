import React from 'react';
import { Loader2 } from 'lucide-react';
import { LoadingSpinnerProps } from '../../types';
import './LoadingSpinner.css';

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  text,
  className = '',
}) => {
  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'spinner-small';
      case 'large':
        return 'spinner-large';
      default:
        return 'spinner-medium';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 20;
      case 'large':
        return 40;
      default:
        return 28;
    }
  };

  return (
    <div className={`loading-spinner ${getSizeClass()} ${className}`}>
      <Loader2
        size={getIconSize()}
        className="spinner-icon"
      />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;