import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';
import { getMarketStatusExplanation } from '@/utils/marketSession';

const EMPTY_SOURCE_STATUS = {
  totalSymbols: 0,
  freshSymbols: 0,
  staleSymbols: 0,
  activeIndices: 0,
};

export function useLiveMarketData(options = {}) {
  const symbols = Array.isArray(options.symbols) ? options.symbols : [];
  const symbolKey = symbols.join('|');
  const livePrices = useMarketStore((state) => state.livePrices ?? {});
  const watchlistPrices = useMarketStore((state) => state.watchlistPrices ?? {});
  const marketOverview = useMarketStore((state) => state.marketOverview ?? []);
  const marketStatus = useMarketStore((state) => state.data?.NIFTY?.latest?.marketStatus ?? 'UNKNOWN');
  const marketStatusDetail = useMarketStore((state) => state.data?.NIFTY?.latest?.marketStatusDetail ?? null);
  const marketStatusReason = useMarketStore((state) => state.data?.NIFTY?.latest?.marketStatusReason ?? null);
  const lastUpdated = useMarketStore((state) => state.lastUpdated ?? null);
  const marketDataSnapshot = useMarketStore((state) => state.marketDataSnapshot ?? {});
  const isLiveMode = useMarketStore((state) => state.isLiveMode);
  const refreshNow = useMarketStore((state) => state.refreshNow);

  return useMemo(() => {
    const referenceQuote = {
      marketStatus,
      marketStatusDetail,
      marketStatusReason,
      lastUpdated,
      stale: marketStatus !== 'OPEN',
    };
    const statusExplanation = getMarketStatusExplanation(referenceQuote);
    const quotesBySymbol =
      symbols.length > 0
        ? symbols.reduce((accumulator, symbol) => {
            accumulator[symbol] = livePrices?.[symbol] ?? null;
            return accumulator;
          }, {})
        : livePrices;

    return {
      marketStatus,
      marketStatusDetail,
      marketStatusReason,
      marketStatusExplanation: statusExplanation,
      lastUpdated,
      livePrices,
      quotesBySymbol,
      watchlistPrices,
      marketOverview,
      sourceStatus: marketDataSnapshot?.sourceStatus ?? EMPTY_SOURCE_STATUS,
      isLiveMode,
      refreshNow,
    };
  }, [
    isLiveMode,
    lastUpdated,
    livePrices,
    marketDataSnapshot?.sourceStatus,
    marketOverview,
    marketStatus,
    marketStatusDetail,
    marketStatusReason,
    refreshNow,
    symbolKey,
    watchlistPrices,
  ]);
}

export function useLiveQuote(symbol) {
  const liveQuote = useMarketStore((state) => (symbol ? state.livePrices?.[symbol] ?? null : null));
  const watchlistQuote = useMarketStore((state) => (symbol ? state.watchlistPrices?.[symbol] ?? null : null));

  return liveQuote ?? watchlistQuote ?? null;
}
