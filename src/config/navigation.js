import {
  Activity,
  BellRing,
  ChartCandlestick,
  Clock3,
  LayoutDashboard,
  LayoutGrid,
  ScanSearch,
  Settings2,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
  BriefcaseBusiness,
} from 'lucide-react';

export const navigationItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/live-monitor', label: 'Live Monitor', icon: Activity },
  { to: '/buy-opportunities', label: 'Buy Zones', icon: TrendingUp },
  { to: '/best-entry-zones', label: 'Best Entry Zones', icon: Target },
  { to: '/one-hour-prediction', label: '1 Hour Prediction', icon: ScanSearch },
  { to: '/opportunity-radar', label: 'Opportunity Radar', icon: LayoutGrid },
  { to: '/sell-opportunities', label: 'Sell / Exit', icon: TrendingDown },
  { to: '/analysis', label: 'Stock Analysis', icon: ChartCandlestick },
  { to: '/portfolio', label: 'Portfolio', icon: BriefcaseBusiness },
  { to: '/watchlist', label: 'Watchlist', icon: WalletCards },
  { to: '/alerts', label: 'Alerts', icon: BellRing },
  { to: '/signals', label: 'Signal History', icon: Clock3 },
  { to: '/backtesting', label: 'Backtesting', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

export const routeAliases = {
  '/dashboard': '/',
  '/monitor': '/live-monitor',
};

export const knownRoutePaths = new Set([
  ...navigationItems.map((item) => item.to),
  ...Object.keys(routeAliases),
]);
