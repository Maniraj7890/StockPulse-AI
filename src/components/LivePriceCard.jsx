import LiveBadge from '@/components/LiveBadge';
import PriceMovementIndicator from '@/components/PriceMovementIndicator';
import SignalBadge from '@/components/SignalBadge';
import { getExpectedMoveLabel, getPriceLabel, getStatusLabel, UI_LABELS } from '@/utils/displayLabels';
import { getQuotePresentation } from '@/utils/marketSession';
import { formatCompactNumber, formatCurrency, formatDateTime, formatPercent } from '@/utils/formatters';

function LivePriceCard({ stock, pinned = false, onTogglePin, isLiveMode = false }) {
  const quote = stock?.live ?? {};
  const direction = quote.direction ?? 'neutral';
  const livePrice = quote.ltp ?? stock?.currentPrice;
  const buyPrice = quote.buyPrice ?? livePrice;
  const sellPrice = quote.sellPrice ?? livePrice;
  const liveChange = quote.changePercent ?? stock?.dayChangePercent ?? 0;
  const dayHigh = quote.high ?? quote.dayHigh ?? stock?.ohlc?.high;
  const dayLow = quote.low ?? quote.dayLow ?? stock?.ohlc?.low;
  const volume = quote.volume ?? stock?.volume;
  const updatedAt = quote.lastUpdated ?? stock?.lastUpdated;
  const quoteStatus = quote.stale ? quote.staleLabel ?? 'Delayed' : null;
  const marketStatus = quote.marketStatus ?? 'UNKNOWN';
  const marketStatusDetail = quote.marketStatusDetail ?? null;
  const quotePresentation = getQuotePresentation(quote);
  const marketExplanation = quotePresentation.explanation;
  const isClosedSession = quotePresentation.isClosedSession;
  const decision = stock?.decision ?? stock?.signal?.decision ?? null;
  const spike = stock?.spike ?? null;
  const monitoringTag = stock?.monitoringTag ?? 'QUIET';
  const attentionReason = stock?.attentionReason ?? null;
  const attentionFlag = stock?.attentionFlag ?? 'NORMAL';

  const spikeTone =
    spike?.spikeType === 'breakout_spike'
      ? 'border-emerald-400/25 bg-emerald-400/8 text-emerald-200'
      : spike?.spikeType === 'breakdown_spike' || spike?.spikeType === 'spike_down'
        ? 'border-rose-400/25 bg-rose-400/8 text-rose-200'
        : 'border-amber-400/25 bg-amber-400/8 text-amber-200';
  const spikeLabel =
    spike?.spikeType === 'breakout_spike'
      ? 'BREAKOUT WATCH'
      : spike?.spikeType === 'breakdown_spike'
        ? 'BREAKDOWN WATCH'
        : spike?.spikeType === 'reversal_spike'
          ? 'REVERSAL RISK'
          : spike?.spikeType === 'volatility_spike'
            ? 'VOLATILITY ALERT'
            : spike?.spikeType === 'spike_up'
              ? 'SPIKE UP'
              : spike?.spikeType === 'spike_down'
                ? 'SPIKE DOWN'
                : spike?.spikeType === 'volume_spike'
                  ? 'VOLUME SPIKE'
                  : null;

  return (
    <div className={`panel p-5 transition ${isLiveMode ? 'shadow-glow' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <p className="font-display text-xl font-bold text-white">{stock?.symbol}</p>
            <LiveBadge status={marketStatus} />
          </div>
          <p className="text-sm text-slate-400">{stock?.companyName}</p>
        </div>
        <button
          onClick={() => onTogglePin?.(stock?.symbol)}
          className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] ${
            pinned ? 'border-amber-400/40 bg-amber-400/12 text-amber-200' : 'border-border/70 text-slate-400'
          }`}
        >
          {pinned ? 'Pinned' : 'Pin'}
        </button>
      </div>

      {marketExplanation.bannerText ? (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-amber-200">
          {marketExplanation.bannerText}
        </div>
      ) : null}

      {spike?.spikeDetected && spikeLabel ? (
        <div className={`mt-4 rounded-2xl border px-4 py-3 ${spikeTone}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em]">{spikeLabel}</p>
            <span className="text-xs font-semibold capitalize">{spike.spikeSeverity}</span>
          </div>
          <p className="mt-2 text-sm text-slate-100">{spike.spikeReason}</p>
          <p className="mt-1 text-xs text-slate-300">
            {spike.confirmationState} confirmation / {spike.actionNote}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-panel-soft/60 px-4 py-3">
        <div>
          <p className="metric-label">Monitoring Tag</p>
          <p className="mt-1 text-sm font-semibold text-white">{monitoringTag}</p>
        </div>
        <div className="text-right">
          <p className="metric-label">Attention</p>
          <p className="mt-1 text-sm text-slate-300">{attentionFlag}</p>
        </div>
      </div>
      {attentionReason ? <p className="mt-2 text-xs text-slate-400">{attentionReason}</p> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="metric-label">{getPriceLabel(isClosedSession)}</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(livePrice)}</p>
          <p className={liveChange >= 0 ? 'text-sm text-emerald-300' : 'text-sm text-rose-300'}>{formatPercent(liveChange)}</p>
          <p className="mt-1 text-xs text-slate-500">{quotePresentation.priceHelper}</p>
        </div>
        <div>
          <p className="metric-label">Movement</p>
          <div className="mt-2">
            <PriceMovementIndicator direction={direction} />
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Market: {getStatusLabel(marketStatus, marketStatusDetail)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{quote.marketStatusReason ?? marketExplanation.reason}</p>
          {quoteStatus ? <p className="mt-1 text-sm text-amber-300">{UI_LABELS.staleFeed}: {quoteStatus}</p> : null}
        </div>
        <div>
          <p className="metric-label">Day High / Low</p>
          <p className="mt-2 text-sm text-slate-300">
            {formatCurrency(dayHigh)} / {formatCurrency(dayLow)}
          </p>
        </div>
        <div>
          <p className="metric-label">Indicative Prices</p>
          <p className="mt-2 text-sm text-emerald-200">Indicative Buy: {formatCurrency(buyPrice)}</p>
          <p className="mt-1 text-sm text-rose-200">Indicative Sell: {formatCurrency(sellPrice)}</p>
        </div>
        <div>
          <p className="metric-label">Final Action</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {decision?.finalDecision ?? 'WAIT'} / {decision?.decisionStrength ?? 'WEAK'}
          </p>
          <p className="mt-1 text-xs text-slate-400">{decision?.decisionReasonShort ?? 'Wait is a valid strategy when the setup is unclear.'}</p>
        </div>
        <div>
          <p className="metric-label">Risk Context</p>
          <p className="mt-2 text-sm text-slate-300">Risk: {decision?.risk?.riskLevel ?? 'MODERATE'}</p>
          <p className="mt-1 text-xs text-slate-500">{decision?.confidenceExplanation?.summary ?? 'Confidence is kept defensive until more confluence aligns.'}</p>
        </div>
        <div>
          <p className="metric-label">Volume</p>
          <p className="mt-2 text-sm text-slate-300">{formatCompactNumber(volume)}</p>
        </div>
        <div>
          <p className="metric-label">Last Updated</p>
          <p className="mt-2 text-sm text-slate-300">Last valid session: {formatDateTime(quote.lastValidSessionTimestamp ?? updatedAt)}</p>
          {quote.freshnessNote ? <p className="mt-1 text-xs text-slate-500">{quote.freshnessNote}</p> : null}
          {quote.nextExpectedLiveSession ? <p className="mt-1 text-xs text-slate-500">Next live session: {quote.nextExpectedLiveSession}</p> : null}
          <p className="mt-1 text-xs text-slate-500">
            Exchange: {quote.exchange ?? 'NSE'} / Source: {quote.source ?? 'Live market data'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <SignalBadge signal={stock?.signal?.signal ?? 'WAIT'} compact />
        <span className="text-sm text-slate-400">
          {UI_LABELS.signalConfidence}: {stock?.signal?.confidence ?? 0}%
          {quotePresentation.isClosedSession ? ' / Next session estimate' : ''}
        </span>
      </div>
      {decision?.noTradeMessage ? <p className="mt-3 text-xs text-amber-200">{decision.noTradeMessage}</p> : null}
    </div>
  );
}

export default LivePriceCard;
