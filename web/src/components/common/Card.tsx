import React from 'react';
import { CardProps } from '../../types';
import './Card.css';

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  image,
  onClick,
  hoverable = false,
  className = '',
}) => {
  const classes = [
    'card',
    hoverable && 'card-hoverable',
    onClick && 'card-clickable',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick}>
      {image && (
        <div className="card-image-container">
          <img src={image} alt={title || ''} className="card-image" />
        </div>
      )}
      <div className="card-content">
        {title && <h3 className="card-title">{title}</h3>}
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
};

export default Card;