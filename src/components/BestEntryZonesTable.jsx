import EntryTypeBadge from '@/components/EntryTypeBadge';
import LiveBadge from '@/components/LiveBadge';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

function BestEntryZonesTable({ rows }) {
  const items = rows ?? [];

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <p className="metric-label">Entry Scanner</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Smart entry timing across tracked stocks</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-slate-400">
            <tr>
              <th className="px-5 py-4 font-medium">Stock</th>
              <th className="px-5 py-4 font-medium">LTP / Indicative Prices</th>
              <th className="px-5 py-4 font-medium">Entry Type</th>
              <th className="px-5 py-4 font-medium">Score / Confidence</th>
              <th className="px-5 py-4 font-medium">Ideal Entry / Targets / Invalidation</th>
              <th className="px-5 py-4 font-medium">Trend / Volume / Confidence</th>
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
                </td>
                <td className="px-5 py-4 text-slate-200">
                  <p>LTP {formatCurrency(livePrice)}</p>
                  <p className="mt-1 text-slate-400">Indicative Buy {formatCurrency(buyPrice)} / Indicative Sell {formatCurrency(sellPrice)}</p>
                  <p className="text-slate-500">
                    Status: {quote.marketStatus ?? '--'}
                    {quote.marketStatusDetail ? ` / ${quote.marketStatusDetail}` : ''}
                  </p>
                  {quote.stale ? <p className="text-amber-300">Feed: {quote.staleLabel}</p> : null}
                  <p className="text-slate-500">Exchange: {quote.exchange ?? 'NSE'} / Source: {quote.source ?? 'Live market data'}</p>
                  <p className="text-slate-500">Last updated: {formatDateTime(quote.lastUpdated)}</p>
                </td>
                <td className="px-5 py-4">
                  <EntryTypeBadge type={item.entryType} />
                </td>
                <td className="px-5 py-4 text-slate-300">
                  <p className="text-lg font-semibold text-white">{item.entryScore}/100</p>
                  <p className="mt-1">{item.confidence}% confidence</p>
                  <p className="mt-1 text-slate-500">Final action {item.decision?.finalDecision ?? 'WAIT'} / {item.decision?.decisionStrength ?? 'WEAK'}</p>
                </td>
                <td className="px-5 py-4 text-slate-300">
                  <p>Entry {formatCurrency(item.idealEntryPrice)}</p>
                  <p className="text-emerald-300">Conservative {formatCurrency(item.targets?.conservative?.price ?? item.target)}</p>
                  <p className="text-emerald-300">Standard {formatCurrency(item.targets?.standard?.price ?? item.target)}</p>
                  <p className="text-slate-300">Stretch {formatCurrency(item.targets?.maximum?.price ?? item.target)}</p>
                  <p className="mt-2 text-slate-500">Invalidation {formatCurrency(item.invalidationLevel ?? item.stopLoss)}</p>
                </td>
                <td className="px-5 py-4 text-slate-300">
                  <p>{item.currentTrend}</p>
                  <p>{item.volumeStrength}</p>
                  <p>Trend {item.trendStrength}/100</p>
                  <p>Timeframes {item.confidenceBreakdown?.timeframe ?? '--'}</p>
                  <p>R/R {item.confidenceBreakdown?.riskReward ?? '--'}</p>
                  <p className="text-slate-500">Breakout gap {formatCurrency(item.nearestBreakoutGap)}</p>
                </td>
                <td className="min-w-[320px] px-5 py-4 text-slate-400">
                  <p>{item.reasonSummary}</p>
                  <p className="mt-2 text-slate-300">{item.decision?.decisionReasonShort ?? 'Wait is a valid strategy when the setup is not clean enough.'}</p>
                  <p className="mt-2 text-slate-500">{item.failureCondition}</p>
                  <p className="mt-2 text-slate-500">{item.marketRegime} regime / sector {item.sectorScore ?? '--'}</p>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BestEntryZonesTable;
