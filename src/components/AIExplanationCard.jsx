import { useAIExplanation } from '@/hooks/useAIExplanation';

const defaultVisibleExplanation = {
  summary: 'Signal is based on the current rule engine output.',
  riskNote: 'Market is closed; using last session data.',
  invalidationNote: 'Use the engine invalidation level before acting.',
  actionNote: 'Wait for market confirmation.',
  actionBias: 'Wait for market confirmation.',
  reasons: ['EMA trend mixed', 'Momentum moderate', 'No live session confirmation'],
};

function AIExplanationCard({
  payload,
  title = 'AI Explanation',
  eyebrow = 'AI Summary',
  fallbackExplanation = defaultVisibleExplanation,
  className = '',
  compact = false,
}) {
  const {
    loading,
    explanation,
    error,
    provider,
    providerMode,
    aiEnabled,
    available,
    fallbackReason,
    lastRequestedAt,
    cacheStatus,
  } = useAIExplanation(payload);
  const content = explanation ?? fallbackExplanation;
  const visibleExplanation = {
    summary: content.summary ?? fallbackExplanation.summary,
    riskNote: content.riskNote ?? fallbackExplanation.riskNote,
    invalidationNote: content.invalidationNote ?? fallbackExplanation.invalidationNote,
    actionNote: content.actionNote ?? content.actionBias ?? fallbackExplanation.actionNote,
    actionBias: content.actionBias ?? fallbackExplanation.actionBias,
    reasons:
      Array.isArray(content.reasons) && content.reasons.length
        ? content.reasons
        : fallbackExplanation.reasons,
  };

  if (compact) {
    return (
      <div className={`rounded-2xl border border-border/60 bg-panel-soft/60 p-4 ${className}`}>
        <p className="metric-label">{eyebrow}</p>
        <h4 className="mt-2 text-sm font-semibold text-white">{title}</h4>
        {loading ? <p className="mt-3 text-sm text-slate-300">Generating AI insight...</p> : null}
        {error && !loading ? (
          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/8 p-2 text-xs text-amber-100">
            AI explanation temporarily unavailable.
          </div>
        ) : null}
        <div className="mt-3 space-y-3 text-sm text-slate-300">
          <p className="leading-6">{visibleExplanation.summary}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="metric-label">Action</p>
              <p className="mt-1">{visibleExplanation.actionNote}</p>
            </div>
            <div>
              <p className="metric-label">Risk</p>
              <p className="mt-1">{visibleExplanation.riskNote}</p>
            </div>
            <div>
              <p className="metric-label">Invalidation</p>
              <p className="mt-1">{visibleExplanation.invalidationNote}</p>
            </div>
          </div>
          {import.meta.env.DEV ? (
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              provider {provider} / {aiEnabled ? (available ? providerMode : 'fallback') : 'disabled'}{fallbackReason ? ` / ${fallbackReason}` : ''}{cacheStatus ? ` / cache ${cacheStatus}` : ''}{lastRequestedAt ? ` / ${lastRequestedAt}` : ''}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`panel panel-hover border-emerald-400/15 bg-panel/95 p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_18px_48px_rgba(15,23,42,0.28)] ${className}`}>
      <p className="metric-label">{eyebrow}</p>
      <h3 className="mt-2 font-display text-xl font-bold text-white">{title}</h3>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
        {aiEnabled && available && providerMode === 'ai'
          ? `Provider: ${provider}`
          : (content.sourceLabel ?? 'Rule-engine explanation fallback')}
      </p>

      {loading ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-slate-300">Generating AI insight...</p>
          <p className="text-sm leading-6 text-slate-300">{fallbackExplanation.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
              <p className="metric-label">Action Bias</p>
              <p className="mt-2 text-sm font-semibold text-white">{fallbackExplanation.actionBias}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
              <p className="metric-label">Risk Note</p>
              <p className="mt-2 text-sm text-slate-300">{fallbackExplanation.riskNote}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Action Note</p>
            <p className="mt-2 text-sm font-semibold text-white">{fallbackExplanation.actionNote}</p>
            <p className="mt-1 text-sm text-slate-300">{fallbackExplanation.invalidationNote}</p>
          </div>
          <ul className="space-y-2 text-sm text-slate-400">
            {fallbackExplanation.reasons.map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-11/12" />
          <div className="skeleton h-4 w-8/12" />
        </div>
      ) : (
        <>
          {error ? (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/8 p-3 text-sm text-amber-100">
              AI explanation temporarily unavailable.
            </div>
          ) : null}
          <p className="mt-4 text-sm leading-6 text-slate-300">{visibleExplanation.summary}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
              <p className="metric-label">Action Bias</p>
              <p className="mt-2 text-sm font-semibold text-white">{visibleExplanation.actionBias}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
              <p className="metric-label">Risk Note</p>
              <p className="mt-2 text-sm text-slate-300">{visibleExplanation.riskNote}</p>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Action Note</p>
            <p className="mt-2 text-sm font-semibold text-white">{visibleExplanation.actionNote}</p>
            <p className="mt-1 text-sm text-slate-300">{visibleExplanation.invalidationNote}</p>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            {visibleExplanation.reasons.slice(0, 4).map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">Educational only. Not investment advice.</p>
          {import.meta.env.DEV ? (
            <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              provider {provider} / {aiEnabled ? (available ? providerMode : 'fallback') : 'disabled'}{fallbackReason ? ` / ${fallbackReason}` : ''}{cacheStatus ? ` / cache ${cacheStatus}` : ''}{lastRequestedAt ? ` / ${lastRequestedAt}` : ''}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export default AIExplanationCard;
