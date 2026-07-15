import { Navigate } from 'react-router-dom';
import { StudentTrackingDashboard } from '@/components/student/StudentTrackingDashboard';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { paths } from '@/routes/paths';

export default function ProgressPage() {
  const { loading, isStudent, student, isTeacher } = useAuth();

  if (loading) return <Spinner />;

  if (isStudent && student) {
    return <StudentTrackingDashboard studentId={student.id} showDetailLists />;
  }

  // Teachers use Analytics / student profiles instead
  if (isTeacher) return <Navigate to={paths.analytics} replace />;

  return (
    <Card className="p-6 text-sm text-ink-muted">
      Progress tracking is available for student accounts.
    </Card>
  );
}
