import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoadingState from '@/components/LoadingState';
import AppLayout from '@/layouts/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';
import SellOpportunityPage from '@/pages/SellOpportunityPage';
import { useMarketStore } from '@/store/useMarketStore';

const LiveMonitorPage = lazy(() => import('@/pages/LiveMonitorPage'));
const BuyOpportunityPage = lazy(() => import('@/pages/BuyOpportunityPage'));
const BestEntryZonesPage = lazy(() => import('@/pages/BestEntryZonesPage'));
const OneHourPredictionPage = lazy(() => import('@/pages/OneHourPredictionPage'));
const StockAnalysisPage = lazy(() => import('@/pages/StockAnalysisPage'));
const PortfolioPage = lazy(() => import('@/pages/PortfolioPage'));
const WatchlistPage = lazy(() => import('@/pages/WatchlistPage'));
const AlertsPage = lazy(() => import('@/pages/AlertsPage'));
const SignalHistoryPage = lazy(() => import('@/pages/SignalHistoryPage'));
const BacktestingPage = lazy(() => import('@/pages/BacktestingPage'));
const OpportunityRadarPage = lazy(() => import('@/pages/OpportunityRadarPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function ErrorState({ message }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel max-w-lg p-6 text-center">
        <p className="metric-label">Load Error</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-white">Unable to load StockPulse</h1>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
      </div>
    </div>
  );
}

function App() {
  const initialize = useMarketStore((state) => state.initialize);
  const startLiveUpdates = useMarketStore((state) => state.startLiveUpdates);
  const stopLiveUpdates = useMarketStore((state) => state.stopLiveUpdates);
  const loading = useMarketStore((state) => state.loading);
  const error = useMarketStore((state) => state.error);
  const hasData = useMarketStore((state) => state.stocks.length > 0);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!hasData) {
      return undefined;
    }

    startLiveUpdates();

    return () => {
      stopLiveUpdates();
    };
  }, [hasData, startLiveUpdates, stopLiveUpdates]);

  if (loading && !hasData) {
    return (
      <div className="p-6">
        <LoadingState label="Loading StockPulse workspace..." />
      </div>
    );
  }

  if (error && !hasData) {
    return <ErrorState message={error} />;
  }

  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingState label="Loading view..." />
        </div>
      }
    >
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/monitor" element={<Navigate to="/live-monitor" replace />} />
          <Route path="/live-monitor" element={<LiveMonitorPage />} />
          <Route path="/buy-opportunities" element={<BuyOpportunityPage />} />
          <Route path="/best-entry-zones" element={<BestEntryZonesPage />} />
          <Route path="/one-hour-prediction" element={<OneHourPredictionPage />} />
          <Route path="/sell-opportunities" element={<SellOpportunityPage />} />
          <Route path="/analysis" element={<StockAnalysisPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/signals" element={<SignalHistoryPage />} />
          <Route path="/backtesting" element={<BacktestingPage />} />
          <Route path="/opportunity-radar" element={<OpportunityRadarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
