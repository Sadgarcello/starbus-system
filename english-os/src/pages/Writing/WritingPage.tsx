import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AiFeedbackPanel } from '@/components/ai/AiFeedbackPanel';
import { SkillModuleHeader } from '@/components/skill/SkillModuleHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import {
  useCloseWritingTask,
  useCreateWritingTask,
  useMyWritingSubmission,
  useReopenWritingTask,
  useReviewWriting,
  useSubmitWriting,
  useWritingSubmissions,
  useWritingTasks,
} from '@/hooks/useWriting';
import { writingService } from '@/services/writingService';
import { getSkillTrackStyle } from '@/lib/examTrackContent';
import type { ExamTrack, WritingSubmissionWithStudent, WritingTask } from '@/types';

export default function WritingPage() {
  const { isTeacher, isStudent, student, profile } = useAuth();
  const tasks = useWritingTasks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && tasks.data?.[0]) setSelectedId(tasks.data[0].id);
  }, [tasks.data, selectedId]);

  const selected = (tasks.data ?? []).find((t) => t.id === selectedId) ?? null;

  if (tasks.isLoading) return <Spinner />;

  if (tasks.isError) {
    return (
      <Card className="p-6 text-sm text-danger">
        Could not load writing tasks. Run{' '}
        <code className="font-mono">0009_writing_tasks.sql</code> in Khawaja Club DB.
        <br />
        {(tasks.error as Error).message}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SkillModuleHeader
        skill="writing"
        title="Writing"
        examTrack={student?.exam_track as ExamTrack | null | undefined}
        isTeacher={isTeacher}
      />

      {notice && <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}
      {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {isTeacher && profile && (
        <CreateTaskForm
          createdBy={profile.id}
          onCreated={(id) => {
            setSelectedId(id);
            setNotice('Writing assignment posted for the class.');
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card>
          <CardHeader title="Assignments" subtitle="Newest first" />
          <div className="max-h-[28rem] divide-y divide-paper-line overflow-y-auto">
            {(tasks.data ?? []).length === 0 && (
              <p className="p-4 text-sm text-ink-subtle">No writing assignments yet.</p>
            )}
            {(tasks.data ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`block w-full px-4 py-3 text-left transition hover:bg-club-soft/40 ${
                  selectedId === t.id ? 'bg-club-soft/70' : ''
                }`}
              >
                <p className="truncate text-sm font-semibold text-ink">{t.title}</p>
                <p className="mt-0.5 text-[11px] text-ink-subtle">
                  {t.session_date} · {t.status}
                </p>
              </button>
            ))}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          {!selected ? (
            <Card className="p-6 text-sm text-ink-subtle">Select or create an assignment.</Card>
          ) : (
            <>
              <TaskDetail
                task={selected}
                isTeacher={isTeacher}
                onNotice={setNotice}
                onError={setError}
              />
              {isStudent && student && profile && (
                <StudentSubmitPanel
                  task={selected}
                  studentId={student.id}
                  userId={profile.id}
                  examTrack={student.exam_track as ExamTrack | null | undefined}
                  onNotice={setNotice}
                  onError={setError}
                />
              )}
              {isTeacher && (
                <TeacherInbox
                  task={selected}
                  reviewerId={profile!.id}
                  onNotice={setNotice}
                  onError={setError}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTaskForm({
  createdBy,
  onCreated,
  onError,
}: {
  createdBy: string;
  onCreated: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const create = useCreateWritingTask();
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sessionDate, setSessionDate] = useState(writingService.todayLocal());

  return (
    <Card>
      <CardHeader
        title="Post end-of-class writing"
        subtitle="Students can paste text or upload a handwritten photo"
      />
      <form
        className="space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create
            .mutateAsync({ title, instructions, sessionDate, createdBy })
            .then((task) => {
              setTitle('');
              setInstructions('');
              onCreated(task.id);
            })
            .catch((err: Error) => onError(err.message));
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Class reflection — 14 Jul"
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-ink"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
            Instructions / prompt
          </span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            placeholder="What should students write about?"
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-ink"
            required
          />
        </label>
        <label className="block text-sm sm:max-w-xs">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
            Class date
          </span>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-ink"
          />
        </label>
        <Button type="submit" loading={create.isPending}>
          Post assignment
        </Button>
      </form>
    </Card>
  );
}

function TaskDetail({
  task,
  isTeacher,
  onNotice,
  onError,
}: {
  task: WritingTask;
  isTeacher: boolean;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const close = useCloseWritingTask();
  const reopen = useReopenWritingTask();

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-subtle">
            {task.session_date} · {task.status}
          </p>
          <h2 className="mt-1 font-display text-2xl text-ink">{task.title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">{task.instructions}</p>
        </div>
        {isTeacher && (
          <div className="flex flex-wrap gap-2">
            {task.status === 'open' ? (
              <Button
                size="sm"
                variant="secondary"
                loading={close.isPending}
                onClick={() =>
                  void close
                    .mutateAsync(task.id)
                    .then(() => onNotice('Assignment closed.'))
                    .catch((e: Error) => onError(e.message))
                }
              >
                Close submissions
              </Button>
            ) : (
              <Button
                size="sm"
                loading={reopen.isPending}
                onClick={() =>
                  void reopen
                    .mutateAsync(task.id)
                    .then(() => onNotice('Assignment reopened.'))
                    .catch((e: Error) => onError(e.message))
                }
              >
                Reopen
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function StudentSubmitPanel({
  task,
  studentId,
  userId,
  examTrack,
  onNotice,
  onError,
}: {
  task: WritingTask;
  studentId: string;
  userId: string;
  examTrack?: ExamTrack | null;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const mine = useMyWritingSubmission(task.id, studentId);
  const submit = useSubmitWriting();
  const writingStyle = getSkillTrackStyle('writing', examTrack, false);
  const textPlaceholder =
    writingStyle.formHints?.placeholder ?? 'Write or paste your work here…';
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    setText(mine.data?.body_text ?? '');
    setFile(null);
    if (mine.data?.photo_path) {
      void writingService.getPhotoUrl(mine.data.photo_path).then(setPreview);
    } else {
      setPreview(null);
    }
  }, [mine.data]);

  if (mine.isLoading) return <Spinner />;

  const closed = task.status !== 'open';
  const reviewed = mine.data?.status === 'reviewed';

  return (
    <Card>
      <CardHeader
        title="Your submission"
        subtitle="Paste typed work, upload a handwritten photo, or both"
      />
      <div className="space-y-3 px-4 py-4">
        {reviewed && (
          <div className="rounded-md border border-club bg-club-soft/50 px-3 py-2 text-sm">
            <p className="font-semibold text-ink">Teacher feedback</p>
            {mine.data?.grade && (
              <p className="mt-1 text-xs text-ink-subtle">Grade: {mine.data.grade}</p>
            )}
            <p className="mt-1 whitespace-pre-wrap text-ink-muted">
              {mine.data?.feedback || 'Reviewed.'}
            </p>
          </div>
        )}

        {closed && !mine.data && (
          <p className="text-sm text-ink-subtle">Submissions are closed for this assignment.</p>
        )}

        {(!closed || mine.data) && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
                Typed / pasted writing
              </span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                disabled={closed || reviewed}
                placeholder={textPlaceholder}
                className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-ink disabled:opacity-60"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
                Handwritten photo (optional if you pasted text)
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={closed || reviewed}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f) setPreview(URL.createObjectURL(f));
                }}
                className="w-full text-sm text-ink"
              />
            </label>

            {preview && (
              <img
                src={preview}
                alt="Handwriting preview"
                className="max-h-72 w-full rounded-md border border-paper-line object-contain"
              />
            )}

            {!closed && !reviewed && (
              <Button
                loading={submit.isPending}
                onClick={() =>
                  void submit
                    .mutateAsync({
                      taskId: task.id,
                      studentId,
                      userId,
                      bodyText: text,
                      photoFile: file,
                      existingPhotoPath: mine.data?.photo_path,
                    })
                    .then(() => onNotice('Submitted for assessment.'))
                    .catch((e: Error) => onError(e.message))
                }
              >
                {mine.data ? 'Update submission' : 'Submit for assessment'}
              </Button>
            )}

            {mine.data?.id && (
              <AiFeedbackPanel
                sourceType="writing"
                sourceId={mine.data.id}
                disabled={!mine.data.body_text?.trim() || mine.data.body_text.trim().length < 20}
                disabledReason={
                  !mine.data.body_text?.trim()
                    ? 'Paste at least 20 characters of typed writing, then submit, to use AI feedback.'
                    : mine.data.body_text.trim().length < 20
                      ? 'Write at least 20 characters before requesting AI feedback.'
                      : undefined
                }
              />
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function TeacherInbox({
  task,
  reviewerId,
  onNotice,
  onError,
}: {
  task: WritingTask;
  reviewerId: string;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const list = useWritingSubmissions(task.id);

  if (list.isLoading) return <Spinner />;

  return (
    <Card>
      <CardHeader
        title="Submissions for assessment"
        subtitle={`${list.data?.length ?? 0} received`}
      />
      <div className="divide-y divide-paper-line">
        {(list.data ?? []).length === 0 && (
          <p className="p-4 text-sm text-ink-subtle">No student submissions yet.</p>
        )}
        {(list.data ?? []).map((s) => (
          <SubmissionReviewRow
            key={s.id}
            submission={s}
            reviewerId={reviewerId}
            onNotice={onNotice}
            onError={onError}
          />
        ))}
      </div>
    </Card>
  );
}

function SubmissionReviewRow({
  submission,
  reviewerId,
  onNotice,
  onError,
}: {
  submission: WritingSubmissionWithStudent;
  reviewerId: string;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const review = useReviewWriting();
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [grade, setGrade] = useState(submission.grade ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const name =
    submission.student?.profile?.name || submission.student?.profile?.email || 'Student';

  useEffect(() => {
    void writingService.getPhotoUrl(submission.photo_path).then(setPhotoUrl);
  }, [submission.photo_path]);

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{name}</p>
          <p className="text-[11px] text-ink-subtle">
            {submission.status} · {new Date(submission.submitted_at).toLocaleString()}
          </p>
        </div>
      </div>
      {submission.body_text && (
        <div className="rounded-md border border-paper-line bg-paper-soft/60 p-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle">
            Typed work
          </p>
          <p className="whitespace-pre-wrap text-sm text-ink">{submission.body_text}</p>
        </div>
      )}
      {photoUrl && (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle">
            Handwritten photo
          </p>
          <img
            src={photoUrl}
            alt="Handwritten submission"
            className="max-h-80 w-full rounded-md border border-paper-line object-contain"
          />
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
        <input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Feedback for later / now"
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
        <input
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="Grade"
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
        />
        <Button
          size="sm"
          loading={review.isPending}
          onClick={() =>
            void review
              .mutateAsync({
                submissionId: submission.id,
                feedback,
                grade,
                reviewerId,
              })
              .then(() => onNotice(`Reviewed ${name}.`))
              .catch((e: Error) => onError(e.message))
          }
        >
          Save review
        </Button>
      </div>
    </div>
  );
}
