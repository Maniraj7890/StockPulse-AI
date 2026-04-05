import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';
import { normalizeMarketDataSnapshot } from '@/utils/marketDataEngine';

export function useLiveQuotes() {
  const livePrices = useMarketStore((state) => state.livePrices);
  const marketOverview = useMarketStore((state) => state.marketOverview);
  const watchlist = useMarketStore((state) => state.watchlist);

  return useMemo(
    () => normalizeMarketDataSnapshot({ livePrices, marketOverview, watchlist }),
    [livePrices, marketOverview, watchlist],
  );
}
