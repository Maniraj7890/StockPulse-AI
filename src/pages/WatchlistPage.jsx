import EmptyState from '@/components/EmptyState';
import SectionHeader from '@/components/SectionHeader';
import WatchlistTable from '@/components/WatchlistTable';
import { useMarketStore } from '@/store/useMarketStore';
import { useState } from 'react';

function WatchlistPage() {
  const analysisData = useMarketStore((state) => state.analysisData ?? {});
  const watchlist = useMarketStore((state) => (Array.isArray(state.watchlist) ? state.watchlist : []));
  const toggleWatchlist = useMarketStore((state) => state.toggleWatchlist);
  const addWatchlistSymbol = useMarketStore((state) => state.addWatchlistSymbol);
  const moveWatchlistItem = useMarketStore((state) => state.moveWatchlistItem);
  const togglePin = useMarketStore((state) => state.togglePin);
  const pinnedStocks = useMarketStore((state) => (Array.isArray(state.pinnedStocks) ? state.pinnedStocks : []));
  const personalWatchlistSummary = useMarketStore((state) => state.personalWatchlistSummary ?? {});
  const addPriceAlert = useMarketStore((state) => state.addPriceAlert);
  const [symbolInput, setSymbolInput] = useState('');
  const [alertForm, setAlertForm] = useState({ symbol: '', price: '', direction: 'above' });
  const rows = (watchlist ?? []).map((symbol) => analysisData?.[symbol]).filter(Boolean);

  const submitAdd = () => {
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) return;
    addWatchlistSymbol(symbol);
    setSymbolInput('');
  };

  const submitAlert = () => {
    const symbol = alertForm.symbol.trim().toUpperCase();
    const price = Number(alertForm.price);
    if (!symbol || price <= 0) return;
    addPriceAlert(symbol, price, alertForm.direction);
    setAlertForm({ symbol: '', price: '', direction: 'above' });
  };

  return (
    <div className="page-shell">
      <SectionHeader
        eyebrow="Watchlist"
        title="Tracked stocks with timing context"
        description="Monitor watchlist names with live price, signal, RSI status, MACD tone, volume confirmation, and trade zones."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Best Opportunity</p>
          <p className="mt-2 text-lg font-semibold text-white">{personalWatchlistSummary?.bestOpportunity?.symbol ?? '--'}</p>
          <p className="mt-1 text-sm text-slate-500">{personalWatchlistSummary?.bestOpportunity?.decision?.finalDecision ?? 'No clear edge yet'}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Breakout Watch</p>
          <p className="mt-2 text-lg font-semibold text-white">{personalWatchlistSummary?.breakoutWatch?.length ?? 0}</p>
          <p className="mt-1 text-sm text-slate-500">Names where structure still needs confirmation</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Spike Active</p>
          <p className="mt-2 text-lg font-semibold text-white">{personalWatchlistSummary?.spikeActive?.length ?? 0}</p>
          <p className="mt-1 text-sm text-slate-500">Watch for fast abnormal moves</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
          <p className="metric-label">Avoid / High Risk</p>
          <p className="mt-2 text-lg font-semibold text-white">{(personalWatchlistSummary?.avoid?.length ?? 0) + (personalWatchlistSummary?.highRisk?.length ?? 0)}</p>
          <p className="mt-1 text-sm text-slate-500">Names where patience matters more than action</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <p className="metric-label">Add Watchlist Stock</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Personal watchlist builder</h3>
          <div className="mt-4 flex gap-3">
            <input
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value)}
              placeholder="Enter NSE symbol"
              className="app-input flex-1"
            />
            <button onClick={submitAdd} className="app-button-primary">
              Add stock
            </button>
          </div>
        </div>
        <div className="panel p-5">
          <p className="metric-label">Watchlist Alert</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Create personal price alert</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input value={alertForm.symbol} onChange={(event) => setAlertForm((current) => ({ ...current, symbol: event.target.value }))} placeholder="Symbol" className="app-input" />
            <input value={alertForm.price} onChange={(event) => setAlertForm((current) => ({ ...current, price: event.target.value }))} placeholder="Alert price" type="number" min="0.01" step="0.01" className="app-input" />
            <select value={alertForm.direction} onChange={(event) => setAlertForm((current) => ({ ...current, direction: event.target.value }))} className="app-input">
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>
          <button onClick={submitAlert} className="app-button-accent mt-4">
            Create alert
          </button>
        </div>
      </div>
      {rows.length ? (
        <WatchlistTable
          rows={rows}
          onRemove={toggleWatchlist}
          onMove={moveWatchlistItem}
          onTogglePin={togglePin}
          pinnedStocks={pinnedStocks}
        />
      ) : (
        <EmptyState
          title="Your watchlist is empty"
          description="Add stocks to monitor live pricing, signal quality, buy zones, and exit timing in one place."
        />
      )}
    </div>
  );
}

export default WatchlistPage;
