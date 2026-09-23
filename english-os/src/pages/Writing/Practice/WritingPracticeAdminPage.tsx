import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { paths } from '@/routes/paths';
import { supabase } from '@/lib/supabase';

export default function WritingPracticeAdminPage() {
  const { isTeacher } = useAuth();
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [bsPrompt, setBsPrompt] = useState('');
  const [bsTarget, setBsTarget] = useState('');
  const [bsBank, setBsBank] = useState('');
  const [bsDiff, setBsDiff] = useState(3);

  async function publishBuildSentence() {
    setError('');
    setOk('');
    const bank = bsBank.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const { error: err } = await supabase.from('writing_build_sentence_items').insert({
      prompt: bsPrompt.trim(),
      target_sentence: bsTarget.trim(),
      word_bank: bank.length ? bank : bsTarget.trim().split(/\s+/),
      difficulty: bsDiff,
      cefr_level: 'B1',
      active: true,
    });
    if (err) setError(err.message);
    else setOk('Build a Sentence item published.');
  }

  async function publishEmail() {
    setError('');
    const { error: err } = await supabase.from('writing_email_tasks').insert({
      scenario: 'Extension request',
      audience: 'Professor',
      purpose: 'Request deadline extension',
      instructions:
        'Write an email to your professor. Explain the problem, explain how it affects you, and request a solution.',
      required_components: [
        { id: 'requirement_1', label: 'Explain the problem' },
        { id: 'requirement_2', label: 'Explain impact' },
        { id: 'requirement_3', label: 'Request a solution' },
      ],
      difficulty: 5,
      cefr_level: 'B1',
      active: true,
    });
    if (err) setError(err.message);
    else setOk('Email task published.');
  }

  async function publishDiscussion() {
    setError('');
    const { error: err } = await supabase.from('writing_academic_discussions').insert({
      professor_prompt: 'Today we are discussing whether universities should require community service.',
      discussion_question: 'Do you think community service should be required for all students?',
      participant_one_name: 'Alex',
      participant_one_response:
        'I think optional programs are better because students stay motivated when they choose to participate.',
      participant_two_name: 'Jordan',
      participant_two_response:
        'Required service could help students develop responsibility, but the schedule must be flexible.',
      task_instruction: 'Write a response that states your opinion and contributes to the discussion.',
      difficulty: 5,
      cefr_level: 'B1',
      active: true,
    });
    if (err) setError(err.message);
    else setOk('Academic discussion published.');
  }

  if (!isTeacher) return <Card className="p-6 text-sm">Teachers only.</Card>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <Link to={paths.writingPractice} className="text-xs font-bold uppercase text-ink-subtle">
        ← Writing diagnostic
      </Link>
      <h1 className="font-display text-2xl text-ink">Writing diagnostic admin</h1>
      {error && <p className="text-sm text-danger">{error}</p>}
      {ok && <p className="text-sm text-success">{ok}</p>}

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Build a Sentence</h2>
        <textarea
          className="w-full rounded border p-2 text-sm"
          placeholder="Prompt / context"
          value={bsPrompt}
          onChange={(e) => setBsPrompt(e.target.value)}
        />
        <input
          className="w-full rounded border p-2 text-sm"
          placeholder="Target sentence"
          value={bsTarget}
          onChange={(e) => setBsTarget(e.target.value)}
        />
        <textarea
          className="w-full rounded border p-2 text-sm"
          placeholder="Word bank (comma or newline separated)"
          value={bsBank}
          onChange={(e) => setBsBank(e.target.value)}
        />
        <input
          type="number"
          min={1}
          max={10}
          className="w-24 rounded border p-2 text-sm"
          value={bsDiff}
          onChange={(e) => setBsDiff(Number(e.target.value))}
        />
        <Button type="button" onClick={() => void publishBuildSentence()}>
          Publish item
        </Button>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Quick publish templates</h2>
        <p className="text-xs text-ink-muted">Use for bootstrapping — edit in Supabase for full control.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void publishEmail()}>
            Publish sample Email
          </Button>
          <Button type="button" variant="secondary" onClick={() => void publishDiscussion()}>
            Publish sample Discussion
          </Button>
        </div>
      </Card>
    </div>
  );
}
