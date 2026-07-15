import { Navigate, Outlet } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { paths } from './paths';

/** Must be signed in. Pending/rejected/locked go to /pending. */
export function ProtectedRoute() {
  const { isAuthenticated, loading, isActive, isPending, isRejected, isLocked } = useAuth();
  if (loading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to={paths.login} replace />;
  if (isPending || isRejected || isLocked || !isActive) {
    return <Navigate to={paths.pending} replace />;
  }
  return <Outlet />;
}

/** Signed in but not necessarily active (pending screen). */
export function AuthenticatedRoute() {
  const { isAuthenticated, loading, isActive } = useAuth();
  if (loading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to={paths.login} replace />;
  if (isActive) return <Navigate to={paths.dashboard} replace />;
  return <Outlet />;
}

export function TeacherRoute() {
  const { isTeacher, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!isTeacher) return <Navigate to={paths.dashboard} replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!isAdmin) return <Navigate to={paths.dashboard} replace />;
  return <Outlet />;
}
