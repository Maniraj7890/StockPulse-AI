import EmptyState from '@/components/EmptyState';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

function AlertStatusBadge({ status }) {
  const tone =
    status === 'ACTIVE'
      ? 'border-sky-400/30 bg-sky-400/10 text-sky-200'
      : status === 'EXPIRED'
        ? 'border-slate-400/30 bg-slate-400/10 text-slate-300'
        : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
      {status}
    </span>
  );
}

function AlertPriorityBadge({ priority = 'LOW' }) {
  const tone =
    priority === 'HIGH'
      ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
      : priority === 'MEDIUM'
        ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
        : 'border-slate-400/30 bg-slate-400/10 text-slate-200';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
      {priority}
    </span>
  );
}

function AlertCard({ alert, onClearAlert }) {
  const spikeContext =
    alert.type === 'SPIKE'
      ? `${alert.spikeType?.replace(/_/g, ' ')} / ${alert.severity ?? 'mild'} / ${alert.confirmationState ?? 'watch'}`
      : null;
  return (
    <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-white">{alert.symbol} - {alert.type}</p>
          <p className="mt-1 text-sm text-slate-400">{alert.message}</p>
          {alert.alertReason ? <p className="mt-2 text-xs text-slate-300">{alert.alertReason}</p> : null}
          {alert.context ? <p className="mt-2 text-xs text-slate-500">{alert.context}</p> : null}
          {spikeContext ? <p className="mt-2 text-xs text-amber-200">{spikeContext}</p> : null}
          {alert.priceAtTrigger ? <p className="mt-1 text-xs text-slate-500">Price at trigger: {formatCurrency(alert.priceAtTrigger)}</p> : null}
          {alert.symbolState ? (
            <p className="mt-1 text-xs text-slate-500">
              State: {alert.symbolState.direction} / {alert.symbolState.confidence}% / {alert.symbolState.actionBias}
            </p>
          ) : null}
        </div>
        <button
          onClick={() => onClearAlert(alert.id)}
          className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-400 transition hover:text-white"
        >
          Clear
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-amber-300">{alert.type}</span>
          <AlertPriorityBadge priority={alert.alertPriority ?? 'LOW'} />
          <AlertStatusBadge status={alert.status ?? 'TRIGGERED'} />
        </div>
        <span className="text-slate-500">Score {alert.alertScore ?? 0} / {formatDateTime(alert.timestamp)}</span>
      </div>
    </div>
  );
}

function AlertPanel({ alerts, activeRules = [], lastChecked, onClearAlert, onClearAll }) {
  const items = alerts ?? [];
  const triggeredAlerts = items.filter((alert) => (alert.status ?? 'TRIGGERED') !== 'EXPIRED');
  const expiredAlerts = items.filter((alert) => (alert.status ?? 'TRIGGERED') === 'EXPIRED');

  if (!items.length && !activeRules.length) {
    return (
      <EmptyState
        title="No active alerts right now"
        description="The alert engine is monitoring price thresholds, prediction changes, stop-loss breaches, target hits, and sudden market moves."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="metric-label">Alert Center</p>
            <h3 className="mt-2 font-display text-xl font-bold text-white">Triggered alerts</h3>
            <p className="mt-2 text-sm text-slate-400">
              {lastChecked ? `Last checked ${formatDateTime(lastChecked)}.` : 'Alert checks will appear once the live engine refreshes.'}
            </p>
          </div>
          <button
            onClick={onClearAll}
            className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-400 transition hover:text-white"
          >
            Clear all
          </button>
        </div>

        {triggeredAlerts.length ? (
          <div className="mt-5 space-y-3">
            {triggeredAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onClearAlert={onClearAlert} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-border/60 bg-panel-soft/60 p-4 text-sm text-slate-400">
            No triggered alerts yet. Active rules are still being monitored.
          </div>
        )}
      </div>

      <div className="panel p-5">
        <p className="metric-label">Active Rules</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Local in-app alert thresholds</h3>

        {activeRules.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {activeRules.map((rule) => (
              <div key={rule.id} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{rule.symbol}</p>
                  <AlertStatusBadge status={rule.status ?? 'ACTIVE'} />
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  Trigger when price moves {rule.direction} {formatCurrency(rule.price)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-border/60 bg-panel-soft/60 p-4 text-sm text-slate-400">
            No active price rules configured yet.
          </div>
        )}
      </div>

      <div className="panel p-5">
        <p className="metric-label">Expired Alerts</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Older alert log</h3>

        {expiredAlerts.length ? (
          <div className="mt-5 space-y-3">
            {expiredAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onClearAlert={onClearAlert} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-border/60 bg-panel-soft/60 p-4 text-sm text-slate-400">
            No expired alerts yet.
          </div>
        )}
      </div>
    </div>
  );
}

export default AlertPanel;
