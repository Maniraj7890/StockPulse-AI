import { mockStocks } from '@/data/mockStocks';
import {
  createLiveTicker,
  createReferenceLivePrices,
  createReferenceMarketOverview,
  fetchLiveMarketSnapshot,
} from '@/services/livePriceService';
import { buildBacktestStats } from '@/utils/backtestEngine';
import { buildDashboardSnapshot, buildStockAnalysis } from '@/utils/signalEngine';

function createAnalysisMap(stocks) {
  return stocks.reduce((accumulator, stock) => {
    const analysis = buildStockAnalysis(stock);
    accumulator[stock.symbol] = analysis;
    return accumulator;
  }, {});
}

export async function getMarketAppData() {
  const analysisMap = createAnalysisMap(mockStocks);
  const stocks = Object.values(analysisMap);
  const fallbackLivePrices = createReferenceLivePrices(stocks);
  const fallbackMarketOverview = createReferenceMarketOverview();
  let livePrices = fallbackLivePrices;
  let marketOverview = fallbackMarketOverview;
  let liveTicker = createLiveTicker(fallbackMarketOverview);
  let apiUsed = 'Yahoo Finance spark API';

  try {
    const snapshot = await fetchLiveMarketSnapshot(stocks, fallbackLivePrices, fallbackMarketOverview);
    livePrices = snapshot.livePrices;
    marketOverview = snapshot.marketOverview;
    liveTicker = snapshot.liveTicker;
    apiUsed = snapshot.apiUsed;
  } catch (error) {
    apiUsed = 'Yahoo Finance spark API (fallback to reference data)';
  }

  return {
    stocks,
    analysisMap,
    dashboardSnapshot: buildDashboardSnapshot(stocks),
    signalHistory: [],
    backtestStats: buildBacktestStats(mockStocks),
    alerts: [],
    marketOverview,
    liveTicker,
    livePrices,
    apiUsed,
  };
}
