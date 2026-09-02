import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusBadge, TypeBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { useAssignment, useReviewAssignment, useSubmitAssignment } from '@/hooks/useAcademy';
import { reviewSchema, submitAssignmentSchema, type ReviewValues, type SubmitAssignmentValues } from '@/lib/validation';
import { paths } from '@/routes/paths';
import { useState } from 'react';

export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isTeacher, isStudent, student, profile } = useAuth();
  const query = useAssignment(id);
  const submit = useSubmitAssignment();
  const review = useReviewAssignment();
  const [error, setError] = useState<string | null>(null);

  const submitForm = useForm<SubmitAssignmentValues>({
    resolver: zodResolver(submitAssignmentSchema),
  });
  const reviewForm = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { feedback: '', grade: '', xp_awarded: 50 },
  });

  if (query.isLoading) return <Spinner />;
  if (!query.data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-danger">Assignment not found.</p>
        <Button className="mt-3" variant="secondary" onClick={() => navigate(isStudent ? paths.home : paths.dashboard)}>
          Back
        </Button>
      </Card>
    );
  }

  const a = query.data;
  const payloadText =
    a.submission?.payload && typeof a.submission.payload.text === 'string'
      ? a.submission.payload.text
      : '';

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-xs font-semibold uppercase tracking-wide text-ink-subtle hover:text-ink"
      >
        ← Back
      </button>

      <Card>
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap gap-2">
            <TypeBadge type={a.activity.type} />
            <StatusBadge status={a.status} />
          </div>
          <h1 className="font-display text-3xl text-ink">{a.activity.title}</h1>
          {a.activity.description && <p className="text-sm text-ink-muted">{a.activity.description}</p>}
          <p className="text-xs font-bold text-ink-subtle">+{a.activity.xp} XP possible</p>
        </div>
      </Card>

      {a.submission && (
        <Card>
          <CardHeader title="Submission" />
          <div className="whitespace-pre-wrap p-4 text-sm text-ink">{payloadText || '—'}</div>
        </Card>
      )}

      {a.review && (
        <Card className="border-club bg-club-soft/40">
          <CardHeader title="Teacher feedback" subtitle={a.review.grade ? `Grade: ${a.review.grade}` : undefined} />
          <div className="space-y-2 p-4 text-sm">
            <p className="whitespace-pre-wrap text-ink">{a.review.feedback}</p>
            <p className="text-xs font-bold text-ink-subtle">+{a.review.xp_awarded} XP awarded</p>
          </div>
        </Card>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {isStudent && student && (a.status === 'assigned' || a.status === 'returned') && (
        <Card>
          <CardHeader title="Complete activity" subtitle="Flexible payload — text for v1" />
          <form
            className="space-y-3 p-4"
            onSubmit={submitForm.handleSubmit(async (values) => {
              setError(null);
              try {
                await submit.mutateAsync({
                  assignmentId: a.id,
                  studentId: student.id,
                  values,
                });
                await query.refetch();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Submit failed');
              }
            })}
          >
            <Field label="Your work" error={submitForm.formState.errors.text?.message}>
              <Textarea rows={8} {...submitForm.register('text')} placeholder="Write, summarize, or paste notes…" />
            </Field>
            <Field label="Notes (optional)">
              <Input {...submitForm.register('notes')} />
            </Field>
            <Button type="submit" loading={submit.isPending}>
              Submit
            </Button>
          </form>
        </Card>
      )}

      {isTeacher && a.status === 'submitted' && a.submission && (
        <Card>
          <CardHeader title="Review" subtitle="Feedback updates status + XP" />
          <form
            className="space-y-3 p-4"
            onSubmit={reviewForm.handleSubmit(async (values) => {
              setError(null);
              try {
                await review.mutateAsync({
                  submissionId: a.submission!.id,
                  reviewerId: profile!.id,
                  values,
                });
                await query.refetch();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Review failed');
              }
            })}
          >
            <Field label="Feedback" error={reviewForm.formState.errors.feedback?.message}>
              <Textarea rows={5} {...reviewForm.register('feedback')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Grade">
                <Input {...reviewForm.register('grade')} placeholder="A / B+ / Pass" />
              </Field>
              <Field label="XP awarded">
                <Input
                  type="number"
                  {...reviewForm.register('xp_awarded', { setValueAs: (v) => Number(v) })}
                />
              </Field>
            </div>
            <Button type="submit" loading={review.isPending}>
              Publish review
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
