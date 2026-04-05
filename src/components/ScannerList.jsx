import LiveBadge from '@/components/LiveBadge';
import SignalBadge from '@/components/SignalBadge';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

function ScannerList({ title, eyebrow, rows }) {
  return (
    <div className="panel p-5">
      <p className="metric-label">{eyebrow}</p>
      <h3 className="mt-2 font-display text-xl font-bold text-white">{title}</h3>
      <div className="mt-5 space-y-3">
        {(rows ?? []).map((row) => {
          const quote = row.live ?? {};
          const ltp = quote.ltp ?? row.currentPrice;
          return (
          <div key={row.symbol} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white">{row.symbol}</p>
                  <LiveBadge status={quote.marketStatus} />
                </div>
                <p className="text-sm text-slate-400">{row.signal.explanation}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {quote.exchange ?? 'NSE'} / {quote.source ?? 'Live market data'}
                </p>
              </div>
              <SignalBadge signal={row.signal.signal} compact />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
              <span>LTP {formatCurrency(ltp)}</span>
              <span className={quote.stale ? 'text-amber-300' : ''}>
                Status: {quote.marketStatus ?? '--'}
                {quote.marketStatusDetail ? ` / ${quote.marketStatusDetail}` : ''}
              </span>
              <span>{row.signal.confidence}% confidence</span>
            </div>
            {quote.stale ? <p className="mt-2 text-xs text-amber-300">Feed: {quote.staleLabel}</p> : null}
            <p className="mt-1 text-xs text-slate-500">Last updated: {formatDateTime(quote.lastUpdated)}</p>
          </div>
        )})}
      </div>
    </div>
  );
}

export default ScannerList;
