import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import type {
  ReadingPracticeMode,
  ReadingQuestionType,
  SessionResultsSummary,
  StudentQuestionPayload,
} from '@/lib/readingPractice/types';
import type { SectionMeta } from '@/lib/readingPractice/sectionPlan';
import { SECTION_LABELS } from '@/lib/readingPractice/sectionPlan';
import { readingPracticeService } from '@/services/readingPracticeService';
import { paths } from '@/routes/paths';
import { isExamPrepComplete } from '@/lib/readingExam/examPrepStorage';

const TYPE_LABEL: Record<ReadingQuestionType, string> = {
  COMPLETE_WORDS: 'Complete the Word',
  DAILY_LIFE: 'Read in Daily Life',
  ACADEMIC: 'Academic Passage',
};

type Phase = 'idle' | 'booting' | 'submitting' | 'advancing' | 'finishing';

export default function ReadingPracticeSessionPage() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = (params.get('mode') ?? 'ADAPTIVE') as ReadingPracticeMode;
  const length = Number(params.get('length') ?? 10);

  const [phase, setPhase] = useState<Phase>('booting');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<StudentQuestionPayload | null>(null);
  const [blankAnswers, setBlankAnswers] = useState<Record<number, string>>({});
  const [mcq, setMcq] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    explanation: string | null;
    reveal?: string;
  } | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [sectionIntro, setSectionIntro] = useState<SectionMeta | null>(null);
  const [summary, setSummary] = useState<SessionResultsSummary | null>(null);
  const startedAt = useRef<number>(Date.now());
  const sessionIdRef = useRef<string | null>(null);

  const targetLength = useMemo(() => Math.min(20, Math.max(1, length || 10)), [length]);
  const busy = phase !== 'idle' && phase !== 'booting';

  function applyQuestion(q: StudentQuestionPayload) {
    setQuestion(q);
    setFeedback(null);
    setBlankAnswers({});
    setMcq(null);
    startedAt.current = Date.now();
    if (q.sectionMeta?.questionInSection === 1) {
      setSectionIntro(q.sectionMeta);
    } else {
      setSectionIntro(null);
    }
  }

  useEffect(() => {
    if (student?.exam_track !== 'toefl') return;
    const query = `mode=${encodeURIComponent(mode)}&length=${encodeURIComponent(String(targetLength))}`;
    if (!isExamPrepComplete()) {
      navigate(`${paths.readingPracticeCheck}?${query}`, { replace: true });
    }
  }, [student?.exam_track, mode, targetLength, navigate]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (student?.exam_track !== 'toefl') {
      setPhase('idle');
      return;
    }

    let cancelled = false;

    async function startSession() {
      setPhase('booting');
      setError(null);
      setSummary(null);
      setFeedback(null);
      setAnsweredCount(0);

      try {
        const res = await readingPracticeService.start(mode, targetLength);
        if (cancelled) return;
        setSessionId(res.sessionId);
        applyQuestion(res.question);
        setPhase('idle');
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error).message;
        setError(msg);
        setPhase('idle');
      }
    }

    void startSession();

    return () => {
      cancelled = true;
    };
  }, [student?.id, student?.exam_track, mode, targetLength]);

  async function submitCurrent() {
    if (phase !== 'idle' || !sessionId || !question || feedback) return;

    const responseTimeMs = Date.now() - startedAt.current;
    let payload = mcq ?? '';
    if (question.questionType === 'COMPLETE_WORDS') {
      const blanks = question.blanks ?? [];
      const answers: Record<string, string> = {};
      for (const blank of blanks) {
        answers[String(blank.id)] = blankAnswers[blank.id] ?? '';
      }
      payload = JSON.stringify(answers);
    }
    const activeSessionId = sessionId;
    const activeQuestionId = question.questionId;

    setPhase('submitting');
    try {
      const result = await readingPracticeService.submit(
        activeSessionId,
        activeQuestionId,
        question.questionType,
        payload,
        responseTimeMs,
      );
      if (sessionIdRef.current !== activeSessionId) return;
      setFeedback(result);
      setAnsweredCount((c) => c + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhase('idle');
    }
  }

  async function nextQuestion() {
    if (phase !== 'idle' || !sessionId) return;

    if (answeredCount >= targetLength) {
      setPhase('finishing');
      const activeSessionId = sessionId;
      try {
        const s = await readingPracticeService.finish(activeSessionId);
        if (sessionIdRef.current !== activeSessionId) return;
        setSummary(s);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPhase('idle');
      }
      return;
    }

    const activeSessionId = sessionId;
    setPhase('advancing');
    try {
      const q = await readingPracticeService.next(activeSessionId);
      if (sessionIdRef.current !== activeSessionId) return;
      applyQuestion(q);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhase('idle');
    }
  }

  if (!student || student.exam_track !== 'toefl') {
    return (
      <Card className="p-6 text-sm">
        TOEFL Reading Practice only.{' '}
        <Link to={paths.settings} className="underline">
          Choose TOEFL
        </Link>
      </Card>
    );
  }

  if (phase === 'booting' && !question) return <Spinner />;

  if (error && !question) {
    return (
      <Card className="space-y-3 p-6 text-sm text-danger">
        <p>{error}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setError(null);
            setPhase('booting');
            void readingPracticeService.start(mode, targetLength).then((res) => {
              setSessionId(res.sessionId);
              applyQuestion(res.question);
              setPhase('idle');
            }).catch((e) => {
              setError((e as Error).message);
              setPhase('idle');
            });
          }}
        >
          Retry
        </Button>
      </Card>
    );
  }

  if (summary) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="page-title">Reading Practice Results</h1>
        <Card className="p-5 text-sm">
          <p>
            <strong>{summary.correct}</strong> / {summary.questions} correct ({summary.accuracy}%)
          </p>
          <p className="mt-2 text-ink-muted">
            Difficulty {summary.startingDifficulty.toFixed(1)} → {summary.endingDifficulty.toFixed(1)}
          </p>
          {summary.weakestSkill && (
            <p className="mt-2 text-ink-muted">
              Needs practice: <strong>{formatSkill(summary.weakestSkill)}</strong>
            </p>
          )}
          {summary.strongestSkill && (
            <p className="text-ink-muted">
              Strongest: <strong>{formatSkill(summary.strongestSkill)}</strong>
            </p>
          )}
          <div className="mt-4 space-y-1 border-t border-paper-line pt-3 text-xs text-ink-subtle">
            <p>Complete the Words: {summary.byType.COMPLETE_WORDS.accuracy}%</p>
            <p>Daily Life: {summary.byType.DAILY_LIFE.accuracy}%</p>
            <p>Academic: {summary.byType.ACADEMIC.accuracy}%</p>
          </div>
          <p className="mt-4 text-xs text-ink-subtle">
            This is practice performance — your official CEFR level is set by Khawaja Club assessment.
          </p>
        </Card>
        <div className="flex gap-2">
          <Link to={paths.readingPractice}>
            <Button variant="secondary">Practice hub</Button>
          </Link>
          <Link to={paths.reading}>
            <Button>Back to Reading</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!question) return null;

  if (sectionIntro) {
    return (
      <SectionIntroCard
        meta={sectionIntro}
        onContinue={() => setSectionIntro(null)}
        onExit={() => navigate(paths.readingPractice)}
      />
    );
  }

  const sectionMeta = question.sectionMeta;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {sectionMeta ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-club">
                Section {sectionMeta.sectionIndex} of {sectionMeta.totalSections}
              </p>
              <p className="font-display text-lg text-ink">{sectionMeta.sectionLabel}</p>
              <p className="text-sm text-ink-muted">
                Question {sectionMeta.questionInSection} of {sectionMeta.questionsInSection} in this
                section · Overall {sectionMeta.overallQuestion} of {sectionMeta.totalQuestions}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-subtle">
                {TYPE_LABEL[question.questionType]}
              </p>
              <p className="text-sm text-ink-muted">
                Question {Math.min(answeredCount + 1, targetLength)} of {targetLength}
              </p>
            </>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(paths.readingPractice)} disabled={busy}>
          Exit
        </Button>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </Card>
      )}

      <Card key={question.questionId} className="relative p-5">
        {busy && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-paper/70">
            <Spinner />
          </div>
        )}

        {question.questionType === 'COMPLETE_WORDS' && (
          <CompleteWordsView
            question={question}
            blankAnswers={blankAnswers}
            setBlankAnswers={setBlankAnswers}
            disabled={!!feedback || busy}
          />
        )}
        {question.questionType === 'DAILY_LIFE' && (
          <DailyLifeView question={question} mcq={mcq} setMcq={setMcq} disabled={!!feedback || busy} />
        )}
        {question.questionType === 'ACADEMIC' && (
          <AcademicView question={question} mcq={mcq} setMcq={setMcq} disabled={!!feedback || busy} />
        )}

        {feedback && (
          <div
            className={`mt-4 rounded-md px-3 py-2 text-sm ${feedback.correct ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
          >
            {feedback.correct ? '✓ All words correct' : '✗ Some words incorrect'}
            {feedback.reveal && (
              <p className="mt-1 text-ink">
                Correct words: <strong>{feedback.reveal}</strong>
              </p>
            )}
            {feedback.explanation && (
              <p className="mt-1 text-ink-muted">{feedback.explanation}</p>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {!feedback ? (
            <Button
              onClick={() => void submitCurrent()}
              disabled={
                busy ||
                (question.questionType === 'COMPLETE_WORDS'
                  ? !(question.blanks ?? []).every((b) => (blankAnswers[b.id] ?? '').trim())
                  : mcq === null)
              }
            >
              {phase === 'submitting' ? 'Checking…' : 'Submit'}
            </Button>
          ) : (
            <Button onClick={() => void nextQuestion()} disabled={busy}>
              {phase === 'finishing'
                ? 'Loading results…'
                : phase === 'advancing'
                  ? 'Loading…'
                  : answeredCount >= targetLength
                    ? 'See results'
                    : 'Next question'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function CompleteWordsView({
  question,
  blankAnswers,
  setBlankAnswers,
  disabled,
}: {
  question: StudentQuestionPayload;
  blankAnswers: Record<number, string>;
  setBlankAnswers: Dispatch<SetStateAction<Record<number, string>>>;
  disabled: boolean;
}) {
  const passage = question.displayPassage ?? question.displaySentence ?? '';
  const blanks = question.blanks ?? [];

  return (
    <>
      <p className="whitespace-pre-wrap font-display text-lg leading-relaxed text-ink">{passage}</p>
      {blanks.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-paper-line pt-4">
          <p className="text-xs font-bold uppercase text-ink-subtle">
            Complete the missing parts ({blanks.length} words)
          </p>
          {blanks.map((blank) => (
            <label key={blank.id} className="block text-sm">
              <span className="font-mono text-ink-muted">{blank.maskedDisplay}</span>
              <Input
                className="mt-1"
                value={blankAnswers[blank.id] ?? ''}
                onChange={(e) =>
                  setBlankAnswers((prev) => ({ ...prev, [blank.id]: e.target.value }))
                }
                placeholder={
                  blank.visiblePrefix
                    ? `Type missing letters after “${blank.visiblePrefix}”`
                    : 'Type the complete word'
                }
                autoComplete="off"
                disabled={disabled}
              />
            </label>
          ))}
        </div>
      )}
    </>
  );
}

function DailyLifeView({
  question,
  mcq,
  setMcq,
  disabled,
}: {
  question: StudentQuestionPayload;
  mcq: 'A' | 'B' | 'C' | 'D' | null;
  setMcq: (v: 'A' | 'B' | 'C' | 'D') => void;
  disabled: boolean;
}) {
  return (
    <>
      <h2 className="font-display text-xl text-ink">{question.title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm text-ink-muted">{question.content}</p>
      <McqBlock
        questionText={question.questionText ?? ''}
        options={question.options ?? []}
        mcq={mcq}
        setMcq={setMcq}
        disabled={disabled}
      />
    </>
  );
}

function AcademicView({
  question,
  mcq,
  setMcq,
  disabled,
}: {
  question: StudentQuestionPayload;
  mcq: 'A' | 'B' | 'C' | 'D' | null;
  setMcq: (v: 'A' | 'B' | 'C' | 'D') => void;
  disabled: boolean;
}) {
  return (
    <>
      <h2 className="font-display text-xl text-ink">{question.title}</h2>
      <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-ink-muted">
        {question.passageText}
      </p>
      <p className="mt-3 text-xs text-ink-subtle">
        Question {question.questionIndex} of {question.questionsInPassage}
      </p>
      <McqBlock
        questionText={question.questionText ?? ''}
        options={question.options ?? []}
        mcq={mcq}
        setMcq={setMcq}
        disabled={disabled}
      />
    </>
  );
}

function McqBlock({
  questionText,
  options,
  mcq,
  setMcq,
  disabled,
}: {
  questionText: string;
  options: { key: 'A' | 'B' | 'C' | 'D'; label: string }[];
  mcq: 'A' | 'B' | 'C' | 'D' | null;
  setMcq: (v: 'A' | 'B' | 'C' | 'D') => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-4 space-y-2">
      <p className="font-semibold text-ink">{questionText}</p>
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.key}
            className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
              mcq === o.key ? 'border-club bg-club-soft/60' : 'border-paper-line'
            } ${disabled ? 'pointer-events-none opacity-70' : ''}`}
          >
            <input
              type="radio"
              name={`mcq-${questionText}`}
              checked={mcq === o.key}
              onChange={() => setMcq(o.key)}
              className="mt-1"
              disabled={disabled}
            />
            <span>
              <strong>{o.key}.</strong> {o.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function formatSkill(skill: string): string {
  return skill.replace(/_/g, ' ').toLowerCase();
}

const SECTION_DESCRIPTION: Record<ReadingQuestionType, string> = {
  COMPLETE_WORDS: 'Fill in the missing letters to complete each word in the paragraph.',
  DAILY_LIFE: 'Read everyday material and answer questions about it.',
  ACADEMIC: 'Read an academic passage and answer questions about it.',
};

function SectionIntroCard({
  meta,
  onContinue,
  onExit,
}: {
  meta: SectionMeta;
  onContinue: () => void;
  onExit: () => void;
}) {
  const isTransition = meta.sectionTransition;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Card className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-10 w-1 shrink-0 rounded-full bg-club" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-club">
              Section {meta.sectionIndex} of {meta.totalSections}
            </p>
            <h2 className="font-display text-2xl text-ink">{meta.sectionLabel}</h2>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-ink-muted">
          {SECTION_DESCRIPTION[meta.sectionType]}
        </p>

        <p className="text-sm text-ink-muted">
          This section has <strong className="text-ink">{meta.questionsInSection}</strong>{' '}
          {meta.questionsInSection === 1 ? 'question' : 'questions'}.
          {isTransition
            ? ' Finish this section before moving on to the next task type.'
            : ' When you are ready, click Continue to begin.'}
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={onContinue}>
            {isTransition ? 'Continue to this section' : 'Continue'}
          </Button>
          <Button variant="ghost" onClick={onExit}>
            Exit
          </Button>
        </div>
      </Card>

      <p className="text-center text-xs text-ink-subtle">
        {formatSectionProgress(meta)}
      </p>
    </div>
  );
}

function formatSectionProgress(meta: SectionMeta): string {
  const order: ReadingQuestionType[] = ['COMPLETE_WORDS', 'DAILY_LIFE', 'ACADEMIC'];
  return order
    .map((type, i) => {
      const label = SECTION_LABELS[type];
      if (i + 1 === meta.sectionIndex) return `${label} (now)`;
      if (i + 1 < meta.sectionIndex) return `${label} (done)`;
      return label;
    })
    .join(' → ');
}
