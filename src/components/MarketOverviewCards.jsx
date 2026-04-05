import { AlertTriangle, CandlestickChart, Gauge, ShieldCheck } from 'lucide-react';
import LiveBadge from '@/components/LiveBadge';
import { useMarketStore } from '@/store/useMarketStore';
import { getStatusLabel, UI_LABELS } from '@/utils/displayLabels';
import { getQuotePresentation } from '@/utils/marketSession';
import { formatDateTime, formatNumber, formatPercent } from '@/utils/formatters';

const icons = [CandlestickChart, Gauge, ShieldCheck, AlertTriangle];

function MarketOverviewCards() {
  const cards = useMarketStore((state) => state.marketOverview);
  const data = useMarketStore((state) => state.data ?? {});

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {(cards ?? []).map((card, index) => {
        const Icon = icons[index % icons.length];
        const latest = data[card.label]?.latest ?? card;
        const quotePresentation = getQuotePresentation(latest);
        const explanation = quotePresentation.explanation;

        return (
          <div key={card.label} className="panel relative overflow-hidden p-5 transition hover:-translate-y-1">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300/0 via-emerald-300/60 to-amber-300/0" />
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-label">{card.label}</p>
                <p className="mt-4 font-display text-3xl font-bold text-white">
                  {card.value == null ? 'Data unavailable' : formatNumber(card.value)}
                </p>
              </div>
              <div className="space-y-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-emerald-200">
                  <Icon className="h-5 w-5" />
                </div>
                <LiveBadge status={latest.marketStatus} />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {getStatusLabel(latest.marketStatus, latest.marketStatusDetail)}
              </span>
              <span className={card.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {formatPercent(card.change)}
              </span>
            </div>
            {explanation.bannerText ? (
              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-200">
                {explanation.bannerText}
              </div>
            ) : null}
            <div className="mt-3 text-xs text-slate-500">
              <p>Status: {getStatusLabel(latest.marketStatus, latest.marketStatusDetail)}</p>
              <p>{latest.marketStatusReason ?? explanation.reason}</p>
              {latest.freshnessNote ? <p>{latest.freshnessNote}</p> : null}
              {latest.stale ? <p className="text-amber-300">{UI_LABELS.staleFeed}: {latest.staleLabel ?? 'Delayed'}</p> : null}
              <p>Exchange: {latest.exchange ?? 'NSE'}</p>
              <p>Source: {latest.source ?? UI_LABELS.liveSource}</p>
              <p>Last valid session: {formatDateTime(latest.lastValidSessionTimestamp ?? latest.lastUpdated)}</p>
              {latest.nextExpectedLiveSession ? <p>Next live session: {latest.nextExpectedLiveSession}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MarketOverviewCards;
