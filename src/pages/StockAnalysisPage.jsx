import { lazy, memo, Suspense, useCallback, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import LiveBadge from '@/components/LiveBadge';
import SectionHeader from '@/components/SectionHeader';
import SignalBadge from '@/components/SignalBadge';
import TradeSetupCard from '@/components/TradeSetupCard';
import { useMarketStore } from '@/store/useMarketStore';
import { getQuotePresentation } from '@/utils/marketSession';
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from '@/utils/formatters';

const ChartContainer = lazy(() => import('@/components/ChartContainer'));
const DecisionSummaryCard = lazy(() => import('@/components/DecisionSummaryCard'));
const IndicatorPanel = lazy(() => import('@/components/IndicatorPanel'));
const WhySignalPanel = lazy(() => import('@/components/WhySignalPanel'));

const SummaryCard = memo(function SummaryCard({ label, value, helper, tone = 'text-white' }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
      <p className="metric-label">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${tone}`}>{value}</p>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
});

function PanelSkeleton({ label = 'Loading section...' }) {
  return (
    <div className="panel p-5">
      <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-5 text-sm text-slate-400">{label}</div>
    </div>
  );
}

function StockAnalysisPage() {
  const selectedStock = useMarketStore((state) => state.selectedStock ?? null);
  const analysis = useMarketStore((state) => {
    if (!state.selectedStock) {
      return null;
    }

    return state.analysisData?.[state.selectedStock] ?? null;
  });
  const loading = useMarketStore((state) => state.loading);
  const [showWhyPanel, setShowWhyPanel] = useState(false);
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);

  const handleToggleWhyPanel = useCallback(() => {
    setShowWhyPanel((current) => !current);
  }, []);

  const handleToggleIndicatorPanel = useCallback(() => {
    setShowIndicatorPanel((current) => !current);
  }, []);

  if (!analysis) {
    return (
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Stock Analysis"
          title="Analysis"
          description="Loading selected stock analysis and chart data."
        />
        <div className="panel p-6">
          <p className="text-lg font-semibold text-white">Loading analysis...</p>
          <p className="mt-2 text-sm text-slate-400">
            {loading
              ? 'Market data is still loading.'
              : `Analysis data for ${selectedStock ?? 'the selected stock'} is not ready yet.`}
          </p>
        </div>
      </div>
    );
  }

  const signal = useMemo(
    () => ({
      signal: 'WAIT',
      confidence: 0,
      tradeQuality: 0,
      bias: 'Neutral',
      explanation: 'Analysis is still being prepared.',
      riskRewardRatio: '--',
      tradePlan: {
        idealEntry: null,
        aggressiveEntry: null,
        safeEntry: null,
        stopLoss: null,
        target1: null,
        target2: null,
        target3: null,
        trailingStop: null,
      },
      ...(analysis.signal ?? {}),
    }),
    [analysis.signal],
  );

  const quote = analysis.live ?? {};
  const indicators = analysis.indicators ?? {};
  const trend = analysis.trend ?? {};
  const supportResistance = analysis.supportResistance ?? {};
  const candles = Array.isArray(analysis.candles) ? analysis.candles : [];
  const multiTimeframe = analysis.multiTimeframe ?? {};
  const shortTermPredictions = analysis.shortTermPredictions ?? {};
  const buyZone = analysis.buyZone ?? {};
  const exitPlan = analysis.exitPlan ?? {};
  const decision = analysis.decision ?? signal.decision ?? null;
  const quotePresentation = useMemo(() => getQuotePresentation(quote), [quote]);
  const livePrice = quote.ltp ?? null;
  const liveChange = quote.changePercent ?? 0;
  const buyPrice = quote.buyPrice ?? quote.ltp ?? null;
  const sellPrice = quote.sellPrice ?? quote.ltp ?? null;

  const summaryCards = useMemo(
    () => [
      {
        label: quotePresentation.priceLabel,
        value: formatCurrency(livePrice),
        helper: `${quotePresentation.priceHelper} / Status: ${quote.marketStatus ?? '--'}${quote.marketStatusDetail ? ` / ${quote.marketStatusDetail}` : ''}${quote.direction ? ` / ${quote.direction}` : ''}`,
      },
      {
        label: 'Day Change',
        value: formatPercent(liveChange),
        tone: liveChange >= 0 ? 'text-emerald-300' : 'text-rose-300',
      },
      {
        label: 'Indicative Buy / Sell',
        value: `${formatCurrency(buyPrice)} / ${formatCurrency(sellPrice)}`,
        helper: `Exchange: ${quote.exchange ?? 'NSE'} / Source: ${quote.source ?? 'Live market data'}`,
      },
      {
        label: 'OHLC',
        value: `${formatCurrency(quote.open)} / ${formatCurrency(quote.high)}`,
        helper: `${formatCurrency(quote.low)} / ${formatCurrency(quote.prevClose)}`,
      },
      {
        label: 'Volume',
        value: formatNumber(quote.volume, 0),
        helper: indicators.volumeTrend,
      },
      {
        label: 'Breakout Probability',
        value: `${trend.breakoutProbability ?? 0}%`,
        helper: `Last updated: ${formatDateTime(quote.lastUpdated)}`,
      },
      {
        label: '15m View',
        value: `${shortTermPredictions.fifteenMinutes?.direction ?? 'SIDEWAYS'} / ${shortTermPredictions.fifteenMinutes?.confidence ?? 0}%`,
        helper: shortTermPredictions.fifteenMinutes?.expectedMoveText ?? 'Limited short-term data',
      },
      {
        label: '30m View',
        value: `${shortTermPredictions.thirtyMinutes?.direction ?? 'SIDEWAYS'} / ${shortTermPredictions.thirtyMinutes?.confidence ?? 0}%`,
        helper: shortTermPredictions.thirtyMinutes?.expectedMoveText ?? 'Limited short-term data',
      },
      {
        label: '1H View',
        value: `${shortTermPredictions.oneHour?.direction ?? 'SIDEWAYS'} / ${shortTermPredictions.oneHour?.confidence ?? 0}%`,
        helper: shortTermPredictions.oneHour?.basisLabel ?? 'Estimate',
      },
      {
        label: 'Reversal Warning',
        value: trend.reversalWarning ?? 'Monitoring',
        helper:
          livePrice != null && signal.tradePlan?.stopLoss != null && livePrice <= signal.tradePlan.stopLoss * 1.01
            ? 'Stop-loss risk active'
            : 'Monitoring',
      },
      {
        label: 'Buy Zone',
        value: buyZone.entryLabel ?? 'WAIT',
        helper: buyZone.entryRange
          ? `${formatCurrency(buyZone.entryRange.min)} - ${formatCurrency(buyZone.entryRange.max)}`
          : 'No active entry range',
      },
      {
        label: 'Exit Action',
        value: exitPlan.action ?? 'HOLD',
        helper: exitPlan.reasons?.[0] ?? 'Hold current plan',
      },
    ],
    [
      buyPrice,
      buyZone.entryLabel,
      buyZone.entryRange,
      exitPlan.action,
      exitPlan.reasons,
      indicators.volumeTrend,
      liveChange,
      livePrice,
      quote.direction,
      quote.exchange,
      quote.high,
      quote.lastUpdated,
      quote.low,
      quote.marketStatus,
      quote.marketStatusDetail,
      quote.open,
      quote.prevClose,
      quote.source,
      quote.volume,
      quotePresentation.priceHelper,
      quotePresentation.priceLabel,
      sellPrice,
      shortTermPredictions.fifteenMinutes,
      shortTermPredictions.oneHour,
      shortTermPredictions.thirtyMinutes,
      signal.tradePlan,
      trend.breakoutProbability,
      trend.reversalWarning,
    ],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Stock Analysis"
        title={`${analysis.companyName} (${analysis.symbol})`}
        description="Full individual analysis with charting, indicator stack, trend confirmation, breakout probability, and actionable trade levels."
        action={
          <div className="flex items-center gap-3">
            <LiveBadge status={quote.marketStatus} />
            <SignalBadge signal={signal.signal} />
          </div>
        }
      />

      {quotePresentation.closedBadgeText ? (
        <div className="panel border-amber-400/20 bg-amber-400/8 p-5 text-sm leading-7 text-slate-300">
          {quotePresentation.closedBadgeText}. Prices below are shown as last traded price, and forecasts are next session estimates.
        </div>
      ) : null}

      <div className="panel p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {summaryCards.map((item) => (
            <SummaryCard key={item.label} label={item.label} value={item.value} helper={item.helper} tone={item.tone} />
          ))}
        </div>
      </div>

      <Suspense fallback={<PanelSkeleton label="Loading decision summary..." />}>
        <DecisionSummaryCard decision={decision} />
      </Suspense>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        {candles.length ? (
          <Suspense fallback={<PanelSkeleton label="Loading chart..." />}>
            <ChartContainer candles={candles} />
          </Suspense>
        ) : (
          <div className="panel p-5">
            <p className="metric-label">Price Action</p>
            <h3 className="mt-2 font-display text-xl font-bold text-white">Candlestick chart</h3>
            <div className="mt-5 rounded-2xl border border-border/60 bg-panel-soft/60 p-5 text-sm text-slate-400">
              Loading chart data...
            </div>
          </div>
        )}
        <TradeSetupCard signal={signal} decision={decision} multiTimeframe={multiTimeframe} shortTermPredictions={shortTermPredictions} quote={quote} />
      </div>

      {showWhyPanel ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleToggleWhyPanel}
              className="rounded-full border border-border/70 px-4 py-2 text-sm text-slate-300 transition hover:border-border hover:text-white"
            >
              Hide details
            </button>
          </div>
          <Suspense fallback={<PanelSkeleton label="Loading signal explanation..." />}>
            <WhySignalPanel decision={decision} />
          </Suspense>
        </div>
      ) : (
        <div className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="metric-label">Signal Context</p>
              <h3 className="mt-2 font-display text-xl font-bold text-white">Why this signal?</h3>
            </div>
            <button
              type="button"
              onClick={handleToggleWhyPanel}
              className="rounded-full border border-border/70 px-4 py-2 text-sm text-slate-300 transition hover:border-border hover:text-white"
            >
              Show details
            </button>
          </div>
          <div className="mt-5 rounded-2xl border border-border/60 bg-panel-soft/60 p-4 text-sm text-slate-400">
            Expand this section to load the detailed rule-based explanation, confidence context, and risk notes.
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        {showIndicatorPanel ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleToggleIndicatorPanel}
                className="rounded-full border border-border/70 px-4 py-2 text-sm text-slate-300 transition hover:border-border hover:text-white"
              >
                Hide indicators
              </button>
            </div>
            <Suspense fallback={<PanelSkeleton label="Loading indicator stack..." />}>
              <IndicatorPanel
                indicators={indicators}
                trend={{ strengthScore: 0, ...trend }}
                supportResistance={{ support: null, resistance: null, ...supportResistance }}
                multiTimeframe={multiTimeframe}
              />
            </Suspense>
          </div>
        ) : (
          <div className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="metric-label">Indicator Stack</p>
                <h3 className="mt-2 font-display text-xl font-bold text-white">Technical overview</h3>
              </div>
              <button
                type="button"
                onClick={handleToggleIndicatorPanel}
                className="rounded-full border border-border/70 px-4 py-2 text-sm text-slate-300 transition hover:border-border hover:text-white"
              >
                Show indicators
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-border/60 bg-panel-soft/60 p-4 text-sm text-slate-400">
              Expand to load the full indicator stack, multi-timeframe agreement, and technical breakdown.
            </div>
          </div>
        )}

        <div className="panel p-5">
          <p className="metric-label">Zones</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Support and resistance</h3>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
              <div className="flex items-center gap-2 text-emerald-300">
                <ArrowUpRight className="h-4 w-4" />
                <span className="font-semibold">Support</span>
              </div>
              <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(supportResistance.support)}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
              <div className="flex items-center gap-2 text-rose-300">
                <ArrowDownRight className="h-4 w-4" />
                <span className="font-semibold">Resistance</span>
              </div>
              <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(supportResistance.resistance)}</p>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4 text-sm leading-6 text-slate-300">
              For analysis support only. Not financial advice.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StockAnalysisPage;
