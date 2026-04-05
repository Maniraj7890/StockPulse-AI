import { formatCurrency, formatDateTime, formatPercent } from '@/utils/formatters';

function OutcomeBadge({ outcome, evaluated }) {
  const tone =
    outcome === 'SUCCESS'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
      : outcome === 'FAILURE'
        ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
        : outcome === 'PARTIAL'
          ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
        : 'border-slate-400/30 bg-slate-400/10 text-slate-200';

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
      {evaluated ? outcome ?? 'NEUTRAL' : 'PENDING'}
    </span>
  );
}

function SignalHistoryTable({ rows }) {
  const safeRows = rows ?? [];

  if (!safeRows.length) {
    return (
      <div className="panel p-6">
        <p className="metric-label">History</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Recorded signals</h3>
        <p className="mt-4 text-sm text-slate-400">
          No signals match the current filters yet.
        </p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <p className="metric-label">History</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Recorded signals</h3>
      </div>
      <div className="mobile-card-list p-4">
        {safeRows.map((item) => (
          <article key={`${item.id}-mobile`} className="rounded-3xl border border-border/70 bg-panel-soft/70 p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">{item.symbol}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.timestamp)}</p>
              </div>
              <OutcomeBadge outcome={item.outcome} evaluated={item.evaluated} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Direction</p>
                <p className="mt-1">{item.direction}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Setup</p>
                <p className="mt-1">{item.setupType ?? 'No Trade'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Family</p>
                <p className="mt-1">{item.setupFamily ?? 'mixed sideways'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Confidence</p>
                <p className="mt-1">{item.confidence}%</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border/60 bg-white/[0.02] p-3 text-sm text-slate-300">
              <p>Entry {formatCurrency(item.entryPrice)}</p>
              <p className="mt-1 text-slate-400">Current / Exit {item.exitPrice != null ? formatCurrency(item.exitPrice) : '--'}</p>
              <p className="mt-2 text-slate-400">
                Expected {formatPercent(item.expectedMoveMin)} to {formatPercent(item.expectedMoveMax)}
              </p>
              <p className="mt-2 text-xs text-slate-500">{item.entryType ?? 'No Trade'} / {item.actionSummary ?? 'Monitor'}</p>
              <p className="mt-2 text-xs text-slate-400">
                Move {formatPercent(item.moveAchievedPercent ?? 0)} / Drawdown {formatPercent(item.drawdownPercent ?? 0)}
              </p>
              {item.usefulness ? <p className="mt-2 text-xs text-slate-500">{item.usefulness}</p> : null}
            </div>
          </article>
        ))}
      </div>
      <div className="desktop-table overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-slate-400">
            <tr>
              <th className="px-5 py-4 font-medium">Date / Time</th>
              <th className="px-5 py-4 font-medium">Stock</th>
              <th className="px-5 py-4 font-medium">Direction / Setup</th>
              <th className="px-5 py-4 font-medium">Family / Quality</th>
              <th className="px-5 py-4 font-medium">Entry Type / Action</th>
              <th className="px-5 py-4 font-medium">Entry / Exit</th>
              <th className="px-5 py-4 font-medium">Expected Move</th>
              <th className="px-5 py-4 font-medium">Confidence</th>
              <th className="px-5 py-4 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {safeRows.map((item) => (
              <tr key={item.id} className="border-t border-border/60 align-top">
                <td className="px-5 py-4 text-slate-400">{formatDateTime(item.timestamp)}</td>
                <td className="px-5 py-4">
                  <p className="font-semibold text-white">{item.symbol}</p>
                  <p className="text-slate-500">{item.setupAge ?? 'Unknown age'}</p>
                </td>
                <td className="px-5 py-4 text-slate-200">
                  <p>{item.direction}</p>
                  <p className="text-slate-500">{item.setupType ?? 'No Trade'}</p>
                </td>
                <td className="px-5 py-4 text-slate-200">
                  <p>{item.setupFamily ?? 'mixed sideways'}</p>
                  <p className="text-slate-500">{item.quality ?? 'WEAK'} / {item.confidenceBucket ?? '0-30'}</p>
                </td>
                <td className="px-5 py-4 text-slate-200">
                  <p>{item.entryType ?? 'No Trade'}</p>
                  <p className="text-slate-500">{item.actionSummary ?? 'Monitor'}</p>
                </td>
                <td className="px-5 py-4 text-slate-200">
                  <p>Entry {formatCurrency(item.entryPrice)}</p>
                  <p className="text-slate-500">Current / Exit {item.exitPrice != null ? formatCurrency(item.exitPrice) : '--'}</p>
                </td>
                <td className="px-5 py-4 text-slate-200">
                  <p>
                    {`${formatPercent(item.expectedMoveMin)} to ${formatPercent(item.expectedMoveMax)}`}
                  </p>
                  <p className="text-slate-500">15m {item.expectedMove15m?.text ?? '--'}</p>
                  <p className="text-slate-500">30m {item.expectedMove30m?.text ?? '--'}</p>
                  <p className="text-slate-500">Inv. {formatCurrency(item.invalidation)}</p>
                </td>
                <td className="px-5 py-4 text-slate-200">
                  <p>{item.confidence}%</p>
                  <p className="text-slate-500">{item.setupType ?? 'No Trade'}</p>
                </td>
                <td className="px-5 py-4">
                  <OutcomeBadge outcome={item.outcome} evaluated={item.evaluated} />
                  <p className="mt-2 text-xs text-slate-400">
                    Move {formatPercent(item.moveAchievedPercent ?? 0)} / Drawdown {formatPercent(item.drawdownPercent ?? 0)}
                  </p>
                  {item.usefulness ? <p className="mt-2 max-w-[16rem] text-xs text-slate-500">{item.usefulness}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SignalHistoryTable;
