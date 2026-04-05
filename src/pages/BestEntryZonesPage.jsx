import { useMemo, useState } from 'react';
import AIExplanationCard from '@/components/AIExplanationCard';
import BestEntrySummaryCards from '@/components/BestEntrySummaryCards';
import BestEntryZonesTable from '@/components/BestEntryZonesTable';
import EmptyState from '@/components/EmptyState';
import LiveBadge from '@/components/LiveBadge';
import SectionHeader from '@/components/SectionHeader';
import { useLiveMarketData } from '@/hooks/useLiveMarketData';
import { useMarketStore } from '@/store/useMarketStore';

const filters = [
  { key: 'all', label: 'All' },
  { key: 'BUY NOW', label: 'Buy Now' },
  { key: 'WAIT FOR BREAKOUT', label: 'Breakout' },
  { key: 'WAIT FOR PULLBACK', label: 'Pullback' },
  { key: 'SUPPORT BOUNCE', label: 'Support Bounce' },
  { key: 'AVOID', label: 'Avoid' },
];

const sorts = [
  { key: 'score', label: 'Best Entry Score' },
  { key: 'confidence', label: 'Highest Confidence' },
  { key: 'breakout', label: 'Nearest Breakout' },
  { key: 'trend', label: 'Strongest Trend' },
];

function FilterButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${
        active
          ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-200'
          : 'border-border/70 text-slate-400 hover:border-border hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function BestEntryZonesPage() {
  const rows = useMarketStore((state) => state.bestEntryZones ?? []);
  const refreshBestEntryZones = useMarketStore((state) => state.refreshBestEntryZones);
  const { marketStatus } = useLiveMarketData();
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score');

  const filteredRows = useMemo(() => {
    let items = [...(rows ?? [])];

    if (filter !== 'all') {
      items = items.filter((item) => item.entryType === filter);
    }

    return items.sort((left, right) => {
      if (sortBy === 'confidence') return right.confidence - left.confidence;
      if (sortBy === 'breakout') return left.nearestBreakoutGap - right.nearestBreakoutGap;
      if (sortBy === 'trend') return right.trendStrength - left.trendStrength;
      return right.entryScore - left.entryScore;
    });
  }, [filter, rows, sortBy]);

  const stats = useMemo(() => {
    const source = rows ?? [];
    return {
      total: source.length,
      buyNow: source.filter((item) => item.entryType === 'BUY NOW').length,
      breakoutWatch: source.filter((item) => item.entryType === 'WAIT FOR BREAKOUT').length,
      pullbackWatch: source.filter((item) => item.entryType === 'WAIT FOR PULLBACK').length,
      avoid: source.filter((item) => item.entryType === 'AVOID').length,
    };
  }, [rows]);
  const leadSetup = filteredRows[0] ?? rows[0] ?? null;
  const explanationPayload = leadSetup
    ? {
        symbol: leadSetup.symbol,
        marketStatus: leadSetup.live?.marketStatus ?? 'UNKNOWN',
        signal: leadSetup.signal?.signal ?? 'HOLD',
        confidence: leadSetup.confidence ?? leadSetup.signal?.confidence ?? 0,
        trendSummary: leadSetup.prediction?.trendSummary ?? leadSetup.trend?.direction ?? null,
        momentumSummary: leadSetup.prediction?.momentumSummary ?? null,
        structureSummary: leadSetup.prediction?.structureSummary ?? null,
        volatilitySummary: leadSetup.prediction?.volatilitySummary ?? null,
        support: leadSetup.supportResistance?.support ?? leadSetup.entryZonePlan?.support ?? null,
        resistance: leadSetup.supportResistance?.resistance ?? leadSetup.entryZonePlan?.resistance ?? null,
        invalidation: leadSetup.entryZonePlan?.invalidationLevel ?? leadSetup.stopLoss ?? null,
        entryZonePlan: leadSetup.entryZonePlan ?? null,
        exitZonePlan: leadSetup.exitZonePlan ?? null,
        actionBias: leadSetup.entryZonePlan?.actionSummary ?? leadSetup.entryType ?? 'Wait for confirmation',
        reasons: leadSetup.reasonSummary ? [leadSetup.reasonSummary] : leadSetup.signal?.buyReasons ?? [],
        whyThisPrediction: leadSetup.prediction?.whyThisPrediction ?? leadSetup.signal?.reasons ?? [],
        expectedMoveMin: leadSetup.shortTermPredictions?.oneHour?.expectedMoveMin ?? null,
        expectedMoveMax: leadSetup.shortTermPredictions?.oneHour?.expectedMoveMax ?? null,
        expectedMoveText: leadSetup.shortTermPredictions?.oneHour?.expectedMoveText ?? null,
        live: leadSetup.live ?? null,
        lastUpdated: leadSetup.lastUpdated ?? null,
      }
    : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Best Entry Zones"
        title="Best Entry Zones"
        description="Smart entry timing based on price action and signals"
        action={<LiveBadge status={marketStatus} />}
      />

      <div className="panel border-amber-400/20 bg-amber-400/8 p-5 text-sm leading-7 text-slate-300">
        For analysis support only. Not financial advice.
      </div>

      <BestEntrySummaryCards stats={stats} />

      <AIExplanationCard
        title="AI Entry Note"
        eyebrow="AI Explanation"
        payload={explanationPayload}
      />

      <div className="panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="metric-label">Filters</p>
            <h3 className="mt-2 font-display text-xl font-bold text-white">Find the cleanest entry timing</h3>
          </div>
          <button
            onClick={refreshBestEntryZones}
            className="rounded-full border border-border/70 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-200"
          >
            Refresh entry scan
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {filters.map((item) => (
            <FilterButton key={item.key} active={filter === item.key} onClick={() => setFilter(item.key)}>
              {item.label}
            </FilterButton>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3 text-sm text-slate-300">
          <span>Sort by</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-full border border-border/70 bg-panel px-4 py-2 text-sm text-white outline-none transition focus:border-emerald-400/40"
          >
            {sorts.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredRows.length ? (
        <BestEntryZonesTable rows={filteredRows} />
      ) : (
        <EmptyState
          title="No entry setups available right now"
          description="The entry scanner is not seeing a clean buy-now, breakout, pullback, or support-bounce setup at the moment."
        />
      )}
    </div>
  );
}

export default BestEntryZonesPage;
