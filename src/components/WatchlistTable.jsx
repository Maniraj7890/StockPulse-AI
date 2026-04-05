import ConfidenceBar from '@/components/ConfidenceBar';
import LiveBadge from '@/components/LiveBadge';
import PredictionDirectionBadge from '@/components/PredictionDirectionBadge';
import PriceMovementIndicator from '@/components/PriceMovementIndicator';
import SignalBadge from '@/components/SignalBadge';
import { getExpectedMoveLabel, getPriceLabel, getStatusLabel, UI_LABELS } from '@/utils/displayLabels';
import { formatCurrency, formatDateTime, formatPercent } from '@/utils/formatters';
import { getQuotePresentation } from '@/utils/marketSession';

function WatchlistTable({ rows, onRemove, onMove, onTogglePin, pinnedStocks = [] }) {
  const safeRows = rows ?? [];

  return (
    <div className="panel panel-hover overflow-hidden animate-fade-in-up">
      <div className="border-b border-border/70 px-5 py-4">
        <p className="metric-label">Watchlist</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Tracked stocks</h3>
      </div>

      <div className="mobile-card-list p-4">
        {safeRows.map((stock) => {
          const quote = stock.live ?? {};
          const quotePresentation = getQuotePresentation(quote);
          const isClosedSession = quotePresentation.isClosedSession;
          const ltp = quote.ltp ?? null;
          const buyPrice = quote.buyPrice ?? quote.ltp ?? null;
          const sellPrice = quote.sellPrice ?? quote.ltp ?? null;
          const change = quote.changePercent ?? 0;
          const spike = stock.spike ?? null;
          const monitoringTag = stock.monitoringTag ?? 'QUIET';

          return (
            <article key={`${stock.symbol}-mobile`} className="rounded-3xl border border-border/70 bg-panel-soft/70 p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">{stock.symbol}</p>
                  <p className={change >= 0 ? 'mt-1 text-sm text-emerald-300' : 'mt-1 text-sm text-rose-300'}>
                    {getPriceLabel(isClosedSession)} {formatCurrency(ltp)} / {formatPercent(change)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{quotePresentation.priceHelper}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <SignalBadge signal={stock.signal.signal} compact />
                  <PredictionDirectionBadge direction={stock.shortTermPredictions?.oneHour?.direction ?? 'SIDEWAYS'} compact />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{UI_LABELS.signalConfidence}</p>
                  <p className="mt-1">{stock.signal.confidence}%</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Suggested action</p>
                  <p className="mt-1">{stock.decision?.finalDecision ?? 'WAIT'}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Monitoring</p>
                  <p className="mt-1">{monitoringTag}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{getExpectedMoveLabel(isClosedSession)}</p>
                  <p className="mt-1">{stock.shortTermPredictions?.oneHour?.expectedMoveText ?? '--'}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-border/60 bg-white/[0.02] p-3 text-sm text-slate-300">
                <p className="font-medium text-white">{stock.decision?.decisionReasonShort ?? 'No clear edge - avoid trading this setup.'}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
                  <p>Buy {formatCurrency(buyPrice)}</p>
                  <p>Sell {formatCurrency(sellPrice)}</p>
                  <p>Entry {formatCurrency(stock.signal.tradePlan.safeEntry)}</p>
                  <p>Target {formatCurrency(stock.signal.tradePlan.target1)}</p>
                  <p>{getStatusLabel(quote.marketStatus, quote.marketStatusDetail)}</p>
                  <p>Updated {formatDateTime(quote.lastUpdated)}</p>
                </div>
                {spike?.spikeDetected ? (
                  <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-amber-200">
                    Spike: {spike.spikeType?.replace(/_/g, ' ')} / {spike.spikeSeverity}
                  </p>
                ) : null}
                {quotePresentation.isClosedSession ? (
                  <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-amber-200">Next session estimate</p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => onTogglePin?.(stock.symbol)}
                  className={
                    pinnedStocks.includes(stock.symbol)
                      ? 'app-button border-amber-400/40 bg-amber-400/12 text-amber-200'
                      : 'app-button'
                  }
                >
                  {pinnedStocks.includes(stock.symbol) ? 'Pinned' : 'Pin'}
                </button>
                <button onClick={() => onMove?.(stock.symbol, 'up')} className="app-button">
                  Move Up
                </button>
                <button onClick={() => onMove?.(stock.symbol, 'down')} className="app-button">
                  Move Down
                </button>
                <button
                  onClick={() => onRemove(stock.symbol)}
                  className="app-button border-rose-400/30 text-rose-200 hover:border-rose-300/50 hover:bg-rose-400/10"
                >
                  Remove
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="desktop-table overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-slate-400">
            <tr>
              <th className="px-5 py-4 font-medium">Stock</th>
              <th className="px-5 py-4 font-medium">Signal</th>
              <th className="px-5 py-4 font-medium">Trend / RSI / MACD</th>
              <th className="px-5 py-4 font-medium">LTP / Indicative Prices</th>
              <th className="px-5 py-4 font-medium">Entry / Target</th>
              <th className="px-5 py-4 font-medium">Updated</th>
              <th className="px-5 py-4 font-medium" />
            </tr>
          </thead>
          <tbody>
            {safeRows.map((stock) => {
              const quote = stock.live ?? {};
              const quotePresentation = getQuotePresentation(quote);
              const isClosedSession = quotePresentation.isClosedSession;
              const ltp = quote.ltp ?? null;
              const buyPrice = quote.buyPrice ?? quote.ltp ?? null;
              const sellPrice = quote.sellPrice ?? quote.ltp ?? null;
              const change = quote.changePercent ?? 0;
              const spike = stock.spike ?? null;
              const monitoringTag = stock.monitoringTag ?? 'QUIET';

              return (
                <tr key={stock.symbol} className="border-t border-border/60 align-top transition-colors duration-200 hover:bg-white/[0.025]">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-white">{stock.symbol}</p>
                    <p className={change >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                      {getPriceLabel(isClosedSession)} {formatCurrency(ltp)} / {formatPercent(change)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{quotePresentation.priceHelper}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <LiveBadge status={quote.marketStatus} />
                      <PriceMovementIndicator direction={quote.direction ?? 'neutral'} showLabel={false} />
                    </div>
                    {quotePresentation.closedBadgeText ? (
                      <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-amber-200">{quotePresentation.closedBadgeText}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-sky-200">Monitoring: {monitoringTag}</p>
                    {spike?.spikeDetected ? (
                      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-amber-200">
                        Spike: {spike.spikeType?.replace(/_/g, ' ')} / {spike.spikeSeverity}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <div
                      className={
                        stock.signal.signal.includes('BUY')
                          ? 'inline-block rounded-full signal-accent'
                          : stock.signal.signal.includes('SELL')
                            ? 'inline-block rounded-full bg-rose-400/10 shadow-glow'
                            : 'inline-block rounded-full'
                      }
                    >
                      <SignalBadge signal={stock.signal.signal} compact />
                    </div>
                    <p className="mt-2 text-slate-400">{UI_LABELS.signalConfidence}: {stock.signal.confidence}%</p>
                    <ConfidenceBar value={stock.shortTermPredictions?.oneHour?.confidence ?? stock.signal.confidence} />
                    <p className="mt-2 text-xs text-slate-300">
                      Final action: {stock.decision?.finalDecision ?? 'WAIT'} / {stock.decision?.decisionStrength ?? 'WEAK'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {stock.decision?.decisionReasonShort ?? 'No clear edge - avoid trading this setup.'}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    <p>{stock.trend.direction}</p>
                    <p>RSI {stock.indicators.rsi14}</p>
                    <p>MACD {stock.indicators.macd}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <PredictionDirectionBadge direction={stock.shortTermPredictions?.fifteenMinutes?.direction ?? 'SIDEWAYS'} compact />
                      <PredictionDirectionBadge direction={stock.shortTermPredictions?.thirtyMinutes?.direction ?? 'SIDEWAYS'} compact />
                      <PredictionDirectionBadge direction={stock.shortTermPredictions?.oneHour?.direction ?? 'SIDEWAYS'} compact />
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    <p>{getPriceLabel(isClosedSession)} {formatCurrency(ltp)}</p>
                    <p>Indicative Buy {formatCurrency(buyPrice)}</p>
                    <p>Indicative Sell {formatCurrency(sellPrice)}</p>
                    <p className="text-slate-500">
                      {getStatusLabel(quote.marketStatus, quote.marketStatusDetail)}
                    </p>
                    {quote.stale ? <p className="text-amber-300">{UI_LABELS.staleFeed}: {quote.staleLabel}</p> : null}
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    <p>Entry {formatCurrency(stock.signal.tradePlan.safeEntry)}</p>
                    <p>Target {formatCurrency(stock.signal.tradePlan.target1)}</p>
                    <p className="text-slate-500">
                      {(stock.shortTermPredictions?.oneHour?.expectedMoveLabel ?? getExpectedMoveLabel(isClosedSession))}:{' '}
                      {stock.shortTermPredictions?.oneHour?.expectedMoveText ?? stock.indicators.volumeTrend}
                    </p>
                    <p className="mt-1 text-slate-500">Risk: {stock.decision?.risk?.riskLevel ?? 'MODERATE'}</p>
                    {quotePresentation.isClosedSession ? (
                      <p className="mt-1 text-xs text-amber-200">Next session estimate</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-slate-400">
                    <p>Last updated: {formatDateTime(quote.lastUpdated)}</p>
                    <p className="mt-1 text-slate-500">
                      Exchange: {quote.exchange ?? 'NSE'} / Source: {quote.source ?? 'Live market data'}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => onTogglePin?.(stock.symbol)}
                        className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${
                          pinnedStocks.includes(stock.symbol)
                            ? 'border-amber-400/40 bg-amber-400/12 text-amber-200'
                            : 'border-border/70 text-slate-400 hover:text-white'
                        }`}
                      >
                        {pinnedStocks.includes(stock.symbol) ? 'Pinned' : 'Pin'}
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onMove?.(stock.symbol, 'up')}
                          className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-400 transition hover:text-white"
                        >
                          Up
                        </button>
                        <button
                          onClick={() => onMove?.(stock.symbol, 'down')}
                          className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-400 transition hover:text-white"
                        >
                          Down
                        </button>
                      </div>
                      <button
                        onClick={() => onRemove(stock.symbol)}
                        className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-400 transition hover:border-rose-400/30 hover:text-rose-200"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WatchlistTable;
