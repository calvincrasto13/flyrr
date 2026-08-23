import React from 'react';
import './Badge.css';

export type BadgeVariant = 'discount' | 'success' | 'info' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  /** Looping soft glow — reserve for "new"/"triggered" states, not static tags */
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Small pill badge. One component covers every badge treatment in the app:
 * red "% off" discount tags, green savings amounts, mint/info match-method
 * pills, and neutral tags — variant + optional pulse cover all of them.
 */
const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', pulse = false, children, className = '' }) => {
  const classes = ['badge', `badge--${variant}`, pulse && 'fyr-pulse', className]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{children}</span>;
};

export default Badge;
