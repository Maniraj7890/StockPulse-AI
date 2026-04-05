import ConfidenceBar from '@/components/ConfidenceBar';
import PredictionDirectionBadge from '@/components/PredictionDirectionBadge';
import SignalBadge from '@/components/SignalBadge';
import { getExpectedMoveLabel, getStatusLabel, UI_LABELS } from '@/utils/displayLabels';
import { getQuotePresentation } from '@/utils/marketSession';
import { formatDateTime, formatNumber, formatPercent } from '@/utils/formatters';

function IndexPredictionCards({ items = [] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {(items ?? []).map((item) => (
        <div key={item.label} className="panel p-5">
          {(() => {
            const quotePresentation = getQuotePresentation(item);
            return (
              <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="metric-label">{item.label}</p>
              <p className="mt-2 font-display text-2xl font-bold text-white">{formatNumber(item.currentValue)}</p>
              <p className={item.change >= 0 ? 'mt-1 text-sm text-emerald-300' : 'mt-1 text-sm text-rose-300'}>
                {formatPercent(item.change)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{quotePresentation.priceHelper}</p>
            </div>
            <SignalBadge signal={item.signal} compact />
          </div>

          {quotePresentation.closedBadgeText ? (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-amber-200">
              {quotePresentation.closedBadgeText}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="metric-label">{UI_LABELS.signalConfidence}</p>
              <p className="mt-1 text-sm text-slate-200">{item.confidence}%</p>
              <ConfidenceBar value={item.confidence} />
            </div>
            <div>
              <p className="metric-label">Market Status</p>
              <p className="mt-1 text-sm text-slate-200">
                {getStatusLabel(item.marketStatus, item.marketStatusDetail)}
              </p>
              {quotePresentation.isClosedSession ? <p className="mt-1 text-xs text-amber-200">Next session estimate</p> : null}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-sm text-slate-300">{item.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PredictionDirectionBadge direction={item.shortTermPredictions?.fifteenMinutes?.direction ?? 'SIDEWAYS'} compact />
              <PredictionDirectionBadge direction={item.shortTermPredictions?.thirtyMinutes?.direction ?? 'SIDEWAYS'} compact />
              <PredictionDirectionBadge direction={item.shortTermPredictions?.oneHour?.direction ?? 'SIDEWAYS'} compact />
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              {(item.reasons ?? []).map((reason) => (
                <li key={reason}>- {reason}</li>
              ))}
            </ul>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            <p>Source: {item.source ?? UI_LABELS.liveSource}</p>
            <p>Last updated: {formatDateTime(item.lastUpdated)}</p>
            <p className="mt-1">
              15m {item.shortTermPredictions?.fifteenMinutes?.expectedMoveText ?? '--'} / 30m {item.shortTermPredictions?.thirtyMinutes?.expectedMoveText ?? '--'}
            </p>
            <p className="mt-1">
              {item.shortTermPredictions?.oneHour?.expectedMoveLabel ?? getExpectedMoveLabel(quotePresentation.isClosedSession)}: {item.shortTermPredictions?.oneHour?.expectedMoveText ?? '--'}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">{item.disclaimer}</p>
          </div>
              </>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

export default IndexPredictionCards;
