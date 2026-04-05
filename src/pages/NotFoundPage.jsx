import { Link } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';
import SectionHeader from '@/components/SectionHeader';

function NotFoundPage() {
  return (
    <div className="page-shell">
      <SectionHeader
        eyebrow="Navigation"
        title="Page not found"
        description="That route is not available in this StockPulse workspace. You can safely return to the dashboard and continue from there."
      />

      <EmptyState
        title="This page is not available"
        description="The link may be outdated, or the page may not be part of the current deployment. Head back to the dashboard to continue monitoring the market."
        action={
          <Link to="/" className="app-button-primary">
            Go to dashboard
          </Link>
        }
      />
    </div>
  );
}

export default NotFoundPage;
