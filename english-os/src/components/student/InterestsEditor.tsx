import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import {
  useAddHobby,
  useHobbyCatalog,
  useMyPendingHobbySuggestions,
  useRemoveHobby,
  useRequestHobby,
  useStudentHobbies,
} from '@/hooks/useHobbies';

interface InterestsEditorProps {
  studentId: string;
}

export function InterestsEditor({ studentId }: InterestsEditorProps) {
  const catalog = useHobbyCatalog();
  const mine = useStudentHobbies(studentId);
  const pending = useMyPendingHobbySuggestions(studentId);
  const request = useRequestHobby();
  const add = useAddHobby();
  const remove = useRemoveHobby();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const myIds = useMemo(() => new Set((mine.data ?? []).map((h) => h.id)), [mine.data]);
  const available = (catalog.data ?? []).filter((h) => !myIds.has(h.id));

  async function submitCustom() {
    setError(null);
    setMessage(null);
    const value = text.trim();
    if (value.length < 2) {
      setError('Enter at least 2 characters.');
      return;
    }
    try {
      const result = await request.mutateAsync(value);
      setText('');
      if (result.status === 'added') {
        setMessage(`Added to your profile.`);
      } else if (result.status === 'pending' || result.status === 'pending_exists') {
        setMessage(
          `“${value}” sent to admin. Once they normalize it (e.g. Soccer → Football), it becomes a shared hobby.`,
        );
      } else {
        setMessage('Saved.');
      }
    } catch (e) {
      setError((e as Error).message || 'Could not save interest');
    }
  }

  return (
    <Card>
      <CardHeader
        title="Interests"
        subtitle="Pick a club hobby or suggest a new one for the admin to normalize"
      />
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2">
          {(mine.data ?? []).length === 0 && (
            <p className="text-sm text-ink-subtle">No interests on your profile yet.</p>
          )}
          {(mine.data ?? []).map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => void remove.mutateAsync({ studentId, hobbyId: h.id })}
              className="rounded-md border border-ink bg-club-soft px-2.5 py-1 text-xs font-semibold text-ink hover:bg-club"
              title="Remove"
            >
              {h.name} ×
            </button>
          ))}
        </div>

        {(pending.data ?? []).length > 0 && (
          <div className="rounded-md border border-dashed border-paper-line px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
              Waiting for admin
            </p>
            <p className="mt-1 text-sm text-ink-muted">{(pending.data ?? []).join(' · ')}</p>
          </div>
        )}

        {available.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
              Club hobbies
            </p>
            <div className="flex flex-wrap gap-2">
              {available.map((h) => (
                <Button
                  key={h.id}
                  size="sm"
                  variant="secondary"
                  loading={add.isPending}
                  onClick={() => void add.mutateAsync({ studentId, hobbyId: h.id })}
                >
                  + {h.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. soccer"
            maxLength={60}
            className="min-w-0 flex-1 rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
          <Button loading={request.isPending} onClick={() => void submitCustom()}>
            Suggest interest
          </Button>
        </div>

        {message && <p className="text-sm font-semibold text-ink">{message}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Card>
  );
}
