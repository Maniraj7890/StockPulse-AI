import ConfidenceBar from '@/components/ConfidenceBar';
import PredictionDirectionBadge from '@/components/PredictionDirectionBadge';
import SignalBadge from '@/components/SignalBadge';
import { getQuotePresentation } from '@/utils/marketSession';
import { formatCurrency } from '@/utils/formatters';

function TradeSetupCard({ signal, decision = null, multiTimeframe, shortTermPredictions = {}, quote = {} }) {
  const plan = signal.tradePlan;
  const buyZone = signal.buyZone ?? {};
  const exitPlan = signal.exitPlan ?? {};
  const quotePresentation = getQuotePresentation(quote);

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="metric-label">Trade Setup</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Entry and exit levels</h3>
        </div>
        <SignalBadge signal={signal.signal} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Entries</p>
          <p className="mt-2 text-sm text-slate-200">Ideal: {formatCurrency(plan.idealEntry)}</p>
          <p className="mt-1 text-sm text-slate-200">Aggressive: {formatCurrency(plan.aggressiveEntry)}</p>
          <p className="mt-1 text-sm text-slate-200">Safe: {formatCurrency(plan.safeEntry)}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Risk Controls</p>
          <p className="mt-2 text-sm text-slate-200">Stop: {formatCurrency(plan.stopLoss)}</p>
          <p className="mt-1 text-sm text-slate-200">Trailing: {formatCurrency(plan.trailingStop)}</p>
          <p className="mt-1 text-sm text-slate-200">R/R: {signal.riskRewardRatio}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Targets</p>
          <p className="mt-2 text-sm text-emerald-300">T1: {formatCurrency(plan.target1)}</p>
          <p className="mt-1 text-sm text-emerald-300">T2: {formatCurrency(plan.target2)}</p>
          <p className="mt-1 text-sm text-emerald-300">T3: {formatCurrency(plan.target3)}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Buy Zone</p>
          <p className="mt-2 text-sm text-slate-200">{buyZone.entryLabel ?? 'WAIT'}</p>
          <p className="mt-1 text-sm text-slate-200">
            Suggested: {buyZone.entryRange ? `${formatCurrency(buyZone.entryRange.min)} - ${formatCurrency(buyZone.entryRange.max)}` : 'Monitor'}
          </p>
          <p className="mt-1 text-sm text-slate-400">{buyZone.reasons?.[0] ?? 'Entry guidance will appear here.'}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Exit Action</p>
          <p className="mt-2 text-sm text-slate-200">{exitPlan.action ?? 'HOLD'}</p>
          <p className="mt-1 text-sm text-slate-200">Target: {formatCurrency(signal.target ?? plan.target1)}</p>
          <p className="mt-1 text-sm text-slate-400">{exitPlan.reasons?.[0] ?? 'Exit guidance will appear here.'}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Decision Quality</p>
          <p className="mt-2 text-sm text-slate-200">Final action: {decision?.finalDecision ?? 'WAIT'}</p>
          <ConfidenceBar value={signal.confidence} />
          <p className="mt-1 text-sm text-slate-200">Trade quality: {decision?.tradeQualityScore ?? signal.tradeQuality}/100</p>
          <p className="mt-1 text-sm text-slate-200">Risk: {decision?.risk?.riskLevel ?? signal.bias}</p>
          <p className="mt-1 text-sm text-slate-200">Timeframes: {multiTimeframe?.agreement ?? 'Monitoring'}</p>
          {decision?.noTradeMessage ? <p className="mt-2 text-xs text-amber-200">{decision.noTradeMessage}</p> : null}
        </div>
      </div>

      {quotePresentation.closedBadgeText ? (
        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4 text-sm leading-6 text-slate-300">
          {quotePresentation.closedBadgeText}. Predictions below are next session estimates.
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
        <p className="metric-label">Short-Term Prediction Windows</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            ['15m', shortTermPredictions.fifteenMinutes],
            ['30m', shortTermPredictions.thirtyMinutes],
            ['1h', shortTermPredictions.oneHour],
          ].map(([label, item]) => (
            <div key={label} className="rounded-2xl border border-border/60 bg-black/10 p-4">
              <p className="metric-label">{label}</p>
              <div className="mt-2">
                <PredictionDirectionBadge direction={item?.direction ?? 'SIDEWAYS'} compact />
              </div>
              <p className="mt-3 text-sm text-slate-200">
                {item?.expectedMoveLabel ?? 'Expected move'}: {item?.expectedMoveText ?? 'Limited data'}
              </p>
              <ConfidenceBar value={item?.confidence ?? 0} />
              <p className="mt-2 text-xs text-slate-500">{item?.basisLabel ?? 'Estimate'}</p>
              {quotePresentation.isClosedSession ? <p className="mt-1 text-xs text-amber-200">Next session estimate</p> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4 text-sm leading-6 text-slate-300">
        {decision?.trustNote ? `${signal.explanation} ${decision.trustNote}` : signal.explanation}
      </div>
    </div>
  );
}

export default TradeSetupCard;
