import { formatCurrency, formatPercent } from '@/utils/formatters';

function StatCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-panel-soft/60 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

function renderBreakdownRows(breakdown) {
  return Object.entries(breakdown ?? {}).map(([signal, item]) => (
    <div key={signal} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
      <p className="metric-label">{signal}</p>
      <p className="mt-2 text-lg font-semibold text-white">
        {item.correct}/{item.total}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {item.total ? `${formatPercent((item.correct / item.total) * 100)} accuracy` : 'No signals yet'}
      </p>
    </div>
  ));
}

function renderConfidenceRows(confidenceBands) {
  return Object.entries(confidenceBands ?? {}).map(([band, item]) => (
    <div key={band} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
      <p className="metric-label">{band} Confidence</p>
      <p className="mt-2 text-lg font-semibold text-white">{formatPercent(item.accuracy)}</p>
      <p className="mt-1 text-sm text-slate-500">
        {item.correct}/{item.total} correct
      </p>
    </div>
  ));
}

function BacktestSummaryCard({ stats, predictionResults = [] }) {
  const items = [
    ['Total Signals', stats.totalSignals, 'Primary replay window'],
    ['Correct Signals', stats.correctSignals, 'Signals that matched later price behavior'],
    ['Accuracy', formatPercent(stats.accuracy), `${stats.windowResults?.[0]?.steps ?? 5}-step evaluation`],
    ['Wins', stats.wins, 'Correct BUY and SELL calls'],
    ['Losses', stats.losses, 'Incorrect directional calls or weak HOLD calls'],
    ['Average Gain', formatPercent(stats.averageGain), 'Correct bullish follow-through'],
    ['Average Loss', formatPercent(stats.averageLoss), 'Incorrect directional move'],
    ['Max Drawdown', formatPercent(stats.maxDrawdown), 'Approximate replay drawdown'],
    ['Best Setup', stats.bestSetupType, null],
    ['Weak Setup', stats.weakSetupType, null],
  ];

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <p className="metric-label">Backtest Summary</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Strategy performance snapshot</h3>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(([label, value, helper]) => (
            <StatCard key={label} label={label} value={value} helper={helper} />
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-border/60 bg-white/[0.02] p-4 text-sm leading-6 text-slate-400">
          {stats.notes}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <p className="metric-label">Signal Breakdown</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">BUY / SELL / HOLD accuracy</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-3">{renderBreakdownRows(stats.breakdown)}</div>
        </div>

        <div className="panel p-5">
          <p className="metric-label">Confidence vs Accuracy</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">How confidence translated into outcome</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-3">{renderConfidenceRows(stats.confidenceBands)}</div>
        </div>
      </div>

      <div className="panel p-5">
        <p className="metric-label">Evaluation Windows</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Short-term replay windows</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {(stats.windowResults ?? []).map((windowResult) => (
            <div key={windowResult.steps} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
              <p className="metric-label">{windowResult.steps}-Step Window</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatPercent(windowResult.accuracy)}</p>
              <p className="mt-1 text-sm text-slate-500">
                {windowResult.correctSignals}/{windowResult.totalSignals} correct
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-5">
        <p className="metric-label">Recent Evaluations</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Recent prediction outcomes</h3>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.02] text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Signal</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Entry / Outcome</th>
                <th className="px-4 py-3 font-medium">Change</th>
                <th className="px-4 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {(predictionResults ?? []).slice(0, 12).map((item) => (
                <tr key={item.id} className="border-t border-border/60">
                  <td className="px-4 py-3 text-white">{item.symbol}</td>
                  <td className="px-4 py-3 text-slate-200">{item.signal}</td>
                  <td className="px-4 py-3 text-slate-200">{item.confidence}%</td>
                  <td className="px-4 py-3 text-slate-200">{`${formatCurrency(item.entryPrice)} -> ${formatCurrency(item.futurePrice)}`}</td>
                  <td className="px-4 py-3 text-slate-200">{formatPercent(item.changePercent)}</td>
                  <td className={item.correct ? 'px-4 py-3 text-emerald-300' : 'px-4 py-3 text-rose-300'}>
                    {item.correct ? 'Correct' : 'Miss'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default BacktestSummaryCard;
