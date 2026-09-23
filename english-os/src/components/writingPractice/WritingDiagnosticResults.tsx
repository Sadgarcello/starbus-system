import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { DiagnosticReport, WritingErrorItem } from '@/lib/writingPractice/types';
import { HighlightedWritingText } from './HighlightedWritingText';

export function WritingDiagnosticResults({ report }: { report: DiagnosticReport }) {
  const [activeError, setActiveError] = useState(0);
  const errors = report.errors;
  const err = errors[activeError] as WritingErrorItem | undefined;
  const sampleText = report.discussionResponse || report.emailResponse || '';

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Card className="p-5">
        <h1 className="font-display text-2xl text-ink">Writing complete</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Khawaja diagnostic estimate — not an official ETS score.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-subtle">Diagnostic score</dt>
            <dd className="text-xl font-bold text-ink">{report.diagnosticScore}/100</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">Estimated level</dt>
            <dd className="font-semibold text-ink">{report.estimatedCefr}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">Build a Sentence</dt>
            <dd className="font-semibold">{report.buildSentencePercent}%</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">Email</dt>
            <dd className="font-semibold">{report.emailPercent}%</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">Academic Discussion</dt>
            <dd className="font-semibold">{report.discussionPercent}%</dd>
          </div>
        </dl>
        {report.aiStatus === 'failed' && (
          <p className="mt-3 text-sm text-ink-muted">
            Your responses were saved. Detailed AI feedback is temporarily unavailable.
          </p>
        )}
      </Card>

      {report.topWeaknesses.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold text-ink">Top priorities</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {report.topWeaknesses.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ol>
        </Card>
      )}

      {report.strengths.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold text-ink">Strengths</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {report.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      )}

      {errors.length > 0 && sampleText && (
        <Card className="p-5">
          <h2 className="font-semibold text-ink">Your writing — highlighted</h2>
          <div className="mt-3 rounded-md border border-paper-line bg-paper-soft/40 p-3">
            <HighlightedWritingText
              text={sampleText}
              errors={errors}
              activeIndex={activeError}
              onSelect={setActiveError}
            />
          </div>
          {err && (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <strong>What you wrote:</strong> “{err.student_text}”
              </p>
              <p>
                <strong>What is wrong:</strong> {err.what_is_wrong}
              </p>
              <p>
                <strong>How to fix it:</strong> {err.correction}
              </p>
              <p>
                <strong>What to do:</strong> {err.what_to_do}
              </p>
              {err.targeted_exercise && (
                <div className="rounded-md border border-club/30 bg-club-soft/30 p-3">
                  <p className="font-semibold">Try it</p>
                  <p className="mt-1">{err.targeted_exercise.prompt}</p>
                  {err.targeted_exercise.options?.map((o) => (
                    <p key={o} className="text-ink-muted">
                      {o}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-semibold text-ink">Sentence construction</h2>
        <p className="text-sm text-ink-muted">{report.buildSentencePercent}% correct</p>
        <ul className="mt-3 space-y-2 text-xs">
          {report.buildSentenceItems
            .filter((b) => !b.correct)
            .slice(0, 5)
            .map((b, i) => (
              <li key={i} className="rounded border border-paper-line p-2">
                <p>
                  <strong>Yours:</strong> {b.studentSentence}
                </p>
                <p>
                  <strong>Expected:</strong> {b.expectedSentence}
                </p>
                {b.issueLabel && <p>Issue: {b.issueLabel}</p>}
                {b.whatToDo && <p className="text-ink-muted">{b.whatToDo}</p>}
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
