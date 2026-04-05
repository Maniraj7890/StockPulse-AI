import SignalBadge from '@/components/SignalBadge';
import { formatCurrency, formatDateTime, formatPercent } from '@/utils/formatters';

function GainersTable({ rows }) {
  return (
    <div className="panel p-5">
      <p className="metric-label">Leaders</p>
      <h3 className="mt-2 font-display text-xl font-bold text-white">Top gainers</h3>
      <div className="mt-5 space-y-3">
        {(rows ?? []).map((stock) => {
          const quote = stock.live ?? {};
          const livePrice = quote.ltp ?? stock.currentPrice;
          return (
          <div key={stock.symbol} className="rounded-2xl border border-border/60 bg-panel-soft/60 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{stock.symbol}</p>
                <p className="text-sm text-slate-400">{stock.companyName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {quote.exchange ?? 'NSE'} / {quote.source ?? 'Live market data'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-white">LTP {formatCurrency(livePrice)}</p>
                <p className="text-sm text-emerald-300">{formatPercent(quote.changePercent ?? stock.dayChangePercent)}</p>
                <p className="text-xs text-slate-500">
                  Status: {quote.marketStatus ?? '--'}
                  {quote.marketStatusDetail ? ` / ${quote.marketStatusDetail}` : ''}
                </p>
                {quote.stale ? <p className="text-xs text-amber-300">Feed: {quote.staleLabel}</p> : null}
                <p className="text-xs text-slate-500">Last updated: {formatDateTime(quote.lastUpdated)}</p>
              </div>
              <SignalBadge signal={stock.signal.signal} compact />
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}

export default GainersTable;
