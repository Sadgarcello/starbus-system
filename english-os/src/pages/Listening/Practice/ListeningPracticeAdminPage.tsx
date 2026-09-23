import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListeningOnceAudioPlayer } from '@/components/listeningPractice/ListeningOnceAudioPlayer';
import { ListeningSpeakerStrip } from '@/components/listeningPractice/ListeningSpeakerStrip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import {
  LISTENING_SKILL_LABELS,
  LISTENING_TASK_LABELS,
  type ListeningSkill,
  type ListeningTaskType,
} from '@/lib/listeningPractice/types';
import { paths } from '@/routes/paths';
import {
  getTeacherAudioSignedUrl,
  uploadListeningAudio,
  uploadSpeakerImage,
} from '@/services/listeningContentService';
import { supabase } from '@/lib/supabase';

interface DraftQuestion {
  question_text: string;
  skill: ListeningSkill;
  difficulty: number;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  order_index: number;
}

const TASK_TYPES: ListeningTaskType[] = [
  'CHOOSE_RESPONSE',
  'CONVERSATION',
  'ANNOUNCEMENT',
  'ACADEMIC_TALK',
];

const SKILLS = Object.keys(LISTENING_SKILL_LABELS) as ListeningSkill[];

export default function ListeningPracticeAdminPage() {
  const { isTeacher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stimuli, setStimuli] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState('');
  const [previewAudio, setPreviewAudio] = useState<string | null>(null);
  const [previewSpeakers, setPreviewSpeakers] = useState<
    { name: string; role: string; imageUrl: string | null }[]
  >([]);

  const [taskType, setTaskType] = useState<ListeningTaskType>('CONVERSATION');
  const [title, setTitle] = useState('');
  const [overallDifficulty, setOverallDifficulty] = useState(5);
  const [cefr, setCefr] = useState('B1');
  const [transcript, setTranscript] = useState('');
  const [academicField, setAcademicField] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [speakers, setSpeakers] = useState([{ name: 'Speaker 1', role: 'Student', imageFile: null as File | null }]);
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    defaultQuestion(0, 'MAIN_IDEA'),
  ]);

  function defaultQuestion(order: number, skill: ListeningSkill): DraftQuestion {
    return {
      question_text: '',
      skill,
      difficulty: 5,
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'A',
      order_index: order,
    };
  }

  async function loadList() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('listening_stimuli')
      .select('id, title, task_type, overall_difficulty, active, created_at')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setStimuli(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (isTeacher) void loadList();
  }, [isTeacher]);

  async function runPreviewFromDraft() {
    if (!audioFile) {
      setError('Upload audio to preview.');
      return;
    }
    setError('');
    const tempId = crypto.randomUUID();
    const path = await uploadListeningAudio(tempId, audioFile);
    const url = await getTeacherAudioSignedUrl(path);
    setPreviewAudio(url);
    setPreviewSpeakers(
      speakers.map((s) => ({ name: s.name, role: s.role, imageUrl: null })),
    );
  }

  async function publish(active: boolean) {
    setError('');
    if (!title.trim() || !audioFile) {
      setError('Title and audio file are required.');
      return;
    }
    if (questions.length === 0) {
      setError('Add at least one question.');
      return;
    }

    const stimulusId = crypto.randomUUID();
    const audioPath = await uploadListeningAudio(stimulusId, audioFile);

    const portraits = [];
    for (let i = 0; i < speakers.length; i++) {
      const sp = speakers[i]!;
      let imagePath: string | undefined;
      if (sp.imageFile) {
        imagePath = await uploadSpeakerImage(stimulusId, i, sp.imageFile);
      }
      portraits.push({ name: sp.name, role: sp.role, ...(imagePath ? { imagePath } : {}) });
    }

    const { error: insErr } = await supabase.from('listening_stimuli').insert({
      id: stimulusId,
      task_type: taskType,
      title: title.trim(),
      audio_path: audioPath,
      transcript: transcript.trim() || null,
      academic_field: academicField.trim() || null,
      cefr_level: cefr,
      overall_difficulty: overallDifficulty,
      speaker_portraits: portraits,
      active,
    });
    if (insErr) {
      setError(insErr.message);
      return;
    }

    const rows = questions.map((q, i) => ({
      stimulus_id: stimulusId,
      question_text:
        taskType === 'CHOOSE_RESPONSE' ? '' : q.question_text.trim(),
      skill: taskType === 'CHOOSE_RESPONSE' ? 'APPROPRIATE_RESPONSE' : q.skill,
      difficulty: q.difficulty,
      option_a: q.option_a.trim(),
      option_b: q.option_b.trim(),
      option_c: q.option_c.trim(),
      option_d: q.option_d.trim(),
      correct_option: q.correct_option,
      order_index: i,
      active,
    }));

    const { error: qErr } = await supabase.from('listening_questions').insert(rows);
    if (qErr) {
      setError(qErr.message);
      return;
    }

    setTitle('');
    setTranscript('');
    setAudioFile(null);
    setQuestions([defaultQuestion(0, 'MAIN_IDEA')]);
    await loadList();
  }

  if (!isTeacher) {
    return <Card className="p-6 text-sm">Teachers only.</Card>;
  }

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <Link to={paths.listeningPractice} className="text-xs font-bold uppercase text-ink-subtle">
        ← Listening Practice
      </Link>
      <h1 className="font-display text-2xl text-ink">Listening content admin</h1>
      <p className="text-sm text-ink-muted">
        One audio stimulus → multiple questions. Transcript is stored for teachers only.
      </p>

      {error && <p className="rounded bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-ink">New stimulus</h2>
        <label className="block text-sm">
          Task type
          <select
            className="mt-1 w-full rounded border border-paper-line px-2 py-1"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as ListeningTaskType)}
          >
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>
                {LISTENING_TASK_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Title
          <input
            className="mt-1 w-full rounded border border-paper-line px-2 py-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Overall difficulty (1–10)
            <input
              type="number"
              min={1}
              max={10}
              className="mt-1 w-full rounded border border-paper-line px-2 py-1"
              value={overallDifficulty}
              onChange={(e) => setOverallDifficulty(Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            CEFR tag
            <input
              className="mt-1 w-full rounded border border-paper-line px-2 py-1"
              value={cefr}
              onChange={(e) => setCefr(e.target.value)}
            />
          </label>
          {taskType === 'ACADEMIC_TALK' && (
            <label className="text-sm">
              Academic field
              <input
                className="mt-1 w-full rounded border border-paper-line px-2 py-1"
                value={academicField}
                onChange={(e) => setAcademicField(e.target.value)}
              />
            </label>
          )}
        </div>
        <label className="block text-sm">
          Audio file
          <input
            type="file"
            accept="audio/*"
            className="mt-1 block w-full text-sm"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="block text-sm">
          Transcript (admin only)
          <textarea
            rows={4}
            className="mt-1 w-full rounded border border-paper-line px-2 py-1 font-mono text-xs"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Speakers</p>
          {speakers.map((sp, i) => (
            <div key={i} className="flex flex-wrap gap-2 rounded border border-paper-line p-2">
              <input
                placeholder="Name"
                className="rounded border px-2 py-1 text-sm"
                value={sp.name}
                onChange={(e) => {
                  const next = [...speakers];
                  next[i] = { ...sp, name: e.target.value };
                  setSpeakers(next);
                }}
              />
              <input
                placeholder="Role"
                className="rounded border px-2 py-1 text-sm"
                value={sp.role}
                onChange={(e) => {
                  const next = [...speakers];
                  next[i] = { ...sp, role: e.target.value };
                  setSpeakers(next);
                }}
              />
              <input
                type="file"
                accept="image/*"
                className="text-xs"
                onChange={(e) => {
                  const next = [...speakers];
                  next[i] = { ...sp, imageFile: e.target.files?.[0] ?? null };
                  setSpeakers(next);
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setSpeakers([...speakers, { name: `Speaker ${speakers.length + 1}`, role: '', imageFile: null }])
            }
          >
            Add speaker
          </Button>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold">Questions (ordered)</p>
          {questions.map((q, i) => (
            <div key={i} className="space-y-2 rounded border border-paper-line p-3">
              <p className="text-xs font-bold text-ink-subtle">Question {i + 1}</p>
              {taskType !== 'CHOOSE_RESPONSE' && (
                <input
                  placeholder="Question text"
                  className="w-full rounded border px-2 py-1 text-sm"
                  value={q.question_text}
                  onChange={(e) => {
                    const next = [...questions];
                    next[i] = { ...q, question_text: e.target.value };
                    setQuestions(next);
                  }}
                />
              )}
              <div className="flex flex-wrap gap-2">
                <select
                  value={q.skill}
                  onChange={(e) => {
                    const next = [...questions];
                    next[i] = { ...q, skill: e.target.value as ListeningSkill };
                    setQuestions(next);
                  }}
                  className="rounded border px-2 py-1 text-sm"
                >
                  {SKILLS.map((s) => (
                    <option key={s} value={s}>
                      {LISTENING_SKILL_LABELS[s]}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={q.difficulty}
                  onChange={(e) => {
                    const next = [...questions];
                    next[i] = { ...q, difficulty: Number(e.target.value) };
                    setQuestions(next);
                  }}
                  className="w-20 rounded border px-2 py-1 text-sm"
                  title="Question difficulty"
                />
              </div>
              {(['A', 'B', 'C', 'D'] as const).map((key) => {
                const field =
                  key === 'A'
                    ? 'option_a'
                    : key === 'B'
                      ? 'option_b'
                      : key === 'C'
                        ? 'option_c'
                        : 'option_d';
                return (
                  <input
                    key={key}
                    placeholder={`Option ${key}`}
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={q[field]}
                    onChange={(e) => {
                      const next = [...questions];
                      next[i] = { ...q, [field]: e.target.value };
                      setQuestions(next);
                    }}
                  />
                );
              })}
              <select
                value={q.correct_option}
                onChange={(e) => {
                  const next = [...questions];
                  next[i] = { ...q, correct_option: e.target.value as 'A' | 'B' | 'C' | 'D' };
                  setQuestions(next);
                }}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="A">Correct: A</option>
                <option value="B">Correct: B</option>
                <option value="C">Correct: C</option>
                <option value="D">Correct: D</option>
              </select>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setQuestions([
                ...questions,
                defaultQuestion(
                  questions.length,
                  taskType === 'ACADEMIC_TALK' && questions.length === 0 ? 'MAIN_IDEA' : 'DETAIL',
                ),
              ])
            }
          >
            Add question
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void runPreviewFromDraft()}>
            Preview audio flow
          </Button>
          <Button type="button" onClick={() => void publish(true)}>
            Publish
          </Button>
          <Button type="button" variant="secondary" onClick={() => void publish(false)}>
            Save draft
          </Button>
        </div>
      </Card>

      {previewAudio && (
        <Card className="space-y-3 p-5">
          <h3 className="font-semibold">Admin preview</h3>
          <ListeningSpeakerStrip speakers={previewSpeakers} />
          <ListeningOnceAudioPlayer
            src={previewAudio}
            assessmentMode={false}
            onEnded={() => setError('Preview: audio ended — student would see questions next.')}
          />
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-semibold text-ink">Published stimuli</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {stimuli.map((s) => (
            <li key={s.id as string} className="flex justify-between gap-2 border-b border-paper-line py-2">
              <span>
                {LISTENING_TASK_LABELS[s.task_type as ListeningTaskType]} — {s.title as string}
              </span>
              <span className="text-ink-muted">
                d{s.overall_difficulty as number} · {s.active ? 'active' : 'draft'}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
