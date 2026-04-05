function MarketSentimentCard({ sentiment, marketContext = null }) {
  return (
    <div className="panel p-5">
      <p className="metric-label">Market Sentiment</p>
      <h3 className="mt-2 font-display text-xl font-bold text-white">{sentiment.label}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">{sentiment.summary}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-4">
          <p className="metric-label">Bullish</p>
          <p className="mt-2 text-2xl font-bold text-emerald-200">{sentiment.bullishCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4">
          <p className="metric-label">Neutral</p>
          <p className="mt-2 text-2xl font-bold text-amber-200">{sentiment.neutralCount}</p>
        </div>
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/8 p-4">
          <p className="metric-label">Bearish</p>
          <p className="mt-2 text-2xl font-bold text-rose-200">{sentiment.bearishCount}</p>
        </div>
      </div>

      {marketContext ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Market Bias</p>
            <p className="mt-2 text-sm font-semibold text-white">{marketContext.marketBias}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Volatility State</p>
            <p className="mt-2 text-sm font-semibold text-white">{marketContext.volatilityState}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
            <p className="metric-label">Session Quality</p>
            <p className="mt-2 text-sm font-semibold text-white">{marketContext.sessionQuality}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MarketSentimentCard;
