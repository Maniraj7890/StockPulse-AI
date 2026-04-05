import {
  X,
  LogOut,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { navigationItems } from '@/config/navigation';
import { cn } from '@/utils/cn';
import { useMarketStore } from '@/store/useMarketStore';

function Sidebar({ mobileOpen = false, onCloseMobile = () => {} }) {
  const alertCount = useMarketStore((state) => state.alertCount ?? 0);
  const handleNavigationClick = (label) => {
    if (import.meta.env.DEV) {
      window.sessionStorage.setItem('stockpulse:lastNavClick', label);
    }
  };

  return (
    <aside className={`pointer-events-auto fixed inset-y-0 left-0 z-40 w-[84vw] max-w-[320px] overflow-y-auto border-r border-border/70 bg-app/95 px-4 py-5 backdrop-blur-xl transition-transform duration-300 ease-out lg:bottom-0 lg:left-0 lg:top-0 lg:w-72 lg:max-w-none lg:translate-x-0 lg:px-5 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 via-emerald-300/10 to-amber-300/20 shadow-glow transition-transform duration-300 hover:scale-105">
              <div className="h-6 w-6 rounded-full border border-emerald-300/50 bg-emerald-300/20" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Market Intelligence</p>
              <h1 className="font-display text-xl font-bold text-gradient">StockPulse</h1>
            </div>
          </div>

          <div className="panel-hover hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/8 via-transparent to-amber-300/10 p-4 lg:block">
            <p className="metric-label">Decision Support</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Serious short-term stock analysis with deterministic signals, live monitoring, and alert-ready workflows.
            </p>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="rounded-2xl border border-border/70 p-2 text-slate-300 lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

        <nav className="mt-8 flex flex-col gap-2">
          {navigationItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => {
                handleNavigationClick(label);
                onCloseMobile();
              }}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition',
                  isActive
                    ? 'signal-accent border-emerald-400/30 bg-emerald-400/10 text-white shadow-glow'
                    : 'border-transparent bg-white/[0.02] text-slate-400 hover:border-border hover:bg-white/[0.04] hover:text-slate-100',
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {label === 'Alerts' && alertCount ? (
                <span className="ml-auto rounded-full border border-amber-400/30 bg-amber-400/12 px-2 py-0.5 text-[10px] text-amber-200">
                  {alertCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      <button className="mt-6 hidden items-center gap-2 rounded-2xl border border-border/70 bg-panel-soft/60 px-4 py-3 text-sm text-slate-400 transition hover:text-white lg:flex">
        <LogOut className="h-4 w-4" />
        Personal workspace
      </button>
    </aside>
  );
}

export default Sidebar;
