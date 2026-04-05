import { formatCurrency, formatDateTime, formatPercent } from '@/utils/formatters';

function RiskBadge({ level = 'MODERATE' }) {
  const tone =
    level === 'HIGH'
      ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
      : level === 'LOW'
        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
        : 'border-amber-400/30 bg-amber-400/10 text-amber-200';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
      {level}
    </span>
  );
}

function PnLText({ value = 0, percent = 0 }) {
  const positive = value >= 0;
  return (
    <div>
      <p className={positive ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>
        {formatCurrency(value)}
      </p>
      <p className={positive ? 'text-xs text-emerald-200' : 'text-xs text-rose-200'}>
        {formatPercent(percent)}
      </p>
    </div>
  );
}

function PortfolioHoldingsTable({ rows, onEdit, onRemove }) {
  const safeRows = rows ?? [];

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <p className="metric-label">Portfolio</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Holdings and unrealized P&amp;L</h3>
      </div>
      <div className="mobile-card-list p-4">
        {safeRows.map((item) => (
          <article key={`${item.id}-mobile`} className="rounded-3xl border border-border/70 bg-panel-soft/70 p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">{item.symbol}</p>
                <p className="mt-1 text-sm text-slate-400">{item.marketValueLabel}</p>
                <p className="mt-1 text-xs text-slate-500">{item.direction} / {item.confidence}% / {item.quality}</p>
              </div>
              <RiskBadge level={item.riskLevel} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Quantity</p>
                <p className="mt-1">{item.quantity} shares</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Average buy</p>
                <p className="mt-1">{formatCurrency(item.averageBuyPrice)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Invested</p>
                <p className="mt-1">{formatCurrency(item.totalInvestedAmount)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Current value</p>
                <p className="mt-1">{formatCurrency(item.currentValue)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border/60 bg-white/[0.02] p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Unrealized P&amp;L</p>
              <div className="mt-2">
                <PnLText value={item.unrealizedPnL} percent={item.pnlPercent} />
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{item.holdBias}</p>
              <p className="mt-1 text-xs text-slate-500">{item.stopLossWarning}</p>
              <p className="mt-2 text-xs text-slate-400">{item.downsideRiskNote}</p>
              <p className="mt-2 text-xs text-slate-500">Updated {formatDateTime(item.lastUpdated)}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => onEdit?.(item)} className="app-button">
                Edit
              </button>
              <button
                onClick={() => onRemove?.(item.id)}
                className="app-button border-rose-400/30 text-rose-200 hover:border-rose-300/50 hover:bg-rose-400/10"
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="desktop-table overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-slate-400">
            <tr>
              <th className="px-5 py-4 font-medium">Stock</th>
              <th className="px-5 py-4 font-medium">Quantity / Avg</th>
              <th className="px-5 py-4 font-medium">Invested / Value</th>
              <th className="px-5 py-4 font-medium">Unrealized P&amp;L</th>
              <th className="px-5 py-4 font-medium">Risk / Action</th>
              <th className="px-5 py-4 font-medium">Alerts</th>
              <th className="px-5 py-4 font-medium">Updated</th>
              <th className="px-5 py-4 font-medium" />
            </tr>
          </thead>
          <tbody>
            {safeRows.map((item) => (
              <tr key={item.id} className="border-t border-border/60 align-top">
                <td className="px-5 py-4">
                  <p className="font-semibold text-white">{item.symbol}</p>
                  <p className="text-slate-400">{item.marketValueLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.direction} / {item.confidence}% / {item.quality}</p>
                </td>
                <td className="px-5 py-4 text-slate-300">
                  <p>{item.quantity} shares</p>
                  <p className="text-slate-500">Avg {formatCurrency(item.averageBuyPrice)}</p>
                </td>
                <td className="px-5 py-4 text-slate-300">
                  <p>{formatCurrency(item.totalInvestedAmount)}</p>
                  <p className="text-slate-500">{formatCurrency(item.currentValue)}</p>
                </td>
                <td className="px-5 py-4">
                  <PnLText value={item.unrealizedPnL} percent={item.pnlPercent} />
                </td>
                <td className="px-5 py-4 text-slate-300">
                  <RiskBadge level={item.riskLevel} />
                  <p className="mt-2 text-sm font-semibold text-white">{item.holdBias}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.stopLossWarning}</p>
                </td>
                <td className="px-5 py-4 text-slate-300">
                  <p>{item.alerts?.length ?? 0} active context alerts</p>
                  <p className="mt-1 text-xs text-slate-500">{item.downsideRiskNote}</p>
                </td>
                <td className="px-5 py-4 text-slate-400">
                  <p>{formatDateTime(item.lastUpdated)}</p>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => onEdit?.(item)}
                      className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-400 transition hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onRemove?.(item.id)}
                      className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-400 transition hover:border-rose-400/30 hover:text-rose-200"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PortfolioHoldingsTable;
