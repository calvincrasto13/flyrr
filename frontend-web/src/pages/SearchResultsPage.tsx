import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  searchItems,
  selectSearchResults,
  selectSearchLoading,
  selectSearchError,
} from '../store/slices/searchSlice';
import {
  addToCart,
  updateQuantity,
  removeFromCart,
  selectCartItems,
} from '../store/slices/cartSlice';
import { ItemCard } from '../components/ItemCard/ItemCard';
import { LoadingSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import styles from './SearchResultsPage.module.css';

export const SearchResultsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();

  const query = searchParams.get('q') || '';
  const postalCode = searchParams.get('postal') || '';

  const searchResults = useAppSelector(selectSearchResults);
  const loading = useAppSelector(selectSearchLoading);
  const error = useAppSelector(selectSearchError);
  const cartItems = useAppSelector(selectCartItems);

  useEffect(() => {
    if (!query || !postalCode) {
      navigate('/');
      return;
    }

    dispatch(searchItems({ query, postal_code: postalCode }));
  }, [query, postalCode, dispatch, navigate]);

  const getItemQuantityInCart = (globalId: string): number => {
    const item = cartItems.find((i) => i.global_id === globalId);
    return item ? item.quantity : 0;
  };

  const handleAddToCart = (item: any) => {
    dispatch(addToCart(item));
  };

  const handleUpdateQuantity = (item: any, delta: number) => {
    const cartItem = cartItems.find((i) => i.global_id === item.global_id);
    if (!cartItem) {
      if (delta > 0) {
        dispatch(addToCart(item));
      }
      return;
    }

    const newQuantity = cartItem.quantity + delta;
    if (newQuantity <= 0) {
      dispatch(removeFromCart(cartItem.id));
    } else {
      dispatch(updateQuantity({ id: cartItem.id, delta }));
    }
  };

  const cheapestPrice = searchResults.length > 0 ? searchResults[0].current_price : 0;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate('/')} className={styles.backButton}>
          ← Back
        </button>
        <h1 className={styles.title}>Search Results</h1>
        <div className={styles.spacer} />
      </div>

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="button button-primary">
            Try Again
          </button>
        </div>
      )}

      {!error && searchResults.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🔍</span>
          <p className={styles.emptyText}>No items found</p>
          <p className={styles.emptySubtext}>Try a different search term</p>
          <button onClick={() => navigate('/')} className="button button-primary">
            Back to Search
          </button>
        </div>
      )}

      {!error && searchResults.length > 0 && (
        <>
          <p className={styles.resultsCount}>
            Found {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} for "{query}"
          </p>

          <div className={styles.resultsList}>
            {searchResults.map((item, index) => {
              const priceDifference = item.current_price - cheapestPrice;
              const quantity = getItemQuantityInCart(item.global_id);

              return (
                <ItemCard
                  key={item.global_id || index}
                  item={item}
                  mode="search"
                  showBestPrice={index === 0}
                  priceDifference={priceDifference}
                  quantity={quantity}
                  onAddToCart={() => handleAddToCart(item)}
                  onUpdateQuantity={(delta) => handleUpdateQuantity(item, delta)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
