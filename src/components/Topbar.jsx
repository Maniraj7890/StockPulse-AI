import { Bell, ChevronDown, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import LiveTickerStrip from '@/components/LiveTickerStrip';
import StockSearchBar from '@/components/StockSearchBar';
import { useMarketStore } from '@/store/useMarketStore';

function Topbar({ onOpenMobileNav = () => {} }) {
  const alertCount = useMarketStore((state) => state.alertCount ?? 0);

  return (
    <header className="pointer-events-auto sticky top-0 z-30 border-b border-border/70 bg-app/80 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="space-y-4 animate-fade-in-up">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <button
              onClick={onOpenMobileNav}
              className="rounded-2xl border border-border/70 bg-panel p-3 text-slate-300 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="brand-badge">StockPulse Workspace</p>
              <h2 className="mt-3 font-display text-2xl font-bold text-white sm:text-[2.15rem]">Live monitoring and timing support</h2>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <StockSearchBar />
            <Link
              to="/alerts"
              className="panel-hover flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-panel px-4 py-3 text-sm text-slate-300 transition hover:border-emerald-400/30 hover:text-white"
            >
              <Bell className="h-4 w-4" />
              Alerts
              {alertCount ? (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/12 px-2 py-0.5 text-[10px] text-amber-200">
                  {alertCount}
                </span>
              ) : null}
              <ChevronDown className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <LiveTickerStrip />
      </div>
    </header>
  );
}

export default Topbar;
