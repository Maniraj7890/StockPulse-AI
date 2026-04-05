import AIExplanationCard from '@/components/AIExplanationCard';
import SectionHeader from '@/components/SectionHeader';
import SellOpportunityTable from '@/components/SellOpportunityTable';
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

function EmptySellState() {
  return (
    <div className="panel flex min-h-[220px] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-2xl border border-border/70 bg-panel-soft px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-500">
        Empty
      </div>
      <div className="space-y-2">
        <h3 className="font-display text-xl font-bold text-white">No sell opportunities right now</h3>
        <p className="max-w-2xl text-sm leading-6 text-slate-400">
          There are currently no stocks triggering the exit logic. This page stays active and will list profit-booking,
          breakdown, and exit warnings here when conditions appear.
        </p>
      </div>
    </div>
  );
}

function SellOpportunityPage() {
  const rows = useMarketStore((state) => state.sellExitRows ?? []);
  const leadExit = rows[0] ?? null;

  const strongExitCount = rows.filter((stock) => ['SELL', 'STRONG SELL'].includes(stock?.signal?.signal)).length;
  const waitCount = rows.filter((stock) => stock?.signal?.signal === 'WAIT').length;
  const averageConfidence = rows.length
    ? Math.round(rows.reduce((sum, stock) => sum + (stock?.signal?.confidence ?? 0), 0) / rows.length)
    : 0;
  const explanationPayload = leadExit
    ? {
        symbol: leadExit.symbol,
        marketStatus: leadExit.live?.marketStatus ?? 'UNKNOWN',
        signal: leadExit.signal?.signal ?? 'HOLD',
        confidence: leadExit.signal?.confidence ?? 0,
        rsi: leadExit.indicators?.rsi14 ?? null,
        ema9: leadExit.indicators?.ema9 ?? null,
        ema21: leadExit.indicators?.ema21 ?? null,
        momentum: leadExit.dayChangePercent ?? leadExit.live?.changePercent ?? 0,
        volatility: leadExit.indicators?.atr14 ?? null,
        buyZone: leadExit.buyZone ?? null,
        exitPlan: leadExit.exitPlan ?? {
          action: 'HOLD',
          reasons: [],
        },
        stopLoss: leadExit.signal?.tradePlan?.stopLoss ?? leadExit.invalidationLevel ?? null,
        target: leadExit.signal?.tradePlan?.target1 ?? leadExit.targets?.standard?.price ?? null,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="panel border-emerald-400/15 bg-panel/95 p-5">
        <p className="metric-label">Sell Opportunities Page</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-white">Sell Opportunities Page</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Review live profit-booking zones, trend weakness, trailing stop levels, and breakdown risks with safe fallbacks.
        </p>
      </div>

      <SectionHeader
        eyebrow="Sell / Exit"
        title="Exit timing and warning zones"
        description="Review profit-booking zones, trailing stops, resistance rejection, breakdown threats, and weakening momentum."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Active Exit Setups" value={rows.length} helper="Sell, strong sell, and wait names with caution signals" />
        <SummaryCard label="Strong Exit Alerts" value={strongExitCount} helper="Stocks already leaning toward exit action" />
        <SummaryCard label="Average Confidence" value={`${averageConfidence}%`} helper={`${waitCount} mixed-signal names still on watch`} />
      </div>

      <AIExplanationCard
        title="AI Exit Note"
        eyebrow="AI Explanation"
        payload={explanationPayload}
      />

      {rows.length ? <SellOpportunityTable rows={rows} /> : <EmptySellState />}
    </div>
  );
}

export default SellOpportunityPage;
