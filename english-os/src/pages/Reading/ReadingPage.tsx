import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { ExamTrackLogo } from '@/components/exam/ExamTrackLogo';
import { BookCover } from '@/components/reading/BookCover';
import { SkillModuleHeader } from '@/components/skill/SkillModuleHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import {
  useClearReadingVote,
  useCreateReadingBook,
  useDeleteReadingBook,
  useReadingBooks,
  useReadingVotes,
  useUpdateReadingProgress,
  useVoteReadingBook,
} from '@/hooks/useReading';
import { readingProgressPercent } from '@/services/readingService';
import { paths } from '@/routes/paths';
import type { ExamTrack, ReadingBook, ReadingBookVoter } from '@/types';

export default function ReadingPage() {
  const { isTeacher, isStudent, student, profile } = useAuth();
  const books = useReadingBooks();
  const votes = useReadingVotes();
  const removeBook = useDeleteReadingBook();
  const vote = useVoteReadingBook();
  const clearVote = useClearReadingVote();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const votersByBook = useMemo(() => {
    const map = new Map<string, ReadingBookVoter[]>();
    for (const v of votes.data ?? []) {
      const list = map.get(v.book_id) ?? [];
      list.push(v);
      map.set(v.book_id, list);
    }
    return map;
  }, [votes.data]);

  const myVoteBookId = useMemo(() => {
    if (!student) return null;
    return (votes.data ?? []).find((v) => v.student_id === student.id)?.book_id ?? null;
  }, [votes.data, student]);

  if (books.isLoading) return <Spinner />;

  if (books.isError) {
    return (
      <Card className="p-6 text-sm text-danger">
        Could not load books. Run <code className="font-mono">0008_reading_books.sql</code> in
        Khawaja Club DB.
        <br />
        {(books.error as Error).message}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SkillModuleHeader
        skill="reading"
        title="Reading"
        examTrack={student?.exam_track as ExamTrack | null | undefined}
        isTeacher={isTeacher}
      />

      {isStudent && student?.exam_track === 'toefl' && (
        <Card className="overflow-hidden border-club/40 bg-gradient-to-r from-club-soft/80 to-paper">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ExamTrackLogo track="toefl" variant="badge" className="h-5 max-w-[72px]" />
                <p className="text-xs font-bold uppercase tracking-wide text-ink-subtle">
                  TOEFL Reading Practice
                </p>
              </div>
              <p className="font-display text-xl text-ink">Take actual test</p>
              <p className="mt-1 text-sm text-ink-muted">
                Adaptive Complete the Words, Daily Life, and Academic passages — powered by your
                practice profile, not AI.
              </p>
            </div>
            <Link to={`${paths.readingPractice}/session?mode=ADAPTIVE&length=10`} className="shrink-0">
              <Button className="w-full sm:w-auto">Take actual test</Button>
            </Link>
          </div>
        </Card>
      )}

      {isTeacher && (
        <Link to={paths.readingPracticeAdmin} className="inline-block text-xs font-bold uppercase text-ink-subtle hover:text-ink">
          Manage reading practice content →
        </Link>
      )}

      {notice && <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}
      {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {votes.isError && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          Could not load votes. Confirm migration 0008 ran.
        </p>
      )}

      {isTeacher && profile && <AddBookForm createdBy={profile.id} />}

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl text-ink">Books</h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {(votes.data ?? []).length} vote{(votes.data ?? []).length === 1 ? '' : 's'} · vote for
              which to start first
            </p>
          </div>
          <p className="text-xs text-ink-subtle">{(books.data ?? []).length} titles</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {(books.data ?? []).map((book) => (
            <BookCard
              key={book.id}
              book={book}
              voters={votersByBook.get(book.id) ?? []}
              myVote={myVoteBookId === book.id}
              isTeacher={isTeacher}
              isStudent={isStudent}
              voting={vote.isPending || clearVote.isPending}
              deleting={removeBook.isPending}
              onVote={async () => {
                setError(null);
                try {
                  await vote.mutateAsync(book.id);
                  setNotice(`Voted to start “${book.title}” first.`);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
              onClearVote={async () => {
                setError(null);
                try {
                  await clearVote.mutateAsync();
                  setNotice('Vote cleared.');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
              onDelete={async () => {
                setError(null);
                try {
                  await removeBook.mutateAsync(book.id);
                  setNotice(`Removed “${book.title}”.`);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          ))}
          {(books.data ?? []).length === 0 && (
            <Card className="p-5 text-sm text-ink-subtle lg:col-span-2">
              No books yet. Teachers can add a novel cover, total pages, and pages finished above.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function AddBookForm({ createdBy }: { createdBy: string }) {
  const create = useCreateReadingBook();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('200');
  const [pagesFinished, setPagesFinished] = useState('0');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        title="Add book / novel"
        subtitle="Upload a cover and pages. Updating finished pages applies Reading % to attendees only"
      />
      <form
        className="space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setOk(null);
          void create
            .mutateAsync({
              title,
              author,
              totalPages: Number(totalPages),
              pagesFinished: Number(pagesFinished),
              coverFile: file,
              createdBy,
            })
            .then(() => {
              setTitle('');
              setAuthor('');
              setTotalPages('200');
              setPagesFinished('0');
              setFile(null);
              if (fileRef.current) fileRef.current.value = '';
              setOk('Book added.');
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-ink"
              required
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
              Author (optional)
            </span>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-ink"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
              Total pages
            </span>
            <input
              type="number"
              min={1}
              value={totalPages}
              onChange={(e) => setTotalPages(e.target.value)}
              className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-ink"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
              Pages finished
            </span>
            <input
              type="number"
              min={0}
              value={pagesFinished}
              onChange={(e) => setPagesFinished(e.target.value)}
              className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-ink"
              required
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-subtle">
              Front cover
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-ink"
            />
          </label>
        </div>
        <Button type="submit" loading={create.isPending}>
          Add book
        </Button>
        {ok && <p className="text-sm font-semibold text-ink">{ok}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Card>
  );
}

function BookCard({
  book,
  voters,
  myVote,
  isTeacher,
  isStudent,
  voting,
  deleting,
  onVote,
  onClearVote,
  onDelete,
}: {
  book: ReadingBook;
  voters: ReadingBookVoter[];
  myVote: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  voting: boolean;
  deleting: boolean;
  onVote: () => void;
  onClearVote: () => void;
  onDelete: () => void;
}) {
  const update = useUpdateReadingProgress();
  const [finished, setFinished] = useState(String(book.pages_finished));
  const [total, setTotal] = useState(String(book.total_pages));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const percent = readingProgressPercent(book);

  useEffect(() => {
    setFinished(String(book.pages_finished));
    setTotal(String(book.total_pages));
  }, [book.pages_finished, book.total_pages]);
  const shown = voters.slice(0, 8);
  const extra = Math.max(0, voters.length - shown.length);

  return (
    <Card>
      <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-stretch sm:gap-6 sm:p-6">
        <BookCover path={book.cover_path} title={book.title} className="mx-auto sm:mx-0" />
        <div className="min-w-0 flex-1 space-y-3 sm:py-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-display text-xl text-ink">{book.title}</h3>
              {book.author && <p className="text-sm text-ink-muted">{book.author}</p>}
            </div>
            {myVote && (
              <span className="shrink-0 rounded border border-ink/20 px-2 py-0.5 text-[10px] font-bold uppercase text-ink-subtle">
                Your vote
              </span>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-ink-subtle">
              <span>
                {book.pages_finished} / {book.total_pages} pages
              </span>
              <span className="text-ink">{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-paper-line">
              <div
                className="h-full rounded-full bg-club transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <div className="rounded-md border border-paper-line bg-paper-soft/80 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-subtle">
              {voters.length} vote{voters.length === 1 ? '' : 's'} · start first?
            </p>
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

          {isTeacher && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs">
                <span className="mb-1 block font-bold uppercase tracking-wide text-ink-subtle">
                  Finished
                </span>
                <input
                  type="number"
                  min={0}
                  value={finished}
                  onChange={(e) => setFinished(e.target.value)}
                  className="w-24 rounded-md border border-paper-line bg-paper px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-bold uppercase tracking-wide text-ink-subtle">
                  Total
                </span>
                <input
                  type="number"
                  min={1}
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className="w-24 rounded-md border border-paper-line bg-paper px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <Button
                size="sm"
                loading={update.isPending}
                onClick={async () => {
                  setErr(null);
                  setMsg(null);
                  try {
                    const result = await update.mutateAsync({
                      bookId: book.id,
                      pagesFinished: Number(finished),
                      totalPages: Number(total),
                    });
                    setMsg(
                      `Saved ${readingProgressPercent(result.book)}%. Applied to ${result.attendeesUpdated} student${result.attendeesUpdated === 1 ? '' : 's'} who attended today.`,
                    );
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                }}
              >
                Update pages
              </Button>
              <p className="basis-full text-[11px] text-ink-subtle">
                Opens Attendance for today first, then update pages so attendees get this %.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isStudent &&
              (myVote ? (
                <Button size="sm" variant="secondary" loading={voting} onClick={onClearVote}>
                  Remove my vote
                </Button>
              ) : (
                <Button size="sm" loading={voting} onClick={onVote}>
                  Vote to start this first
                </Button>
              ))}
            {isTeacher && (
              <Button
                size="sm"
                variant="danger"
                loading={deleting}
                onClick={() => {
                  if (window.confirm(`Remove “${book.title}”?`)) onDelete();
                }}
              >
                Remove
              </Button>
            )}
          </div>
          {msg && <p className="text-xs font-semibold text-ink">{msg}</p>}
          {err && <p className="text-xs text-danger">{err}</p>}
        </div>
      </div>
    </Card>
  );
}
