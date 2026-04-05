import { useMarketStore } from '@/store/useMarketStore';
import { formatNumber, formatPercent } from '@/utils/formatters';

function LiveTickerStrip() {
  const ticker = useMarketStore((state) => state.liveTicker);
  const items = ticker ?? [];

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-[180px] rounded-2xl border border-border/70 bg-panel-soft/70 px-4 py-3"
        >
          <p className="metric-label">{item.label}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{formatNumber(item.value)}</span>
            <span className={item.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {formatPercent(item.change)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default LiveTickerStrip;
