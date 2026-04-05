import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';
import { buildMarketStatusView } from '@/utils/marketStatusEngine';

export function useMarketStatus(symbol) {
  const marketData = useMarketStore((state) => state.data ?? {});
  const marketOverview = useMarketStore((state) => state.marketOverview ?? []);

  return useMemo(() => {
    if (symbol && marketData[symbol]?.latest) {
      return buildMarketStatusView(marketData[symbol].latest);
    }

    const fallbackQuote = marketOverview?.[0] ?? {};
    return buildMarketStatusView(fallbackQuote);
  }, [marketData, marketOverview, symbol]);
}
