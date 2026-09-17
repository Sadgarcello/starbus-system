import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import type {
  ReadingQuestionType,
  SessionResultsSummary,
  StudentQuestionPayload,
} from '@/lib/readingPractice/types';
import type { SectionMeta } from '@/lib/readingPractice/sectionPlan';
import { expectedQuestionTypeForMode, normalizePracticeMode } from '@/lib/readingPractice/mode';
import { effectiveSessionLength, SECTION_LABELS } from '@/lib/readingPractice/sectionPlan';
import {
  CompleteWordsPracticeShell,
  type PlacementPassageFeedback,
} from '@/components/readingPractice/CompleteWordsPracticeShell';
import { AcademicPracticeShell } from '@/components/readingPractice/AcademicPracticeShell';
import { DailyLifePracticeShell } from '@/components/readingPractice/DailyLifePracticeShell';
import { missingLetterCountFromMasked } from '@/lib/readingPractice/completeWords';
import { ReadingPracticeResults } from '@/components/readingPractice/ReadingPracticeResults';
import { readingPracticeService } from '@/services/readingPracticeService';
import { paths } from '@/routes/paths';
import { isExamPrepComplete } from '@/lib/readingExam/examPrepStorage';

type Phase = 'idle' | 'booting' | 'submitting' | 'advancing' | 'finishing';

export default function ReadingPracticeSessionPage() {
  const { student } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawMode = params.get('mode');
  const mode = normalizePracticeMode(rawMode);
  const length = Number(params.get('length') ?? 10);

  useEffect(() => {
    if (rawMode === 'ADAPTIVE') {
      const query = `mode=COMPLETE_WORDS&length=${encodeURIComponent(String(length || 10))}`;
      navigate(`${paths.readingPractice}/session?${query}`, { replace: true });
    }
  }, [rawMode, length, navigate]);

  const [phase, setPhase] = useState<Phase>('booting');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<StudentQuestionPayload | null>(null);
  const [blankAnswers, setBlankAnswers] = useState<Record<number, string>>({});
  const [mcq, setMcq] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [sectionIntro, setSectionIntro] = useState<SectionMeta | null>(null);
  const [summary, setSummary] = useState<SessionResultsSummary | null>(null);
  const [focusedBlankId, setFocusedBlankId] = useState<number | null>(null);
  const [lastPassageFeedback, setLastPassageFeedback] = useState<PlacementPassageFeedback | null>(
    null,
  );
  const startedAt = useRef<number>(Date.now());
  const sessionIdRef = useRef<string | null>(null);

  const requestedLength = useMemo(() => Math.min(20, Math.max(1, length || 10)), [length]);
  const targetLength = useMemo(() => {
    if (mode === 'COMPLETE_WORDS') return 10;
    return effectiveSessionLength(requestedLength, mode);
  }, [requestedLength, mode]);
  const busy = phase !== 'idle' && phase !== 'booting';

  function applyQuestion(q: StudentQuestionPayload) {
    const expectedType = expectedQuestionTypeForMode(mode);
    if (expectedType && q.questionType !== expectedType) {
      throw new Error(
        expectedType === 'DAILY_LIFE'
          ? 'Daily Life practice received the wrong question type. Please retry — it should never show Complete the Words.'
          : expectedType === 'ACADEMIC'
            ? 'Academic practice received the wrong question type. Please retry.'
            : `Expected ${expectedType} but received ${q.questionType}. Please retry.`,
      );
    }
    setQuestion(q);
    setBlankAnswers({});
    setFocusedBlankId(null);
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
      setAnsweredCount(0);
      setLastPassageFeedback(null);

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
    if (phase !== 'idle' || !sessionId || !question) return;
    const responseTimeMs = Date.now() - startedAt.current;
    let payload = mcq ?? '';
    if (question.questionType === 'COMPLETE_WORDS') {
      const blanks = question.blanks ?? [];
      const answers: Record<string, string> = {};
      for (const blank of blanks) {
        const suffix = blankAnswers[blank.id] ?? '';
        answers[String(blank.id)] = blank.visiblePrefix + suffix;
      }
      payload = JSON.stringify(answers);
    }
    const activeSessionId = sessionId;
    const activeQuestionId = question.questionId;
    setPhase('submitting');
    try {
      const submitResult = await readingPracticeService.submit(
        activeSessionId,
        activeQuestionId,
        question.questionType,
        payload,
        responseTimeMs,
      );
      if (sessionIdRef.current !== activeSessionId) return;

      setError(null);
      if (submitResult.placementFeedback) {
        setLastPassageFeedback(submitResult.placementFeedback);
      }
      const newAnsweredCount = answeredCount + 1;
      setAnsweredCount(newAnsweredCount);

      if (newAnsweredCount >= targetLength) {
        setPhase('finishing');
        const s = await readingPracticeService.finish(activeSessionId);
        if (sessionIdRef.current !== activeSessionId) return;
        setSummary(s);
      } else {
        setPhase('advancing');
        const q = await readingPracticeService.next(activeSessionId);
        if (sessionIdRef.current !== activeSessionId) return;
        applyQuestion(q);
      }
      setPhase('idle');
    } catch (e) {
      setError((e as Error).message);
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
      <ReadingPracticeResults
        summary={summary}
        onRetry={() => {
          setSummary(null);
          setPhase('booting');
          void readingPracticeService.start(mode, targetLength).then((res) => {
            setSessionId(res.sessionId);
            applyQuestion(res.question);
            setAnsweredCount(0);
            setPhase('idle');
          }).catch((e) => {
            setError((e as Error).message);
            setPhase('idle');
          });
        }}
        onSelectHistory={(id) => {
          void readingPracticeService.getReport(id).then(setSummary).catch((e) => setError((e as Error).message));
        }}
      />
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

  const cwCanContinue = (question.blanks ?? []).every((b) => {
    const typed = blankAnswers[b.id] ?? '';
    return typed.length === missingLetterCountFromMasked(b.maskedDisplay);
  });
  const cwContinueLabel =
    phase === 'submitting' || phase === 'advancing' || phase === 'finishing'
      ? 'Saving…'
      : answeredCount + 1 >= targetLength
        ? 'Finish'
        : 'Continue';

  if (question.questionType === 'COMPLETE_WORDS') {
    return (
      <>
        {error && (
          <div className="mx-auto max-w-3xl px-4 pt-2">
            <Card className="border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</Card>
          </div>
        )}
        <CompleteWordsPracticeShell
          question={question}
          blankAnswers={blankAnswers}
          setBlankAnswers={setBlankAnswers}
          focusedBlankId={focusedBlankId}
          setFocusedBlankId={setFocusedBlankId}
          answeredCount={answeredCount}
          targetLength={targetLength}
          busy={busy}
          onContinue={() => void submitCurrent()}
          continueLabel={cwContinueLabel}
          canContinue={cwCanContinue}
          lastPassageFeedback={lastPassageFeedback}
        />
      </>
    );
  }

  if (question.questionType === 'DAILY_LIFE') {
    return (
      <>
        {error && (
          <div className="mx-auto max-w-6xl px-1 pt-2 sm:px-0">
            <Card className="border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</Card>
          </div>
        )}
        <DailyLifePracticeShell
          question={question}
          mcq={mcq}
          setMcq={setMcq}
          answeredCount={answeredCount}
          targetLength={targetLength}
          busy={busy}
          onContinue={() => void submitCurrent()}
          continueLabel={
            phase === 'submitting' || phase === 'advancing' || phase === 'finishing'
              ? 'Saving…'
              : answeredCount + 1 >= targetLength
                ? 'Finish'
                : 'Continue'
          }
        />
      </>
    );
  }

  if (question.questionType === 'ACADEMIC') {
    return (
      <>
        {error && (
          <div className="mx-auto max-w-6xl px-1 pt-2 sm:px-0">
            <Card className="border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</Card>
          </div>
        )}
        <AcademicPracticeShell
          question={question}
          mcq={mcq}
          setMcq={setMcq}
          answeredCount={answeredCount}
          targetLength={targetLength}
          busy={busy}
          onContinue={() => void submitCurrent()}
          continueLabel={
            phase === 'submitting' || phase === 'advancing' || phase === 'finishing'
              ? 'Saving…'
              : answeredCount + 1 >= targetLength
                ? 'Finish'
                : 'Continue'
          }
        />
      </>
    );
  }

  return (
    <Card className="mx-auto max-w-lg p-6 text-sm text-danger">
      Unknown question type. Please exit and start again.
      <div className="mt-3">
        <Button variant="secondary" onClick={() => navigate(paths.reading)}>
          Back to Reading
        </Button>
      </div>
    </Card>
  );
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

        {isTransition && (
          <p className="rounded-md border border-club/30 bg-club-soft/40 px-3 py-2 text-sm text-ink-muted">
            Your earlier answers are saved. The full results report (score, level, word review) appears
            after you finish <strong className="text-ink">all {meta.totalSections} sections</strong> —
            not after Complete the Words alone.
          </p>
        )}

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
