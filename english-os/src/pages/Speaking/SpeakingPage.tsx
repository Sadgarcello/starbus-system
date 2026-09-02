import { useMemo, useState } from 'react';
import { Avatar } from '@/components/common/Avatar';
import { SkillModuleHeader } from '@/components/skill/SkillModuleHeader';
import { SkillGauge } from '@/components/student/SkillGauge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import {
  useClearSpeakingVote,
  useCloseSpeakingDay,
  useCreateSpeakingFormat,
  useDeleteSpeakingFormat,
  useMarkSpeakingPractice,
  useMySpeakingMark,
  useOpenSpeakingDay,
  useSpeakingDay,
  useSpeakingFormats,
  useSpeakingMarks,
  useSpeakingVotes,
  useVoteSpeakingFormat,
} from '@/hooks/useSpeaking';
import { getSkillTrackStyle } from '@/lib/examTrackContent';
import { speakingService } from '@/services/speakingService';
import type { ExamTrack } from '@/types';
import type {
  SpeakingDaySessionWithFormat,
  SpeakingFormat,
  SpeakingFormatVoter,
} from '@/types';

export default function SpeakingPage() {
  const { isTeacher, isStudent, student, refresh } = useAuth();
  const today = speakingService.todayLocal();
  const formats = useSpeakingFormats();
  const votes = useSpeakingVotes();
  const day = useSpeakingDay(today);
  const open = useOpenSpeakingDay();
  const removeFormat = useDeleteSpeakingFormat();
  const vote = useVoteSpeakingFormat();
  const clearVote = useClearSpeakingVote();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const votersByFormat = useMemo(() => {
    const map = new Map<string, SpeakingFormatVoter[]>();
    for (const v of votes.data ?? []) {
      const list = map.get(v.format_id) ?? [];
      list.push(v);
      map.set(v.format_id, list);
    }
    return map;
  }, [votes.data]);

  const myVoteFormatId = useMemo(() => {
    if (!student) return null;
    return (votes.data ?? []).find((v) => v.student_id === student.id)?.format_id ?? null;
  }, [votes.data, student]);

  if (formats.isLoading || day.isLoading) return <Spinner />;

  if (formats.isError) {
    return (
      <Card className="p-6 text-sm text-danger">
        Could not load speaking formats. Run migration{' '}
        <code className="font-mono">0006_speaking_sessions.sql</code> in Khawaja Club DB.
        <br />
        {(formats.error as Error).message}
      </Card>
    );
  }

  async function chooseFormat(formatId: string) {
    setBannerError(null);
    setBannerNotice(null);
    try {
      await open.mutateAsync({ formatId, sessionDate: today });
      setBannerNotice('Speaking day opened for all students.');
    } catch (e) {
      setBannerError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <SkillModuleHeader
        skill="speaking"
        title="Speaking"
        examTrack={student?.exam_track as ExamTrack | null | undefined}
        isTeacher={isTeacher}
      />

      {isStudent && student?.exam_track && (
        <SpeakingTips track={student.exam_track as ExamTrack} />
      )}

      {bannerNotice && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{bannerNotice}</p>
      )}
      {bannerError && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{bannerError}</p>
      )}

      {isStudent && student && (
        <StudentSpeakingBanner
          studentId={student.id}
          speakingProgress={student.speaking_progress ?? 0}
          level={student.level}
          session={day.data}
          onPracticed={() => void refresh()}
        />
      )}

      {isTeacher && (
        <TeacherSpeakingControls session={day.data} today={today} formats={formats.data ?? []} />
      )}

      {isTeacher && <AddSuggestionForm />}

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl text-ink">Suggestions</h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Students vote for a favorite · {(votes.data ?? []).length} vote
              {(votes.data ?? []).length === 1 ? '' : 's'} total
            </p>
          </div>
          <p className="text-xs text-ink-subtle">{(formats.data ?? []).length} formats</p>
        </div>
        {votes.isError && (
          <p className="mb-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            Could not load votes. Run <code className="font-mono">0007_speaking_votes.sql</code>.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {(formats.data ?? []).map((f) => (
            <FormatCard
              key={f.id}
              format={f}
              voters={votersByFormat.get(f.id) ?? []}
              myVote={myVoteFormatId === f.id}
              active={day.data?.format_id === f.id && day.data.status === 'open'}
              isTeacher={isTeacher}
              isStudent={isStudent}
              choosing={open.isPending}
              deleting={removeFormat.isPending}
              voting={vote.isPending || clearVote.isPending}
              onChoose={() => void chooseFormat(f.id)}
              onVote={async () => {
                setBannerError(null);
                try {
                  await vote.mutateAsync(f.id);
                  setBannerNotice(`Voted for “${f.title}”.`);
                } catch (e) {
                  setBannerError((e as Error).message);
                }
              }}
              onClearVote={async () => {
                setBannerError(null);
                try {
                  await clearVote.mutateAsync();
                  setBannerNotice('Vote cleared.');
                } catch (e) {
                  setBannerError((e as Error).message);
                }
              }}
              onDelete={async () => {
                setBannerError(null);
                try {
                  await removeFormat.mutateAsync(f.id);
                  setBannerNotice(`Removed “${f.title}”.`);
                } catch (e) {
                  setBannerError((e as Error).message);
                }
              }}
            />
          ))}
          {(formats.data ?? []).length === 0 && (
            <Card className="p-5 text-sm text-ink-subtle md:col-span-2">
              No formats yet. Add one above, or run 0006_speaking_sessions.sql for the starter pair.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function AddSuggestionForm() {
  const create = useCreateSpeakingFormat();
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        title="Add speaking suggestion"
        subtitle="Create as many formats as you want — then choose one as today’s topic"
      />
      <form
        className="space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setOk(null);
          void create
            .mutateAsync({ title, details, goal })
            .then(() => {
              setTitle('');
              setDetails('');
              setGoal('');
              setOk('Suggestion added.');
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Story Circle"
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-ink"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
            Details
          </span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="How it works, example topics, timing…"
            rows={5}
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-ink"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
            Goal
          </span>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Storytelling + vocabulary"
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-ink"
            required
          />
        </label>
        <Button type="submit" loading={create.isPending}>
          Add suggestion
        </Button>
        {ok && <p className="text-sm font-semibold text-ink">{ok}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Card>
  );
}

function FormatCard({
  format,
  voters,
  myVote,
  active,
  isTeacher,
  isStudent,
  choosing,
  deleting,
  voting,
  onChoose,
  onVote,
  onClearVote,
  onDelete,
}: {
  format: SpeakingFormat;
  voters: SpeakingFormatVoter[];
  myVote: boolean;
  active: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  choosing: boolean;
  deleting: boolean;
  voting: boolean;
  onChoose: () => void;
  onVote: () => void;
  onClearVote: () => void;
  onDelete: () => void;
}) {
  const shown = voters.slice(0, 8);
  const extra = Math.max(0, voters.length - shown.length);

  return (
    <Card className={active ? 'border-ink ring-2 ring-club' : undefined}>
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl text-ink">{format.title}</h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {active && (
              <span className="rounded bg-club px-2 py-0.5 text-[10px] font-bold uppercase text-ink">
                Today
              </span>
            )}
            {myVote && (
              <span className="rounded border border-ink/20 px-2 py-0.5 text-[10px] font-bold uppercase text-ink-subtle">
                Your vote
              </span>
            )}
          </div>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{format.details}</p>
        <p className="text-sm font-semibold text-ink">Goal: {format.goal}</p>

        <div className="rounded-md border border-paper-line bg-paper-soft/80 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-subtle">
              {voters.length} vote{voters.length === 1 ? '' : 's'}
            </p>
          </div>
          {voters.length === 0 ? (
            <p className="mt-1 text-xs text-ink-subtle">No votes yet</p>
          ) : (
            <div className="mt-2 flex items-center">
              <div className="flex -space-x-2">
                {shown.map((v) => (
                  <Avatar
                    key={v.student_id}
                    path={v.avatar}
                    name={v.name}
                    email={v.email}
                    size="xs"
                    className="ring-2 ring-paper"
                  />
                ))}
              </div>
              {extra > 0 && (
                <span className="ml-2 text-xs font-semibold text-ink-subtle">+{extra}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isStudent && (
            myVote ? (
              <Button size="sm" variant="secondary" loading={voting} onClick={onClearVote}>
                Remove my vote
              </Button>
            ) : (
              <Button size="sm" loading={voting} onClick={onVote}>
                Vote for this
              </Button>
            )
          )}
          {isTeacher && (
            <>
              <Button size="sm" loading={choosing} onClick={onChoose}>
                {active ? 'Reopen as today' : 'Choose for today'}
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={deleting}
                disabled={active}
                onClick={() => {
                  if (window.confirm(`Remove “${format.title}”?`)) onDelete();
                }}
              >
                Remove
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function TeacherSpeakingControls({
  session,
  today,
  formats,
}: {
  session: SpeakingDaySessionWithFormat | null | undefined;
  today: string;
  formats: SpeakingFormat[];
}) {
  const close = useCloseSpeakingDay();
  const marks = useSpeakingMarks(session?.id);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        title="Topic of the day"
        subtitle={`${today} · use a suggestion box below, or close when class ends`}
      />
      <div className="space-y-3 px-4 py-4">
        {session ? (
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-ink">{session.format?.title ?? 'Format'}</span>
            {' · '}
            status <span className="font-semibold text-ink">{session.status}</span>
            {' · '}
            {marks.data?.length ?? 0} practiced
            {formats.length === 0 ? '' : ''}
          </p>
        ) : (
          <p className="text-sm text-ink-subtle">No speaking topic chosen for today yet.</p>
        )}
        <Button
          variant="secondary"
          size="sm"
          loading={close.isPending}
          disabled={!session || session.status !== 'open'}
          onClick={async () => {
            if (!session) return;
            setError(null);
            try {
              await close.mutateAsync(session.id);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Close speaking day
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Card>
  );
}

function StudentSpeakingBanner({
  studentId,
  speakingProgress,
  level,
  session,
  onPracticed,
}: {
  studentId: string;
  speakingProgress: number;
  level: string;
  session: SpeakingDaySessionWithFormat | null | undefined;
  onPracticed: () => void;
}) {
  const myMark = useMySpeakingMark(session?.id, studentId);
  const mark = useMarkSpeakingPractice();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const sessionsDone = Math.min(15, Math.round(speakingProgress / 7));

  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr]">
      <Card className="flex items-center justify-center p-4">
        <SkillGauge
          label="Speaking cycle"
          percent={speakingProgress}
          skillKey="speaking"
          size={100}
        />
      </Card>
      <Card className="p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-subtle">Your progress</p>
        <p className="mt-1 font-display text-2xl text-ink">
          Level {level} · {speakingProgress}% · {sessionsDone}/15 sessions
        </p>
        {!session || session.status !== 'open' ? (
          <p className="mt-3 text-sm text-ink-muted">
            No open speaking topic today yet. Wait for your teacher to choose a format.
          </p>
        ) : myMark.data ? (
          <p className="mt-3 text-sm font-semibold text-ink">
            Practiced today · {session.format?.title}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-muted">
              Today: <span className="font-semibold text-ink">{session.format?.title}</span>
            </p>
            <Button
              className="mt-4"
              loading={mark.isPending}
              onClick={async () => {
                setErr(null);
                setMsg(null);
                try {
                  const result = await mark.mutateAsync(session.id);
                  onPracticed();
                  setMsg(
                    result.leveled_up
                      ? `Level up! You are now ${result.level}. Speaking cycle reset.`
                      : `+7% speaking · now ${result.speaking_progress}%`,
                  );
                } catch (e) {
                  setErr((e as Error).message);
                }
              }}
            >
              I practiced today (+7%)
            </Button>
          </>
        )}
        {msg && <p className="mt-2 text-sm font-semibold text-ink">{msg}</p>}
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      </Card>
    </div>
  );
}

function SpeakingTips({ track }: { track: ExamTrack }) {
  const tips = getSkillTrackStyle('speaking', track).studentTips ?? [];
  if (tips.length === 0) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {tips.map((tip) => (
        <li
          key={tip}
          className="rounded-md border border-paper-line bg-paper-soft/80 px-3 py-2 text-sm text-ink-muted"
        >
          {tip}
        </li>
      ))}
    </ul>
  );
}
