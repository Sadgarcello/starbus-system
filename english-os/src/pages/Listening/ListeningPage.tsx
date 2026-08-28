import { useState } from 'react';
import { Avatar } from '@/components/common/Avatar';
import { AiFeedbackPanel } from '@/components/ai/AiFeedbackPanel';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import {
  useDeleteListeningPick,
  useListeningPicks,
  useSubmitListeningPick,
} from '@/hooks/useListening';
import type { ListeningPickWithStudent } from '@/types';

const RULES = [
  '2–5 minutes',
  'Clean language',
  'English audio',
  'Interesting topic',
];

export default function ListeningPage() {
  const { isStudent, isTeacher, student } = useAuth();
  const picks = useListeningPicks();
  const remove = useDeleteListeningPick();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (picks.isLoading) return <Spinner />;

  if (picks.isError) {
    return (
      <Card className="p-6 text-sm text-danger">
        Could not load listening picks. Run{' '}
        <code className="font-mono">0011_listening_picks.sql</code> in Khawaja Club DB.
        <br />
        {(picks.error as Error).message}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-subtle">Skill module</p>
        <h1 className="page-title">Listening</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Student Picks — each week one student chooses the clip and explains it.
        </p>
      </div>

      {notice && <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}
      {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <Card className="p-5">
        <h2 className="font-display text-2xl text-ink">Student Picks</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Each week one student chooses the clip. Then they explain why, what they understood, and
          their opinion.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {RULES.map((rule) => (
            <li
              key={rule}
              className="rounded-md border border-paper-line bg-paper-soft/80 px-3 py-2 text-sm font-semibold text-ink"
            >
              {rule}
            </li>
          ))}
        </ul>
      </Card>

      {isStudent && student && (
        <SubmitPickForm
          studentId={student.id}
          onNotice={setNotice}
          onError={setError}
        />
      )}

      {!isStudent && !isTeacher && (
        <Card className="p-5 text-sm text-ink-subtle">Sign in as a student to submit a pick.</Card>
      )}

      <div>
        <h2 className="mb-3 font-display text-2xl text-ink">Recent picks</h2>
        <div className="space-y-4">
          {(picks.data ?? []).length === 0 && (
            <Card className="p-5 text-sm text-ink-subtle">No student picks yet.</Card>
          )}
          {(picks.data ?? []).map((pick) => (
            <PickCard
              key={pick.id}
              pick={pick}
              isOwnPick={Boolean(student) && pick.student_id === student?.id}
              canDelete={
                isTeacher || (Boolean(student) && pick.student_id === student?.id)
              }
              deleting={remove.isPending}
              onDelete={async () => {
                setError(null);
                try {
                  await remove.mutateAsync(pick.id);
                  setNotice('Pick removed.');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SubmitPickForm({
  studentId,
  onNotice,
  onError,
}: {
  studentId: string;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const submit = useSubmitListeningPick();
  const [clipName, setClipName] = useState('');
  const [topic, setTopic] = useState('');
  const [url, setUrl] = useState('');
  const [whyChose, setWhyChose] = useState('');
  const [whatUnderstood, setWhatUnderstood] = useState('');
  const [opinion, setOpinion] = useState('');

  return (
    <Card>
      <CardHeader
        title="Submit your pick"
        subtitle="Name the clip, topic, optional URL, then explain and share your opinion"
      />
      <form
        className="space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit
            .mutateAsync({
              studentId,
              clipName,
              topic,
              url,
              whyChose,
              whatUnderstood,
              opinion,
            })
            .then(() => {
              setClipName('');
              setTopic('');
              setUrl('');
              setWhyChose('');
              setWhatUnderstood('');
              setOpinion('');
              onNotice('Listening pick submitted.');
            })
            .catch((err: Error) => onError(err.message));
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Clip name">
            <input
              value={clipName}
              onChange={(e) => setClipName(e.target.value)}
              required
              className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
              placeholder="Name of the audio / video clip"
            />
          </Field>
          <Field label="Topic of discussion">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
              placeholder="What is it about?"
            />
          </Field>
        </div>
        <Field label="URL (optional)">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
            placeholder="https://…"
          />
        </Field>
        <Field label="Why you chose it">
          <textarea
            value={whyChose}
            onChange={(e) => setWhyChose(e.target.value)}
            required
            rows={3}
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </Field>
        <Field label="What you understood">
          <textarea
            value={whatUnderstood}
            onChange={(e) => setWhatUnderstood(e.target.value)}
            required
            rows={4}
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </Field>
        <Field label="Personal opinion">
          <textarea
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            required
            rows={3}
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </Field>
        <Button type="submit" loading={submit.isPending}>
          Submit
        </Button>
      </form>
    </Card>
  );
}

function PickCard({
  pick,
  isOwnPick,
  canDelete,
  deleting,
  onDelete,
}: {
  pick: ListeningPickWithStudent;
  isOwnPick: boolean;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const profile = pick.student?.profile;
  const name = profile?.name || profile?.email || 'Student';

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar path={profile?.avatar} name={profile?.name} email={profile?.email} size="sm" />
          <div>
            <p className="font-semibold text-ink">{name}</p>
            <p className="text-[11px] text-ink-subtle">
              {new Date(pick.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        {canDelete && (
          <Button
            size="sm"
            variant="danger"
            loading={deleting}
            onClick={() => {
              if (window.confirm('Remove this pick?')) onDelete();
            }}
          >
            Remove
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <Row label="Clip" value={pick.clip_name} />
        <Row label="Topic" value={pick.topic} />
        {pick.url && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">URL</p>
            <a
              href={pick.url}
              target="_blank"
              rel="noreferrer"
              className="break-all font-semibold text-ink underline decoration-club underline-offset-2"
            >
              {pick.url}
            </a>
          </div>
        )}
        <Block label="Why they chose it" text={pick.why_chose} />
        <Block label="What they understood" text={pick.what_understood} />
        <Block label="Opinion" text={pick.opinion} />
      </div>

      {isOwnPick && (
        <div className="mt-4">
          <AiFeedbackPanel
            sourceType="listening"
            sourceId={pick.id}
            disabled={
              `${pick.what_understood} ${pick.opinion}`.trim().length < 20
            }
            disabledReason="Write at least 20 characters in your explanation fields to use AI feedback."
          />
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-paper-line bg-paper-soft/70 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-ink-muted">{text}</p>
    </div>
  );
}
