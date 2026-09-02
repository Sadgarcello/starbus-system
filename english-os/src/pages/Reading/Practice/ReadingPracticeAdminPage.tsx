import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { validateTargetWordInSentence, maskTargetWord } from '@/lib/readingPractice/completeWords';
import { paths } from '@/routes/paths';

type Tab = 'complete_words' | 'daily_life' | 'academic';

export default function ReadingPracticeAdminPage() {
  const { isTeacher } = useAuth();
  const [tab, setTab] = useState<Tab>('complete_words');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!isTeacher) {
    return (
      <Card className="p-6 text-sm">Teachers and admins can manage reading practice content.</Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to={paths.readingPractice} className="text-xs font-bold uppercase text-ink-subtle hover:text-ink">
        ← Practice hub
      </Link>
      <h1 className="page-title">Reading Practice — Admin</h1>
      <p className="text-sm text-ink-muted">Manually add TOEFL-style reading content. No AI generation.</p>

      <div className="flex flex-wrap gap-2">
        {(['complete_words', 'daily_life', 'academic'] as Tab[]).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? 'primary' : 'secondary'} onClick={() => setTab(t)}>
            {t.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {msg && <p className="text-sm text-success">{msg}</p>}
      {err && <p className="text-sm text-danger">{err}</p>}

      {tab === 'complete_words' && (
        <CompleteWordsForm
          onDone={(m) => {
            setMsg(m);
            setErr(null);
          }}
          onError={setErr}
        />
      )}
      {tab === 'daily_life' && (
        <DailyLifeForm
          onDone={(m) => {
            setMsg(m);
            setErr(null);
          }}
          onError={setErr}
        />
      )}
      {tab === 'academic' && (
        <AcademicForm
          onDone={(m) => {
            setMsg(m);
            setErr(null);
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
  const [sentence, setSentence] = useState('');
  const [targetWord, setTargetWord] = useState('');
  const [cefr, setCefr] = useState('B2');
  const [difficulty, setDifficulty] = useState('6');
  const [explanation, setExplanation] = useState('');
  const [preview, setPreview] = useState('');

  function runPreview() {
    try {
      if (!validateTargetWordInSentence(sentence, targetWord)) {
        onError('Target word must appear in the sentence.');
        return;
      }
      setPreview(maskTargetWord(sentence, targetWord, Number(difficulty)));
    } catch {
      onError('Could not preview — check sentence and target word.');
    }
  }

  async function save(active: boolean) {
    onError('');
    if (!sentence.trim() || !targetWord.trim()) {
      onError('Sentence and target word are required.');
      return;
    }
    if (!validateTargetWordInSentence(sentence, targetWord)) {
      onError('Target word must appear in the sentence.');
      return;
    }
    const d = Number(difficulty);
    if (d < 1 || d > 10) {
      onError('Difficulty must be 1–10.');
      return;
    }
    const { error } = await supabase.from('complete_words_questions').insert({
      sentence: sentence.trim(),
      target_word: targetWord.trim(),
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
    onDone(active ? 'Published Complete the Words question.' : 'Saved as draft (inactive).');
  }

  return (
    <Card>
      <CardHeader title="Complete the Words" subtitle="Target word is set manually by teacher." />
      <div className="space-y-3 px-4 pb-4">
        <Field label="Sentence" value={sentence} onChange={setSentence} multiline />
        <Field label="Target word" value={targetWord} onChange={setTargetWord} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CEFR" value={cefr} onChange={setCefr} />
          <Field label="Difficulty (1–10)" value={difficulty} onChange={setDifficulty} />
        </div>
        <Field label="Explanation (optional)" value={explanation} onChange={setExplanation} multiline />
        {preview && (
          <div className="rounded-md bg-paper-soft p-3 text-sm">
            <p className="text-xs font-bold uppercase text-ink-subtle">Student preview</p>
            <p className="mt-1 font-display text-lg">{preview}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={runPreview}>
            Preview
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
  const [skill, setSkill] = useState('DETAIL');
  const [difficulty, setDifficulty] = useState('4');
  const [explanation, setExplanation] = useState('');

  async function save(active: boolean) {
    if (!title || !content || !question || !a || !b || !c || !d) {
      onError('All fields required.');
      return;
    }
    const { error } = await supabase.from('daily_life_questions').insert({
      title,
      content,
      content_type: 'NOTICE',
      cefr_level: 'B1',
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
    onDone('Daily Life question saved.');
  }

  return (
    <Card>
      <CardHeader title="Read in Daily Life" />
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
        <Field label="Skill" value={skill} onChange={setSkill} />
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
  const [passage, setPassage] = useState('');
  const [question, setQuestion] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState('');
  const [d, setD] = useState('');
  const [correct, setCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [skill, setSkill] = useState('MAIN_IDEA');

  async function save() {
    if (!title || !passage || !question || !a || !b || !c || !d) {
      onError('Passage and first question are required.');
      return;
    }
    const wc = passage.trim().split(/\s+/).length;
    const { data: p, error: pErr } = await supabase
      .from('academic_passages')
      .insert({
        title,
        passage_text: passage,
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
        <Field label="Passage" value={passage} onChange={setPassage} multiline />
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
        <Field label="Skill" value={skill} onChange={setSkill} />
        <Button size="sm" onClick={() => void save()}>
          Publish passage
        </Button>
      </div>
    </Card>
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
