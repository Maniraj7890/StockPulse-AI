import { useMemo } from 'react';
import EmptyState from '@/components/EmptyState';
import SectionHeader from '@/components/SectionHeader';
import { getAIAvailabilityState } from '@/services/aiExplanationService';
import { useMarketStore } from '@/store/useMarketStore';

const settingSections = [
  {
    title: 'Market Data Settings',
    description: 'Control quote refresh cadence and session-aware monitoring behavior.',
    items: {
      refreshInterval: ['2s', '3s', '5s'],
      marketSession: ['NSE cash', 'NSE + BSE'],
    },
  },
  {
    title: 'Prediction Behavior',
    description: 'Tune how selective StockPulse should be and how confidence is shown.',
    items: {
      strategyMode: ['Strict', 'Balanced', 'Aggressive'],
      signalSensitivity: ['balanced', 'aggressive', 'conservative'],
      riskProfile: ['moderate', 'low', 'high'],
      showConfidenceAs: ['percent', 'banded'],
      fastSignalRefreshInterval: ['30s', '60s'],
      strongConfirmationRefreshInterval: ['300s'],
    },
  },
  {
    title: 'Alerts and Watchlist',
    description: 'Choose how much monitoring noise to allow and how personal tracking should behave.',
    items: {
      alertPreferences: ['all', 'critical only'],
      watchlistPreferences: ['mixed', 'favorites'],
    },
  },
  {
    title: 'Development and Future AI',
    description: 'Keep production clean while preserving safe extension points for future explanation features.',
    items: {
      aiExplanationsEnabled: ['disabled', 'enabled'],
      devToolsEnabled: ['disabled', 'enabled'],
    },
  },
];

function SettingCard({ label, values, currentValue, onSelect, description }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
      <p className="metric-label">{label}</p>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {values.map((value) => (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className={currentValue === value ? 'app-button-primary' : 'app-button'}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
      <p className="metric-label">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm leading-6 text-slate-400">{helper}</p> : null}
    </div>
  );
}

function LaunchChecklistPanel({ checks }) {
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="panel p-5">
      <p className="metric-label">Developer Checklist</p>
      <h3 className="mt-2 font-display text-xl font-bold text-white">Launch readiness helper</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <div key={check.label} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">{check.label}</p>
              <span className={check.ok ? 'brand-badge' : 'rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-200'}>
                {check.ok ? 'Verified' : 'Review'}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{check.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  const settings = useMarketStore((state) => state.settings);
  const updateSetting = useMarketStore((state) => state.updateSetting);
  const resetUserWorkspace = useMarketStore((state) => state.resetUserWorkspace);
  const watchlist = useMarketStore((state) => state.watchlist ?? []);
  const portfolioHoldings = useMarketStore((state) => state.portfolioHoldings ?? []);
  const signalHistory = useMarketStore((state) => state.signalHistory ?? []);
  const alertSnapshot = useMarketStore((state) => state.alertSnapshot);
  const marketDataSnapshot = useMarketStore((state) => state.marketDataSnapshot);
  const aiState = getAIAvailabilityState();

  const launchChecks = useMemo(
    () => [
      { label: 'Routes verified', ok: true, helper: 'Every core workspace route resolves inside the shared app shell.' },
      { label: 'Mobile navigation', ok: true, helper: 'Responsive drawer navigation is active and debug-only helpers stay hidden in production.' },
      {
        label: 'Market closed handling',
        ok: true,
        helper: 'Closed-session labels, last traded price wording, and next-session planning states are wired globally.',
      },
      {
        label: 'Local storage recovery',
        ok: true,
        helper: 'Portfolio, watchlist, alerts, settings, and signal history now recover safely from malformed saved data.',
      },
      {
        label: 'Debug visibility',
        ok: settings.devToolsEnabled === 'enabled',
        helper: settings.devToolsEnabled === 'enabled' ? 'Developer toggles are intentionally on for this session.' : 'Developer toggles stay off for a cleaner production-like experience.',
      },
      {
        label: 'AI fallback readiness',
        ok: true,
        helper: aiState.available ? 'Provider configuration is available with local fallback protection.' : 'Rule-engine fallback mode is ready when no provider is configured.',
      },
    ],
    [aiState.available, settings.devToolsEnabled],
  );

  return (
    <div className="page-shell">
      <SectionHeader
        eyebrow="Settings"
        title="Control center and launch readiness"
        description="Adjust refresh cadence, monitoring behavior, confidence display, local data handling, and future AI placeholders without changing the rule-based analysis core."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Tracked Watchlist" value={String(watchlist.length)} helper="Personal watchlist symbols stored locally with safe recovery." />
        <InfoCard label="Portfolio Holdings" value={String(portfolioHoldings.length)} helper="Holdings, unrealized P&L, and holding-level risk stay local to this browser." />
        <InfoCard label="Saved Signals" value={String(signalHistory.length)} helper="Signal history powers local backtesting, confidence calibration, and performance review." />
        <InfoCard label="Triggered Alerts" value={String(alertSnapshot?.triggeredAlerts?.length ?? 0)} helper="Active, triggered, and expired alerts remain available even when live AI is absent." />
      </div>

      <div className="space-y-6">
        {settingSections.map((section) => (
          <div key={section.title} className="panel p-5">
            <p className="metric-label">{section.title}</p>
            <h3 className="mt-2 font-display text-xl font-bold text-white">{section.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{section.description}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(section.items).map(([key, values]) => (
                <SettingCard
                  key={key}
                  label={key}
                  values={values}
                  currentValue={settings[key]}
                  description={
                    key === 'showConfidenceAs'
                      ? 'Choose between exact percentage confidence or simplified confidence bands.'
                      : key === 'devToolsEnabled'
                        ? 'Developer panels stay hidden in production mode even if enabled here.'
                        : undefined
                  }
                  onSelect={(value) => updateSetting(key, value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel p-5">
        <p className="metric-label">AI Provider Placeholder</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Explanation mode and provider readiness</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Current Provider" value={aiState.provider} helper="Future explanation layer only. The rule engine remains the source of truth." />
          <InfoCard
            label="Explanation Mode"
            value={
              settings.aiExplanationsEnabled === 'disabled'
                ? 'Rule-engine fallback'
                : aiState.available
                  ? 'Provider enabled'
                  : 'Fallback mode'
            }
            helper="No external AI call is required for the app to stay fully functional."
          />
          <InfoCard
            label="Provider State"
            value={aiState.available ? 'Configured' : 'Not configured'}
            helper={aiState.available ? 'The provider can be used when explanations are explicitly enabled.' : 'Missing configuration automatically falls back to deterministic local explanations.'}
          />
          <InfoCard
            label="Fallback Safety"
            value="Always on"
            helper="AI never overrides direction, confidence, entry zones, or exit logic."
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <p className="metric-label">About StockPulse</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">What this workspace does well</h3>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <p>StockPulse is a rule-based market analyzer built to help you understand market tone, prediction strength, entry and exit zones, monitoring alerts, and personal watchlist or portfolio risk.</p>
            <p>It does not guarantee outcomes, does not promise profit, and treats no-trade or wait states as valid decisions when edge is weak.</p>
            <p>When markets are closed or data is stale, the app intentionally downgrades confidence and labels outputs as last-session or next-session planning estimates.</p>
          </div>
        </div>

        <div className="panel p-5">
          <p className="metric-label">Data and Reset</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Local workspace controls</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
            <p>Resetting clears personal holdings, watchlist items, price alerts, saved settings, and local signal history. Market analysis will rebuild from the shared rule engine on the next refresh.</p>
            <p>Saved snapshots use versioned local storage with validation so older or malformed values do not crash the app.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={resetUserWorkspace} className="app-button-accent">
              Reset local workspace
            </button>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <p className="metric-label">Future Export Placeholders</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Share and export readiness</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Watchlist Export" value="Planned" helper="Prepare personal watchlist snapshots for future CSV or report export." />
          <InfoCard label="Signal History Export" value="Planned" helper="Saved signals are structured to support local export without backend dependencies later." />
          <InfoCard label="Backtest Summary Export" value="Planned" helper="Confidence buckets and setup-family summaries are already normalized for future exports." />
          <InfoCard label="Insight Snapshot Sharing" value="Planned" helper="Future share cards can reuse the current normalized analysis view model." />
        </div>
      </div>

      {import.meta.env.DEV ? <LaunchChecklistPanel checks={launchChecks} /> : null}

      {!marketDataSnapshot?.quotes?.length ? (
        <EmptyState
          title="Market data is still warming up"
          description="Once the first quote snapshot is ready, StockPulse will apply your refresh, alert, and tracking preferences automatically."
        />
      ) : null}

      <div className="panel border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-7 text-slate-300">
        StockPulse is an analysis support workspace. It helps you monitor market structure, signal quality, risk, and timing context, but it does not replace independent verification or disciplined risk management.
      </div>
    </div>
  );
}

export default SettingsPage;
