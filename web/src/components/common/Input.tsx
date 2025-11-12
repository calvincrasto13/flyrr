import React from 'react';
import { InputProps } from '../../types';
import './Input.css';

const Input: React.FC<InputProps> = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  error,
  label,
  required = false,
  maxLength,
  onKeyPress,
  className = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const classes = [
    'input',
    error && 'input-error',
    disabled && 'input-disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className="input-container">
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={handleChange}
        onKeyPress={onKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className={classes}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <span id={`${name}-error`} className="input-error-text">
          {error}
        </span>
      )}
    </div>
  );
};

export default Input;