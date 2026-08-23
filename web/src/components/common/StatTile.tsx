import React from 'react';
import { LucideIcon } from 'lucide-react';
import './StatTile.css';

export type StatTileTone = 'mint' | 'blush' | 'warning';

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: StatTileTone;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}

/**
 * Small pastel stat card. Reused app-wide: the Home "Quick Stats" row
 * (Items in Cart / Total Saved / Active Alerts) and the Savings History
 * stats grid both render through this one component.
 */
const StatTile: React.FC<StatTileProps> = ({
  icon: Icon,
  label,
  value,
  tone = 'mint',
  onClick,
  loading = false,
  className = '',
}) => {
  const classes = [
    'stat-tile',
    `stat-tile--${tone}`,
    onClick && 'stat-tile--clickable',
    className,
  ].filter(Boolean).join(' ');

  const content = (
    <>
      <span className="stat-tile-icon">
        <Icon size={20} strokeWidth={2} />
      </span>
      <span className="stat-tile-value">{loading ? '—' : value}</span>
      <span className="stat-tile-label">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
};

export default StatTile;
