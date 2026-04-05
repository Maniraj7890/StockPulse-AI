import { buildWatchlistPrices } from '@/services/livePriceService';
import { buildMarketStatusView } from '@/utils/marketStatusEngine';

function safeEntries(source) {
  return Object.entries(source ?? {});
}

export function normalizeMarketDataSnapshot({
  livePrices = {},
  marketOverview = [],
  watchlist = [],
} = {}) {
  const quotes = safeEntries(livePrices).map(([symbol, quote]) => ({
    symbol,
    quote,
    marketStatusView: buildMarketStatusView(quote),
  }));

  const watchlistQuotes = buildWatchlistPrices(watchlist, livePrices);
  const freshQuotes = quotes.filter((item) => !item.quote?.stale);
  const staleQuotes = quotes.filter((item) => item.quote?.stale);
  const activeIndices = (marketOverview ?? []).filter((item) => item?.marketStatus === 'OPEN');

  return {
    quotes,
    watchlistQuotes,
    sourceStatus: {
      totalSymbols: quotes.length,
      freshSymbols: freshQuotes.length,
      staleSymbols: staleQuotes.length,
      activeIndices: activeIndices.length,
    },
  };
}
