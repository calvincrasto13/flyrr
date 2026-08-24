import React from 'react';
import { Plus, Tag, ImageOff } from 'lucide-react';
import { Deal } from '../../types';
import './DealCard.css';

interface DealCardProps {
  deal: Deal;
  onAdd: (deal: Deal) => void;
  /** Stagger index for the entrance animation. */
  index?: number;
}

/** "3 days left" / "Ends today" — null once the offer has lapsed. */
const formatExpiry = (validTo?: string | null): string | null => {
  if (!validTo) return null;
  const end = new Date(validTo);
  if (Number.isNaN(end.getTime())) return null;

  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return 'Ends today';
  if (days === 1) return 'Ends tomorrow';
  return `${days} days left`;
};

const DealCard: React.FC<DealCardProps> = ({ deal, onAdd, index = 0 }) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const expiry = formatExpiry(deal.valid_to);
  const hasDiscount = deal.discount_percent > 0;

  return (
    <article
      className="deal-card fyr-rise"
      style={{ '--i': Math.min(index, 11) } as React.CSSProperties}
    >
      <div className="deal-card-media">
        {deal.image_url && !imageFailed ? (
          <img
            src={deal.image_url}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="deal-card-media-fallback" aria-hidden="true">
            <ImageOff size={22} />
          </div>
        )}

        {hasDiscount && (
          <span className="deal-card-badge">−{deal.discount_percent}%</span>
        )}
      </div>

      <div className="deal-card-body">
        <p className="deal-card-merchant">{deal.merchant}</p>
        <h3 className="deal-card-name" title={deal.name}>{deal.name}</h3>

        <div className="deal-card-pricing">
          <span className="deal-card-price">${deal.current_price.toFixed(2)}</span>
          {deal.original_price != null && deal.original_price > deal.current_price && (
            <span className="deal-card-was">${deal.original_price.toFixed(2)}</span>
          )}
        </div>

        {deal.sale_story && (
          <p className="deal-card-story">
            <Tag size={12} />
            {deal.sale_story}
          </p>
        )}

        <div className="deal-card-footer">
          {expiry && <span className="deal-card-expiry">{expiry}</span>}
          <button
            className="deal-card-add"
            onClick={() => onAdd(deal)}
            aria-label={`Add ${deal.name} to cart`}
            type="button"
          >
            <Plus size={16} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </article>
  );
};

export default DealCard;
