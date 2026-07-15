import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { paths } from '@/routes/paths';

export default function AnalyticsPage() {
  return (
    <div className="space-y-4">
      <h1 className="page-title">Analytics</h1>
      <Card className="space-y-3 p-6 text-sm text-ink-muted">
        <p>
          Open a student from the Dashboard roster to see their System &amp; Tracking view
          (skill completion, XP over time, and recent activity).
        </p>
        <Link
          to={paths.dashboard}
          className="inline-block text-sm font-semibold text-ink underline decoration-club underline-offset-2"
        >
          Go to Dashboard
        </Link>
      </Card>
    </div>
  );
}
