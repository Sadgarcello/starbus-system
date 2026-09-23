import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { paths } from '@/routes/paths';

export default function ListeningPracticeHubPage() {
  const { student, isTeacher } = useAuth();

  if (student?.exam_track !== 'toefl' && !isTeacher) {
    return (
      <Card className="p-6 text-sm">
        TOEFL Listening Practice is for students on the TOEFL track.
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">TOEFL 2026 style</p>
        <h1 className="font-display text-3xl text-ink">Listening Practice</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Multistage diagnostic: lower module, routing, then upper module. One audio per conversation,
          announcement, or academic talk — questions follow without replay.
        </p>
      </div>

      {student?.exam_track === 'toefl' && (
        <Card className="p-5">
          <h2 className="font-semibold text-ink">Placement test</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Listen and Choose, Conversations, Announcements, and Academic Talks. Take notes while audio
            plays; no transcript during the test.
          </p>
          <Link to={`${paths.listeningPractice}/session`} className="mt-4 inline-block">
            <Button type="button">Start listening diagnostic</Button>
          </Link>
        </Card>
      )}

      {isTeacher && (
        <Link to={paths.listeningPracticeAdmin} className="text-sm font-bold uppercase text-ink-subtle hover:text-ink">
          Manage listening content →
        </Link>
      )}

      <Link to={paths.listening} className="text-xs text-ink-muted underline">
        ← Student Picks (weekly listening)
      </Link>
    </div>
  );
}
