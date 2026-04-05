import SectionHeader from '@/components/SectionHeader';
import SignalHistoryTable from '@/components/SignalHistoryTable';
import { useMarketStore } from '@/store/useMarketStore';
import { useMemo, useState } from 'react';

function SummaryCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
      <p className="metric-label">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

function SignalHistoryPage() {
  const signalHistory = useMarketStore((state) => state.signalHistory ?? []);
  const summary = useMarketStore((state) => state.signalHistorySummary);
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [strengthFilter, setStrengthFilter] = useState('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  const [confidenceFilter, setConfidenceFilter] = useState('ALL');
  const [setupTypeFilter, setSetupTypeFilter] = useState('ALL');
  const [symbolFilter, setSymbolFilter] = useState('ALL');

  const symbolOptions = useMemo(
    () => ['ALL', ...new Set((signalHistory ?? []).map((item) => item.symbol).filter(Boolean))],
    [signalHistory],
  );
  const setupTypeOptions = useMemo(
    () => ['ALL', ...new Set((signalHistory ?? []).map((item) => item.setupType).filter(Boolean))],
    [signalHistory],
  );

  const filteredRows = useMemo(() => {
    return (signalHistory ?? []).filter((item) => {
      const normalizedDirection = item.direction === 'NO_EDGE' ? 'SIDEWAYS' : item.direction;
      const strength = item.quality ?? 'WEAK';

      if (directionFilter !== 'ALL' && normalizedDirection !== directionFilter) return false;
      if (strengthFilter !== 'ALL' && strength !== strengthFilter) return false;
      if (outcomeFilter !== 'ALL' && item.outcome !== outcomeFilter) return false;
      if (confidenceFilter !== 'ALL' && item.confidenceBucket !== confidenceFilter) return false;
      if (setupTypeFilter !== 'ALL' && item.setupType !== setupTypeFilter) return false;
      if (symbolFilter !== 'ALL' && item.symbol !== symbolFilter) return false;
      return true;
    }).sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  }, [confidenceFilter, directionFilter, outcomeFilter, setupTypeFilter, signalHistory, strengthFilter, symbolFilter]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Signal History"
        title="Past entries and outcomes"
        description="Review tracked 1-hour directional signals, evaluate outcome after one hour, and monitor which setup types are working best."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Signals Tracked" value={summary?.totalSignals ?? 0} helper="Recent 1-hour UP and DOWN candidates only" />
        <SummaryCard label="Overall Accuracy" value={`${summary?.overallAccuracy ?? 0}%`} helper={`${summary?.wins ?? 0} success / ${summary?.partial ?? 0} partial / ${summary?.losses ?? 0} failure`} />
        <SummaryCard label="Average Confidence" value={`${summary?.averageConfidence ?? 0}%`} helper={`${summary?.pendingSignals ?? 0} signals still pending evaluation`} />
        <SummaryCard label="Best Setup Family" value={summary?.bestSetupFamily ?? 'N/A'} helper={`Weakest: ${summary?.worstSetupFamily ?? 'N/A'}`} />
      </div>
      <div className="panel p-5">
        <div className="flex flex-wrap gap-3">
          {['ALL', 'UP', 'DOWN', 'SIDEWAYS'].map((option) => (
            <button
              key={option}
              onClick={() => setDirectionFilter(option)}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.16em] transition ${
                directionFilter === option
                  ? 'border-emerald-400/40 bg-emerald-400/12 text-white'
                  : 'border-border/70 text-slate-400 hover:text-white'
              }`}
            >
              {option === 'ALL' ? 'All Directions' : option}
            </button>
          ))}
          {['ALL', 'STRONG', 'MODERATE', 'WEAK'].map((option) => (
            <button
              key={option}
              onClick={() => setStrengthFilter(option)}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.16em] transition ${
                strengthFilter === option
                  ? 'border-sky-400/40 bg-sky-400/12 text-white'
                  : 'border-border/70 text-slate-400 hover:text-white'
              }`}
            >
              {option === 'ALL' ? 'All Strengths' : option}
            </button>
          ))}
          {['ALL', 'SUCCESS', 'PARTIAL', 'FAILURE', 'PENDING'].map((option) => (
            <button
              key={option}
              onClick={() => setOutcomeFilter(option)}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.16em] transition ${
                outcomeFilter === option
                  ? 'border-amber-400/40 bg-amber-400/12 text-white'
                  : 'border-border/70 text-slate-400 hover:text-white'
              }`}
            >
              {option === 'ALL' ? 'All Outcomes' : option}
            </button>
          ))}
          {['ALL', '0-30', '30-60', '60-100'].map((option) => (
            <button
              key={option}
              onClick={() => setConfidenceFilter(option)}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.16em] transition ${
                confidenceFilter === option
                  ? 'border-fuchsia-400/40 bg-fuchsia-400/12 text-white'
                  : 'border-border/70 text-slate-400 hover:text-white'
              }`}
            >
              {option === 'ALL' ? 'All Confidence' : option}
            </button>
          ))}
          <select
            value={setupTypeFilter}
            onChange={(event) => setSetupTypeFilter(event.target.value)}
            className="rounded-full border border-border/70 bg-panel px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 outline-none"
          >
            {setupTypeOptions.map((setupType) => (
              <option key={setupType} value={setupType}>
                {setupType === 'ALL' ? 'All Setups' : setupType}
              </option>
            ))}
          </select>
          <select
            value={symbolFilter}
            onChange={(event) => setSymbolFilter(event.target.value)}
            className="rounded-full border border-border/70 bg-panel px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 outline-none"
          >
            {symbolOptions.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol === 'ALL' ? 'All Symbols' : symbol}
              </option>
            ))}
          </select>
        </div>
      </div>
      <SignalHistoryTable rows={filteredRows} />
    </div>
  );
}

export default SignalHistoryPage;
