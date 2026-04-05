function WhySignalPanel({ decision, compact = false }) {
  const why = decision?.whyPanel ?? {};
  const detailed = Array.isArray(decision?.decisionReasonDetailed) ? decision.decisionReasonDetailed : [];
  const missingForHigherConfidence = decision?.confidenceExplanation?.missingForHigherConfidence ?? [];

  return (
    <div className="panel p-5">
      <p className="metric-label">Why This Signal?</p>
      <h3 className="mt-2 font-display text-xl font-bold text-white">Decision context</h3>
      <div className={`mt-4 grid gap-3 ${compact ? 'md:grid-cols-2' : 'xl:grid-cols-2'}`}>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Trend</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{why.trendExplanation ?? 'Trend context is still developing.'}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Momentum</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{why.momentumExplanation ?? 'Momentum context is still developing.'}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Structure</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{why.structureExplanation ?? 'Nearby levels still need confirmation.'}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Risk / Session</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{why.riskExplanation ?? 'Risk remains manageable only with discipline.'}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{why.sessionContext ?? 'Session quality is being monitored.'}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Detailed Reasoning</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {detailed.length ? detailed.map((item) => <li key={item}>- {item}</li>) : <li>- Wait is a valid strategy when the setup is not clean enough.</li>}
          </ul>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Confidence Context</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {decision?.confidenceExplanation?.summary ?? 'Confidence is being kept conservative until more layers align.'}
          </p>
          <ul className="mt-3 space-y-2 text-xs text-slate-500">
            {missingForHigherConfidence.length
              ? missingForHigherConfidence.map((item) => <li key={item}>- {item}</li>)
              : <li>- Cleaner momentum and structure would improve confidence.</li>}
          </ul>
          {decision?.flipWarning ? (
            <p className="mt-3 text-xs text-amber-200">Flip warning: the signal has been less stable recently.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default WhySignalPanel;
