import { useMemo } from 'react';
import { useAIPredictionAssistant } from '@/hooks/useAIPredictionAssistant';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toneForAction(action) {
  if (action === 'BUY') return 'text-emerald-200 border-emerald-400/30 bg-emerald-400/10';
  if (action === 'AVOID') return 'text-rose-200 border-rose-400/30 bg-rose-400/10';
  if (action === 'WATCH') return 'text-sky-200 border-sky-400/30 bg-sky-400/10';
  return 'text-amber-200 border-amber-400/30 bg-amber-400/10';
}

function AIPredictionInsightCard({ payload, className = '', title = 'AI View' }) {
  const { loading, insight, error, providerMode, provider, aiEnabled } = useAIPredictionAssistant(payload, {
    enabled: true,
  });
  const baseConfidence = Number.isFinite(payload?.confidence) ? payload.confidence : 0;
  const refinedConfidence = useMemo(
    () => clamp(baseConfidence + (Number(insight?.aiConfidenceAdjustment) || 0), 0, 100),
    [baseConfidence, insight?.aiConfidenceAdjustment],
  );

  return (
    <div className={`rounded-2xl border border-border/60 bg-panel-soft/60 p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="metric-label">AI Prediction Assistant</p>
          <h4 className="mt-2 text-sm font-semibold text-white">{title}</h4>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${toneForAction(insight?.aiActionSuggestion)}`}>
          {insight?.aiActionSuggestion ?? 'WATCH'}
        </span>
      </div>

      {loading ? <p className="mt-3 text-sm text-slate-300">Loading AI view...</p> : null}
      {error && !loading ? (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/8 p-2 text-xs text-amber-100">
          AI view unavailable. Showing rule-engine fallback.
        </div>
      ) : null}

      <div className="mt-3 space-y-3 text-sm text-slate-300">
        <p className="leading-6">{insight?.aiSummary}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-black/10 p-3">
            <p className="metric-label">Confidence Refinement</p>
            <p className="mt-2 text-white">
              {refinedConfidence}%{' '}
              <span className="text-xs text-slate-500">
                ({insight?.aiConfidenceAdjustment > 0 ? '+' : ''}
                {insight?.aiConfidenceAdjustment ?? 0})
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-black/10 p-3">
            <p className="metric-label">Short Explanation</p>
            <p className="mt-2 text-slate-300">{insight?.aiShortExplanation}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-black/10 p-3">
          <p className="metric-label">Risk Note</p>
          <p className="mt-2 text-slate-300">{insight?.aiRiskNote}</p>
        </div>
        {import.meta.env.DEV ? (
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {aiEnabled ? providerMode : 'disabled'} / {provider}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default AIPredictionInsightCard;
