import { useCallback, useEffect, useState } from 'react';
import { Deal } from '../types';
import apiService from '../services/api';

interface UseDealsReturn {
  deals: Deal[];
  merchants: string[];
  totalFound: number;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

interface DealsState {
  deals: Deal[];
  merchants: string[];
  totalFound: number;
  isLoading: boolean;
  error: string | null;
}

const IDLE: DealsState = {
  deals: [],
  merchants: [],
  totalFound: 0,
  isLoading: false,
  error: null,
};

/**
 * Loads the nearby-deals feed for a postal code.
 *
 * The fan-out across staple categories takes a few seconds server-side, so an
 * in-flight request is abandoned rather than applied if the postal code changes
 * mid-flight — otherwise a slow response for the old location would land after
 * a fast one for the new.
 *
 * Held as one state object rather than five so each phase of the request costs
 * a single render instead of three.
 */
export const useDeals = (postalCode: string, limit = 24): UseDealsReturn => {
  const [state, setState] = useState<DealsState>(IDLE);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    // Nothing to fetch without a location. State is left untouched and the
    // empty result derived at return time instead.
    if (!postalCode.trim()) return;

    let cancelled = false;
    // Entering the loading state is the point of this effect; fetching on a
    // param change has no non-effect equivalent short of adopting a
    // data-fetching library, so the rule is suppressed deliberately here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((previous) => ({ ...previous, isLoading: true, error: null }));

    apiService
      .getDeals(postalCode, limit)
      .then((response) => {
        if (cancelled) return;
        setState({
          deals: response.deals,
          merchants: response.merchants,
          totalFound: response.total_found,
          isLoading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          ...IDLE,
          error: err instanceof Error ? err.message : 'Failed to load deals',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [postalCode, limit, reloadToken]);

  // An empty postal code reports as idle regardless of what the last lookup
  // left behind, so a cleared location can't keep showing stale deals.
  return { ...(postalCode.trim() ? state : IDLE), reload };
};
