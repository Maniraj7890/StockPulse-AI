import LivePriceCard from '@/components/LivePriceCard';

function LivePriceGrid({ rows, pinnedStocks, onTogglePin, isLiveMode }) {
  const items = rows ?? [];
  const safePinnedStocks = Array.isArray(pinnedStocks) ? pinnedStocks : [];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((stock) => (
        <LivePriceCard
          key={stock.symbol}
          stock={stock}
          pinned={safePinnedStocks.includes(stock.symbol)}
          onTogglePin={onTogglePin}
          isLiveMode={isLiveMode}
        />
      ))}
    </div>
  );
}

export default LivePriceGrid;
