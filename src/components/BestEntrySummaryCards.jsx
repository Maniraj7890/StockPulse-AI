function BestEntrySummaryCards({ stats }) {
  const items = [
    ['Total Stocks', stats.total],
    ['Buy Now', stats.buyNow],
    ['Breakout Watch', stats.breakoutWatch],
    ['Pullback Watch', stats.pullbackWatch],
    ['Avoid', stats.avoid],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">{label}</p>
          <p className="mt-2 text-lg font-semibold text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}

export default BestEntrySummaryCards;
