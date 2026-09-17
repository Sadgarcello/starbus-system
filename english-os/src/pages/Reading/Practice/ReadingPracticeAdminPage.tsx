import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  buildCompleteWordsTask,
  countPassageWords,
  DEFAULT_MASK_BLANK_COUNT,
  splitPassageSentences,
  TARGET_PASSAGE_WORD_MAX,
  TARGET_PASSAGE_WORD_MIN,
  validatePassageBlankCount,
} from '@/lib/readingPractice/completeWords';
import type { ReadingSkill } from '@/lib/readingPractice/types';
import { paths } from '@/routes/paths';

const READING_SKILL_OPTIONS: { value: ReadingSkill; label: string }[] = [
  { value: 'DETAIL', label: 'Detail — specific facts in the text' },
  { value: 'MAIN_IDEA', label: 'Main idea — central point of the text' },
  { value: 'INFERENCE', label: 'Inference — implied, not directly stated' },
  { value: 'PURPOSE', label: 'Purpose — why something was written' },
  { value: 'VOCABULARY', label: 'Vocabulary' },
  { value: 'VOCABULARY_CONTEXT', label: 'Vocabulary in context' },
  { value: 'REFERENCE', label: 'Reference — what a word/phrase refers to' },
  { value: 'RELATIONSHIP', label: 'Relationship — how ideas connect' },
  { value: 'SPELLING', label: 'Spelling (Complete the Words)' },
];

type Tab = 'complete_words' | 'daily_life' | 'academic';
type AdminView = 'manage' | 'add';

export default function ReadingPracticeAdminPage() {
  const { isTeacher } = useAuth();
  const [tab, setTab] = useState<Tab>('complete_words');
  const [view, setView] = useState<AdminView>('manage');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [listRefresh, setListRefresh] = useState(0);
  const bumpList = useCallback(() => setListRefresh((n) => n + 1), []);

  if (!isTeacher) {
    return (
      <Card className="p-6 text-sm">Teachers and admins can manage reading practice content.</Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase text-ink-subtle">
        <Link to={paths.reading} className="hover:text-ink">
          ← Reading
        </Link>
        <Link to={paths.readingPracticeAdminResults} className="hover:text-ink">
          Student results →
        </Link>
      </div>
      <h1 className="page-title">Reading Practice — Admin</h1>
      <p className="text-sm text-ink-muted">
        Passage-only mode — paste full text; words are masked automatically. No target word field.
      </p>

      <div className="flex flex-wrap gap-2">
        {(['complete_words', 'daily_life', 'academic'] as Tab[]).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? 'primary' : 'secondary'}
            onClick={() => {
              setTab(t);
              setView('manage');
            }}
          >
            {t.replace('_', ' ')}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-paper-line pb-3">
        <Button size="sm" variant={view === 'manage' ? 'primary' : 'secondary'} onClick={() => setView('manage')}>
          Manage existing
        </Button>
        <Button size="sm" variant={view === 'add' ? 'primary' : 'secondary'} onClick={() => setView('add')}>
          Add new
        </Button>
      </div>

      {msg && <p className="text-sm text-success">{msg}</p>}
      {err && <p className="text-sm text-danger">{err}</p>}

      {tab === 'complete_words' && view === 'manage' && (
        <CompleteWordsQuestionList
          refreshKey={listRefresh}
          onDone={(m) => {
            setMsg(m);
            setErr(null);
          }}
          onError={setErr}
        />
      )}
      {tab === 'complete_words' && view === 'add' && (
        <CompleteWordsForm
          onDone={(m) => {
            setMsg(m);
            setErr(null);
            bumpList();
            setView('manage');
          }}
          onError={setErr}
        />
      )}
      {tab === 'daily_life' && view === 'manage' && (
        <>
          <DailyLifeFollowUpForm
            refreshKey={listRefresh}
            onDone={(m) => {
              setMsg(m);
              setErr(null);
              bumpList();
            }}
            onError={setErr}
          />
          <DailyLifeQuestionList
            refreshKey={listRefresh}
            onDone={(m) => {
              setMsg(m);
              setErr(null);
            }}
            onError={setErr}
          />
        </>
      )}
      {tab === 'daily_life' && view === 'add' && (
        <DailyLifeForm
          onDone={(m) => {
            setMsg(m);
            setErr(null);
            bumpList();
            setView('manage');
          }}
          onError={setErr}
        />
      )}
      {tab === 'academic' && view === 'manage' && (
        <AcademicQuestionList
          refreshKey={listRefresh}
          onDone={(m) => {
            setMsg(m);
            setErr(null);
          }}
          onError={setErr}
        />
      )}
      {tab === 'academic' && view === 'add' && (
        <AcademicForm
          onDone={(m) => {
            setMsg(m);
            setErr(null);
            bumpList();
            setView('manage');
          }}
          onError={setErr}
        />
      )}
    </div>
  );
}

function CompleteWordsForm({
  onDone,
  onError,
}: {
  onDone: (m: string) => void;
  onError: (e: string) => void;
}) {
  const [passage, setPassage] = useState('');
  const [cefr, setCefr] = useState('B2');
  const [difficulty, setDifficulty] = useState('6');
  const [explanation, setExplanation] = useState('');
  const [preview, setPreview] = useState<{ passage: string; blankCount: number } | null>(null);

  function validatePassage(trimmed: string): string | null {
    if (!trimmed) return 'Passage text is required.';
    if (splitPassageSentences(trimmed).length < 2) {
      return 'Add at least two sentences. The first sentence stays intact; masking starts in sentence two.';
    }
    const words = countPassageWords(trimmed);
    if (words < TARGET_PASSAGE_WORD_MIN || words > TARGET_PASSAGE_WORD_MAX) {
      return `Passage is ${words} words. TOEFL passages are usually ${TARGET_PASSAGE_WORD_MIN}–${TARGET_PASSAGE_WORD_MAX} words — it will still save, but aim for that range.`;
    }
    return null;
  }

  function runPreview() {
    onError('');
    const trimmed = passage.trim();
    const issue = validatePassage(trimmed);
    if (issue?.includes('required') || issue?.includes('two sentences')) {
      onError(issue);
      return;
    }
    if (issue) onError(issue);
    const blankCheck = validatePassageBlankCount(trimmed);
    if (!blankCheck.valid) {
      onError(blankCheck.message ?? `Passage must produce exactly ${DEFAULT_MASK_BLANK_COUNT} blanks.`);
      return;
    }
    const task = buildCompleteWordsTask(trimmed);
    setPreview({ passage: task.displayPassage, blankCount: task.blanks.length });
  }

  async function save(active: boolean) {
    onError('');
    const trimmed = passage.trim();
    const issue = validatePassage(trimmed);
    if (issue?.includes('required') || issue?.includes('two sentences')) {
      onError(issue);
      return;
    }
    if (issue) onError(issue);
    const blankCheck = validatePassageBlankCount(trimmed);
    if (!blankCheck.valid) {
      onError(blankCheck.message ?? `Passage must produce exactly ${DEFAULT_MASK_BLANK_COUNT} blanks.`);
      return;
    }
    const task = buildCompleteWordsTask(trimmed);
    const d = Number(difficulty);
    if (d < 1 || d > 10) {
      onError('Difficulty must be 1–10.');
      return;
    }
    const { error } = await supabase.from('complete_words_questions').insert({
      sentence: trimmed,
      cefr_level: cefr,
      difficulty: d,
      category: 'academic',
      explanation: explanation.trim() || null,
      active,
    });
    if (error) {
      onError(error.message);
      return;
    }
    onDone(
      active
        ? `Published passage with ${task.blanks.length} auto-masked words.`
        : 'Saved as draft (inactive).',
    );
  }

  return (
    <Card>
      <CardHeader
        title="Complete the Words"
        subtitle="70–100 word passage. First sentence stays intact, then up to 10 words are masked (offi_____ style), then the rest stays normal."
      />
      <div className="space-y-3 px-4 pb-4">
        <Field label="Passage text" value={passage} onChange={setPassage} multiline />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CEFR" value={cefr} onChange={setCefr} />
          <Field label="Difficulty (1–10)" value={difficulty} onChange={setDifficulty} />
        </div>
        <Field label="Explanation (optional)" value={explanation} onChange={setExplanation} multiline />
        {preview && (
          <div className="rounded-md bg-paper-soft p-3 text-sm">
            <p className="text-xs font-bold uppercase text-ink-subtle">
              Student preview · {preview.blankCount} of 10 blanks
            </p>
            <p className="mt-1 whitespace-pre-wrap text-base leading-relaxed text-ink">{preview.passage}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={runPreview}>
            Preview masking
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void save(false)}>
            Save draft
          </Button>
          <Button size="sm" onClick={() => void save(true)}>
            Publish
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DailyLifeFollowUpForm({
  refreshKey,
  onDone,
  onError,
}: {
  refreshKey: number;
  onDone: (m: string) => void;
  onError: (e: string) => void;
}) {
  const [contexts, setContexts] = useState<{ id: string; title: string }[]>([]);
  const [contextId, setContextId] = useState('');
  const [question, setQuestion] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState('');
  const [d, setD] = useState('');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [skill, setSkill] = useState<ReadingSkill>('DETAIL');
  const [difficulty, setDifficulty] = useState('4');
  const [explanation, setExplanation] = useState('');

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from('daily_life_contexts')
      .select('id, title')
      .eq('active', true)
      .order('title')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) onError(error.message);
        else setContexts((data ?? []) as { id: string; title: string }[]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, onError]);

  async function save() {
    if (!contextId || !question || !a || !b || !c || !d) {
      onError('Pick a context and fill in the question and all options.');
      return;
    }
    const { data: ctx, error: ctxErr } = await supabase
      .from('daily_life_contexts')
      .select('title, content, content_type, cefr_level, difficulty')
      .eq('id', contextId)
      .single();
    if (ctxErr || !ctx) {
      onError(ctxErr?.message ?? 'Context not found.');
      return;
    }
    const { error } = await supabase.from('daily_life_questions').insert({
      context_id: contextId,
      title: ctx.title,
      content: ctx.content,
      content_type: ctx.content_type,
      cefr_level: ctx.cefr_level,
      difficulty: Number(difficulty),
      skill,
      question,
      option_a: a,
      option_b: b,
      option_c: c,
      option_d: d,
      correct_option: correct,
      explanation: explanation || null,
      active: true,
    });
    if (error) {
      onError(error.message);
      return;
    }
    setQuestion('');
    setA('');
    setB('');
    setC('');
    setD('');
    setExplanation('');
    onDone('Added another question to the same Daily Life context.');
  }

  return (
    <Card>
      <CardHeader
        title="Add question to existing context"
        subtitle="Use the same notice, email, or menu for multiple comprehension questions."
      />
      <div className="space-y-3 px-4 pb-4">
        <label className="block text-xs font-bold uppercase text-ink-subtle">
          Context
          <select
            className="mt-1 w-full rounded-md border border-paper-line px-3 py-2 text-sm"
            value={contextId}
            onChange={(e) => setContextId(e.target.value)}
          >
            <option value="">Select context…</option>
            {contexts.map((ctx) => (
              <option key={ctx.id} value={ctx.id}>
                {ctx.title}
              </option>
            ))}
          </select>
        </label>
        <Field label="Question" value={question} onChange={setQuestion} />
        <Field label="Option A" value={a} onChange={setA} />
        <Field label="Option B" value={b} onChange={setB} />
        <Field label="Option C" value={c} onChange={setC} />
        <Field label="Option D" value={d} onChange={setD} />
        <label className="block text-xs font-bold uppercase text-ink-subtle">
          Correct
          <select
            className="mt-1 w-full rounded-md border border-paper-line px-3 py-2 text-sm"
            value={correct}
            onChange={(e) => setCorrect(e.target.value as 'A' | 'B' | 'C' | 'D')}
          >
            {(['A', 'B', 'C', 'D'] as const).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <SkillSelect value={skill} onChange={setSkill} />
        <Field label="Difficulty" value={difficulty} onChange={setDifficulty} />
        <Field label="Explanation" value={explanation} onChange={setExplanation} multiline />
        <Button size="sm" onClick={() => void save()}>
          Add question
        </Button>
      </div>
    </Card>
  );
}

function DailyLifeForm({
  onDone,
  onError,
}: {
  onDone: (m: string) => void;
  onError: (e: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [question, setQuestion] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState('');
  const [d, setD] = useState('');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [skill, setSkill] = useState<ReadingSkill>('DETAIL');
  const [difficulty, setDifficulty] = useState('4');
  const [explanation, setExplanation] = useState('');

  async function save(active: boolean) {
    if (!title || !content || !question || !a || !b || !c || !d) {
      onError('All fields required.');
      return;
    }
    const { data: ctx, error: ctxErr } = await supabase
      .from('daily_life_contexts')
      .insert({
        title,
        content,
        content_type: 'NOTICE',
        cefr_level: 'B1',
        difficulty: Number(difficulty),
        active,
      })
      .select('id, title, content, content_type, cefr_level, difficulty')
      .single();
    if (ctxErr || !ctx) {
      onError(ctxErr?.message ?? 'Could not create Daily Life context.');
      return;
    }
    const { error } = await supabase.from('daily_life_questions').insert({
      context_id: ctx.id,
      title: ctx.title,
      content: ctx.content,
      content_type: ctx.content_type,
      cefr_level: ctx.cefr_level,
      difficulty: Number(difficulty),
      skill,
      question,
      option_a: a,
      option_b: b,
      option_c: c,
      option_d: d,
      correct_option: correct,
      explanation: explanation || null,
      active,
    });
    if (error) {
      onError(error.message);
      return;
    }
    onDone('Daily Life context and first question saved. Add more questions to the same context from Manage.');
  }

  return (
    <Card>
      <CardHeader
        title="Read in Daily Life"
        subtitle="Creates a new notice/email context with its first question. Add more questions to the same context from Manage."
      />
      <div className="space-y-3 px-4 pb-4">
        <Field label="Title" value={title} onChange={setTitle} />
        <Field label="Content" value={content} onChange={setContent} multiline />
        <Field label="Question" value={question} onChange={setQuestion} />
        <Field label="Option A" value={a} onChange={setA} />
        <Field label="Option B" value={b} onChange={setB} />
        <Field label="Option C" value={c} onChange={setC} />
        <Field label="Option D" value={d} onChange={setD} />
        <label className="block text-xs font-bold uppercase text-ink-subtle">
          Correct
          <select
            className="mt-1 w-full rounded-md border border-paper-line px-3 py-2 text-sm"
            value={correct}
            onChange={(e) => setCorrect(e.target.value as 'A' | 'B' | 'C' | 'D')}
          >
            {(['A', 'B', 'C', 'D'] as const).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <SkillSelect value={skill} onChange={setSkill} />
        <Field label="Difficulty" value={difficulty} onChange={setDifficulty} />
        <Field label="Explanation" value={explanation} onChange={setExplanation} multiline />
        <Button size="sm" onClick={() => void save(true)}>
          Publish
        </Button>
      </div>
    </Card>
  );
}

function AcademicForm({
  onDone,
  onError,
}: {
  onDone: (m: string) => void;
  onError: (e: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [passageText, setPassageText] = useState('');
  const [question, setQuestion] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState('');
  const [d, setD] = useState('');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [skill, setSkill] = useState<ReadingSkill>('MAIN_IDEA');

  async function save() {
    if (!title || !passageText || !question || !a || !b || !c || !d) {
      onError('Passage and first question are required.');
      return;
    }
    const wc = passageText.trim().split(/\s+/).length;
    const { data: p, error: pErr } = await supabase
      .from('academic_passages')
      .insert({
        title,
        passage_text: passageText,
        cefr_level: 'B2',
        difficulty: 6,
        topic: 'general',
        word_count: wc,
        active: true,
      })
      .select('id')
      .single();
    if (pErr || !p) {
      onError(pErr?.message ?? 'Passage failed');
      return;
    }
    const { error } = await supabase.from('academic_questions').insert({
      passage_id: p.id,
      question,
      skill,
      difficulty: 6,
      option_a: a,
      option_b: b,
      option_c: c,
      option_d: d,
      correct_option: correct,
      active: true,
    });
    if (error) {
      onError(error.message);
      return;
    }
    onDone('Academic passage + question published.');
  }

  return (
    <Card>
      <CardHeader title="Academic Passage" subtitle="Add passage and first question; add more questions in DB or extend UI later." />
      <div className="space-y-3 px-4 pb-4">
        <Field label="Title" value={title} onChange={setTitle} />
        <Field label="Passage" value={passageText} onChange={setPassageText} multiline />
        <Field label="Question" value={question} onChange={setQuestion} />
        <Field label="A" value={a} onChange={setA} />
        <Field label="B" value={b} onChange={setB} />
        <Field label="C" value={c} onChange={setC} />
        <Field label="D" value={d} onChange={setD} />
        <label className="block text-xs font-bold uppercase text-ink-subtle">
          Correct
          <select
            className="mt-1 w-full rounded-md border border-paper-line px-3 py-2 text-sm"
            value={correct}
            onChange={(e) => setCorrect(e.target.value as 'A' | 'B' | 'C' | 'D')}
          >
            {(['A', 'B', 'C', 'D'] as const).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <SkillSelect value={skill} onChange={setSkill} />
        <Button size="sm" onClick={() => void save()}>
          Publish passage
        </Button>
      </div>
    </Card>
  );
}

function SkillSelect({
  value,
  onChange,
}: {
  value: ReadingSkill;
  onChange: (skill: ReadingSkill) => void;
}) {
  return (
    <label className="block text-xs font-bold uppercase text-ink-subtle">
      Skill
      <select
        className="mt-1 w-full rounded-md border border-paper-line px-3 py-2 text-sm normal-case"
        value={value}
        onChange={(e) => onChange(e.target.value as ReadingSkill)}
      >
        {READING_SKILL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block text-xs font-bold uppercase text-ink-subtle">
      {label}
      {multiline ? (
        <textarea
          className="mt-1 w-full rounded-md border border-paper-line px-3 py-2 text-sm"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function truncateText(text: string, max = 120): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function formatAdminDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
        active ? 'bg-success/15 text-success' : 'bg-ink/10 text-ink-subtle'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function QuestionRowActions({
  active,
  busy,
  onToggleActive,
  onDelete,
}: {
  active: boolean;
  busy: boolean;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button variant="secondary" size="sm" disabled={busy} onClick={onToggleActive}>
        {active ? 'Remove from tests' : 'Restore'}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        className="text-danger hover:text-danger"
        onClick={onDelete}
      >
        Delete
      </Button>
    </div>
  );
}

type ListProps = {
  refreshKey: number;
  onDone: (m: string) => void;
  onError: (e: string) => void;
};

function CompleteWordsQuestionList({ refreshKey, onDone, onError }: ListProps) {
  const [rows, setRows] = useState<
    { id: string; sentence: string; cefr_level: string; difficulty: number; active: boolean; created_at: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void supabase
      .from('complete_words_questions')
      .select('id, sentence, cefr_level, difficulty, active, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) onError(error.message);
        else setRows((data ?? []) as typeof rows);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function setActive(id: string, active: boolean) {
    setBusyId(id);
    onError('');
    const { error } = await supabase.from('complete_words_questions').update({ active }).eq('id', id);
    setBusyId(null);
    if (error) {
      onError(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, active } : r)));
    onDone(active ? 'Passage restored to active tests.' : 'Passage removed from tests (still saved as inactive).');
  }

  async function remove(id: string) {
    if (!window.confirm('Permanently delete this passage? Past student reports may still reference it.')) return;
    setBusyId(id);
    onError('');
    const { error } = await supabase.from('complete_words_questions').delete().eq('id', id);
    setBusyId(null);
    if (error) {
      onError(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    onDone('Passage deleted permanently.');
  }

  return (
    <QuestionListCard title="Existing passages" count={rows.length} loading={loading}>
      {rows.length === 0 && !loading && (
        <p className="px-4 pb-4 text-sm text-ink-muted">No passages yet.</p>
      )}
      {rows.map((row) => (
        <div key={row.id} className="border-t border-paper-line px-4 py-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge active={row.active} />
                <span className="text-xs text-ink-subtle">
                  {row.cefr_level} · Difficulty {Number(row.difficulty)} · {formatAdminDate(row.created_at)}
                </span>
              </div>
              <p className="mt-1 text-ink">{truncateText(row.sentence)}</p>
            </div>
            <QuestionRowActions
              active={row.active}
              busy={busyId === row.id}
              onToggleActive={() => void setActive(row.id, !row.active)}
              onDelete={() => void remove(row.id)}
            />
          </div>
        </div>
      ))}
    </QuestionListCard>
  );
}

function DailyLifeQuestionList({ refreshKey, onDone, onError }: ListProps) {
  const [rows, setRows] = useState<
    {
      id: string;
      title: string;
      question: string;
      difficulty: number;
      active: boolean;
      created_at: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void supabase
      .from('daily_life_questions')
      .select('id, title, question, difficulty, active, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) onError(error.message);
        else setRows((data ?? []) as typeof rows);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function setActive(id: string, active: boolean) {
    setBusyId(id);
    onError('');
    const { error } = await supabase.from('daily_life_questions').update({ active }).eq('id', id);
    setBusyId(null);
    if (error) {
      onError(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, active } : r)));
    onDone(active ? 'Question restored to active tests.' : 'Question removed from tests.');
  }

  async function remove(id: string) {
    if (!window.confirm('Permanently delete this Daily Life question?')) return;
    setBusyId(id);
    onError('');
    const { error } = await supabase.from('daily_life_questions').delete().eq('id', id);
    setBusyId(null);
    if (error) {
      onError(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    onDone('Question deleted permanently.');
  }

  return (
    <QuestionListCard title="Existing questions" count={rows.length} loading={loading}>
      {rows.length === 0 && !loading && (
        <p className="px-4 pb-4 text-sm text-ink-muted">No Daily Life questions yet.</p>
      )}
      {rows.map((row) => (
        <div key={row.id} className="border-t border-paper-line px-4 py-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge active={row.active} />
                <span className="text-xs text-ink-subtle">
                  Difficulty {Number(row.difficulty)} · {formatAdminDate(row.created_at)}
                </span>
              </div>
              <p className="mt-1 font-semibold text-ink">{row.title}</p>
              <p className="text-ink-muted">{truncateText(row.question, 100)}</p>
            </div>
            <QuestionRowActions
              active={row.active}
              busy={busyId === row.id}
              onToggleActive={() => void setActive(row.id, !row.active)}
              onDelete={() => void remove(row.id)}
            />
          </div>
        </div>
      ))}
    </QuestionListCard>
  );
}

function AcademicQuestionList({ refreshKey, onDone, onError }: ListProps) {
  const [rows, setRows] = useState<
    {
      id: string;
      question: string;
      difficulty: number;
      active: boolean;
      created_at: string;
      passage_id: string;
      academic_passages: { title: string; active: boolean } | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void supabase
      .from('academic_questions')
      .select('id, question, difficulty, active, created_at, passage_id, academic_passages(title, active)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) onError(error.message);
        else {
          setRows(
            (data ?? []).map((row) => {
              const passage = row.academic_passages;
              const academic_passages = Array.isArray(passage) ? (passage[0] ?? null) : passage;
              return { ...row, academic_passages } as (typeof rows)[number];
            }),
          );
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function setActive(id: string, active: boolean) {
    setBusyId(id);
    onError('');
    const { error } = await supabase.from('academic_questions').update({ active }).eq('id', id);
    setBusyId(null);
    if (error) {
      onError(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, active } : r)));
    onDone(active ? 'Academic question restored.' : 'Academic question removed from tests.');
  }

  async function remove(id: string, passageTitle: string) {
    if (!window.confirm(`Permanently delete this academic question from "${passageTitle}"?`)) return;
    setBusyId(id);
    onError('');
    const { error } = await supabase.from('academic_questions').delete().eq('id', id);
    setBusyId(null);
    if (error) {
      onError(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    onDone('Academic question deleted permanently.');
  }

  async function removePassage(passageId: string, title: string) {
    if (
      !window.confirm(
        `Remove entire passage "${title}" and all its questions from tests? (Sets passage and questions inactive.)`,
      )
    ) {
      return;
    }
    setBusyId(passageId);
    onError('');
    const { error: pErr } = await supabase.from('academic_passages').update({ active: false }).eq('id', passageId);
    const { error: qErr } = await supabase.from('academic_questions').update({ active: false }).eq('passage_id', passageId);
    setBusyId(null);
    if (pErr || qErr) {
      onError(pErr?.message ?? qErr?.message ?? 'Failed to deactivate passage');
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.passage_id === passageId
          ? { ...r, active: false, academic_passages: r.academic_passages ? { ...r.academic_passages, active: false } : null }
          : r,
      ),
    );
    onDone('Passage and its questions removed from tests.');
  }

  const passageIds = [...new Set(rows.map((r) => r.passage_id))];

  return (
    <QuestionListCard title="Existing academic questions" count={rows.length} loading={loading}>
      {rows.length === 0 && !loading && (
        <p className="px-4 pb-4 text-sm text-ink-muted">No academic questions yet.</p>
      )}
      {passageIds.map((passageId) => {
        const passageRows = rows.filter((r) => r.passage_id === passageId);
        const passageTitle = passageRows[0]?.academic_passages?.title ?? 'Untitled passage';
        const passageActive = passageRows[0]?.academic_passages?.active ?? true;
        return (
          <div key={passageId} className="border-t border-paper-line">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-paper-soft/50 px-4 py-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-ink">{passageTitle}</span>
                <StatusBadge active={passageActive} />
              </div>
              {passageActive && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId === passageId}
                  onClick={() => void removePassage(passageId, passageTitle)}
                >
                  Remove whole passage
                </Button>
              )}
            </div>
            {passageRows.map((row) => (
              <div key={row.id} className="border-t border-paper-line/70 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge active={row.active} />
                      <span className="text-xs text-ink-subtle">
                        Difficulty {Number(row.difficulty)} · {formatAdminDate(row.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-ink">{truncateText(row.question, 140)}</p>
                  </div>
                  <QuestionRowActions
                    active={row.active}
                    busy={busyId === row.id}
                    onToggleActive={() => void setActive(row.id, !row.active)}
                    onDelete={() => void remove(row.id, passageTitle)}
                  />
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </QuestionListCard>
  );
}

function QuestionListCard({
  title,
  count,
  loading,
  children,
}: {
  title: string;
  count: number;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader
        title={title}
        subtitle={loading ? 'Loading…' : `${count} total · inactive items stay saved but won't appear in student tests`}
      />
      {loading ? (
        <div className="px-4 pb-4">
          <Spinner />
        </div>
      ) : (
        children
      )}
    </Card>
  );
}
