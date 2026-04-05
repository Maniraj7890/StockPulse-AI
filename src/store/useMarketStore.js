import { create } from 'zustand';
import {
  applyLivePricesToStocks,
  buildWatchlistPrices,
  createLiveTicker,
  createMarketPulse,
  fetchLiveMarketSnapshot,
} from '@/services/livePriceService';
import { LIVE_SOURCE } from '@/services/symbolMap';
import { getMarketAppData } from '@/services/marketService';
import { enrichMarketQuoteState, getRecommendedPollingInterval } from '@/utils/marketSession';
import {
  generateAlerts,
  generateOneHourAlerts,
  mergeAlerts,
  notifyBrowserAlerts,
  summarizeAlertCount,
} from '@/utils/alertEngine';
import { buildBacktestStats } from '@/utils/backtestEngine';
import { buildAlertSnapshot } from '@/utils/alertSystemEngine';
import { buildLearningProfile } from '@/utils/learningProfileEngine';
import { normalizeMarketDataSnapshot } from '@/utils/marketDataEngine';
import { enrichDecisionWithHistory } from '@/utils/decisionEngine';
import { buildHistoryOverview } from '@/utils/historyEngine';
import { buildMonitoringSnapshot } from '@/utils/monitoringEngine';
import {
  buildHoldingSnapshots,
  buildPersonalWatchlistSummary,
  buildPortfolioSummary,
  mergeHolding,
  moveWatchlistItem,
  removeHolding,
  updateHolding,
} from '@/utils/portfolioEngine';
import { recordSpikeHistory } from '@/utils/spikeDetectionEngine';
import {
  isPlainObject,
  isStringArray,
  loadVersionedState,
  removeVersionedState,
  saveVersionedState,
} from '@/utils/storage';
import {
  buildSignalHistorySummary,
  evaluateOneHourSignals,
  loadSignalHistory,
  recordOneHourSignals,
  saveSignalHistory,
} from '@/utils/signalHistoryEngine';
import {
  buildBestEntryZones,
  buildBuyZoneRows,
  buildDashboardSnapshot,
  buildIndexPredictions,
  buildOneHourPredictions,
  buildPredictionResultTracker,
  buildSellExitRows,
} from '@/utils/signalEngine';

const defaultSettings = {
  theme: 'dark',
  alertPreferences: 'all',
  watchlistPreferences: 'mixed',
  strategyMode: 'Balanced',
  signalSensitivity: 'balanced',
  riskProfile: 'moderate',
  aiExplanationsEnabled: 'disabled',
  refreshInterval: '5s',
  fastSignalRefreshInterval: '60s',
  strongConfirmationRefreshInterval: '300s',
  marketSession: 'NSE cash',
  showConfidenceAs: 'percent',
  devToolsEnabled: 'disabled',
};

const intervalMap = {
  '2s': 2000,
  '3s': 3000,
  '5s': 5000,
  '15s': 15000,
  '30s': 30000,
  '60s': 60000,
  '300s': 300000,
};

function staleWindowMs(refreshInterval) {
  return Math.max(refreshInterval * 2, 30000);
}

function annotateQuotes(quotes, refreshInterval) {
  const maxAge = staleWindowMs(refreshInterval);

  return Object.entries(quotes ?? {}).reduce((accumulator, [symbol, quote]) => {
    accumulator[symbol] = enrichMarketQuoteState(
      {
        ...quote,
        source: quote?.source ?? LIVE_SOURCE,
      },
      { refreshInterval: maxAge },
    );

    return accumulator;
  }, {});
}

function mapBySymbol(stocks) {
  return (stocks ?? []).reduce((accumulator, stock) => {
    accumulator[stock.symbol] = stock;
    return accumulator;
  }, {});
}

function getTimestampValue(value) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isValidQuoteValue(quote) {
  const price = quote?.ltp ?? quote?.price;
  return Number.isFinite(price) && price > 0;
}

function mergeFreshQuote(nextQuote, currentQuote) {
  if (!isValidQuoteValue(nextQuote)) {
    return currentQuote ?? null;
  }

  if (!isValidQuoteValue(currentQuote)) {
    return nextQuote;
  }

  const nextTimestamp = getTimestampValue(nextQuote?.lastUpdated);
  const currentTimestamp = getTimestampValue(currentQuote?.lastUpdated);

  if (!nextTimestamp) {
    return currentQuote;
  }

  if (!currentTimestamp || nextTimestamp >= currentTimestamp) {
    return nextQuote;
  }

  return currentQuote;
}

function mergeFreshQuotes(nextQuotes = {}, currentQuotes = {}) {
  const symbols = new Set([...Object.keys(currentQuotes ?? {}), ...Object.keys(nextQuotes ?? {})]);

  return Array.from(symbols).reduce((accumulator, symbol) => {
    const mergedQuote = mergeFreshQuote(nextQuotes?.[symbol], currentQuotes?.[symbol]);

    if (mergedQuote) {
      accumulator[symbol] = mergedQuote;
    }

    return accumulator;
  }, {});
}

function getMarketCardPrice(card) {
  const value = card?.ltp ?? card?.value;
  return Number.isFinite(value) ? value : null;
}

function mergeFreshMarketCard(nextCard, currentCard) {
  if (getMarketCardPrice(nextCard) == null && !nextCard?.lastUpdated) {
    return currentCard ?? null;
  }

  if (getMarketCardPrice(currentCard) == null && !currentCard?.lastUpdated) {
    return nextCard ?? null;
  }

  const nextTimestamp = getTimestampValue(nextCard?.lastUpdated);
  const currentTimestamp = getTimestampValue(currentCard?.lastUpdated);

  if (!nextTimestamp) {
    return currentCard ?? nextCard ?? null;
  }

  if (!currentTimestamp || nextTimestamp >= currentTimestamp) {
    return nextCard ?? null;
  }

  return currentCard ?? null;
}

function mergeFreshMarketOverview(nextOverview = [], currentOverview = []) {
  const currentMap = new Map((currentOverview ?? []).map((item) => [item.label, item]));
  const nextMap = new Map((nextOverview ?? []).map((item) => [item.label, item]));
  const labels = new Set([...currentMap.keys(), ...nextMap.keys()]);

  return Array.from(labels)
    .map((label) => mergeFreshMarketCard(nextMap.get(label), currentMap.get(label)))
    .filter(Boolean);
}

function buildMarketDataMap({ livePrices, marketOverview, analysisData }) {
  const marketData = {};

  Object.entries(livePrices ?? {}).forEach(([symbol, quote]) => {
    marketData[symbol] = {
      key: symbol,
      kind: 'stock',
      latest: {
        ...quote,
        marketStatus: quote?.marketStatus ?? 'UNKNOWN',
      },
      analysis: analysisData?.[symbol] ?? null,
    };
  });

  (marketOverview ?? []).forEach((item) => {
    marketData[item.label] = {
      key: item.label,
      kind: 'index',
      latest: {
        ...item,
        symbol: item.label,
        ltp: item.value,
        marketStatus: item?.marketStatus ?? 'UNKNOWN',
      },
      analysis: null,
    };
  });

  return marketData;
}

function syncRowWithQuote(row, quote, stock) {
  if (!quote && !stock) {
    return row;
  }

  const liveQuote = quote ?? stock?.live;
  const ltp = liveQuote?.ltp ?? liveQuote?.price ?? stock?.currentPrice ?? row.currentPrice ?? row.livePrice;
  const tradePlan = stock?.signal?.tradePlan ?? row.signal?.tradePlan;

  return {
    ...row,
    currentPrice: ltp,
    livePrice: ltp,
    currentChangePercent: liveQuote?.changePercent ?? row.currentChangePercent,
    lastUpdated: liveQuote?.lastUpdated ?? row.lastUpdated,
    live: liveQuote
      ? {
          ...(row.live ?? {}),
          ...liveQuote,
          symbol: liveQuote.symbol ?? row.symbol ?? stock?.symbol,
          exchange: liveQuote.exchange ?? stock?.exchange ?? 'NSE',
          ltp,
          open: liveQuote.open ?? stock?.ohlc?.open ?? row.open,
          high: liveQuote.high ?? liveQuote.dayHigh ?? stock?.ohlc?.high ?? row.high,
          low: liveQuote.low ?? liveQuote.dayLow ?? stock?.ohlc?.low ?? row.low,
          prevClose: liveQuote.prevClose ?? liveQuote.previousClose ?? row.prevClose ?? ltp,
          change: liveQuote.change ?? row.change ?? 0,
          changePercent: liveQuote.changePercent ?? row.currentChangePercent ?? 0,
          volume: liveQuote.volume ?? row.volume ?? 0,
          lastUpdated: liveQuote.lastUpdated ?? row.lastUpdated ?? stock?.lastUpdated,
          stale: liveQuote.stale ?? liveQuote.isStale ?? false,
          staleLabel: liveQuote.staleLabel ?? null,
          marketStatus: liveQuote.marketStatus ?? null,
          marketStatusDetail: liveQuote.marketStatusDetail ?? null,
          source: liveQuote.source ?? LIVE_SOURCE,
          price: ltp,
          previousClose: liveQuote.prevClose ?? liveQuote.previousClose ?? row.prevClose ?? ltp,
          dayHigh: liveQuote.high ?? liveQuote.dayHigh ?? stock?.ohlc?.high ?? row.high,
          dayLow: liveQuote.low ?? liveQuote.dayLow ?? stock?.ohlc?.low ?? row.low,
        }
      : row.live,
    idealEntryZone: tradePlan?.idealEntry ?? row.idealEntryZone,
    idealEntryPrice: tradePlan?.idealEntry ?? row.idealEntryPrice,
    stopLoss: tradePlan?.stopLoss ?? row.stopLoss,
    target: tradePlan?.target1 ?? row.target,
    signal: row.signal
      ? {
          ...row.signal,
          tradePlan: tradePlan ? { ...(row.signal.tradePlan ?? {}), ...tradePlan } : row.signal.tradePlan,
        }
      : row.signal,
  };
}

function syncRowsWithQuotes(rows, livePrices, analysisMap) {
  return (rows ?? []).map((row) => syncRowWithQuote(row, livePrices?.[row.symbol], analysisMap?.[row.symbol]));
}

function buildTrackedPredictions(predictions, watchlist, timestamp = null) {
  return (predictions ?? []).map((item) => ({
    ...item,
    lastUpdated: item?.lastUpdated ?? timestamp ?? null,
    isWatchlistStock: watchlist.includes(item.symbol),
  }));
}

function enrichStocksWithDecisionHistory(stocks, signalHistory) {
  return (stocks ?? []).map((stock) => ({
    ...stock,
    decision: enrichDecisionWithHistory(stock.decision, signalHistory, stock.symbol),
    signal: stock.signal
      ? {
          ...stock.signal,
          decision: enrichDecisionWithHistory(stock.signal.decision, signalHistory, stock.symbol),
        }
      : stock.signal,
  }));
}

function enrichRowsWithDecisionHistory(rows, signalHistory) {
  return (rows ?? []).map((row) => ({
    ...row,
    decision: enrichDecisionWithHistory(row.decision, signalHistory, row.symbol),
    signal: row.signal
      ? {
          ...row.signal,
          decision: enrichDecisionWithHistory(row.signal.decision, signalHistory, row.symbol),
        }
      : row.signal,
  }));
}

const STORAGE_VERSION = 1;
const PORTFOLIO_STORAGE = { namespace: 'portfolio-holdings', legacyKeys: ['stockpulse.portfolio-holdings.v1'] };
const WATCHLIST_STORAGE = { namespace: 'watchlist', legacyKeys: ['stockpulse.watchlist.v1'] };
const PINNED_STORAGE = { namespace: 'pinned-stocks', legacyKeys: ['stockpulse.pinned-stocks.v1'] };
const PRICE_ALERTS_STORAGE = { namespace: 'price-alerts', legacyKeys: ['stockpulse.price-alerts.v1'] };
const SETTINGS_STORAGE = { namespace: 'settings', legacyKeys: ['stockpulse.settings.v1'] };

function sanitizeWatchlist(value, fallback = []) {
  if (!isStringArray(value)) return fallback;
  return Array.from(new Set(value.map((item) => item.trim().toUpperCase()).filter(Boolean)));
}

function sanitizePinnedStocks(value, fallback = []) {
  return sanitizeWatchlist(value, fallback);
}

function sanitizePriceAlerts(value) {
  if (!isPlainObject(value)) return {};

  return Object.entries(value).reduce((accumulator, [symbol, alerts]) => {
    if (!Array.isArray(alerts)) return accumulator;

    const safeAlerts = alerts
      .filter((item) => isPlainObject(item))
      .map((item) => ({
        id: String(item.id ?? `${symbol}-${item.direction ?? 'above'}-${item.price ?? 0}`),
        price: Number(item.price),
        direction: item.direction === 'below' ? 'below' : 'above',
      }))
      .filter((item) => Number.isFinite(item.price) && item.price > 0);

    if (safeAlerts.length) {
      accumulator[symbol.trim().toUpperCase()] = safeAlerts;
    }

    return accumulator;
  }, {});
}

function sanitizePortfolioHoldings(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => isPlainObject(item))
    .map((item, index) => ({
      id: String(item.id ?? `${item.symbol ?? 'holding'}-${index}`),
      symbol: String(item.symbol ?? '').trim().toUpperCase(),
      quantity: Number(item.quantity),
      averageBuyPrice: Number(item.averageBuyPrice),
    }))
    .filter((item) => item.symbol && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.averageBuyPrice) && item.averageBuyPrice > 0);
}

function sanitizeSettings(value) {
  if (!isPlainObject(value)) return defaultSettings;

  return {
    ...defaultSettings,
    ...Object.fromEntries(
      Object.entries(value).filter(([key, settingValue]) => key in defaultSettings && typeof settingValue === 'string'),
    ),
  };
}

function loadStoreValue(config, fallback, sanitize) {
  return loadVersionedState(config.namespace, {
    version: STORAGE_VERSION,
    fallback,
    legacyKeys: config.legacyKeys,
    validate: sanitize,
    migrate: sanitize,
  });
}

function saveStoreValue(config, value) {
  saveVersionedState(config.namespace, value, STORAGE_VERSION);
}

function clearStoreValue(config) {
  removeVersionedState(config.namespace, STORAGE_VERSION, config.legacyKeys);
}

function buildDefaultPortfolioSummary() {
  return {
    totalInvested: 0,
    currentValue: 0,
    totalPnL: 0,
    totalReturnPercent: 0,
    bestHolding: null,
    worstHolding: null,
    highRiskHolding: null,
    strongestWatchlistOpportunity: null,
    relevantAlerts: [],
  };
}

function buildDefaultWatchlistSummary() {
  return {
    total: 0,
    bestOpportunity: null,
    breakoutWatch: [],
    avoid: [],
    spikeActive: [],
    highRisk: [],
    alerts: [],
  };
}

let liveIntervalId = null;
let fastSignalIntervalId = null;
let strongConfirmationIntervalId = null;
let liveRefreshInFlight = false;
let liveRefreshRequestId = 0;

export const useMarketStore = create((set, get) => ({
  stocks: [],
  analysisData: {},
  selectedStock: 'RELIANCE',
  watchlist: loadStoreValue(WATCHLIST_STORAGE, ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'], (value) => sanitizeWatchlist(value, ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'])),
  pinnedStocks: loadStoreValue(PINNED_STORAGE, ['RELIANCE', 'ICICIBANK'], (value) => sanitizePinnedStocks(value, ['RELIANCE', 'ICICIBANK'])),
  alerts: [],
  alertCount: 0,
  spikeHistory: [],
  priceAlerts: loadStoreValue(PRICE_ALERTS_STORAGE, {}, sanitizePriceAlerts),
  portfolioHoldings: loadStoreValue(PORTFOLIO_STORAGE, [], sanitizePortfolioHoldings),
  portfolioSummary: buildDefaultPortfolioSummary(),
  personalWatchlistSummary: buildDefaultWatchlistSummary(),
  signalHistory: [],
  signalHistorySummary: {
    totalSignals: 0,
    evaluatedSignals: 0,
    overallAccuracy: 0,
    wins: 0,
    losses: 0,
    bestSetupType: 'N/A',
    worstSetupType: 'N/A',
    setupAccuracy: {
      breakoutAccuracy: 0,
      pullbackAccuracy: 0,
      reversalAccuracy: 0,
      breakdownAccuracy: 0,
    },
    bySymbol: {},
  },
  learningProfile: {
    overallAccuracy: 0,
    setupAccuracy: {},
    directionAccuracy: {},
    symbolAccuracy: {},
  },
  predictionResults: [],
  backtestStats: null,
  dashboardSnapshot: {
    cards: [],
    sentiment: { label: '', summary: '', bullishCount: 0, neutralCount: 0, bearishCount: 0 },
    topGainers: [],
    topLosers: [],
    opportunities: [],
    risks: [],
  },
  oneHourPredictions: [],
  bestEntryZones: [],
  buyZoneRows: [],
  sellExitRows: [],
  predictionTracker: [],
  indexPredictions: [],
  monitoringSnapshot: {
    watchlistPulse: [],
    movers: [],
    unusuallyActiveNames: [],
    stableNames: [],
    weakNames: [],
    spikeEvents: [],
    indicesPulse: [],
    marketTone: 'Neutral',
    marketContext: {
      marketBias: 'neutral',
      volatilityState: 'normal',
      sessionQuality: 'clean',
    },
    lastUpdated: null,
  },
  marketDataSnapshot: {
    quotes: [],
    watchlistQuotes: {},
    sourceStatus: {
      totalSymbols: 0,
      freshSymbols: 0,
      staleSymbols: 0,
      activeIndices: 0,
    },
  },
  alertSnapshot: {
    activeAlerts: [],
    triggeredAlerts: [],
    expiredAlerts: [],
    lastChecked: null,
  },
  historyOverview: {
    totalSignals: 0,
    evaluatedSignals: 0,
    overallAccuracy: 0,
    wins: 0,
    losses: 0,
    pendingSignals: 0,
    averageConfidence: 0,
    bestSetupType: 'N/A',
    worstSetupType: 'N/A',
    setupAccuracy: {},
    directionAccuracy: {},
    bySymbol: {},
    latestSignals: [],
  },
  marketOverview: [],
  marketData: {},
  data: {},
  liveTicker: [],
  apiUsed: 'Yahoo Finance spark API',
  livePrices: {},
  watchlistPrices: {},
  lastUpdated: null,
  lastAlertCheck: null,
  lastPredictionUpdated: null,
  lastStrongConfirmationUpdated: null,
  isLiveMode: false,
  refreshInterval: 5000,
  fastSignalRefreshInterval: 60000,
  strongConfirmationRefreshInterval: 300000,
  settings: loadStoreValue(SETTINGS_STORAGE, defaultSettings, sanitizeSettings),
  loading: false,
  error: null,
  initialize: async () => {
    if (get().stocks.length) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const payload = await getMarketAppData();
      const persistedSignalHistory = loadSignalHistory();
      const strategyMode = get().settings.strategyMode;
      const livePrices = annotateQuotes(payload.livePrices ?? {}, get().refreshInterval);
      const stocks = applyLivePricesToStocks(payload.stocks, livePrices);
      const analysisMap = mapBySymbol(stocks);
      const dashboardSnapshot = buildDashboardSnapshot(stocks);
      const backtestAccuracy = payload.backtestStats?.accuracy ?? 58;
      const predictionTimestamp = Object.values(livePrices)[0]?.lastUpdated ?? new Date().toISOString();
      const enrichedPredictions = buildTrackedPredictions(
        buildOneHourPredictions(stocks, dashboardSnapshot.sentiment, strategyMode, {
          backtestAccuracy,
        }),
        get().watchlist,
        predictionTimestamp,
      );
      const syncedPredictions = syncRowsWithQuotes(enrichedPredictions, livePrices, analysisMap);
      const signalHistory = evaluateOneHourSignals(
        recordOneHourSignals(persistedSignalHistory.length ? persistedSignalHistory : payload.signalHistory ?? [], syncedPredictions, { timestamp: predictionTimestamp }),
        livePrices,
        { now: predictionTimestamp },
      );
      const signalHistorySummary = buildSignalHistorySummary(signalHistory);
      const learningProfile = buildLearningProfile(signalHistory);
      const enrichedStocks = enrichStocksWithDecisionHistory(stocks, signalHistory);
      const enrichedAnalysisMap = mapBySymbol(enrichedStocks);
      const learnedPredictions = syncRowsWithQuotes(
        buildTrackedPredictions(
          buildOneHourPredictions(enrichedStocks, dashboardSnapshot.sentiment, strategyMode, {
            backtestAccuracy,
            learningProfile,
          }),
          get().watchlist,
          predictionTimestamp,
        ),
        livePrices,
        enrichedAnalysisMap,
      );
      const unifiedData = buildMarketDataMap({
        livePrices,
        marketOverview: payload.marketOverview ?? createMarketPulse([], livePrices),
        analysisData: enrichedAnalysisMap,
      });
      const marketDataSnapshot = normalizeMarketDataSnapshot({
        livePrices,
        marketOverview: payload.marketOverview ?? createMarketPulse([], livePrices),
        watchlist: get().watchlist,
      });
      const monitoringSnapshot = buildMonitoringSnapshot({
        stocks: enrichedStocks,
        previousStocks: [],
        oneHourPredictions: learnedPredictions,
        watchlist: get().watchlist,
        marketOverview: payload.marketOverview ?? createMarketPulse([], livePrices),
        lastUpdated: predictionTimestamp,
      });
      const historyOverview = buildHistoryOverview(signalHistory);
      const alertSnapshot = buildAlertSnapshot(payload.alerts ?? [], get().priceAlerts, predictionTimestamp);
      const portfolioHoldings = loadStoreValue(PORTFOLIO_STORAGE, get().portfolioHoldings ?? [], sanitizePortfolioHoldings);
      const bestEntryZones = enrichRowsWithDecisionHistory(syncRowsWithQuotes(buildBestEntryZones(enrichedStocks, strategyMode), livePrices, enrichedAnalysisMap), signalHistory);
      const buyZoneRows = enrichRowsWithDecisionHistory(syncRowsWithQuotes(buildBuyZoneRows(enrichedStocks, strategyMode), livePrices, enrichedAnalysisMap), signalHistory);
      const sellExitRows = enrichRowsWithDecisionHistory(syncRowsWithQuotes(buildSellExitRows(enrichedStocks, strategyMode), livePrices, enrichedAnalysisMap), signalHistory);
      const holdingsSnapshot = buildHoldingSnapshots(portfolioHoldings, enrichedAnalysisMap, payload.alerts ?? []);
      const personalWatchlistSummary = buildPersonalWatchlistSummary(
        (get().watchlist ?? []).map((symbol) => enrichedAnalysisMap[symbol]).filter(Boolean),
        payload.alerts ?? [],
      );
      const portfolioSummary = buildPortfolioSummary(
        holdingsSnapshot,
        (get().watchlist ?? []).map((symbol) => enrichedAnalysisMap[symbol]).filter(Boolean),
        payload.alerts ?? [],
      );

      set({
        loading: false,
        stocks: enrichedStocks,
        analysisData: enrichedAnalysisMap,
        signalHistory,
        signalHistorySummary,
        learningProfile,
        predictionResults: payload.backtestStats?.recentPredictions ?? [],
        backtestStats: payload.backtestStats,
        dashboardSnapshot,
        oneHourPredictions: learnedPredictions,
        bestEntryZones,
        buyZoneRows,
        sellExitRows,
        predictionTracker: buildPredictionResultTracker(syncedPredictions),
        monitoringSnapshot,
        marketDataSnapshot,
        alertSnapshot,
        historyOverview,
        marketOverview: payload.marketOverview ?? createMarketPulse([], livePrices),
        marketData: unifiedData,
        data: unifiedData,
        indexPredictions: buildIndexPredictions(payload.marketOverview ?? createMarketPulse([], livePrices)),
        liveTicker: payload.liveTicker ?? createLiveTicker(payload.marketOverview ?? createMarketPulse([], livePrices)),
        apiUsed: payload.apiUsed ?? 'Yahoo Finance spark API',
        alerts: payload.alerts ?? [],
        alertCount: summarizeAlertCount(payload.alerts ?? []),
        spikeHistory: [],
        portfolioHoldings,
        portfolioSummary,
        personalWatchlistSummary,
        livePrices,
        watchlistPrices: buildWatchlistPrices(get().watchlist, livePrices),
        lastUpdated: Object.values(livePrices)[0]?.lastUpdated ?? null,
        lastAlertCheck: Object.values(livePrices)[0]?.lastUpdated ?? null,
        lastPredictionUpdated: Object.values(livePrices)[0]?.lastUpdated ?? null,
        lastStrongConfirmationUpdated: Object.values(livePrices)[0]?.lastUpdated ?? null,
      });
      saveSignalHistory(signalHistory);
    } catch (error) {
      set({ loading: false, error: error.message ?? 'Unable to load market dashboard.' });
    }
  },
  applyLiveUpdate: (nextLivePrices, nextMarketOverview, nextLiveTicker) => {
    const state = get();
    const annotatedPrices = mergeFreshQuotes(
      annotateQuotes(nextLivePrices, state.refreshInterval),
      state.livePrices,
    );
    const marketOverview = mergeFreshMarketOverview(
      nextMarketOverview ?? createMarketPulse(state.marketOverview, annotatedPrices),
      state.marketOverview,
    );
    const predictionTimestamp =
      Object.values(annotatedPrices ?? {}).reduce(
        (latest, quote) => Math.max(latest, getTimestampValue(quote?.lastUpdated)),
        0,
      ) > 0
        ? new Date(
            Object.values(annotatedPrices ?? {}).reduce((latest, quote) => {
              const quoteTimestamp = getTimestampValue(quote?.lastUpdated);
              return quoteTimestamp > latest ? quoteTimestamp : latest;
            }, 0),
          ).toISOString()
        : state.lastUpdated ?? new Date().toISOString();

    if (getTimestampValue(state.lastUpdated) > getTimestampValue(predictionTimestamp)) {
      return;
    }

    const updatedStocks = applyLivePricesToStocks(state.stocks, annotatedPrices);
    const analysisData = mapBySymbol(updatedStocks);
    const nextDashboardSnapshot = buildDashboardSnapshot(updatedStocks);
    const emittedAlerts = generateAlerts({
      previousStocks: state.stocks,
      currentStocks: updatedStocks,
      priceAlerts: state.priceAlerts,
      timestamp: predictionTimestamp,
    });
    const alerts = mergeAlerts(state.alerts, emittedAlerts);
    const liveTicker = nextLiveTicker ?? createLiveTicker(marketOverview);

    if (emittedAlerts.length) {
      notifyBrowserAlerts(emittedAlerts);
    }
    const signalHistory = evaluateOneHourSignals(
      state.signalHistory,
      annotatedPrices,
      { now: predictionTimestamp },
    );
    const signalHistorySummary = buildSignalHistorySummary(signalHistory);
    const learningProfile = buildLearningProfile(signalHistory);
    const enrichedStocks = enrichStocksWithDecisionHistory(updatedStocks, signalHistory);
    const enrichedAnalysisData = mapBySymbol(enrichedStocks);
    const unifiedData = buildMarketDataMap({
      livePrices: annotatedPrices,
      marketOverview,
      analysisData: enrichedAnalysisData,
    });
    const learnedPredictions = syncRowsWithQuotes(
      buildTrackedPredictions(
        buildOneHourPredictions(enrichedStocks, nextDashboardSnapshot.sentiment, state.settings.strategyMode, {
          backtestAccuracy: backtestStats?.accuracy ?? 58,
          learningProfile,
        }),
        state.watchlist,
        predictionTimestamp,
      ),
      annotatedPrices,
      enrichedAnalysisData,
    );
    const marketDataSnapshot = normalizeMarketDataSnapshot({
      livePrices: annotatedPrices,
      marketOverview,
      watchlist: state.watchlist,
    });
    const historyOverview = buildHistoryOverview(signalHistory);
    const alertSnapshot = buildAlertSnapshot(alerts, state.priceAlerts, predictionTimestamp);
    const oneHourPredictions = enrichRowsWithDecisionHistory(
      syncRowsWithQuotes(state.oneHourPredictions, annotatedPrices, enrichedAnalysisData),
      signalHistory,
    );
    const bestEntryZones = enrichRowsWithDecisionHistory(
      syncRowsWithQuotes(state.bestEntryZones, annotatedPrices, enrichedAnalysisData),
      signalHistory,
    );
    const buyZoneRows = enrichRowsWithDecisionHistory(
      syncRowsWithQuotes(state.buyZoneRows, annotatedPrices, enrichedAnalysisData),
      signalHistory,
    );
    const sellExitRows = enrichRowsWithDecisionHistory(
      syncRowsWithQuotes(state.sellExitRows, annotatedPrices, enrichedAnalysisData),
      signalHistory,
    );
    const watchlistRows = state.watchlist.map((symbol) => enrichedAnalysisData[symbol]).filter(Boolean);
    const portfolioHoldings = state.portfolioHoldings ?? [];
    const holdingsSnapshot = buildHoldingSnapshots(portfolioHoldings, enrichedAnalysisData, alerts);
    const personalWatchlistSummary = buildPersonalWatchlistSummary(watchlistRows, alerts);
    const portfolioSummary = buildPortfolioSummary(holdingsSnapshot, watchlistRows, alerts);

    set({
      stocks: enrichedStocks,
      analysisData: enrichedAnalysisData,
      livePrices: annotatedPrices,
      watchlistPrices: buildWatchlistPrices(state.watchlist, annotatedPrices),
      lastUpdated: Object.values(annotatedPrices ?? {})[0]?.lastUpdated ?? state.lastUpdated,
      lastAlertCheck: Object.values(annotatedPrices ?? {})[0]?.lastUpdated ?? state.lastAlertCheck,
      marketOverview,
      marketData: unifiedData,
      data: unifiedData,
      indexPredictions: buildIndexPredictions(marketOverview),
      liveTicker,
      dashboardSnapshot: nextDashboardSnapshot,
      oneHourPredictions,
      marketDataSnapshot,
      alertSnapshot,
      historyOverview,
      bestEntryZones,
      buyZoneRows,
      sellExitRows,
      signalHistory,
      signalHistorySummary,
      learningProfile,
      alerts,
      alertCount: summarizeAlertCount(alerts),
      spikeHistory: recordSpikeHistory(state.spikeHistory, alerts),
      portfolioSummary,
      personalWatchlistSummary,
    });
    saveSignalHistory(signalHistory);
  },
  recalculatePredictions: (strength = 'fast') => {
    const state = get();
    const nextDashboardSnapshot = buildDashboardSnapshot(state.stocks);
    const nextBacktestStats = buildBacktestStats(state.stocks);
    const predictionTimestamp = state.lastUpdated ?? new Date().toISOString();
    const nextOneHourPredictions = buildTrackedPredictions(
      buildOneHourPredictions(state.stocks, nextDashboardSnapshot.sentiment, state.settings.strategyMode, {
        backtestAccuracy: nextBacktestStats?.accuracy ?? state.backtestStats?.accuracy ?? 58,
      }),
      state.watchlist,
      predictionTimestamp,
    );
    const oneHourAlerts = generateOneHourAlerts({
      previousPredictions: state.oneHourPredictions,
      currentPredictions: nextOneHourPredictions,
      timestamp: predictionTimestamp,
    });
    const alerts = mergeAlerts(state.alerts, oneHourAlerts);
    if (oneHourAlerts.length) {
      notifyBrowserAlerts(oneHourAlerts);
    }
    const signalHistory = evaluateOneHourSignals(
      recordOneHourSignals(state.signalHistory, nextOneHourPredictions, { timestamp: predictionTimestamp }),
      state.livePrices,
      { now: predictionTimestamp },
    );
    const signalHistorySummary = buildSignalHistorySummary(signalHistory);
    const learningProfile = buildLearningProfile(signalHistory);
    const enrichedStocks = enrichStocksWithDecisionHistory(state.stocks, signalHistory);
    const learnedPredictions = buildTrackedPredictions(
      buildOneHourPredictions(enrichedStocks, nextDashboardSnapshot.sentiment, state.settings.strategyMode, {
        backtestAccuracy: nextBacktestStats?.accuracy ?? state.backtestStats?.accuracy ?? 58,
        learningProfile,
      }),
      state.watchlist,
      predictionTimestamp,
    );
    const monitoringSnapshot = buildMonitoringSnapshot({
      stocks: enrichedStocks,
      previousStocks: state.stocks,
      oneHourPredictions: learnedPredictions,
      watchlist: state.watchlist,
      marketOverview: state.marketOverview,
      lastUpdated: predictionTimestamp,
    });
    const historyOverview = buildHistoryOverview(signalHistory);
    const alertSnapshot = buildAlertSnapshot(alerts, state.priceAlerts, predictionTimestamp);
    const analysisData = mapBySymbol(enrichedStocks);
    const watchlistRows = state.watchlist.map((symbol) => analysisData[symbol]).filter(Boolean);
    const bestEntryZones = enrichRowsWithDecisionHistory(buildBestEntryZones(enrichedStocks, state.settings.strategyMode), signalHistory);
    const buyZoneRows = enrichRowsWithDecisionHistory(buildBuyZoneRows(enrichedStocks, state.settings.strategyMode), signalHistory);
    const sellExitRows = enrichRowsWithDecisionHistory(buildSellExitRows(enrichedStocks, state.settings.strategyMode), signalHistory);
    const holdingsSnapshot = buildHoldingSnapshots(state.portfolioHoldings ?? [], analysisData, alerts);
    const personalWatchlistSummary = buildPersonalWatchlistSummary(watchlistRows, alerts);
    const portfolioSummary = buildPortfolioSummary(holdingsSnapshot, watchlistRows, alerts);

    set({
      dashboardSnapshot: nextDashboardSnapshot,
      stocks: enrichedStocks,
      analysisData,
      oneHourPredictions: learnedPredictions,
      monitoringSnapshot,
      alertSnapshot,
      historyOverview,
      bestEntryZones,
      buyZoneRows,
      sellExitRows,
      predictionTracker: buildPredictionResultTracker(learnedPredictions),
      predictionResults: nextBacktestStats.recentPredictions,
      backtestStats: nextBacktestStats,
      signalHistory,
      signalHistorySummary,
      learningProfile,
      spikeHistory: recordSpikeHistory(state.spikeHistory, alerts),
      alerts,
      alertCount: summarizeAlertCount(alerts),
      portfolioSummary,
      personalWatchlistSummary,
      lastAlertCheck: predictionTimestamp,
      lastPredictionUpdated: predictionTimestamp,
      lastStrongConfirmationUpdated:
        strength === 'strong'
          ? predictionTimestamp
          : state.lastStrongConfirmationUpdated,
    });
    saveSignalHistory(signalHistory);
  },
  refreshOneHourPredictions: () => {
    const state = get();
    const predictionTimestamp = state.lastUpdated ?? new Date().toISOString();
    const predictions = buildTrackedPredictions(
      buildOneHourPredictions(state.stocks, state.dashboardSnapshot.sentiment, state.settings.strategyMode, {
        backtestAccuracy: state.backtestStats?.accuracy ?? 58,
      }),
      state.watchlist,
      predictionTimestamp,
    );
    const oneHourAlerts = generateOneHourAlerts({
      previousPredictions: state.oneHourPredictions,
      currentPredictions: predictions,
      timestamp: predictionTimestamp,
    });
    const alerts = mergeAlerts(state.alerts, oneHourAlerts);
    if (oneHourAlerts.length) {
      notifyBrowserAlerts(oneHourAlerts);
    }
    const signalHistory = evaluateOneHourSignals(
      recordOneHourSignals(state.signalHistory, predictions, { timestamp: predictionTimestamp }),
      state.livePrices,
      { now: predictionTimestamp },
    );
    const signalHistorySummary = buildSignalHistorySummary(signalHistory);
    const learningProfile = buildLearningProfile(signalHistory);
    const enrichedStocks = enrichStocksWithDecisionHistory(state.stocks, signalHistory);
    const learnedPredictions = buildTrackedPredictions(
      buildOneHourPredictions(enrichedStocks, state.dashboardSnapshot.sentiment, state.settings.strategyMode, {
        backtestAccuracy: state.backtestStats?.accuracy ?? 58,
        learningProfile,
      }),
      state.watchlist,
      predictionTimestamp,
    );
    const monitoringSnapshot = buildMonitoringSnapshot({
      stocks: enrichedStocks,
      previousStocks: state.stocks,
      oneHourPredictions: learnedPredictions,
      watchlist: state.watchlist,
      marketOverview: state.marketOverview,
      lastUpdated: predictionTimestamp,
    });
    const historyOverview = buildHistoryOverview(signalHistory);
    const alertSnapshot = buildAlertSnapshot(alerts, state.priceAlerts, predictionTimestamp);
    const analysisData = mapBySymbol(enrichedStocks);
    const watchlistRows = state.watchlist.map((symbol) => analysisData[symbol]).filter(Boolean);
    const bestEntryZones = enrichRowsWithDecisionHistory(buildBestEntryZones(enrichedStocks, state.settings.strategyMode), signalHistory);
    const buyZoneRows = enrichRowsWithDecisionHistory(buildBuyZoneRows(enrichedStocks, state.settings.strategyMode), signalHistory);
    const sellExitRows = enrichRowsWithDecisionHistory(buildSellExitRows(enrichedStocks, state.settings.strategyMode), signalHistory);
    const holdingsSnapshot = buildHoldingSnapshots(state.portfolioHoldings ?? [], analysisData, alerts);
    const personalWatchlistSummary = buildPersonalWatchlistSummary(watchlistRows, alerts);
    const portfolioSummary = buildPortfolioSummary(holdingsSnapshot, watchlistRows, alerts);
    set({
      oneHourPredictions: learnedPredictions,
      stocks: enrichedStocks,
      analysisData,
      monitoringSnapshot,
      alertSnapshot,
      historyOverview,
      predictionTracker: buildPredictionResultTracker(learnedPredictions),
      signalHistory,
      signalHistorySummary,
      learningProfile,
      spikeHistory: recordSpikeHistory(state.spikeHistory, alerts),
      bestEntryZones,
      buyZoneRows,
      sellExitRows,
      alerts,
      alertCount: summarizeAlertCount(alerts),
      portfolioSummary,
      personalWatchlistSummary,
      lastAlertCheck: predictionTimestamp,
    });
    saveSignalHistory(signalHistory);
  },
  refreshBestEntryZones: () => {
    const state = get();
    set({
      bestEntryZones: enrichRowsWithDecisionHistory(buildBestEntryZones(state.stocks, state.settings.strategyMode), state.signalHistory),
      buyZoneRows: enrichRowsWithDecisionHistory(buildBuyZoneRows(state.stocks, state.settings.strategyMode), state.signalHistory),
      sellExitRows: enrichRowsWithDecisionHistory(buildSellExitRows(state.stocks, state.settings.strategyMode), state.signalHistory),
    });
  },
  refreshLivePrices: () => {
    if (liveRefreshInFlight) {
      return;
    }

    liveRefreshInFlight = true;
    const state = get();
    const requestId = liveRefreshRequestId + 1;
    liveRefreshRequestId = requestId;

    fetchLiveMarketSnapshot(state.stocks, state.livePrices, state.marketOverview)
      .then((snapshot) => {
        if (requestId !== liveRefreshRequestId) {
          return;
        }
        get().applyLiveUpdate(snapshot.livePrices, snapshot.marketOverview, snapshot.liveTicker);
        set({ apiUsed: snapshot.apiUsed ?? state.apiUsed, error: null });
      })
      .catch((error) => {
        if (requestId !== liveRefreshRequestId) {
          return;
        }
        set({
          error: error.message ?? 'Unable to refresh live market data right now.',
        });
      })
      .finally(() => {
        liveRefreshInFlight = false;
      });
  },
  startLiveUpdates: () => {
    const state = get();
    if (!Object.keys(state.livePrices ?? {}).length) {
      set({ isLiveMode: true });
      return;
    }

    const referenceStatus =
      state.data?.NIFTY?.latest?.marketStatus ??
      Object.values(state.livePrices ?? {})[0]?.marketStatus ??
      'UNKNOWN';
    const quoteRefreshInterval = getRecommendedPollingInterval(referenceStatus, state.refreshInterval);

    if (!liveIntervalId) {
      liveIntervalId = setInterval(() => {
        get().refreshLivePrices();
      }, quoteRefreshInterval);
    }

    if (!fastSignalIntervalId) {
      fastSignalIntervalId = setInterval(() => {
        get().recalculatePredictions('fast');
      }, state.fastSignalRefreshInterval);
    }

    if (!strongConfirmationIntervalId) {
      strongConfirmationIntervalId = setInterval(() => {
        get().recalculatePredictions('strong');
      }, state.strongConfirmationRefreshInterval);
    }

    set({ isLiveMode: true });
  },
  stopLiveUpdates: () => {
    if (liveIntervalId) {
      clearInterval(liveIntervalId);
      liveIntervalId = null;
    }
    if (fastSignalIntervalId) {
      clearInterval(fastSignalIntervalId);
      fastSignalIntervalId = null;
    }
    if (strongConfirmationIntervalId) {
      clearInterval(strongConfirmationIntervalId);
      strongConfirmationIntervalId = null;
    }
    set({ isLiveMode: false });
  },
  refreshNow: () => {
    get().refreshLivePrices();
    get().recalculatePredictions('fast');
  },
  setRefreshInterval: (refreshInterval) => {
    const wasLive = get().isLiveMode;
    get().stopLiveUpdates();
    set({ refreshInterval });
    if (wasLive) {
      get().startLiveUpdates();
    }
  },
  setSelectedStock: (symbol) => set({ selectedStock: symbol }),
  toggleWatchlist: (symbol) =>
    set((state) => {
      const nextWatchlist = state.watchlist.includes(symbol)
        ? state.watchlist.filter((item) => item !== symbol)
        : [...state.watchlist, symbol];
      saveStoreValue(WATCHLIST_STORAGE, nextWatchlist);
      const watchlistRows = nextWatchlist.map((item) => state.analysisData[item]).filter(Boolean);

      return {
        watchlist: nextWatchlist,
        watchlistPrices: buildWatchlistPrices(nextWatchlist, state.livePrices),
        personalWatchlistSummary: buildPersonalWatchlistSummary(watchlistRows, state.alerts),
        portfolioSummary: buildPortfolioSummary(
          buildHoldingSnapshots(state.portfolioHoldings ?? [], state.analysisData, state.alerts),
          watchlistRows,
          state.alerts,
        ),
        oneHourPredictions: state.oneHourPredictions.map((item) => ({
          ...item,
          isWatchlistStock: nextWatchlist.includes(item.symbol),
        })),
      };
    }),
  togglePin: (symbol) =>
    set((state) => {
      const nextPinned = state.pinnedStocks.includes(symbol)
        ? state.pinnedStocks.filter((item) => item !== symbol)
        : [...state.pinnedStocks, symbol];
      saveStoreValue(PINNED_STORAGE, nextPinned);
      return {
        pinnedStocks: nextPinned,
      };
    }),
  toggleAlert: (alertId) =>
    set((state) => {
      const alerts = state.alerts.filter((alert) => alert.id !== alertId);
      return {
        alerts,
        alertCount: summarizeAlertCount(alerts),
        alertSnapshot: buildAlertSnapshot(alerts, state.priceAlerts, state.lastAlertCheck),
      };
    }),
  clearAlerts: () =>
    set((state) => ({
      alerts: [],
      alertCount: 0,
      alertSnapshot: buildAlertSnapshot([], state.priceAlerts, state.lastAlertCheck),
    })),
  addPriceAlert: (symbol, price, direction = 'above') =>
    set((state) => {
      const priceAlerts = {
        ...state.priceAlerts,
        [symbol]: [
          ...(state.priceAlerts[symbol] ?? []),
          {
            id: `${symbol}-${direction}-${price}`,
            price,
            direction,
          },
        ],
      };
      saveStoreValue(PRICE_ALERTS_STORAGE, priceAlerts);
      return {
        priceAlerts,
        alertSnapshot: buildAlertSnapshot(state.alerts, priceAlerts, state.lastAlertCheck),
      };
    }),
  removePriceAlert: (symbol, alertId) =>
    set((state) => {
      const priceAlerts = {
        ...state.priceAlerts,
        [symbol]: (state.priceAlerts[symbol] ?? []).filter((item) => item.id !== alertId),
      };
      saveStoreValue(PRICE_ALERTS_STORAGE, priceAlerts);
      return {
        priceAlerts,
        alertSnapshot: buildAlertSnapshot(state.alerts, priceAlerts, state.lastAlertCheck),
      };
    }),
  addHolding: ({ symbol, quantity, averageBuyPrice }) =>
    set((state) => {
      const nextHoldings = mergeHolding(state.portfolioHoldings ?? [], {
        symbol,
        quantity,
        averageBuyPrice,
      });
      saveStoreValue(PORTFOLIO_STORAGE, nextHoldings);
      const holdingsSnapshot = buildHoldingSnapshots(nextHoldings, state.analysisData, state.alerts);
      return {
        portfolioHoldings: nextHoldings,
        portfolioSummary: buildPortfolioSummary(
          holdingsSnapshot,
          state.watchlist.map((item) => state.analysisData[item]).filter(Boolean),
          state.alerts,
        ),
      };
    }),
  editHolding: (holdingId, updates) =>
    set((state) => {
      const nextHoldings = updateHolding(state.portfolioHoldings ?? [], holdingId, updates);
      saveStoreValue(PORTFOLIO_STORAGE, nextHoldings);
      const holdingsSnapshot = buildHoldingSnapshots(nextHoldings, state.analysisData, state.alerts);
      return {
        portfolioHoldings: nextHoldings,
        portfolioSummary: buildPortfolioSummary(
          holdingsSnapshot,
          state.watchlist.map((item) => state.analysisData[item]).filter(Boolean),
          state.alerts,
        ),
      };
    }),
  removeHolding: (holdingId) =>
    set((state) => {
      const nextHoldings = removeHolding(state.portfolioHoldings ?? [], holdingId);
      saveStoreValue(PORTFOLIO_STORAGE, nextHoldings);
      const holdingsSnapshot = buildHoldingSnapshots(nextHoldings, state.analysisData, state.alerts);
      return {
        portfolioHoldings: nextHoldings,
        portfolioSummary: buildPortfolioSummary(
          holdingsSnapshot,
          state.watchlist.map((item) => state.analysisData[item]).filter(Boolean),
          state.alerts,
        ),
      };
    }),
  addWatchlistSymbol: (symbol) =>
    set((state) => {
      if (state.watchlist.includes(symbol)) {
        return {};
      }
      const nextWatchlist = [...state.watchlist, symbol];
      saveStoreValue(WATCHLIST_STORAGE, nextWatchlist);
      const watchlistRows = nextWatchlist.map((item) => state.analysisData[item]).filter(Boolean);
      return {
        watchlist: nextWatchlist,
        watchlistPrices: buildWatchlistPrices(nextWatchlist, state.livePrices),
        personalWatchlistSummary: buildPersonalWatchlistSummary(watchlistRows, state.alerts),
        portfolioSummary: buildPortfolioSummary(
          buildHoldingSnapshots(state.portfolioHoldings ?? [], state.analysisData, state.alerts),
          watchlistRows,
          state.alerts,
        ),
      };
    }),
  moveWatchlistItem: (symbol, direction) =>
    set((state) => {
      const nextWatchlist = moveWatchlistItem(state.watchlist ?? [], symbol, direction);
      saveStoreValue(WATCHLIST_STORAGE, nextWatchlist);
      const watchlistRows = nextWatchlist.map((item) => state.analysisData[item]).filter(Boolean);
      return {
        watchlist: nextWatchlist,
        personalWatchlistSummary: buildPersonalWatchlistSummary(watchlistRows, state.alerts),
        portfolioSummary: buildPortfolioSummary(
          buildHoldingSnapshots(state.portfolioHoldings ?? [], state.analysisData, state.alerts),
          watchlistRows,
          state.alerts,
        ),
      };
    }),
  requestNotificationPermission: async () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return 'unsupported';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    return Notification.requestPermission();
  },
  updateSetting: (key, value) =>
    set((state) => {
      const nextSettings = {
        ...state.settings,
        [key]: value,
      };
      saveStoreValue(SETTINGS_STORAGE, nextSettings);

      if (key === 'strategyMode') {
        const enrichedStocks = enrichStocksWithDecisionHistory(state.stocks, state.signalHistory);
        const trackedPredictions = buildTrackedPredictions(
          buildOneHourPredictions(enrichedStocks, state.dashboardSnapshot.sentiment, value, {
            backtestAccuracy: state.backtestStats?.accuracy ?? 58,
            learningProfile: state.learningProfile,
          }),
          state.watchlist,
          state.lastUpdated ?? new Date().toISOString(),
        );

          return {
            settings: nextSettings,
            stocks: enrichedStocks,
            analysisData: mapBySymbol(enrichedStocks),
            oneHourPredictions: trackedPredictions,
            bestEntryZones: enrichRowsWithDecisionHistory(buildBestEntryZones(enrichedStocks, value), state.signalHistory),
            buyZoneRows: enrichRowsWithDecisionHistory(buildBuyZoneRows(enrichedStocks, value), state.signalHistory),
            sellExitRows: enrichRowsWithDecisionHistory(buildSellExitRows(enrichedStocks, value), state.signalHistory),
            predictionTracker: buildPredictionResultTracker(trackedPredictions),
          };
      }

      if (key === 'refreshInterval' || key === 'fastSignalRefreshInterval' || key === 'strongConfirmationRefreshInterval') {
        const nextState = {
          settings: nextSettings,
          refreshInterval:
            key === 'refreshInterval' ? intervalMap[value] ?? state.refreshInterval : state.refreshInterval,
          fastSignalRefreshInterval:
            key === 'fastSignalRefreshInterval'
              ? intervalMap[value] ?? state.fastSignalRefreshInterval
              : state.fastSignalRefreshInterval,
          strongConfirmationRefreshInterval:
            key === 'strongConfirmationRefreshInterval'
              ? intervalMap[value] ?? state.strongConfirmationRefreshInterval
              : state.strongConfirmationRefreshInterval,
        };

        setTimeout(() => {
          if (get().isLiveMode) {
            get().stopLiveUpdates();
            get().startLiveUpdates();
          }
        }, 0);

        return nextState;
      }

      return {
        settings: nextSettings,
      };
    }),
  resetUserWorkspace: () =>
    set((state) => {
      clearStoreValue(PORTFOLIO_STORAGE);
      clearStoreValue(WATCHLIST_STORAGE);
      clearStoreValue(PINNED_STORAGE);
      clearStoreValue(PRICE_ALERTS_STORAGE);
      clearStoreValue(SETTINGS_STORAGE);
      saveSignalHistory([]);

      return {
        watchlist: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'],
        pinnedStocks: ['RELIANCE', 'ICICIBANK'],
        watchlistPrices: buildWatchlistPrices(['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'], state.livePrices),
        priceAlerts: {},
        portfolioHoldings: [],
        portfolioSummary: buildDefaultPortfolioSummary(),
        personalWatchlistSummary: buildDefaultWatchlistSummary(),
        settings: defaultSettings,
        signalHistory: [],
        signalHistorySummary: buildSignalHistorySummary([]),
        historyOverview: buildHistoryOverview([]),
        learningProfile: buildLearningProfile([]),
        predictionResults: [],
        alerts: [],
        alertCount: 0,
        alertSnapshot: buildAlertSnapshot([], {}, state.lastAlertCheck),
      };
    }),
}));
