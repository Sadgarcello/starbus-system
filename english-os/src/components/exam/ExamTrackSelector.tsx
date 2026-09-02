import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import {
  EXAM_TRACK_INFO,
  EXAM_TRACK_LABELS,
  EXAM_TRACKS,
  type ExamTrack,
} from '@/lib/examTrackContent';
import { studentService } from '@/services/studentService';
import { cn } from '@/utils/cn';
import { ExamTrackLogo } from '@/components/exam/ExamTrackLogo';

interface ExamTrackSelectorProps {
  studentId: string;
  currentTrack: ExamTrack | null | undefined;
  onSaved: (track: ExamTrack) => void | Promise<void>;
  required?: boolean;
  /** When true, saved track shows logo summary until user taps Change exam. */
  collapsible?: boolean;
}

export function ExamTrackSelector({
  studentId,
  currentTrack,
  onSaved,
  required = false,
  collapsible = false,
}: ExamTrackSelectorProps) {
  const [selected, setSelected] = useState<ExamTrack | null>(currentTrack ?? null);
  const [editing, setEditing] = useState(!currentTrack || !collapsible);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(currentTrack ?? null);
    if (collapsible && currentTrack) {
      setEditing(false);
    }
    if (!currentTrack) {
      setEditing(true);
    }
  }, [collapsible, currentTrack]);

  async function save() {
    if (!selected) {
      setError('Choose TOEFL, IELTS, or Linguaskill to continue.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await studentService.updateExamTrack(studentId, selected);
      await onSaved(selected);
      if (collapsible) {
        setEditing(false);
      }
    } catch (e) {
      setError((e as Error).message || 'Could not save exam track.');
    } finally {
      setSaving(false);
    }
  }

  if (collapsible && currentTrack && !editing) {
    const info = EXAM_TRACK_INFO.find((i) => i.id === currentTrack)!;
    return (
      <Card>
        <CardHeader title="Exam track" subtitle="Your skill modules follow this test style." />
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 pb-4">
          <div className="flex min-w-0 items-center gap-4">
            <ExamTrackLogo track={currentTrack} variant="card" className="h-12 max-w-[160px]" />
            <div>
              <p className="font-display text-lg text-ink">{EXAM_TRACK_LABELS[currentTrack]}</p>
              <p className="mt-0.5 text-xs text-ink-subtle">{info.tagline}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Change exam
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(required && !currentTrack && 'border-club/50 ring-1 ring-club/30')}>
      <CardHeader
        title={required && !currentTrack ? 'Choose your exam track' : 'Exam track'}
        subtitle={
          required && !currentTrack
            ? 'All Khawaja Club students must pick one test — Reading, Listening, Writing, and Speaking will match this style.'
            : 'Change which test you are preparing for. Skill modules update to match.'
        }
      />
      <div className="space-y-3 px-4 pb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {EXAM_TRACKS.map((track) => {
            const info = EXAM_TRACK_INFO.find((i) => i.id === track)!;
            const active = selected === track;
            return (
              <button
                key={track}
                type="button"
                onClick={() => setSelected(track)}
                className={cn(
                  'rounded-md border p-4 text-left transition',
                  active
                    ? 'border-club bg-club-soft/80 ring-2 ring-club/40'
                    : 'border-paper-line bg-paper hover:border-club/40',
                )}
              >
                <div className="mb-3 flex min-h-10 items-center px-1 py-1">
                  <ExamTrackLogo track={track} variant="card" />
                </div>
                <p className="font-display text-lg text-ink">{info.label}</p>
                <p className="mt-1 text-xs font-semibold text-ink-muted">{info.tagline}</p>
                <p className="mt-2 text-xs text-ink-subtle">{info.description}</p>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            loading={saving}
            disabled={!selected || selected === currentTrack}
            onClick={() => void save()}
          >
            {currentTrack ? 'Update exam track' : 'Save my exam track'}
          </Button>
          {collapsible && currentTrack && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          {currentTrack && selected === currentTrack && !collapsible && (
            <p className="text-xs text-ink-subtle">Current track saved.</p>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Card>
  );
}
