import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListeningNotesPanel } from '@/components/listeningPractice/ListeningNotesPanel';
import { ListeningOnceAudioPlayer } from '@/components/listeningPractice/ListeningOnceAudioPlayer';
import { ListeningSpeakerStrip } from '@/components/listeningPractice/ListeningSpeakerStrip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import {
  LISTENING_SKILL_LABELS,
  LISTENING_TASK_LABELS,
  type ListeningSessionSummary,
  type ListeningStepPayload,
  type QuestionStepPayload,
  type StimulusPlaybackPayload,
} from '@/lib/listeningPractice/types';
import { paths } from '@/routes/paths';
import { listeningPracticeService } from '@/services/listeningPracticeService';

type Phase = 'booting' | 'stimulus' | 'question' | 'transition' | 'results' | 'error';

export default function ListeningPracticeSessionPage() {
  const { student } = useAuth();
  const [phase, setPhase] = useState<Phase>('booting');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<ListeningStepPayload | null>(null);
  const [summary, setSummary] = useState<ListeningSessionSummary | null>(null);
  const [choice, setChoice] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [busy, setBusy] = useState(false);
  const questionStartedAt = useRef(Date.now());
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);

  function applyStep(next: ListeningStepPayload) {
    setStep(next);
    setChoice(null);
    if (next.kind === 'STIMULUS') setPhase('stimulus');
    else if (next.kind === 'QUESTION') {
      setPhase('question');
      questionStartedAt.current = Date.now();
    } else if (next.kind === 'MODULE_TRANSITION') setPhase('transition');
    else if (next.kind === 'COMPLETE') {
      if (next.summary) setSummary(next.summary);
      setPhase('results');
    }
  }

  useEffect(() => {
    if (student?.exam_track !== 'toefl') return;
    let cancelled = false;

    async function boot() {
      try {
        const res = await listeningPracticeService.start();
        if (cancelled) return;
        setSessionId(res.sessionId);
        applyStep(res.step);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setPhase('error');
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [student?.exam_track]);

  async function afterStimulusEnded() {
    if (!sessionId || busy) return;
    setBusy(true);
    try {
      const next = await listeningPracticeService.ackStimulus(sessionId);
      if (sessionRef.current !== sessionId) return;
      applyStep(next);
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }

  async function continueFromTransition() {
    if (!sessionId || busy) return;
    setBusy(true);
    try {
      const next = await listeningPracticeService.advance(sessionId);
      if (sessionRef.current !== sessionId) return;
      applyStep(next);
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    const q = step as QuestionStepPayload | null;
    if (!sessionId || !q || q.kind !== 'QUESTION' || !choice || busy) return;
    setBusy(true);
    const sid = sessionId;
    try {
      await listeningPracticeService.submit(
        sid,
        q.questionId,
        choice,
        Date.now() - questionStartedAt.current,
      );
      const next = await listeningPracticeService.advance(sid);
      if (sessionRef.current !== sid) return;
      if (next.kind === 'COMPLETE' && !next.summary) {
        const sum = await listeningPracticeService.finish(sid);
        setSummary(sum);
        setPhase('results');
      } else {
        applyStep(next);
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }

  if (!student || student.exam_track !== 'toefl') {
    return (
      <Card className="m-6 p-6 text-sm">
        TOEFL Listening Practice only.{' '}
        <Link to={paths.settings} className="underline">
          Choose TOEFL
        </Link>
      </Card>
    );
  }

  if (phase === 'booting') return <Spinner />;

  if (phase === 'error' || error) {
    return (
      <Card className="mx-auto mt-8 max-w-lg p-6 text-sm">
        <p className="text-danger">{error ?? 'Something went wrong.'}</p>
        <Link to={paths.listeningPractice} className="mt-4 inline-block underline">
          Back to Listening
        </Link>
      </Card>
    );
  }

  if (phase === 'results' && summary) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="font-display text-2xl text-ink">Listening results</h1>
        <Card className="p-5 text-sm">
          <p>
            Estimated proficiency: <strong>{summary.estimatedCefr}</strong>
          </p>
          <p className="mt-2">
            Accuracy: {summary.accuracyPercent}% ({summary.itemsCorrect}/{summary.itemsAnswered})
          </p>
          {summary.lowerModuleScore != null && (
            <p className="mt-1 text-ink-muted">Lower module: {Math.round(summary.lowerModuleScore)}%</p>
          )}
        </Card>
        <Link to={paths.listeningPractice} className="underline text-sm">
          ← Back to Listening Practice
        </Link>
      </div>
    );
  }

  const stimulus = step?.kind === 'STIMULUS' ? (step as StimulusPlaybackPayload) : null;
  const question = step?.kind === 'QUESTION' ? (step as QuestionStepPayload) : null;
  const transition = step?.kind === 'MODULE_TRANSITION' ? step : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <Link to={paths.listeningPractice} className="text-xs font-bold uppercase text-ink-subtle hover:text-ink">
        ← Exit
      </Link>

      {transition && (
        <Card className="p-6">
          <h1 className="font-display text-xl text-ink">Upper module</h1>
          <p className="mt-2 text-sm text-ink-muted">{transition.message}</p>
          <p className="mt-1 text-xs text-ink-subtle">
            Lower module score: {transition.lowerScorePercent}%
          </p>
          <Button type="button" className="mt-4" disabled={busy} onClick={() => void continueFromTransition()}>
            Continue
          </Button>
        </Card>
      )}

      {stimulus && (
        <Card className="space-y-4 p-6">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">
            {LISTENING_TASK_LABELS[stimulus.taskType]} · {stimulus.modulePhase} module
          </p>
          <h1 className="font-display text-xl text-ink">{stimulus.title}</h1>
          <ListeningSpeakerStrip speakers={stimulus.speakers} />
          <ListeningOnceAudioPlayer src={stimulus.audioUrl} onEnded={() => void afterStimulusEnded()} />
          <ListeningNotesPanel disabled={busy} />
          <p className="text-xs text-ink-muted">
            {stimulus.questionCount} question{stimulus.questionCount === 1 ? '' : 's'} follow this audio.
          </p>
        </Card>
      )}

      {question && (
        <Card className="space-y-4 p-6">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">
            {LISTENING_TASK_LABELS[question.taskType]} · Question {question.questionNumber}
          </p>
          <p className="text-xs text-ink-muted">
            Stimulus question {question.questionIndexInStimulus + 1} of {question.questionsInStimulus} ·{' '}
            {LISTENING_SKILL_LABELS[question.skill]} · Difficulty {question.difficulty}/10
          </p>
          {question.showQuestionText && question.questionText && (
            <p className="text-base font-medium text-ink">{question.questionText}</p>
          )}
          {!question.showQuestionText && (
            <p className="text-sm text-ink-muted">Choose the most appropriate response.</p>
          )}
          <div className="space-y-2">
            {question.options.map((opt) => (
              <label
                key={opt.key}
                className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2 text-sm ${
                  choice === opt.key ? 'border-club bg-club-soft/40' : 'border-paper-line'
                }`}
              >
                <input
                  type="radio"
                  name="listening-mcq"
                  checked={choice === opt.key}
                  onChange={() => setChoice(opt.key)}
                  className="mt-1"
                />
                <span>
                  <strong>{opt.key}.</strong> {opt.text}
                </span>
              </label>
            ))}
          </div>
          <ListeningNotesPanel />
          <Button type="button" disabled={!choice || busy} onClick={() => void submitAnswer()}>
            Submit answer
          </Button>
        </Card>
      )}
    </div>
  );
}
