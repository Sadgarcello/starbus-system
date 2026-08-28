import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { useAiEvaluation, useEvaluateText } from '@/hooks/useAiCoach';
import type { AiTextEvaluation, AiTextSourceType } from '@/types';

interface AiFeedbackPanelProps {
  sourceType: AiTextSourceType;
  sourceId: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function AiFeedbackPanel({
  sourceType,
  sourceId,
  disabled = false,
  disabledReason,
}: AiFeedbackPanelProps) {
  const cached = useAiEvaluation(sourceType, sourceId);
  const evaluate = useEvaluateText(sourceType, sourceId);

  const evaluation = evaluate.data ?? cached.data;
  const loading = cached.isLoading || evaluate.isPending;
  const error = evaluate.error ? (evaluate.error as Error).message : null;

  async function run(force = false) {
    await evaluate.mutateAsync(force);
  }

  return (
    <Card className="border-club/25">
      <CardHeader
        title="Khawaja AI Coach"
        subtitle="Practice evaluation — not an official TOEFL, IELTS, or exam score"
      />
      <div className="space-y-3 px-4 pb-4">
        {disabled && disabledReason && (
          <p className="text-xs text-ink-subtle">{disabledReason}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {!evaluation && (
            <Button
              size="sm"
              loading={evaluate.isPending}
              disabled={disabled || loading}
              onClick={() => void run(false)}
            >
              Get AI feedback
            </Button>
          )}
          {evaluation && (
            <Button
              size="sm"
              variant="secondary"
              loading={evaluate.isPending}
              disabled={disabled || loading}
              onClick={() => void run(true)}
            >
              Re-check
            </Button>
          )}
        </div>

        {cached.isLoading && !evaluation && (
          <div className="flex items-center gap-2 text-xs text-ink-subtle">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-paper-line border-t-club" />
            Loading saved feedback…
          </div>
        )}

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        {evaluation && <AiFeedbackResult evaluation={evaluation} />}
      </div>
    </Card>
  );
}

function AiFeedbackResult({ evaluation }: { evaluation: AiTextEvaluation }) {
  return (
    <div className="space-y-4 rounded-md border border-paper-line bg-paper-soft/50 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Overall</p>
          <p className="font-display text-3xl text-ink">{evaluation.overall_score}.0 / 10</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">
            Estimated level
          </p>
          <p className="rounded-md bg-club-soft px-2 py-1 text-sm font-bold text-ink">
            {evaluation.estimated_cefr}
          </p>
        </div>
      </div>

      {evaluation.coach_note && (
        <div className="rounded-md border border-club/40 bg-club-soft/60 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">
            From your coach
          </p>
          <p className="mt-1 text-sm font-medium text-ink">{evaluation.coach_note}</p>
        </div>
      )}

      <p className="text-sm text-ink-muted">{evaluation.summary}</p>

      {evaluation.strengths.length > 0 && (
        <Section title="What you did well">
          <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
            {evaluation.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      )}

      {evaluation.corrections.length > 0 && (
        <Section title="Corrections">
          <ol className="space-y-3">
            {evaluation.corrections.map((c, i) => (
              <li key={`${c.original}-${i}`} className="text-sm">
                <p className="text-ink-subtle">
                  <span className="line-through">{c.original}</span>
                </p>
                <p className="font-semibold text-ink">{c.correction}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{c.explanation}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {evaluation.improvements.length > 0 && (
        <Section title="What to improve">
          <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
            {evaluation.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle">{title}</p>
      {children}
    </div>
  );
}
