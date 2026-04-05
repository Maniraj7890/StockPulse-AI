import BacktestSummaryCard from '@/components/BacktestSummaryCard';
import SectionHeader from '@/components/SectionHeader';
import { useMarketStore } from '@/store/useMarketStore';

function SummaryCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
      <p className="metric-label">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

function formatPercentValue(value) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function bucketLabel(summary) {
  const buckets = Object.entries(summary?.confidenceBuckets ?? {});
  if (!buckets.length) return 'N/A';
  const [label] =
    buckets.sort((left, right) => (right[1]?.accuracyPercent ?? 0) - (left[1]?.accuracyPercent ?? 0))[0] ?? [];
  return label ?? 'N/A';
}

function BacktestingPage() {
  const stats = useMarketStore((state) => state.backtestStats);
  const predictionResults = useMarketStore((state) => state.predictionResults ?? []);
  const signalHistorySummary = useMarketStore((state) => state.signalHistorySummary);
  const bestSymbols = Object.entries(signalHistorySummary?.bySymbol ?? {})
    .sort((left, right) => (right[1]?.accuracyPercent ?? 0) - (left[1]?.accuracyPercent ?? 0))
    .slice(0, 3);
  const weakSymbols = Object.entries(signalHistorySummary?.bySymbol ?? {})
    .sort((left, right) => (left[1]?.accuracyPercent ?? 0) - (right[1]?.accuracyPercent ?? 0))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Backtesting"
        title="Rule engine performance snapshot"
        description="Review historical rule-engine calls against later price movement using locally tracked signal history and stored replay windows."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Signals" value={signalHistorySummary?.totalSignals ?? stats?.totalSignals ?? 0} helper="Locally tracked 1-hour predictions" />
        <SummaryCard label="Completed" value={signalHistorySummary?.completedSignals ?? 0} helper={`${signalHistorySummary?.pendingSignals ?? 0} still pending`} />
        <SummaryCard label="Success Rate" value={formatPercentValue(signalHistorySummary?.overallAccuracy ?? stats?.successRate ?? 0)} helper={`${signalHistorySummary?.wins ?? 0} success / ${signalHistorySummary?.partial ?? 0} partial`} />
        <SummaryCard label="Failure Rate" value={formatPercentValue(((signalHistorySummary?.losses ?? 0) / Math.max(signalHistorySummary?.completedSignals ?? 0, 1)) * 100)} helper={`${signalHistorySummary?.losses ?? 0} failure`} />
        <SummaryCard label="Average Confidence" value={formatPercentValue(signalHistorySummary?.averageConfidence ?? 0)} helper="Tracked at signal time" />
        <SummaryCard label="Best / Weakest Setup" value={signalHistorySummary?.bestSetupFamily ?? signalHistorySummary?.bestSetupType ?? 'N/A'} helper={`Weakest: ${signalHistorySummary?.worstSetupFamily ?? signalHistorySummary?.worstSetupType ?? 'N/A'}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Bullish Accuracy" value={formatPercentValue(signalHistorySummary?.directionPerformance?.UP?.accuracyPercent ?? 0)} helper={`${signalHistorySummary?.directionPerformance?.UP?.totalSignals ?? 0} completed bullish calls`} />
        <SummaryCard label="Bearish Accuracy" value={formatPercentValue(signalHistorySummary?.directionPerformance?.DOWN?.accuracyPercent ?? 0)} helper={`${signalHistorySummary?.directionPerformance?.DOWN?.totalSignals ?? 0} completed bearish calls`} />
        <SummaryCard label="Sideways Accuracy" value={formatPercentValue(signalHistorySummary?.directionPerformance?.NO_EDGE?.accuracyPercent ?? 0)} helper={`${signalHistorySummary?.directionPerformance?.NO_EDGE?.totalSignals ?? 0} completed sideways calls`} />
        <SummaryCard label="Avg Move Achieved" value={formatPercentValue(signalHistorySummary?.averageMoveAchieved ?? 0)} helper="Average realized move after evaluation window" />
        <SummaryCard label="Avg Drawdown" value={formatPercentValue(signalHistorySummary?.averageDrawdown ?? 0)} helper={`Best confidence bucket: ${bucketLabel(signalHistorySummary)}`} />
      </div>

      {stats ? <BacktestSummaryCard stats={stats} predictionResults={predictionResults} /> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <p className="metric-label">Confidence Buckets</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">How confidence performed</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {Object.entries(signalHistorySummary?.confidenceBuckets ?? {}).map(([bucket, item]) => (
              <div key={bucket} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
                <p className="metric-label">{bucket}</p>
                <p className="mt-2 text-lg font-semibold text-white">{formatPercentValue(item?.accuracyPercent ?? 0)}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item?.success ?? 0} success / {item?.partial ?? 0} partial / {item?.failure ?? 0} failure
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <p className="metric-label">Setup Families</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Which families are earning trust</h3>
          <div className="mt-5 space-y-3">
            {Object.entries(signalHistorySummary?.setupFamilyPerformance ?? {})
              .sort((left, right) => (right[1]?.reputationScore ?? 0) - (left[1]?.reputationScore ?? 0))
              .slice(0, 6)
              .map(([family, item]) => (
                <div key={family} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
                  <p className="text-sm font-semibold text-white">{family}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Reputation {formatPercentValue(item?.reputationScore ?? 0)} / Avg confidence {formatPercentValue(item?.averageConfidence ?? 0)} / Avg move {formatPercentValue(item?.averageExpectedMove ?? 0)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <p className="metric-label">Best Symbols</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Most reliable names so far</h3>
          <div className="mt-5 space-y-3">
            {bestSymbols.map(([symbol, item]) => (
                <div key={symbol} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
                  <p className="text-sm font-semibold text-white">{symbol}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatPercentValue(item?.accuracyPercent ?? 0)} accuracy / Avg confidence {formatPercentValue(item?.averageConfidence ?? 0)}
                  </p>
                </div>
              ))}
          </div>
        </div>

        <div className="panel p-5">
          <p className="metric-label">Weak Symbols</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Names needing more caution</h3>
          <div className="mt-5 space-y-3">
            {weakSymbols.map(([symbol, item]) => (
                <div key={symbol} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
                  <p className="text-sm font-semibold text-white">{symbol}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatPercentValue(item?.accuracyPercent ?? 0)} accuracy / Avg confidence {formatPercentValue(item?.averageConfidence ?? 0)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BacktestingPage;
