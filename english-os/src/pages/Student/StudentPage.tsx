import { useParams } from 'react-router-dom';
import { StudentTrackingDashboard } from '@/components/student/StudentTrackingDashboard';
import { Card } from '@/components/ui/Card';

export default function StudentPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Card className="p-6 text-sm text-danger">Student not found.</Card>;
  return <StudentTrackingDashboard studentId={id} showDetailLists />;
}
