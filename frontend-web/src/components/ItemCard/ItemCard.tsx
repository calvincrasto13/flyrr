import type { ShoppingItem } from '../../types';
import { provideFeedback } from '../../utils/feedback';
import styles from './ItemCard.module.css';

interface ItemCardProps {
  item: ShoppingItem;
  mode: 'search' | 'cart';
  showBestPrice?: boolean;
  priceDifference?: number;
  quantity?: number;
  onAddToCart?: () => void;
  onUpdateQuantity?: (delta: number) => void;
  onRemove?: () => void;
}

export const ItemCard = ({
  item,
  mode,
  showBestPrice = false,
  priceDifference = 0,
  quantity = 0,
  onAddToCart,
  onUpdateQuantity,
  onRemove,
}: ItemCardProps) => {
  const handleAction = (action: () => void) => {
    provideFeedback();
    action();
  };

  return (
    <div className={styles.card}>
      {showBestPrice && (
        <div className={styles.bestPriceBadge}>
          <span className={styles.badgeIcon}>🏆</span>
          <span className={styles.badgeText}>Best Price</span>
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.imageContainer}>
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className={styles.image}
            />
          ) : (
            <div className={styles.imagePlaceholder}>
              <span className={styles.placeholderIcon}>📦</span>
            </div>
          )}
        </div>

        <div className={styles.details}>
          <h3 className={styles.name}>{item.name}</h3>

          <div className={styles.storeRow}>
            {item.merchant_logo ? (
              <img
                src={item.merchant_logo}
                alt={item.merchant}
                className={styles.storeLogo}
              />
            ) : (
              <span className={styles.storeIcon}>🏪</span>
            )}
            <span className={styles.storeName}>{item.merchant}</span>
          </div>

          <div className={styles.priceRow}>
            <span className={styles.price}>${item.current_price.toFixed(2)}</span>
            {mode === 'cart' && (
              <span className={styles.subtotal}>
                × {item.quantity} = ${(item.current_price * item.quantity).toFixed(2)}
              </span>
            )}
            {priceDifference > 0 && (
              <span className={styles.priceDifference}>
                +${priceDifference.toFixed(2)} vs best
              </span>
            )}
          </div>
        </div>
      </div>

      {mode === 'search' && (
        <div className={styles.actions}>
          {quantity > 0 ? (
            <div className={styles.quantityControls}>
              <button
                onClick={() => handleAction(() => onUpdateQuantity?.(-1))}
                className={styles.quantityButton}
              >
                −
              </button>
              <div className={styles.quantityDisplay}>
                <span className={styles.quantityNumber}>{quantity}</span>
                <span className={styles.quantityLabel}>in cart</span>
              </div>
              <button
                onClick={() => handleAction(() => onUpdateQuantity?.(1))}
                className={styles.quantityButton}
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleAction(() => onAddToCart?.())}
              className={styles.addButton}
            >
              <span className={styles.addIcon}>+</span>
              Add to Cart
            </button>
          )}
        </div>
      )}

      {mode === 'cart' && (
        <div className={styles.cartActions}>
          <div className={styles.quantityControls}>
            <button
              onClick={() => handleAction(() => onUpdateQuantity?.(-1))}
              className={styles.quantityButton}
            >
              −
            </button>
            <span className={styles.quantityNumber}>{item.quantity}</span>
            <button
              onClick={() => handleAction(() => onUpdateQuantity?.(1))}
              className={styles.quantityButton}
            >
              +
            </button>
          </div>
          <button
            onClick={() => handleAction(() => onRemove?.())}
            className={styles.removeButton}
            title="Remove item"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
};
