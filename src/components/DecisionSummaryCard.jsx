import { formatPercent } from '@/utils/formatters';

function toneForDecision(decision = 'WAIT') {
  if (decision === 'BUY') return 'border-emerald-400/25 bg-emerald-400/8 text-emerald-200';
  if (decision === 'SELL') return 'border-rose-400/25 bg-rose-400/8 text-rose-200';
  if (decision === 'AVOID') return 'border-amber-400/25 bg-amber-400/8 text-amber-200';
  return 'border-sky-400/25 bg-sky-400/8 text-sky-200';
}

function qualityTone(score = 0) {
  if (score >= 72) return 'text-emerald-200';
  if (score >= 50) return 'text-amber-200';
  return 'text-rose-200';
}

function DecisionSummaryCard({ decision, compact = false }) {
  const finalAction = decision?.finalDecision ?? 'WAIT';
  const actionClarity = decision?.actionClarity ?? {};

  return (
    <div className={`rounded-2xl border ${toneForDecision(finalAction)} p-4`}>
      <div className={`flex ${compact ? 'flex-col gap-3' : 'items-start justify-between gap-4'}`}>
        <div>
          <p className="metric-label">Final Action</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-white">{finalAction}</span>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-200">
              {decision?.decisionStrength ?? 'WEAK'}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-300">{decision?.decisionReasonShort ?? 'No clear edge — avoid trading this setup.'}</p>
          {decision?.trustNote ? <p className="mt-2 text-xs text-slate-400">{decision.trustNote}</p> : null}
        </div>
        <div className={compact ? 'grid grid-cols-2 gap-3' : 'grid min-w-[280px] grid-cols-2 gap-3'}>
          <div>
            <p className="metric-label">Entry Zone</p>
            <p className="mt-1 text-sm text-white">{actionClarity.entryZone ?? 'Monitor'}</p>
          </div>
          <div>
            <p className="metric-label">Stop Loss</p>
            <p className="mt-1 text-sm text-white">{actionClarity.stopLoss ?? 'Monitor'}</p>
          </div>
          <div>
            <p className="metric-label">Target Zone</p>
            <p className="mt-1 text-sm text-white">{actionClarity.targetZone ?? 'Monitor'}</p>
          </div>
          <div>
            <p className="metric-label">Signal Confidence</p>
            <p className="mt-1 text-sm text-white">{formatPercent((actionClarity.confidence ?? 0) / 100)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
          <p className="metric-label">Trade Quality</p>
          <p className={`mt-1 text-sm font-semibold ${qualityTone(decision?.tradeQualityScore ?? 0)}`}>
            {decision?.tradeQualityScore ?? 0}/100
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
          <p className="metric-label">Risk Level</p>
          <p className="mt-1 text-sm font-semibold text-white">{decision?.risk?.riskLevel ?? 'MODERATE'}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
          <p className="metric-label">Stability</p>
          <p className="mt-1 text-sm font-semibold text-white">{decision?.stabilityScore ?? 0}/100</p>
        </div>
      </div>
    </div>
  );
}

export default DecisionSummaryCard;
