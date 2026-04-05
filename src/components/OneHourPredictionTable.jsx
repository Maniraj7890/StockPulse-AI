import LiveBadge from '@/components/LiveBadge';
import PredictionReasonCard from '@/components/PredictionReasonCard';
import PredictionScoreBadge from '@/components/PredictionScoreBadge';
import ProbabilityBadge from '@/components/ProbabilityBadge';
import { formatCurrency, formatDateTime, formatPercent } from '@/utils/formatters';

function TimeframeRow({ multiTimeframe }) {
  const timeframes = ['5m', '15m', '1h', '1d'];

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {timeframes.map((label) => {
        const trend = multiTimeframe?.[label]?.trend ?? 'Neutral';
        const tone =
          trend === 'Bullish'
            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
            : trend === 'Bearish'
              ? 'border-rose-400/40 bg-rose-400/10 text-rose-200'
              : 'border-border/70 bg-white/[0.02] text-slate-300';

        return (
          <span key={label} className={`rounded-full border px-2.5 py-1 ${tone}`}>
            {label} {trend}
          </span>
        );
      })}
    </div>
  );
}

function OneHourPredictionTable({ rows }) {
  const items = rows ?? [];

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <p className="metric-label">Ranked Scanner</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Next 60-minute bullish probability list</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-slate-400">
            <tr>
              <th className="px-5 py-4 font-medium">Stock</th>
              <th className="px-5 py-4 font-medium">LTP / Indicative Prices</th>
              <th className="px-5 py-4 font-medium">Score / Label</th>
              <th className="px-5 py-4 font-medium">Quality / Timeframes</th>
              <th className="px-5 py-4 font-medium">Entry / Targets / Invalidation</th>
              <th className="px-5 py-4 font-medium">Reason Summary</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const quote = item.live ?? {};
              const livePrice = quote.ltp ?? null;
              const buyPrice = quote.buyPrice ?? quote.ltp ?? null;
              const sellPrice = quote.sellPrice ?? quote.ltp ?? null;

              return (
              <tr key={item.symbol} className="border-t border-border/60 align-top">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{item.symbol}</p>
                    <LiveBadge status={quote.marketStatus} />
                  </div>
                  <p className="text-slate-400">{item.companyName}</p>
                  <p className="mt-1 text-slate-500">{item.confidence}% confidence</p>
                  {item.isWatchlistStock ? (
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-amber-300">Watchlist</p>
                  ) : null}
                </td>
                <td className="px-5 py-4 text-slate-200">
                  <p>LTP {formatCurrency(livePrice)}</p>
                  <p className="mt-1 text-slate-400">Indicative Buy {formatCurrency(buyPrice)} / Indicative Sell {formatCurrency(sellPrice)}</p>
                  <p className={(quote.changePercent ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                    {formatPercent(quote.changePercent)}
                  </p>
                  <p className="text-slate-500">
                    Status: {quote.marketStatus ?? '--'}
                    {quote.marketStatusDetail ? ` / ${quote.marketStatusDetail}` : ''}
                  </p>
                  {quote.stale ? <p className="text-amber-300">Feed: {quote.staleLabel}</p> : null}
                  <p className="text-slate-500">Exchange: {quote.exchange ?? 'NSE'} / Source: {quote.source ?? 'Live market data'}</p>
                  <p className="text-slate-500">Last updated: {formatDateTime(quote.lastUpdated)}</p>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-col gap-2">
                    <PredictionScoreBadge score={item.oneHourBullishScore} />
                    <ProbabilityBadge label={item.predictionLabel} />
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.setupType}</p>
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-300">
                  <p>Setup quality {item.setupQuality} ({item.setupQualityScore}/100)</p>
                  <p>Timeframes {item.timeframeAgreement}</p>
                  <p>Breakout quality {item.breakoutQuality}/100</p>
                  <p>Volume confirmation {item.volumeConfirmation}/100</p>
                  <p>Resistance {item.resistanceDistanceLabel}</p>
                  <p>Overextension {item.overextensionRisk}</p>
                  <TimeframeRow multiTimeframe={item.multiTimeframe} />
                </td>
                <td className="px-5 py-4 text-slate-300">
                  <p>Entry {formatCurrency(item.idealEntryZone)}</p>
                  <p>Stop {formatCurrency(item.stopLoss)}</p>
                  <p className="text-emerald-300">Conservative {formatCurrency(item.conservativeTarget?.price)}</p>
                  <p className="text-emerald-300">Standard {formatCurrency(item.standardTarget?.price)}</p>
                  <p className="text-slate-300">Maximum {formatCurrency(item.maximumTarget?.price)}</p>
                  <p className="mt-2 text-slate-500">Invalidation {formatCurrency(item.invalidationLevel)}</p>
                  <p className="mt-2 text-slate-500">Gap to breakout {formatCurrency(item.nearestBreakoutGap)}</p>
                  <p className="text-slate-500">R/R {item.riskReward}:1</p>
                </td>
                <td className="min-w-[320px] px-5 py-4">
                  <PredictionReasonCard
                    summary={item.reasonSummary}
                    confidenceExplanation={item.confidenceExplanation}
                    agreement={item.multiTimeframe?.agreement}
                    warnings={item.canFailReasons}
                    setupType={item.setupType}
                    safetyProfile={item.safetyProfile}
                  />
                  <div className="mt-3 rounded-2xl border border-border/60 bg-black/10 p-3 text-xs text-slate-400">
                    <p>
                      Conservative target: {item.conservativeTarget?.probabilityLabel} /{' '}
                      {item.conservativeTarget?.confidenceNote}
                    </p>
                    <p className="mt-1">
                      Standard target: {item.standardTarget?.probabilityLabel} /{' '}
                      {item.standardTarget?.confidenceNote}
                    </p>
                    <p className="mt-1">
                      Maximum target: {item.maximumTarget?.probabilityLabel} /{' '}
                      {item.maximumTarget?.confidenceNote}
                    </p>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OneHourPredictionTable;
