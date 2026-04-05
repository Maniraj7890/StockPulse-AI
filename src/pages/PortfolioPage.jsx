import { useMemo, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import PortfolioHoldingsTable from '@/components/PortfolioHoldingsTable';
import SectionHeader from '@/components/SectionHeader';
import { useMarketStore } from '@/store/useMarketStore';
import { buildHoldingSnapshots } from '@/utils/portfolioEngine';
import { formatCurrency, formatPercent } from '@/utils/formatters';

function SummaryCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
      <p className="metric-label">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

function PortfolioPage() {
  const portfolioHoldings = useMarketStore((state) => (Array.isArray(state.portfolioHoldings) ? state.portfolioHoldings : []));
  const analysisData = useMarketStore((state) => state.analysisData ?? {});
  const alerts = useMarketStore((state) => (Array.isArray(state.alertSnapshot?.triggeredAlerts) ? state.alertSnapshot.triggeredAlerts : Array.isArray(state.alerts) ? state.alerts : []));
  const portfolioSummary = useMarketStore((state) => state.portfolioSummary ?? {});
  const addHolding = useMarketStore((state) => state.addHolding);
  const editHolding = useMarketStore((state) => state.editHolding);
  const removeHolding = useMarketStore((state) => state.removeHolding);
  const addPriceAlert = useMarketStore((state) => state.addPriceAlert);
  const [form, setForm] = useState({ symbol: '', quantity: '', averageBuyPrice: '' });
  const [editingId, setEditingId] = useState(null);
  const [alertForm, setAlertForm] = useState({ symbol: '', price: '', direction: 'above' });

  const rows = useMemo(
    () => {
      try {
        return buildHoldingSnapshots(portfolioHoldings, analysisData, alerts).sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('PortfolioPage rows fallback:', error);
        }
        return [];
      }
    },
    [alerts, analysisData, portfolioHoldings],
  );

  const submitHolding = () => {
    const symbol = form.symbol.trim().toUpperCase();
    const quantity = Number(form.quantity);
    const averageBuyPrice = Number(form.averageBuyPrice);
    if (!symbol || quantity <= 0 || averageBuyPrice <= 0) return;
    if (editingId) {
      editHolding(editingId, { quantity, averageBuyPrice });
      setEditingId(null);
    } else {
      addHolding({ symbol, quantity, averageBuyPrice });
    }
    setForm({ symbol: '', quantity: '', averageBuyPrice: '' });
  };

  const submitAlert = () => {
    const symbol = alertForm.symbol.trim().toUpperCase();
    const price = Number(alertForm.price);
    if (!symbol || price <= 0) return;
    addPriceAlert(symbol, price, alertForm.direction);
    setAlertForm({ symbol: '', price: '', direction: 'above' });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Portfolio"
        title="Holdings, P&amp;L, and personal risk context"
        description="Track your local holdings with unrealized profit/loss, setup quality, downside context, and stock-specific alerts."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Invested" value={formatCurrency(portfolioSummary?.totalInvested ?? 0)} helper="Local holdings only" />
        <SummaryCard label="Current Value" value={formatCurrency(portfolioSummary?.currentValue ?? 0)} helper="Uses current or last traded price depending on session" />
        <SummaryCard label="Total P&L" value={formatCurrency(portfolioSummary?.totalPnL ?? 0)} helper={formatPercent(portfolioSummary?.totalReturnPercent ?? 0)} />
        <SummaryCard label="Best Holding" value={portfolioSummary?.bestHolding?.symbol ?? '--'} helper={portfolioSummary?.bestHolding ? formatPercent(portfolioSummary.bestHolding.pnlPercent) : 'No holdings yet'} />
        <SummaryCard label="High-Risk Holding" value={portfolioSummary?.highRiskHolding?.symbol ?? '--'} helper={portfolioSummary?.highRiskHolding?.riskLevel ?? 'No risk warning'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <p className="metric-label">Add or Update Holding</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">{editingId ? 'Edit holding' : 'Add holding'}</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input value={form.symbol} onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value }))} placeholder="Symbol" className="app-input" />
            <input value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Quantity" type="number" min="1" className="app-input" />
            <input value={form.averageBuyPrice} onChange={(event) => setForm((current) => ({ ...current, averageBuyPrice: event.target.value }))} placeholder="Average buy price" type="number" min="0.01" step="0.01" className="app-input" />
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={submitHolding} className="app-button-primary">
              {editingId ? 'Save holding' : 'Add holding'}
            </button>
            {editingId ? (
              <button onClick={() => { setEditingId(null); setForm({ symbol: '', quantity: '', averageBuyPrice: '' }); }} className="app-button">
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <div className="panel p-5">
          <p className="metric-label">Personal Alert</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Add price alert for owned stock</h3>
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
        <PortfolioHoldingsTable
          rows={rows}
          onEdit={(item) => {
            setEditingId(item.id);
            setForm({
              symbol: item.symbol,
              quantity: String(item.quantity),
              averageBuyPrice: String(item.averageBuyPrice),
            });
          }}
          onRemove={removeHolding}
        />
      ) : (
        <EmptyState
          title="No holdings added yet"
          description="Add your first holding to track unrealized P&L, downside risk, and alerts with the shared StockPulse engine."
        />
      )}
    </div>
  );
}

export default PortfolioPage;
