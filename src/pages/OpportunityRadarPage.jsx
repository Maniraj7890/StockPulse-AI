import { useState } from 'react';
import ConfidenceBar from '@/components/ConfidenceBar';
import EmptyState from '@/components/EmptyState';
import LiveBadge from '@/components/LiveBadge';
import PredictionDirectionBadge from '@/components/PredictionDirectionBadge';
import SectionHeader from '@/components/SectionHeader';
import { useLiveMarketData } from '@/hooks/useLiveMarketData';
import { useOpportunityRadar } from '@/hooks/useOpportunityRadar';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

const filters = [
  { key: 'all', label: 'All' },
  { key: 'strong', label: 'Strong Only' },
  { key: 'moderate', label: 'Moderate Only' },
  { key: 'weak', label: 'Weak Only' },
  { key: 'high-confidence', label: 'High Confidence' },
  { key: 'spike-active', label: 'Spike Active' },
  { key: 'breakout-watch', label: 'Breakout Watch' },
  { key: 'avoid', label: 'Avoid / No Trade' },
];

function toneForDirection(direction = 'SIDEWAYS', intensity = 0.45) {
  if (direction === 'UP') return { backgroundColor: `rgba(16, 185, 129, ${Math.max(0.18, intensity * 0.45)})` };
  if (direction === 'DOWN') return { backgroundColor: `rgba(244, 63, 94, ${Math.max(0.18, intensity * 0.45)})` };
  return { backgroundColor: `rgba(245, 158, 11, ${Math.max(0.16, intensity * 0.4)})` };
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${
        active
          ? 'border-emerald-400/40 bg-emerald-400/12 text-white shadow-glow'
          : 'border-border/70 text-slate-400 hover:border-border hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
      <p className="metric-label">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

function RadarList({ title, eyebrow, rows, emptyDescription }) {
  return (
    <div className="panel p-5">
      <p className="metric-label">{eyebrow}</p>
      <h3 className="mt-2 font-display text-xl font-bold text-white">{title}</h3>
      {rows.length ? (
        <div className="mt-5 space-y-3">
          {rows.map((item) => (
            <div key={item.symbol} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{item.symbol}</p>
                    <PredictionDirectionBadge direction={item.direction === 'NONE' ? 'SIDEWAYS' : item.direction} compact />
                    <LiveBadge status={item.marketStatus} />
                    {item.spike?.spikeDetected ? (
                      <span className="rounded-full border border-amber-400/25 bg-amber-400/8 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-amber-200">
                        {item.spike.spikeType.replace(/_/g, ' ')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{item.actionSummary}</p>
                </div>
                <div className="min-w-[180px]">
                  <p className="text-right text-sm text-slate-300">{item.actionBias} / {item.quality}</p>
                  <ConfidenceBar value={item.confidence} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState title={`No ${title.toLowerCase()} right now`} description={emptyDescription} />
        </div>
      )}
    </div>
  );
}

function HeatmapCell({ item }) {
  return (
    <div
      className="rounded-2xl border border-white/8 p-4 transition-transform duration-200 hover:-translate-y-0.5"
      style={toneForDirection(item.direction, item.intensity)}
      title={`${item.displayName} / ${item.direction} / ${item.confidence}% / ${item.actionSummary}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{item.symbol}</p>
          <p className="mt-1 text-xs text-slate-100/80">{item.direction}</p>
        </div>
        {item.spike?.spikeDetected ? (
          <span className="rounded-full border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/85">
            Spike
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-xs text-white/90">{item.actionBias}</p>
      <p className="mt-1 text-[11px] text-white/70">{item.confidence}% / {item.quality}</p>
    </div>
  );
}

function OpportunityRadarPage() {
  const [filter, setFilter] = useState('all');
  const radar = useOpportunityRadar(filter);
  const { marketStatus } = useLiveMarketData();

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Opportunity Radar"
        title="Intraday Heatmap and Opportunity Radar"
        description="Scan where strength, weakness, volatility, and cleaner setups are concentrated across the tracked universe."
        action={<LiveBadge status={marketStatus} />}
      />

      <div className="panel border-amber-400/20 bg-amber-400/8 p-5 text-sm leading-7 text-slate-300">
        {radar.summaryStrip}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Strong Bullish" value={radar.counts.bullish} helper="Cleaner upside opportunities" />
        <SummaryCard label="Strong Bearish" value={radar.counts.bearish} helper="Cleaner downside opportunities" />
        <SummaryCard label="Spike Active" value={radar.counts.volatile} helper="Names with abnormal live expansion" />
        <SummaryCard label="No Clear Edge" value={radar.counts.noEdge} helper="Setups better left alone" />
        <SummaryCard label="Radar Updated" value={radar.lastUpdated ? 'Live' : '--'} helper={radar.lastUpdated ? formatDateTime(radar.lastUpdated) : 'Waiting for first update'} />
      </div>

      <div className="panel p-5">
        <p className="metric-label">Smart Filters</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Refine radar output</h3>
        <div className="mt-5 flex flex-wrap gap-2">
          {filters.map((item) => (
            <FilterButton key={item.key} active={filter === item.key} onClick={() => setFilter(item.key)}>
              {item.label}
            </FilterButton>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RadarList
          eyebrow="Bullish"
          title="Strong Bullish"
          rows={radar.strongBullish}
          emptyDescription="The radar is not seeing enough aligned upside setups under the current filter."
        />
        <RadarList
          eyebrow="Bearish"
          title="Strong Bearish"
          rows={radar.strongBearish}
          emptyDescription="The radar is not seeing enough aligned downside setups under the current filter."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RadarList
          eyebrow="Spike Radar"
          title="Volatile / Spike Active"
          rows={radar.volatileActive}
          emptyDescription="No meaningful live-session spikes are active under the current filter."
        />
        <RadarList
          eyebrow="Discipline"
          title="No Clear Edge"
          rows={radar.noClearEdge}
          emptyDescription="The current filter is not surfacing no-trade names right now."
        />
      </div>

      <div className="panel p-5">
        <p className="metric-label">Intraday Heatmap</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Fast visual scan</h3>
        {radar.heatmap.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {radar.heatmap.map((item) => (
              <HeatmapCell key={item.symbol} item={item} />
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState title="No heatmap data" description="The current filter leaves no names to visualize." />
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <p className="metric-label">Market Strength Ranking</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Top ranked names</h3>
          {radar.ranking.length ? (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/[0.02] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Symbol</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Direction</th>
                    <th className="px-4 py-3 font-medium">Confidence</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {radar.ranking.slice(0, 16).map((item, index) => (
                    <tr key={item.symbol} className="border-t border-border/60">
                      <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3 text-white">{item.symbol}</td>
                      <td className="px-4 py-3 text-slate-200">{item.score}</td>
                      <td className="px-4 py-3 text-slate-200">{item.direction}</td>
                      <td className="px-4 py-3 text-slate-200">{item.confidence}%</td>
                      <td className="px-4 py-3 text-slate-200">{formatCurrency(item.currentPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState title="No ranked names" description="The current filter removed all ranking candidates." />
            </div>
          )}
        </div>

        <div className="panel p-5">
          <p className="metric-label">Sector / Group View</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Where strength is clustered</h3>
          {radar.sectorGroups.length ? (
            <div className="mt-5 space-y-3">
              {radar.sectorGroups.map((item) => (
                <div key={item.sector} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{item.sector}</p>
                    <span className="text-sm text-slate-300">{item.score}/100</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {item.bullish} bullish / {item.bearish} bearish / {item.count} tracked
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState title="No sector grouping yet" description="Sector strength will appear once filtered names are available." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OpportunityRadarPage;
