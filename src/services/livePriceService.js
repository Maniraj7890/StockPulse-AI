import {
  DEFAULT_EXCHANGE,
  FALLBACK_SOURCE,
  LIVE_QUOTE_MAX_AGE_MS,
  LIVE_SOURCE,
  MARKET_INDEX_DEFINITIONS,
  REFERENCE_MARKET_OVERVIEW,
  SPARK_INTERVAL,
  SPARK_RANGE,
  STOCK_SYMBOL_MAP,
} from '@/services/symbolMap';
import { enrichMarketQuoteState, isTimestampInvalid } from '@/utils/marketSession';

function round(value) {
  return Number(value.toFixed(2));
}

function buildExecutionPrices(ltp) {
  const spread = Math.max(ltp * 0.00035, 0.05);
  return {
    ltp: round(ltp),
    buyPrice: round(ltp + spread),
    sellPrice: round(Math.max(0.01, ltp - spread)),
    spread: round(spread * 2),
  };
}

function findLastValue(values) {
  const source = values ?? [];

  for (let index = source.length - 1; index >= 0; index -= 1) {
    const value = source[index];
    if (value != null && Number.isFinite(value)) {
      return Number(value);
    }
  }

  return null;
}

function normalizeLiveQuote(quote, fallback = {}) {
  const ltp = quote?.ltp ?? quote?.price ?? fallback?.currentPrice ?? 0;
  const prevClose = quote?.prevClose ?? quote?.previousClose ?? fallback?.prevClose ?? ltp;
  const change = quote?.change ?? round(ltp - prevClose);
  const high = quote?.high ?? quote?.dayHigh ?? fallback?.ohlc?.high ?? ltp;
  const low = quote?.low ?? quote?.dayLow ?? fallback?.ohlc?.low ?? ltp;

  return enrichMarketQuoteState({
    symbol: quote?.symbol ?? fallback?.symbol,
    exchange: quote?.exchange ?? fallback?.exchange ?? DEFAULT_EXCHANGE,
    ltp,
    open: quote?.open ?? fallback?.ohlc?.open ?? prevClose,
    high,
    low,
    prevClose,
    change,
    changePercent: quote?.changePercent ?? fallback?.dayChangePercent ?? 0,
    volume: quote?.volume ?? fallback?.volume ?? 0,
    lastUpdated: !isTimestampInvalid(quote?.lastUpdated) ? quote?.lastUpdated : fallback?.lastUpdated ?? null,
    stale: quote?.stale ?? quote?.isStale ?? false,
    staleLabel: quote?.staleLabel ?? (quote?.stale ?? quote?.isStale ? 'Delayed' : 'Live'),
    source: quote?.source ?? LIVE_SOURCE,
    buyPrice: quote?.buyPrice ?? ltp,
    sellPrice: quote?.sellPrice ?? ltp,
    spread: quote?.spread ?? 0,
    direction: quote?.direction ?? fallback?.live?.direction ?? 'neutral',
    price: ltp,
    previousClose: prevClose,
    dayHigh: high,
    dayLow: low,
  });
}

function buildLiveTradePlan(stock, liveQuote) {
  const ltp = liveQuote?.ltp ?? stock.currentPrice;
  const atrUnit = stock.indicators?.atr14 || Math.max(ltp * 0.0075, 0.5);
  const bullish = stock.signal?.bias !== 'Bearish';
  const support = stock.supportResistance?.support ?? ltp - atrUnit;
  const resistance = stock.supportResistance?.resistance ?? ltp + atrUnit;
  const ema9 = stock.indicators?.ema9 ?? ltp;
  const ema21 = stock.indicators?.ema21 ?? ltp;

  if (!bullish) {
    const idealEntry = round(Math.min(ltp, ema9));
    const safeEntry = round(Math.min(ltp, ema21));
    const stopLoss = round(Math.max(resistance, ltp + atrUnit * 0.85));
    return {
      idealEntry,
      aggressiveEntry: round(liveQuote?.sellPrice ?? ltp),
      safeEntry,
      stopLoss,
      target1: round(ltp - atrUnit * 0.45),
      target2: round(ltp - atrUnit * 0.8),
      target3: round(ltp - atrUnit * 1.15),
      trailingStop: round(ltp + atrUnit * 0.35),
    };
  }

  const idealEntry = round(Math.max(support + atrUnit * 0.12, Math.min(ema9, ltp)));
  const safeEntry = round(Math.max(Math.min(ema21, ltp), support + atrUnit * 0.18));
  const stopLoss = round(Math.max(0.01, Math.min(support, ltp - atrUnit * 0.82)));

  return {
    idealEntry,
    aggressiveEntry: round(liveQuote?.buyPrice ?? ltp),
    safeEntry,
    stopLoss,
    target1: round(Math.min(resistance, ltp + atrUnit * 0.45)),
    target2: round(Math.min(resistance + atrUnit * 0.18, ltp + atrUnit * 0.78)),
    target3: round(Math.min(resistance + atrUnit * 0.4, ltp + atrUnit * 1.08)),
    trailingStop: round(Math.max(stopLoss, ltp - atrUnit * 0.34)),
  };
}

function deriveDirection(ltp, prevClose) {
  if (ltp > prevClose) return 'up';
  if (ltp < prevClose) return 'down';
  return 'neutral';
}

function buildYahooSparkUrl(symbols) {
  const params = new URLSearchParams({
    symbols: symbols.join(','),
    range: SPARK_RANGE,
    interval: SPARK_INTERVAL,
  });

  return `/api/market/spark?${params.toString()}`;
}

async function fetchSparkPayload(symbols, retries = 1) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(buildYahooSparkUrl(symbols));

      if (!response.ok) {
        throw new Error(`Live market data request failed with status ${response.status}.`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Live market data request failed.');
}

function buildQuoteFromSpark(result, fallback = {}, preferredLabel) {
  const response = result?.response?.[0];
  const meta = response?.meta ?? {};
  const quote = response?.indicators?.quote?.[0] ?? {};
  const timestamps = response?.timestamp ?? [];
  const ltp = Number(meta.regularMarketPrice ?? findLastValue(quote.close) ?? fallback?.ltp ?? fallback?.currentPrice ?? 0);
  const prevClose = Number(meta.previousClose ?? meta.chartPreviousClose ?? fallback?.prevClose ?? ltp);
  const execution = buildExecutionPrices(ltp);
  const updatedEpoch = meta.regularMarketTime ?? timestamps.at(-1);
  const lastUpdated = updatedEpoch ? new Date(updatedEpoch * 1000).toISOString() : fallback?.lastUpdated ?? null;
  const high = Number(meta.regularMarketDayHigh ?? findLastValue(quote.high) ?? fallback?.high ?? ltp);
  const low = Number(meta.regularMarketDayLow ?? findLastValue(quote.low) ?? fallback?.low ?? ltp);
  const open = Number(findLastValue(quote.open) ?? fallback?.open ?? prevClose);
  const volume = Number(meta.regularMarketVolume ?? fallback?.volume ?? 0);
  const change = round(ltp - prevClose);
  const changePercent = prevClose ? round((change / prevClose) * 100) : 0;

  return normalizeLiveQuote(
    {
      symbol: preferredLabel ?? fallback?.symbol ?? meta.symbol,
      exchange: meta.fullExchangeName === 'BSE' ? 'BSE' : fallback?.exchange ?? DEFAULT_EXCHANGE,
      ...execution,
      open,
      high,
      low,
      prevClose,
      previousClose: prevClose,
      change,
      changePercent,
      volume,
      lastUpdated,
      source: LIVE_SOURCE,
      direction: deriveDirection(ltp, prevClose),
    },
    fallback,
  );
}

function buildDelayedQuote(fallback = {}, preferredLabel, exchange = DEFAULT_EXCHANGE) {
  return normalizeLiveQuote(
    {
      ...fallback,
      symbol: preferredLabel ?? fallback?.symbol,
      exchange: exchange ?? fallback?.exchange ?? DEFAULT_EXCHANGE,
      source: FALLBACK_SOURCE,
      stale: true,
      staleLabel: fallback?.lastUpdated ? 'Delayed' : 'Refreshing',
      lastUpdated: !isTimestampInvalid(fallback?.lastUpdated) ? fallback?.lastUpdated : null,
    },
    fallback,
  );
}

function selectBestMarketResult(definition, resultMap, previousCard) {
  const candidates = (definition.yahooSymbols ?? []).map((symbol) => {
    const result = resultMap[symbol];
    if (!result) {
      return null;
    }

    return buildQuoteFromSpark(result, previousCard, definition.label);
  });

  const fresh = candidates.find((candidate) => candidate && !candidate.stale);
  return fresh ?? candidates.find(Boolean) ?? null;
}

export function createReferenceLivePrices(stocks) {
  return (stocks ?? []).reduce((accumulator, stock) => {
    const execution = buildExecutionPrices(stock.currentPrice);
    const prevClose = round(stock.currentPrice / (1 + stock.dayChangePercent / 100));
    const open = round(stock.ohlc?.open ?? prevClose);
    const change = round(execution.ltp - prevClose);

    accumulator[stock.symbol] = normalizeLiveQuote(
      {
        symbol: stock.symbol,
        exchange: stock.exchange ?? DEFAULT_EXCHANGE,
        ...execution,
        open,
        high: round(stock.ohlc?.high ?? stock.currentPrice),
        low: round(stock.ohlc?.low ?? stock.currentPrice),
        prevClose,
        previousClose: prevClose,
        change,
        changePercent: stock.dayChangePercent,
        volume: stock.volume ?? 0,
        direction: deriveDirection(execution.ltp, prevClose),
        lastUpdated: stock.lastUpdated ?? null,
        source: FALLBACK_SOURCE,
        stale: true,
        staleLabel: 'Delayed',
      },
      stock,
    );

    return accumulator;
  }, {});
}

export function createReferenceMarketOverview() {
  return REFERENCE_MARKET_OVERVIEW.map((item) =>
    enrichMarketQuoteState({
      ...item,
      source: FALLBACK_SOURCE,
      stale: true,
      staleLabel: 'Refreshing',
      lastUpdated: null,
    }),
  );
}

export async function fetchLiveMarketSnapshot(stocks, previousLivePrices = {}, previousMarketOverview = []) {
  const stockSymbols = (stocks ?? [])
    .map((stock) => STOCK_SYMBOL_MAP[stock.symbol])
    .filter(Boolean);
  const marketSymbols = MARKET_INDEX_DEFINITIONS.flatMap((item) => item.yahooSymbols ?? []);
  const sparkSymbols = [...new Set([...stockSymbols, ...marketSymbols])];
  const payload = await fetchSparkPayload(sparkSymbols);
  const results = payload?.spark?.result ?? [];
  const resultMap = results.reduce((accumulator, item) => {
    accumulator[item.symbol] = item;
    return accumulator;
  }, {});

  const livePrices = (stocks ?? []).reduce((accumulator, stock) => {
    const yahooSymbol = STOCK_SYMBOL_MAP[stock.symbol];
    const result = yahooSymbol ? resultMap[yahooSymbol] : null;
    const fallback = previousLivePrices?.[stock.symbol] ?? stock.live ?? stock;

    accumulator[stock.symbol] = result
      ? buildQuoteFromSpark(result, fallback, stock.symbol)
      : buildDelayedQuote(fallback, stock.symbol, stock.exchange);

    return accumulator;
  }, {});

  const marketOverview = MARKET_INDEX_DEFINITIONS.map((definition) => {
    const previousCard = previousMarketOverview.find((item) => item.label === definition.label) ?? {};
    const quote = selectBestMarketResult(definition, resultMap, previousCard);

    if (!quote) {
      return enrichMarketQuoteState({
        ...previousCard,
        label: definition.label,
        symbol: definition.label,
        exchange: definition.exchange,
        source: FALLBACK_SOURCE,
        stale: true,
        staleLabel: 'Refreshing',
        lastUpdated: null,
        value: null,
        change: null,
        format: 'number',
      });
    }

    const normalizedQuote = quote.stale ? buildDelayedQuote(quote, definition.label, definition.exchange) : quote;

    if (import.meta.env.DEV) {
      console.debug('[market-index-quote]', {
        symbol: definition.label,
        ltp: normalizedQuote.ltp,
        fetchedTimestamp: normalizedQuote.lastUpdated,
        stale: normalizedQuote.stale,
        source: normalizedQuote.source,
      });
    }

    return enrichMarketQuoteState({
      label: definition.label,
      symbol: definition.label,
      value: normalizedQuote.stale ? normalizedQuote.ltp ?? null : normalizedQuote.ltp,
      ltp: normalizedQuote.stale ? normalizedQuote.ltp ?? null : normalizedQuote.ltp,
      change: normalizedQuote.changePercent,
      changePercent: normalizedQuote.changePercent,
      format: 'number',
      exchange: definition.exchange,
      source: normalizedQuote.source,
      lastUpdated: normalizedQuote.lastUpdated,
      stale: normalizedQuote.stale,
      staleLabel: normalizedQuote.staleLabel,
      marketStatus: normalizedQuote.marketStatus,
      marketStatusDetail: normalizedQuote.marketStatusDetail,
    });
  });

  return {
    livePrices,
    marketOverview,
    liveTicker: createLiveTicker(marketOverview),
    apiUsed: 'Yahoo Finance spark API',
  };
}

export function buildWatchlistPrices(watchlist, livePrices) {
  return (watchlist ?? []).reduce((accumulator, symbol) => {
    accumulator[symbol] = livePrices?.[symbol] ?? null;
    return accumulator;
  }, {});
}

export function createMarketPulse(marketOverview, livePrices) {
  const fallbackMap = new Map((marketOverview ?? []).map((item) => [item.label, item]));
  return createReferenceMarketOverview().map((item) => {
    const fallback = fallbackMap.get(item.label) ?? item;
    return enrichMarketQuoteState({
      ...item,
      ...fallback,
      source: fallback.source ?? FALLBACK_SOURCE,
      stale: fallback.stale ?? true,
      staleLabel: fallback.staleLabel ?? 'Delayed',
      lastUpdated: fallback.lastUpdated ?? null,
    });
  });
}

export function createLiveTicker(marketOverview) {
  return (marketOverview ?? []).map((item) => ({
    label: item.label,
    value: item.value,
    change: item.change,
    lastUpdated: item.lastUpdated,
    source: item.source,
    exchange: item.exchange,
    stale: item.stale ?? false,
    staleLabel: item.staleLabel ?? (item.stale ? 'Delayed' : 'Live'),
    marketStatus: item.marketStatus ?? 'UNKNOWN',
    marketStatusDetail: item.marketStatusDetail ?? null,
  }));
}

export function applyLivePricesToStocks(stocks, livePrices) {
  return (stocks ?? []).map((stock) => {
    const live = livePrices?.[stock.symbol];

    if (!live) {
      return stock;
    }

    const normalizedLive = normalizeLiveQuote(live, stock);

    return {
      ...stock,
      signal: stock.signal
        ? {
            ...stock.signal,
            tradePlan: {
              ...stock.signal.tradePlan,
              ...buildLiveTradePlan(stock, normalizedLive),
            },
          }
        : stock.signal,
      currentPrice: normalizedLive.ltp,
      dayChangePercent: normalizedLive.changePercent,
      volume: normalizedLive.volume,
      lastUpdated: normalizedLive.lastUpdated,
      live: {
        ...normalizedLive,
        debug:
          import.meta.env.DEV
            ? {
                symbol: normalizedLive.symbol ?? stock.symbol,
                ltp: normalizedLive.ltp,
                source: normalizedLive.source,
                timestamp: normalizedLive.lastUpdated,
                stale: normalizedLive.stale,
              }
            : undefined,
      },
      ohlc: {
        ...stock.ohlc,
        open: normalizedLive.open,
        high: normalizedLive.high,
        low: normalizedLive.low,
        close: normalizedLive.ltp,
      },
    };
  });
}
