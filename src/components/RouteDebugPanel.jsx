import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { navigationItems, routeAliases } from '@/config/navigation';

function RouteDebugPanel() {
  const location = useLocation();

  const routeDebug = useMemo(() => {
    const normalizedPath = routeAliases[location.pathname] ?? location.pathname;
    const matchedRoute = navigationItems.find((item) => item.to === normalizedPath)?.label ?? 'Unknown route';
    const lastClickedItem = window.sessionStorage.getItem('stockpulse:lastNavClick') ?? 'None';

    return {
      pathname: location.pathname,
      matchedRoute,
      lastClickedItem,
    };
  }, [location.pathname]);

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-2xl border border-border/70 bg-app/90 px-4 py-3 text-xs text-slate-300 shadow-card backdrop-blur-xl xl:block">
      <p className="metric-label">Route Debug</p>
      <p className="mt-2">Pathname: {routeDebug.pathname}</p>
      <p>Matched route: {routeDebug.matchedRoute}</p>
      <p>Last clicked: {routeDebug.lastClickedItem}</p>
    </div>
  );
}

export default RouteDebugPanel;
