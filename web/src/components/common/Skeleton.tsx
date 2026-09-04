import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  /** Render multiple stacked skeleton blocks, e.g. for a list of loading cards */
  count?: number;
  className?: string;
}

/**
 * Shimmering placeholder block for card-shaped loading states (search
 * results, savings history) — used instead of LoadingSpinner when the
 * final content will occupy a known shape, so the layout doesn't jump.
 */
const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 16, radius, count = 1, className = '' }) => {
  const style: React.CSSProperties = {
    width,
    height,
    borderRadius: radius ?? 'var(--radius-sm)',
  };

  if (count <= 1) {
    return <span className={`skeleton fyr-shimmer ${className}`} style={style} />;
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={`skeleton fyr-shimmer ${className}`} style={style} />
      ))}
    </>
  );
};

export default Skeleton;
