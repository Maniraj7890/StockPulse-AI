import AIExplanationCard from '@/components/AIExplanationCard';
import GainersTable from '@/components/GainersTable';
import IndexPredictionCards from '@/components/IndexPredictionCards';
import LosersTable from '@/components/LosersTable';
import LiveBadge from '@/components/LiveBadge';
import MarketOverviewCards from '@/components/MarketOverviewCards';
import MarketSentimentCard from '@/components/MarketSentimentCard';
import ScannerList from '@/components/ScannerList';
import SectionHeader from '@/components/SectionHeader';
import WatchlistTable from '@/components/WatchlistTable';
import { useLiveMarketData } from '@/hooks/useLiveMarketData';
import { useMarketStore } from '@/store/useMarketStore';
import { formatCurrency, formatDateTime, formatPercent } from '@/utils/formatters';

function DashboardPage() {
  const dashboardSnapshot = useMarketStore((state) => state.dashboardSnapshot);
  const analysisData = useMarketStore((state) => state.analysisData ?? {});
  const watchlist = useMarketStore((state) => state.watchlist);
  const toggleWatchlist = useMarketStore((state) => state.toggleWatchlist);
  const isLiveMode = useMarketStore((state) => state.isLiveMode);
  const indexPredictions = useMarketStore((state) => state.indexPredictions ?? []);
  const monitoringSnapshot = useMarketStore((state) => state.monitoringSnapshot);
  const alertSnapshot = useMarketStore((state) => state.alertSnapshot);
  const historyOverview = useMarketStore((state) => state.historyOverview);
  const portfolioSummary = useMarketStore((state) => state.portfolioSummary);
  const personalWatchlistSummary = useMarketStore((state) => state.personalWatchlistSummary);
  const pinnedStocks = useMarketStore((state) => state.pinnedStocks ?? []);
  const togglePin = useMarketStore((state) => state.togglePin);
  const moveWatchlistItem = useMarketStore((state) => state.moveWatchlistItem);
  const { marketOverview, marketStatus, lastUpdated } = useLiveMarketData();
  const topOpportunity = dashboardSnapshot.opportunities?.[0] ?? null;
  const watchlistStocks = (watchlist ?? []).map((symbol) => analysisData[symbol]).filter(Boolean);
  const trackedIndices = ['NIFTY', 'SENSEX', 'BANKNIFTY', 'MIDCAP'];
  const indexContext = trackedIndices
    .map((label) => {
      const overviewItem = marketOverview.find((item) => item.label === label);
      const prediction = indexPredictions.find((item) => item.label === label);
      return {
        symbol: label,
        trend:
          prediction?.signal === 'BUY'
            ? 'up'
            : prediction?.signal === 'SELL'
              ? 'down'
              : 'sideways',
        momentum:
          (overviewItem?.change ?? 0) > 0.15
            ? 'positive'
            : (overviewItem?.change ?? 0) < -0.15
              ? 'negative'
              : 'mixed',
        marketStatus: overviewItem?.marketStatus ?? 'UNKNOWN',
        confidence: prediction?.confidence ?? 0,
        signal: prediction?.signal ?? 'HOLD',
        reasons: prediction?.reasons ?? [],
        change: overviewItem?.change ?? 0,
      };
    })
    .filter((item) => item.symbol);
  const primaryIndexPrediction = indexPredictions.find((item) => item.label === 'NIFTY') ?? indexPredictions[0] ?? null;
  const biggestRisk = dashboardSnapshot.risks?.[0] ?? null;
  const averageIndexConfidence = indexContext.length
    ? Math.round(indexContext.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / indexContext.length)
    : topOpportunity?.signal?.confidence ?? 0;
  const aggregateMomentum = indexContext.length
    ? Number((indexContext.reduce((sum, item) => sum + (item.change ?? 0), 0) / indexContext.length).toFixed(2))
    : topOpportunity?.dayChangePercent ?? 0;
  const dashboardExplanationPayload = {
    explanationType: 'dashboard_summary',
    symbol: primaryIndexPrediction?.label ?? 'NIFTY',
    marketStatus: primaryIndexPrediction?.marketStatus ?? marketStatus,
    prediction: primaryIndexPrediction
      ? {
          signal: primaryIndexPrediction.signal,
          confidence: primaryIndexPrediction.confidence,
          trend: primaryIndexPrediction.trend,
          riskLevel: primaryIndexPrediction.riskLevel,
          reasons: primaryIndexPrediction.reasons,
          indicators: primaryIndexPrediction.indicators,
        }
      : null,
    signal: primaryIndexPrediction?.signal ?? 'HOLD',
    confidence: primaryIndexPrediction?.confidence ?? averageIndexConfidence,
    trend: primaryIndexPrediction?.trend ?? (aggregateMomentum > 0.15 ? 'up' : aggregateMomentum < -0.15 ? 'down' : 'sideways'),
    momentum: aggregateMomentum,
    indices: indexContext,
    marketTone: dashboardSnapshot.sentiment?.summary ?? monitoringSnapshot.marketTone,
    topBullish: (dashboardSnapshot.opportunities ?? []).slice(0, 3).map((item) => item.symbol),
    topBearish: (dashboardSnapshot.risks ?? []).slice(0, 3).map((item) => item.symbol),
    noTradeNames: (monitoringSnapshot.weakNames ?? []).slice(0, 3).map((item) => item.symbol),
    lastUpdated,
  };
  const dashboardFallbackExplanation = {
    summary: 'Signal is based on the current rule engine output.',
    riskNote:
      marketStatus === 'OPEN'
        ? 'Live market session is active, but confirmation still depends on trend and momentum quality.'
        : 'Market is closed; using last session data.',
    actionBias: topOpportunity?.signal?.signal === 'BUY' ? 'Buy bias with confirmation checks.' : 'Wait for market confirmation.',
    reasons: [
      topOpportunity?.indicators?.ema9 != null && topOpportunity?.indicators?.ema21 != null
        ? topOpportunity.indicators.ema9 >= topOpportunity.indicators.ema21
          ? 'EMA trend supports the current bias'
          : 'EMA trend mixed'
        : 'EMA trend mixed',
      topOpportunity?.dayChangePercent != null && topOpportunity.dayChangePercent >= 0
        ? 'Momentum moderate'
        : 'Momentum cautious',
      marketStatus === 'OPEN' ? 'Live session confirmation available' : 'No live session confirmation',
    ],
  };

  return (
    <div className="page-shell">
      <SectionHeader
        eyebrow="Dashboard"
        title="Indian market decision-support dashboard"
        description="Track market tone, watchlist signals, short-term bias, breakout candidates, and risk-heavy names from one premium workspace."
        action={<LiveBadge status={marketStatus} />}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="panel panel-hover p-5">
          <p className="metric-label">Market Status</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{marketStatus ?? 'Awaiting status'}</h3>
          <p className="mt-2 text-sm text-slate-400">{lastUpdated ? `Last market update ${formatDateTime(lastUpdated)}` : 'Waiting for the latest quote snapshot.'}</p>
        </div>
        <div className="panel panel-hover p-5">
          <p className="metric-label">Strongest Opportunity</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{topOpportunity?.symbol ?? '--'}</h3>
          <p className="mt-2 text-sm text-slate-400">{topOpportunity?.decision?.finalDecision ?? topOpportunity?.signal?.signal ?? 'No clean opportunity yet'}</p>
        </div>
        <div className="panel panel-hover p-5">
          <p className="metric-label">Biggest Risk</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{biggestRisk?.symbol ?? '--'}</h3>
          <p className="mt-2 text-sm text-slate-400">{biggestRisk?.decision?.risk?.riskLevel ?? 'No major risk flag'} / {biggestRisk?.decision?.finalDecision ?? 'WAIT'}</p>
        </div>
        <div className="panel panel-hover p-5">
          <p className="metric-label">Portfolio Snapshot</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{formatCurrency(portfolioSummary?.currentValue ?? 0)}</h3>
          <p className="mt-2 text-sm text-slate-400">{formatPercent(portfolioSummary?.totalReturnPercent ?? 0)} unrealized return</p>
        </div>
        <div className="panel panel-hover p-5">
          <p className="metric-label">Recent Outcomes</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{historyOverview.completedSignals ?? 0}</h3>
          <p className="mt-2 text-sm text-slate-400">{historyOverview.overallAccuracy ?? 0}% historical rule-engine accuracy</p>
        </div>
      </div>

      <div className="panel panel-hover p-5">
        <p className="metric-label">Live Market Pulse</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Market overview and watchlist pulse</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Live pricing is {isLiveMode ? 'active' : 'paused'}. {lastUpdated ? `Last update ${formatDateTime(lastUpdated)}.` : ''}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Market Tone</p>
            <p className="mt-2 text-white">{monitoringSnapshot.marketTone ?? dashboardSnapshot.sentiment?.label ?? 'Neutral'}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Active Names</p>
            <p className="mt-2 text-white">{monitoringSnapshot.unusuallyActiveNames?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Recent Alerts</p>
            <p className="mt-2 text-white">{alertSnapshot.triggeredAlerts?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Recent Outcomes</p>
            <p className="mt-2 text-white">{historyOverview.completedSignals ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <p className="metric-label">Personal Dashboard</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Portfolio and watchlist focus</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Total Invested</p>
            <p className="mt-2 text-white">{formatCurrency(portfolioSummary?.totalInvested ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Portfolio Value</p>
            <p className="mt-2 text-white">{formatCurrency(portfolioSummary?.currentValue ?? 0)}</p>
            <p className="mt-1 text-sm text-slate-500">{formatPercent(portfolioSummary?.totalReturnPercent ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Best Holding</p>
            <p className="mt-2 text-white">{portfolioSummary?.bestHolding?.symbol ?? '--'}</p>
            <p className="mt-1 text-sm text-slate-500">{portfolioSummary?.bestHolding ? formatPercent(portfolioSummary.bestHolding.pnlPercent) : 'Add holdings to track'}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Strongest Watchlist</p>
            <p className="mt-2 text-white">{personalWatchlistSummary?.bestOpportunity?.symbol ?? '--'}</p>
            <p className="mt-1 text-sm text-slate-500">{personalWatchlistSummary?.bestOpportunity?.decision?.finalDecision ?? 'No clear edge yet'}</p>
          </div>
        </div>
      </div>

      <MarketOverviewCards />

      <div className="space-y-4">
        <SectionHeader
          eyebrow="Index Signals"
          title="Rule-based index pulse"
          description="Short-term index view derived from the same unified market store. Educational only, not investment advice."
        />
        <AIExplanationCard
          title="AI Explanation"
          eyebrow="AI Market Summary"
          payload={dashboardExplanationPayload}
          fallbackExplanation={dashboardFallbackExplanation}
          className="mt-2"
        />
        <IndexPredictionCards items={indexPredictions} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <MarketSentimentCard sentiment={dashboardSnapshot.sentiment} marketContext={monitoringSnapshot.marketContext} />
        <ScannerList title="Strong opportunities" eyebrow="Momentum" rows={dashboardSnapshot.opportunities} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <GainersTable rows={dashboardSnapshot.topGainers} />
        <LosersTable rows={dashboardSnapshot.topLosers} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <WatchlistTable rows={watchlistStocks} onRemove={toggleWatchlist} onMove={moveWatchlistItem} onTogglePin={togglePin} pinnedStocks={pinnedStocks} />
        <ScannerList title="Risk zone stocks" eyebrow="Risk" rows={dashboardSnapshot.risks} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <p className="metric-label">Recent Triggered Alerts</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Monitoring highlights</h3>
          <div className="mt-4 space-y-3">
            {(alertSnapshot.triggeredAlerts ?? []).slice(0, 4).map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
                <p className="text-sm font-semibold text-white">{alert.symbol} - {alert.type}</p>
                <p className="mt-1 text-sm text-slate-400">{alert.message}</p>
              </div>
            ))}
            {!(alertSnapshot.triggeredAlerts ?? []).length ? (
              <p className="rounded-2xl border border-dashed border-border/70 bg-panel-soft/40 p-4 text-sm text-slate-500">
                No triggered alerts right now. The monitoring layer will surface important events here first.
              </p>
            ) : null}
          </div>
        </div>
        <div className="panel p-5">
          <p className="metric-label">Recent Signal Outcomes</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Latest completed evaluations</h3>
          <div className="mt-4 space-y-3">
            {(historyOverview.latestSignals ?? []).filter((item) => item.outcome && item.outcome !== 'PENDING').slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
                <p className="text-sm font-semibold text-white">{item.symbol} / {item.setupFamily ?? item.setupType}</p>
                <p className="mt-1 text-sm text-slate-400">{item.outcome} / {item.confidence}% confidence / {item.actionSummary}</p>
              </div>
            ))}
            {!((historyOverview.latestSignals ?? []).filter((item) => item.outcome && item.outcome !== 'PENDING').length) ? (
              <p className="rounded-2xl border border-dashed border-border/70 bg-panel-soft/40 p-4 text-sm text-slate-500">
                Completed signal reviews will appear here once enough time has passed to evaluate them fairly.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
