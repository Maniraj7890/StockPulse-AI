function PredictionReasonCard({ summary, confidenceExplanation, agreement, warnings, setupType, safetyProfile }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4 text-sm leading-6 text-slate-300">
      <p>{summary}</p>
      {setupType ? <p className="mt-3 text-slate-400">Setup: {setupType} / {safetyProfile}</p> : null}
      {confidenceExplanation ? <p className="mt-3 text-slate-400">{confidenceExplanation}</p> : null}
      {warnings?.length ? <p className="mt-3 text-rose-200">Can fail if: {warnings.slice(0, 2).join(' ')}</p> : null}
      {agreement ? <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{agreement}</p> : null}
    </div>
  );
}

export default PredictionReasonCard;
