import LiveBadge from '@/components/LiveBadge';
import SignalBadge from '@/components/SignalBadge';
import { getQuotePresentation } from '@/utils/marketSession';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

function BuyOpportunityTable({ rows }) {
  const items = rows ?? [];

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <p className="metric-label">Buy Timing</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">High-probability buy opportunities</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-slate-400">
            <tr>
              <th className="px-5 py-4 font-medium">Stock</th>
              <th className="px-5 py-4 font-medium">LTP / Indicative Prices</th>
              <th className="px-5 py-4 font-medium">Ideal / Breakout / Safe</th>
              <th className="px-5 py-4 font-medium">Targets / Invalidation</th>
              <th className="px-5 py-4 font-medium">Confidence Breakdown</th>
              <th className="px-5 py-4 font-medium">R/R</th>
              <th className="px-5 py-4 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((stock) => {
              const quote = stock.live ?? {};
              const quotePresentation = getQuotePresentation(quote);
              const livePrice = quote.ltp ?? null;
              const buyPrice = quote.buyPrice ?? quote.ltp ?? null;
              const sellPrice = quote.sellPrice ?? quote.ltp ?? null;
              const entryZonePlan = stock.entryZonePlan ?? {};
              const exitZonePlan = stock.exitZonePlan ?? {};

              return (
                <tr key={stock.symbol} className="border-t border-border/60 align-top">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-white">{stock.symbol}</p>
                    <p className="text-slate-400">{entryZonePlan.actionSummary ?? stock.buyZone?.reasons?.[0] ?? stock.signal.buyReasons[0]}</p>
                    <p className="mt-1 text-slate-500">Final action {stock.decision?.finalDecision ?? 'WAIT'} / {stock.decision?.decisionStrength ?? 'WEAK'}</p>
                    {quotePresentation.isClosedSession ? <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-amber-200">Next session planning</p> : null}
                  </td>
                  <td className="px-5 py-4 text-slate-200">
                    <div className="flex items-center gap-2">
                      <span>{quotePresentation.priceLabel} {formatCurrency(livePrice)}</span>
                      <LiveBadge status={quote.marketStatus} />
                    </div>
                    <p className="mt-1 text-slate-400">Indicative Buy {formatCurrency(buyPrice)} / Indicative Sell {formatCurrency(sellPrice)}</p>
                    <p className="text-slate-500">
                      Status: {quote.marketStatus ?? '--'}
                      {quote.marketStatusDetail ? ` / ${quote.marketStatusDetail}` : ''}
                    </p>
                    {quote.stale ? <p className="text-amber-300">Feed: {quote.staleLabel}</p> : null}
                    <p className="mt-1 text-slate-500">{quotePresentation.priceHelper}</p>
                    <p className="mt-1 text-slate-500">
                      Exchange: {quote.exchange ?? 'NSE'} / Source: {quote.source ?? 'Live market data'}
                    </p>
                    <p className="text-slate-500">Last updated: {formatDateTime(quote.lastUpdated)}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-200">
                    <p>Direction {stock.shortTermPredictions?.oneHour?.direction ?? 'SIDEWAYS'} / {stock.signal.confidence}%</p>
                    <p>Best {entryZonePlan.display?.bestEntryZone ?? (stock.buyZone?.entryRange ? `${formatCurrency(stock.buyZone.entryRange.min)} - ${formatCurrency(stock.buyZone.entryRange.max)}` : formatCurrency(stock.signal.tradePlan.idealEntry))}</p>
                    <p>Safe {entryZonePlan.display?.safeEntryZone ?? formatCurrency(stock.signal.tradePlan.safeEntry)}</p>
                    <p className="text-slate-500">Early {entryZonePlan.display?.earlyEntryZone ?? formatCurrency(stock.signal.tradePlan.aggressiveEntry)}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-200">
                    <p className="text-emerald-300">Profit zone {exitZonePlan.display?.profitBookingZone ?? formatCurrency(stock.targets?.conservative?.price ?? stock.target ?? stock.signal.tradePlan.target1)}</p>
                    <p className="text-emerald-300">Partial exit {exitZonePlan.display?.partialExitZone ?? formatCurrency(stock.targets?.standard?.price ?? stock.signal.tradePlan.target2)}</p>
                    <p className="text-slate-300">Full exit {exitZonePlan.display?.fullExitZone ?? formatCurrency(stock.targets?.maximum?.price ?? stock.signal.tradePlan.target3)}</p>
                    <p className="mt-2 text-slate-500">Stop zone {entryZonePlan.display?.stopLossZone ?? formatCurrency(stock.invalidationLevel ?? stock.stopLoss ?? stock.signal.tradePlan.stopLoss)}</p>
                    <p className="text-slate-500">Invalidation {formatCurrency(entryZonePlan.invalidationLevel ?? stock.invalidationLevel ?? stock.stopLoss ?? stock.signal.tradePlan.stopLoss)}</p>
                    <p className="text-slate-500">{entryZonePlan.setupFailureCondition ?? stock.failureCondition}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-200">
                    <p>Trend {stock.confidenceBreakdown?.trend ?? '--'}</p>
                    <p>Volume {stock.confidenceBreakdown?.volume ?? '--'}</p>
                    <p>Breakout {stock.confidenceBreakdown?.breakout ?? '--'}</p>
                    <p>Timeframes {stock.confidenceBreakdown?.timeframe ?? '--'}</p>
                    <p>R/R {stock.confidenceBreakdown?.riskReward ?? '--'}</p>
                    <p>Zone Quality {entryZonePlan.zoneQualityScore ?? '--'}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-200">
                    <p>Upside {entryZonePlan.riskReward?.estimatedUpsidePercent ?? '--'}%</p>
                    <p>Downside {entryZonePlan.riskReward?.estimatedDownsidePercent ?? '--'}%</p>
                    <p>R/R {entryZonePlan.riskReward?.rewardRiskRatio ?? stock.signal.riskRewardRatio}</p>
                    <p className="text-slate-500">{entryZonePlan.riskReward?.qualityBadge ?? 'Monitoring'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <SignalBadge signal={stock.signal.signal} compact />
                    <p className="mt-2 text-slate-400">{stock.signal.confidence}% confidence</p>
                    <p className="mt-1 text-slate-500">{stock.decision?.decisionReasonShort ?? 'No clear edge — avoid trading this setup.'}</p>
                    <p className="mt-1 text-slate-500">{stock.marketRegime} regime / sector {stock.sectorScore ?? '--'}</p>
                    <p className="mt-1 text-slate-500">Action: {entryZonePlan.actionSummary ?? stock.entryType}</p>
                    <p className="mt-1 text-slate-500">Exit: {exitZonePlan.actionSummary ?? stock.exitPlan?.action ?? 'HOLD'}</p>
                    <p className="mt-1 text-slate-500">Chase risk: {entryZonePlan.chaseRiskLevel ?? 'Moderate'}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BuyOpportunityTable;
