import { useMemo } from 'react';
import LiveBadge from '@/components/LiveBadge';
import LivePriceGrid from '@/components/LivePriceGrid';
import SectionHeader from '@/components/SectionHeader';
import { useLiveMarketData } from '@/hooks/useLiveMarketData';
import { useMarketStore } from '@/store/useMarketStore';
import { formatDateTime } from '@/utils/formatters';

function LiveMonitorPage() {
  const stocks = useMarketStore((state) => state.stocks ?? []);
  const pinnedStocks = useMarketStore((state) => (Array.isArray(state.pinnedStocks) ? state.pinnedStocks : []));
  const togglePin = useMarketStore((state) => state.togglePin);
  const startLiveUpdates = useMarketStore((state) => state.startLiveUpdates);
  const stopLiveUpdates = useMarketStore((state) => state.stopLiveUpdates);
  const refreshInterval = useMarketStore((state) => state.refreshInterval);
  const fastSignalRefreshInterval = useMarketStore((state) => state.fastSignalRefreshInterval);
  const strongConfirmationRefreshInterval = useMarketStore((state) => state.strongConfirmationRefreshInterval);
  const lastPredictionUpdated = useMarketStore((state) => state.lastPredictionUpdated);
  const lastStrongConfirmationUpdated = useMarketStore((state) => state.lastStrongConfirmationUpdated);
  const monitoringSnapshot = useMarketStore((state) => state.monitoringSnapshot ?? {});
  const {
    isLiveMode,
    lastUpdated,
    livePrices,
    marketStatus,
    marketStatusDetail,
    marketStatusExplanation,
    refreshNow,
  } = useLiveMarketData();

  const quoteList = useMemo(() => Object.values(livePrices ?? {}), [livePrices]);
  const staleCount = quoteList.filter((quote) => quote?.stale).length;
  const sourceLabel = quoteList[0]?.source ?? 'Live market data';
  const exchangeLabel = quoteList[0]?.exchange ?? 'NSE';
  const marketStatusLabel = marketStatus ?? 'UNKNOWN';
  const activeSpikeCount = monitoringSnapshot.spikeEvents?.length ?? 0;
  const strongestSpike = monitoringSnapshot.spikeEvents?.[0] ?? null;
  const spikeMap = useMemo(
    () =>
      (monitoringSnapshot.watchlistPulse ?? [])
        .concat(monitoringSnapshot.movers ?? [])
        .concat(monitoringSnapshot.spikeEvents ?? [])
        .reduce((accumulator, item) => {
          accumulator[item.symbol] = item;
          return accumulator;
        }, {}),
    [monitoringSnapshot.movers, monitoringSnapshot.spikeEvents, monitoringSnapshot.watchlistPulse],
  );

  const liveRows = useMemo(
    () =>
      [...stocks]
        .map((stock) => ({
          ...stock,
          spike: spikeMap[stock.symbol]?.spike ?? null,
          monitoringTag: spikeMap[stock.symbol]?.monitoringTag ?? 'QUIET',
          attentionFlag: spikeMap[stock.symbol]?.attentionFlag ?? 'NORMAL',
          attentionReason: spikeMap[stock.symbol]?.attentionReason ?? null,
        }))
        .sort((a, b) => {
          const aPinned = pinnedStocks.includes(a.symbol) ? 1 : 0;
          const bPinned = pinnedStocks.includes(b.symbol) ? 1 : 0;
          return (
            bPinned - aPinned ||
            (b.live?.changePercent ?? b.dayChangePercent) - (a.live?.changePercent ?? a.dayChangePercent)
          );
        }),
    [pinnedStocks, spikeMap, stocks],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Live Monitor"
        title="Watch price action in real time"
        description="Monitor pinned stocks, live movement, momentum, quick signal status, and intraday price range changes."
        action={<LiveBadge status={marketStatusLabel} />}
      />

      {marketStatusExplanation.bannerText ? (
        <div className="panel border-amber-400/20 bg-amber-400/8 p-5 text-sm leading-7 text-slate-300">
          <p className="font-medium text-amber-200">{marketStatusExplanation.bannerText}</p>
          <p className="mt-2">{marketStatusExplanation.reason}</p>
          {marketStatusExplanation.freshnessNote ? <p className="mt-2">{marketStatusExplanation.freshnessNote}</p> : null}
          {marketStatusExplanation.lastValidSessionTimestamp ? (
            <p className="mt-2">Last valid session: {formatDateTime(marketStatusExplanation.lastValidSessionTimestamp)}</p>
          ) : null}
          {marketStatusExplanation.nextExpectedLiveSession ? (
            <p className="mt-2">Next live session: {marketStatusExplanation.nextExpectedLiveSession}</p>
          ) : null}
        </div>
      ) : null}

      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="metric-label">Monitoring Controls</p>
            <p className="mt-2 text-sm text-slate-400">
              Live prices refresh every {Math.round(refreshInterval / 1000)} seconds. Fast signals refresh every{' '}
              {Math.round(fastSignalRefreshInterval / 1000)} seconds. Strong confirmation refreshes every{' '}
              {Math.round(strongConfirmationRefreshInterval / 1000)} seconds.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Live updated {lastUpdated ? formatDateTime(lastUpdated) : '--'} / Predictions updated{' '}
              {lastPredictionUpdated ? formatDateTime(lastPredictionUpdated) : '--'} / Strong confirmation{' '}
              {lastStrongConfirmationUpdated ? formatDateTime(lastStrongConfirmationUpdated) : '--'}.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Exchange: {exchangeLabel} / Source: {sourceLabel} / {staleCount ? `${staleCount} delayed quotes` : 'All quotes fresh in current window'}.
            </p>
            <p className="mt-2 text-sm text-slate-500">Market status: {marketStatusDetail ?? marketStatusLabel}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={startLiveUpdates}
              className="rounded-full border border-emerald-400/40 bg-emerald-400/12 px-4 py-2 text-sm text-emerald-200"
            >
              Start monitoring
            </button>
            <button
              onClick={stopLiveUpdates}
              className="rounded-full border border-rose-400/40 bg-rose-400/12 px-4 py-2 text-sm text-rose-200"
            >
              Stop monitoring
            </button>
            <button
              onClick={refreshNow}
              className="rounded-full border border-border/70 px-4 py-2 text-sm text-slate-300"
            >
              Refresh now
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Active Spike Events</p>
          <p className="mt-2 text-lg font-semibold text-white">{activeSpikeCount}</p>
          <p className="mt-1 text-sm text-slate-500">Adaptive spike engine only flags meaningful live-session moves</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Strongest Spike</p>
          <p className="mt-2 text-lg font-semibold text-white">{strongestSpike?.symbol ?? '--'}</p>
          <p className="mt-1 text-sm text-slate-500">
            {strongestSpike?.spike?.spikeType ? `${strongestSpike.spike.spikeType.replace(/_/g, ' ')} / ${strongestSpike.spike.spikeSeverity}` : 'No active spike event'}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Action Note</p>
          <p className="mt-2 text-lg font-semibold text-white">{strongestSpike?.spike?.actionNote ?? 'Monitor'}</p>
          <p className="mt-1 text-sm text-slate-500">{strongestSpike?.spike?.confirmationReason ?? 'No abnormal expansion is active right now.'}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">HOT</p>
          <p className="mt-2 text-lg font-semibold text-white">{monitoringSnapshot.hotNames?.length ?? 0}</p>
          <p className="mt-1 text-sm text-slate-500">Strong movement with higher setup quality</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">WATCH</p>
          <p className="mt-2 text-lg font-semibold text-white">{monitoringSnapshot.stableNames?.length ?? 0}</p>
          <p className="mt-1 text-sm text-slate-500">Moderate setups needing confirmation</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">QUIET</p>
          <p className="mt-2 text-lg font-semibold text-white">{monitoringSnapshot.weakNames?.length ?? 0}</p>
          <p className="mt-1 text-sm text-slate-500">Low-movement names with no urgent edge</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">AVOID</p>
          <p className="mt-2 text-lg font-semibold text-white">{monitoringSnapshot.avoidNames?.length ?? 0}</p>
          <p className="mt-1 text-sm text-slate-500">Poor or unstable setups where discipline matters most</p>
        </div>
      </div>

      <LivePriceGrid rows={liveRows} pinnedStocks={pinnedStocks} onTogglePin={togglePin} isLiveMode={isLiveMode} />
    </div>
  );
}

export default LiveMonitorPage;
