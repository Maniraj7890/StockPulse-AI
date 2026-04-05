import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import RouteDebugPanel from '@/components/RouteDebugPanel';
import RouteErrorBoundary from '@/components/RouteErrorBoundary';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="relative isolate min-h-screen bg-transparent lg:flex">
      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
      {mobileNavOpen ? (
        <button
          aria-label="Close navigation overlay"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}
      <div className="relative z-10 flex min-h-screen flex-1 flex-col lg:pl-72">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 px-4 pb-8 pt-24 sm:px-6 sm:pb-10 sm:pt-28 lg:px-8 lg:pb-12 lg:pt-6">
          <RouteErrorBoundary resetKey={location.pathname} pageName={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
      <RouteDebugPanel />
    </div>
  );
}

export default AppLayout;
