import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import {
  useActivities,
  useAssignActivity,
  useCreateActivity,
  useCreateLesson,
  useCreateStudent,
  useLessons,
  useStudents,
} from '@/hooks/useAcademy';
import {
  createActivitySchema,
  createLessonSchema,
  createStudentSchema,
  type CreateActivityValues,
  type CreateLessonValues,
  type CreateStudentValues,
} from '@/lib/validation';
import { ACTIVITY_TYPES } from '@/types';
import { useState } from 'react';

export default function TeacherPage() {
  const { profile } = useAuth();
  const teacherId = profile!.id;
  const students = useStudents(teacherId);
  const lessons = useLessons();
  const activities = useActivities();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createStudent = useCreateStudent();
  const createLesson = useCreateLesson();
  const createActivity = useCreateActivity();
  const assign = useAssignActivity();

  const studentForm = useForm<CreateStudentValues>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: { level: 'A1', name: '', email: '', password: '' },
  });
  const lessonForm = useForm<CreateLessonValues>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: { title: '', week: null, theme: '', novel: '', chapter: '' },
  });
  const activityForm = useForm<CreateActivityValues>({
    resolver: zodResolver(createActivitySchema),
    defaultValues: { type: 'writing', xp: 50, title: '', lesson_id: null, description: '' },
  });
  const [assignActivityId, setAssignActivityId] = useState('');
  const [assignStudentId, setAssignStudentId] = useState('');

  async function wrap(fn: () => Promise<unknown>, ok: string) {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something failed');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-subtle">Studio</p>
        <h1 className="page-title">Build the day</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Create student → lesson → activity → assign. The course can change; this loop stays.
        </p>
      </div>

      {notice && <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}
      {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="1. Create student" subtitle="Uses Supabase Auth signUp + student row" />
          <form
            className="space-y-3 p-4"
            onSubmit={studentForm.handleSubmit((values) =>
              wrap(() => createStudent.mutateAsync({ values, teacherId }), 'Student created'),
            )}
          >
            <Field label="Name" error={studentForm.formState.errors.name?.message}>
              <Input {...studentForm.register('name')} />
            </Field>
            <Field label="Email" error={studentForm.formState.errors.email?.message}>
              <Input type="email" {...studentForm.register('email')} />
            </Field>
            <Field label="Temp password" error={studentForm.formState.errors.password?.message}>
              <Input type="password" {...studentForm.register('password')} />
            </Field>
            <Field label="Level" error={studentForm.formState.errors.level?.message}>
              <Input {...studentForm.register('level')} placeholder="A1 / A2 / B1…" />
            </Field>
            <Button type="submit" loading={createStudent.isPending}>
              Create student
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="2. Create lesson" subtitle="Content container — swap anytime" />
          <form
            className="space-y-3 p-4"
            onSubmit={lessonForm.handleSubmit((values) =>
              wrap(() => createLesson.mutateAsync({ values, createdBy: teacherId }), 'Lesson created'),
            )}
          >
            <Field label="Title" error={lessonForm.formState.errors.title?.message}>
              <Input {...lessonForm.register('title')} placeholder="Week 3 — Debate & Opinion" />
            </Field>
            <Field label="Week">
              <Input
                type="number"
                {...lessonForm.register('week', {
                  setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                })}
              />
            </Field>
            <Field label="Theme">
              <Input {...lessonForm.register('theme')} />
            </Field>
            <Field label="Novel / Chapter">
              <div className="grid grid-cols-2 gap-2">
                <Input {...lessonForm.register('novel')} placeholder="Novel" />
                <Input {...lessonForm.register('chapter')} placeholder="Chapter" />
              </div>
            </Field>
            <Button type="submit" loading={createLesson.isPending}>
              Create lesson
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="3. Create activity" subtitle="Activity Engine — any skill type" />
          <form
            className="space-y-3 p-4"
            onSubmit={activityForm.handleSubmit((values) =>
              wrap(
                () => createActivity.mutateAsync({ values, createdBy: teacherId }),
                'Activity created',
              ),
            )}
          >
            <Field label="Title" error={activityForm.formState.errors.title?.message}>
              <Input {...activityForm.register('title')} placeholder="Record a 2-minute intro" />
            </Field>
            <Field label="Type">
              <Select {...activityForm.register('type')}>
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Lesson (optional)">
              <Select
                {...activityForm.register('lesson_id', {
                  setValueAs: (v) => (v === '' ? null : v),
                })}
              >
                <option value="">No lesson</option>
                {(lessons.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="XP">
              <Input
                type="number"
                {...activityForm.register('xp', { setValueAs: (v) => Number(v) })}
              />
            </Field>
            <Field label="Description">
              <Textarea rows={3} {...activityForm.register('description')} />
            </Field>
            <Button type="submit" loading={createActivity.isPending}>
              Create activity
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="4. Assign activity" subtitle="Push work to a student" />
          <div className="space-y-3 p-4">
            <Field label="Activity">
              <Select value={assignActivityId} onChange={(e) => setAssignActivityId(e.target.value)}>
                <option value="">Select activity</option>
                {(activities.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.type}] {a.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Student">
              <Select value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)}>
                <option value="">Select student</option>
                {(students.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.profile?.name || s.profile?.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              loading={assign.isPending}
              disabled={!assignActivityId || !assignStudentId}
              onClick={() =>
                wrap(
                  () =>
                    assign.mutateAsync({
                      activityId: assignActivityId,
                      studentId: assignStudentId,
                      assignedBy: teacherId,
                    }),
                  'Assigned',
                )
              }
            >
              Assign
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
