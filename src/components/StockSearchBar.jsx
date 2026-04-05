import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '@/store/useMarketStore';

function StockSearchBar() {
  const navigate = useNavigate();
  const stocks = useMarketStore((state) => state.stocks);
  const setSelectedStock = useMarketStore((state) => state.setSelectedStock);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    return stocks
      .filter(
        (stock) =>
          stock.symbol.toLowerCase().includes(normalized) ||
          stock.companyName.toLowerCase().includes(normalized),
      )
      .slice(0, 6);
  }, [query, stocks]);

  const handleSelect = (symbol) => {
    setSelectedStock(symbol);
    setQuery('');
    navigate('/analysis');
  };

  return (
    <div className="relative w-full sm:w-[360px]">
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-panel px-4 py-3 shadow-card">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search NSE stocks"
          className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
      </div>

      {matches.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-40 rounded-3xl border border-border/70 bg-panel p-2 shadow-card">
          {matches.map((stock) => (
            <button
              key={stock.symbol}
              onClick={() => handleSelect(stock.symbol)}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-white/[0.04]"
            >
              <div>
                <p className="font-semibold text-white">{stock.symbol}</p>
                <p className="text-sm text-slate-400">{stock.companyName}</p>
              </div>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">NSE</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default StockSearchBar;
