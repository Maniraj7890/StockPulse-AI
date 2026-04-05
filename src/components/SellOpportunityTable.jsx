import LiveBadge from '@/components/LiveBadge';
import SignalBadge from '@/components/SignalBadge';
import { getQuotePresentation } from '@/utils/marketSession';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

function SellOpportunityTable({ rows }) {
  const items = rows ?? [];

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <p className="metric-label">Exit Timing</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Sell and exit opportunities</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-slate-400">
            <tr>
              <th className="px-5 py-4 font-medium">Stock</th>
              <th className="px-5 py-4 font-medium">LTP / Indicative Prices</th>
              <th className="px-5 py-4 font-medium">Profit / Exit Zones</th>
              <th className="px-5 py-4 font-medium">Trailing Stop / Invalidation</th>
              <th className="px-5 py-4 font-medium">Urgency</th>
              <th className="px-5 py-4 font-medium">Reason</th>
              <th className="px-5 py-4 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((stock) => {
              const quote = stock?.live ?? {};
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
                    <p className="text-slate-400">{stock.companyName}</p>
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
                    <p className="text-slate-500">{quotePresentation.priceHelper}</p>
                    <p className="text-slate-500">Exchange: {quote.exchange ?? 'NSE'} / Source: {quote.source ?? 'Live market data'}</p>
                    <p className="text-slate-500">Last updated: {formatDateTime(quote.lastUpdated)}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-200">
                    <p>Profit booking {exitZonePlan.display?.profitBookingZone ?? formatCurrency(stock?.targets?.conservative?.price ?? stock?.target ?? stock?.signal?.tradePlan?.target1)}</p>
                    <p>Partial exit {exitZonePlan.display?.partialExitZone ?? formatCurrency(stock?.targets?.standard?.price ?? stock?.signal?.tradePlan?.target2)}</p>
                    <p>Full exit {exitZonePlan.display?.fullExitZone ?? formatCurrency(stock?.targets?.maximum?.price ?? stock?.signal?.tradePlan?.target3)}</p>
                    <p className="mt-1 text-slate-500">{exitZonePlan.riskyHoldWarning ?? 'Monitoring exit timing'}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-200">
                    <p>Stop zone {entryZonePlan.display?.stopLossZone ?? formatCurrency(stock?.signal?.tradePlan?.trailingStop)}</p>
                    <p className="mt-1 text-slate-500">Invalidation {formatCurrency(entryZonePlan.invalidationLevel ?? stock?.invalidationLevel ?? stock?.stopLoss ?? stock?.signal?.tradePlan?.stopLoss)}</p>
                    <p className="text-slate-500">{entryZonePlan.setupFailureCondition ?? stock?.failureCondition}</p>
                  </td>
                  <td className="px-5 py-4 text-amber-300">
                    <p>{stock?.exitPlan?.action ?? stock?.exitUrgency ?? 'Low'}</p>
                    <p className="mt-1 text-slate-500">{stock?.marketRegime} regime / sector {stock?.sectorScore ?? '--'}</p>
                    <p className="mt-1 text-slate-500">Action: {exitZonePlan.actionSummary ?? 'Monitor'}</p>
                    <p className="mt-1 text-slate-500">Zone quality: {entryZonePlan.zoneQualityScore ?? '--'}</p>
                  </td>
                  <td className="max-w-sm px-5 py-4 text-slate-400">
                    <p>{stock?.exitPlan?.reasons?.[0] ?? stock?.signal?.sellReasons?.[0] ?? 'Monitoring for exit triggers.'}</p>
                    <p className="mt-2 text-slate-300">{stock?.decision?.decisionReasonShort ?? 'Wait is a valid strategy when the setup is not clean enough.'}</p>
                    <p className="mt-2 text-slate-500">
                      Trend {stock?.confidenceBreakdown?.trend ?? '--'} / Volume {stock?.confidenceBreakdown?.volume ?? '--'} / Breakout {stock?.confidenceBreakdown?.breakout ?? '--'}
                    </p>
                    <p className="mt-2 text-slate-500">
                      Upside {entryZonePlan.riskReward?.estimatedUpsidePercent ?? '--'}% / Downside {entryZonePlan.riskReward?.estimatedDownsidePercent ?? '--'}% / R/R {entryZonePlan.riskReward?.rewardRiskRatio ?? '--'}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <SignalBadge signal={stock?.signal?.signal ?? 'WAIT'} compact />
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

export default SellOpportunityTable;
