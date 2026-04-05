import { formatCurrency, formatNumber } from '@/utils/formatters';

function TimeframeChip({ label, item }) {
  const tone =
    item?.trend === 'Bullish'
      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
      : item?.trend === 'Bearish'
        ? 'border-rose-400/40 bg-rose-400/10 text-rose-200'
        : 'border-border/70 bg-white/[0.02] text-slate-300';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone}`}>
      <p className="text-xs uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-sm font-semibold">{item?.trend ?? 'Neutral'}</p>
      <p className="mt-1 text-xs text-slate-400">{item?.signalStrength ?? '--'}/100 strength</p>
    </div>
  );
}

function IndicatorPanel({ indicators, trend, supportResistance, multiTimeframe }) {
  const items = [
    ['RSI 14', formatNumber(indicators.rsi14)],
    ['EMA 9', formatCurrency(indicators.ema9)],
    ['EMA 21', formatCurrency(indicators.ema21)],
    ['EMA 50', formatCurrency(indicators.ema50)],
    ['EMA 200', formatCurrency(indicators.ema200)],
    ['MACD', formatNumber(indicators.macd)],
    ['Signal', formatNumber(indicators.macdSignal)],
    ['Histogram', formatNumber(indicators.macdHistogram)],
    ['VWAP', formatCurrency(indicators.vwap)],
    ['ATR', formatNumber(indicators.atr14)],
    ['ADX', formatNumber(indicators.adx14)],
    ['Supertrend', formatCurrency(indicators.supertrend)],
    ['Volume Trend', indicators.volumeTrend],
    ['Support', formatCurrency(supportResistance.support)],
    ['Resistance', formatCurrency(supportResistance.resistance)],
    ['Trend Score', `${trend.strengthScore}/100`],
  ];

  return (
    <div className="panel p-5">
      <p className="metric-label">Indicator Stack</p>
      <h3 className="mt-2 font-display text-xl font-bold text-white">Technical overview</h3>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border/60 bg-panel-soft/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-2 text-sm font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-3xl border border-border/60 bg-panel-soft/60 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="metric-label">Multi-Timeframe Confirmation</p>
            <h4 className="mt-2 text-lg font-semibold text-white">
              {multiTimeframe?.agreement ?? 'Monitoring agreement'}
            </h4>
          </div>
          <p className="text-sm text-slate-400">Agreement score {multiTimeframe?.agreementScore ?? '--'}/100</p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <TimeframeChip label="5m" item={multiTimeframe?.['5m']} />
          <TimeframeChip label="15m" item={multiTimeframe?.['15m']} />
          <TimeframeChip label="1h" item={multiTimeframe?.['1h']} />
          <TimeframeChip label="1d" item={multiTimeframe?.['1d']} />
        </div>
      </div>
    </div>
  );
}

export default IndicatorPanel;
