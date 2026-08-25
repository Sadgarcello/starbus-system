import { Link } from 'react-router-dom';
import { paths } from '@/routes/paths';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper-soft px-4">
      <h1 className="page-title">404</h1>
      <p className="text-sm text-ink-muted">This page is off the syllabus.</p>
      <Link to={paths.home} className="text-sm font-bold text-ink underline">
        Back to Khawaja Club
      </Link>
    </div>
  );
}
