import AIExplanationCard from '@/components/AIExplanationCard';
import AlertPanel from '@/components/AlertPanel';
import SectionHeader from '@/components/SectionHeader';
import { useLiveMarketData } from '@/hooks/useLiveMarketData';
import { useMarketStore } from '@/store/useMarketStore';
import { formatDateTime } from '@/utils/formatters';

function AlertsPage() {
  const alerts = useMarketStore((state) => state.alertSnapshot?.triggeredAlerts ?? state.alerts ?? []);
  const latestAlert = alerts[0] ?? null;
  const importantNow = useMarketStore((state) => state.alertSnapshot?.importantNow ?? []);
  const activeRules = useMarketStore((state) => state.alertSnapshot?.activeAlerts ?? []);
  const expiredAlerts = useMarketStore((state) => state.alertSnapshot?.expiredAlerts ?? []);
  const lastAlertCheck = useMarketStore((state) => state.alertSnapshot?.lastChecked ?? state.lastAlertCheck);
  const spikeHistory = useMarketStore((state) => state.spikeHistory ?? []);
  const dismissAlert = useMarketStore((state) => state.toggleAlert);
  const clearAlerts = useMarketStore((state) => state.clearAlerts);
  const requestNotificationPermission = useMarketStore((state) => state.requestNotificationPermission);
  const { quotesBySymbol } = useLiveMarketData({ symbols: latestAlert?.symbol ? [latestAlert.symbol] : [] });
  const alertSnapshot = latestAlert?.symbol ? quotesBySymbol?.[latestAlert.symbol] ?? null : null;
  const alertAnalysis = useMarketStore((state) =>
    latestAlert?.symbol ? state.analysisData?.[latestAlert.symbol] ?? null : null,
  );
  const explanationPayload =
    latestAlert && alertSnapshot
      ? {
          symbol: latestAlert.symbol,
          marketStatus: alertSnapshot.marketStatus ?? 'UNKNOWN',
          signal: alertAnalysis?.signal?.signal ?? alertAnalysis?.tradeGuidance?.prediction?.signal ?? 'HOLD',
          confidence: alertAnalysis?.signal?.confidence ?? alertAnalysis?.tradeGuidance?.prediction?.confidence ?? 0,
          rsi: alertAnalysis?.indicators?.rsi14 ?? null,
          ema9: alertAnalysis?.indicators?.ema9 ?? null,
          ema21: alertAnalysis?.indicators?.ema21 ?? null,
          momentum: alertSnapshot.changePercent ?? alertAnalysis?.dayChangePercent ?? 0,
          volatility: alertAnalysis?.indicators?.atr14 ?? null,
          buyZone: alertAnalysis?.buyZone ?? null,
          exitPlan: alertAnalysis?.exitPlan ?? null,
          stopLoss: alertAnalysis?.stopLoss ?? alertAnalysis?.signal?.tradePlan?.stopLoss ?? null,
          target: alertAnalysis?.target ?? alertAnalysis?.signal?.tradePlan?.target1 ?? null,
        }
      : latestAlert
        ? {
            symbol: latestAlert.symbol,
            marketStatus: 'UNKNOWN',
            signal: 'HOLD',
            confidence: 0,
            rsi: null,
            ema9: null,
            ema21: null,
            momentum: 0,
            volatility: null,
            buyZone: null,
            exitPlan: null,
            stopLoss: null,
            target: null,
          }
        : null;
  const triggeredAlerts = alerts;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Alerts"
        title="Condition-based alert stream"
        description="Track active local rules, recent triggered alerts, older expired alerts, and the last alert check from the centralized engine."
        action={
          <div className="flex gap-3">
            <button
              onClick={() => {
                requestNotificationPermission();
              }}
              className="rounded-2xl border border-border/70 bg-panel px-4 py-3 text-sm text-slate-300 transition hover:border-emerald-400/30 hover:text-white"
            >
              Enable browser alerts
            </button>
            <button
              onClick={clearAlerts}
              className="rounded-2xl border border-border/70 bg-panel px-4 py-3 text-sm text-slate-300 transition hover:border-rose-400/30 hover:text-white"
            >
              Clear alerts
            </button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Active Alerts</p>
          <p className="mt-2 text-lg font-semibold text-white">{activeRules.length}</p>
          <p className="mt-1 text-sm text-slate-500">Local price rules being monitored</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Triggered Alerts</p>
          <p className="mt-2 text-lg font-semibold text-white">{triggeredAlerts.length}</p>
          <p className="mt-1 text-sm text-slate-500">Recent alert stream within the last 24 hours</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Expired Alerts</p>
          <p className="mt-2 text-lg font-semibold text-white">{expiredAlerts.length}</p>
          <p className="mt-1 text-sm text-slate-500">Older entries kept for readable audit context</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Spike Events Logged</p>
          <p className="mt-2 text-lg font-semibold text-white">{spikeHistory.length}</p>
          <p className="mt-1 text-sm text-slate-500">Recent abnormal move events stored locally for review</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Last Checked</p>
          <p className="mt-2 text-lg font-semibold text-white">{lastAlertCheck ? 'Updated' : '--'}</p>
          <p className="mt-1 text-sm text-slate-500">{lastAlertCheck ? formatDateTime(lastAlertCheck) : 'Waiting for first alert cycle'}</p>
        </div>
      </div>
      <div className="panel p-5">
        <p className="metric-label">Important Now</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Top priority alerts</h3>
        <div className="mt-4 space-y-3">
          {importantNow.length ? importantNow.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{alert.symbol} - {alert.type}</p>
                  <p className="mt-1 text-sm text-slate-400">{alert.message}</p>
                  <p className="mt-2 text-xs text-slate-300">{alert.alertReason ?? alert.context ?? 'Rule-based alert requires attention.'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{alert.alertPriority ?? 'LOW'}</p>
                  <p className="mt-1 text-lg font-semibold text-white">{alert.alertScore ?? 0}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">{formatDateTime(alert.timestamp)}</p>
            </div>
          )) : (
            <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4 text-sm text-slate-400">
              No high-importance alert needs attention right now.
            </div>
          )}
        </div>
      </div>
      <AIExplanationCard
        title="AI Alert Context"
        eyebrow="AI Explanation"
        payload={latestAlert ? { ...explanationPayload, explanationType: 'alert_context', alertType: latestAlert.type, alertMessage: latestAlert.message } : explanationPayload}
      />
      <AlertPanel
        alerts={[...triggeredAlerts, ...expiredAlerts]}
        activeRules={activeRules}
        lastChecked={lastAlertCheck}
        onClearAlert={dismissAlert}
        onClearAll={clearAlerts}
      />
    </div>
  );
}

export default AlertsPage;
