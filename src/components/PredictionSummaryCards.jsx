function PredictionSummaryCards({ stats }) {
  const items = [
    ['Total Stocks Scanned', stats.total],
    ['Very High Probability', stats.veryHigh],
    ['High Probability', stats.high],
    ['Moderate Probability', stats.moderate],
    ['Watchlist Matches', stats.watchlist ?? 0],
    ['Average Bullish Score', `${stats.averageScore}%`],
    ['Last Updated', stats.lastUpdated],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">{label}</p>
          <p className="mt-2 text-lg font-semibold text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}

export default PredictionSummaryCards;
