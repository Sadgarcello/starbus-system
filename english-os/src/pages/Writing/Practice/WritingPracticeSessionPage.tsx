import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { WritingDiagnosticResults } from '@/components/writingPractice/WritingDiagnosticResults';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import type { DiagnosticReport, StudentWritingItemPayload } from '@/lib/writingPractice/types';
import { paths } from '@/routes/paths';
import { writingPracticeService } from '@/services/writingPracticeService';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function WritingPracticeSessionPage() {
  const { student } = useAuth();
  const [booting, setBooting] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [item, setItem] = useState<StudentWritingItemPayload | null>(null);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [bank, setBank] = useState<string[]>([]);
  const [built, setBuilt] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(1380);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (student?.exam_track !== 'toefl') return;
    void (async () => {
      try {
        const res = await writingPracticeService.start();
        setSessionId(res.sessionId);
        setItem(res.item);
        setSecondsLeft(res.item.timeLimitSeconds);
        if (res.item.buildSentence) {
          setBank(res.item.buildSentence.wordBank);
          setBuilt([]);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBooting(false);
      }
    })();
  }, [student?.exam_track]);

  useEffect(() => {
    if (report || booting) return;
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [report, booting]);

  useEffect(() => {
    if (!sessionId || !item || item.itemType !== 'BUILD_SENTENCE') return;
    const response = built.join(' ');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void writingPracticeService.saveDraft(sessionId, item.itemIndex, response);
    }, 800);
  }, [built, sessionId, item]);

  useEffect(() => {
    if (!sessionId || !item || item.itemType === 'BUILD_SENTENCE') return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void writingPracticeService.saveDraft(sessionId, item.itemIndex, text);
    }, 800);
  }, [text, sessionId, item]);

  async function submitCurrent() {
    if (!sessionId || !item || busy) return;
    setBusy(true);
    setError(null);
    const response =
      item.itemType === 'BUILD_SENTENCE' ? built.join(' ') : text.trim();
    if (!response) {
      setError('Enter a response before continuing.');
      setBusy(false);
      return;
    }
    try {
      const result = await writingPracticeService.submitItem(sessionId, item.itemIndex, response);
      if (result.finished) {
        const r = await writingPracticeService.finish(sessionId);
        setReport(r);
      } else if (result.item) {
        setItem(result.item);
        setText('');
        setBuilt([]);
        if (result.item.buildSentence) setBank(result.item.buildSentence.wordBank);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addWord(w: string) {
    setBuilt((prev) => [...prev, w]);
    setBank((prev) => {
      const i = prev.indexOf(w);
      if (i < 0) return prev;
      return [...prev.slice(0, i), ...prev.slice(i + 1)];
    });
  }

  function undoWord() {
    setBuilt((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1]!;
      setBank((b) => [...b, last]);
      return prev.slice(0, -1);
    });
  }

  if (!student || student.exam_track !== 'toefl') {
    return (
      <Card className="m-6 p-6 text-sm">
        TOEFL Writing diagnostic only. <Link to={paths.settings} className="underline">Choose TOEFL</Link>
      </Card>
    );
  }

  if (booting) return <Spinner />;
  if (report) return <WritingDiagnosticResults report={report} />;
  if (!item) return <Card className="m-6 p-6">{error ?? 'Could not start session.'}</Card>;

  const qNum = item.itemIndex + 1;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-line pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Writing</p>
          <p className="font-semibold text-ink">
            Question {qNum} of {item.totalItems}
          </p>
        </div>
        <p className="font-mono text-sm font-bold text-ink">{formatTime(secondsLeft)}</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {item.itemType === 'BUILD_SENTENCE' && item.buildSentence && (
        <Card className="space-y-4 p-5">
          <p className="text-sm text-ink">{item.buildSentence.prompt}</p>
          <div className="min-h-[48px] rounded-md border border-dashed border-paper-line bg-paper-soft/50 p-3 text-sm">
            {built.length ? built.join(' ') : 'Tap words to build your sentence…'}
          </div>
          <div className="flex flex-wrap gap-2">
            {bank.map((w, i) => (
              <button
                key={`${w}-${i}`}
                type="button"
                className="rounded-full border border-paper-line bg-paper px-3 py-1 text-sm"
                onClick={() => addWord(w)}
              >
                {w}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={undoWord}>
              Undo
            </Button>
            <Button type="button" onClick={() => void submitCurrent()} disabled={busy}>
              {qNum === 12 ? 'Submit test' : 'Next question'}
            </Button>
          </div>
        </Card>
      )}

      {item.itemType === 'EMAIL' && item.email && (
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-lg text-ink">Write an Email</h2>
          <p className="text-sm whitespace-pre-wrap text-ink">{String(item.email.instructions)}</p>
          <textarea
            rows={12}
            className="w-full rounded-md border border-paper-line p-3 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your email here…"
          />
          <Button type="button" onClick={() => void submitCurrent()} disabled={busy}>
            Next question
          </Button>
        </Card>
      )}

      {item.itemType === 'ACADEMIC_DISCUSSION' && item.discussion && (
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-lg text-ink">Academic Discussion</h2>
          <p className="text-sm text-ink">{String(item.discussion.professorPrompt)}</p>
          <p className="text-sm font-medium text-ink">{String(item.discussion.discussionQuestion)}</p>
          <div className="space-y-2 rounded-md bg-paper-soft/50 p-3 text-xs">
            <p>
              <strong>{String(item.discussion.participantOneName)}:</strong>{' '}
              {String(item.discussion.participantOneResponse)}
            </p>
            <p>
              <strong>{String(item.discussion.participantTwoName)}:</strong>{' '}
              {String(item.discussion.participantTwoResponse)}
            </p>
          </div>
          <textarea
            rows={10}
            className="w-full rounded-md border border-paper-line p-3 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your discussion response…"
          />
          <Button type="button" onClick={() => void submitCurrent()} disabled={busy}>
            Submit test
          </Button>
        </Card>
      )}
    </div>
  );
}
