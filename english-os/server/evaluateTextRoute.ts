import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  evaluateStudentText,
  getGeminiApiKey,
  humanizeGeminiError,
  type StudentCoachContext,
} from './aiCoach.js';
import { getSupabaseServerEnv } from './serverEnv.js';
import { verifySupabaseAccessToken } from './pushSend.js';
import {
  AI_COACH_LOCKED_MESSAGE,
  canStudentUseAiCoach,
} from './aiCoachAccess.js';

const MAX_INPUT_CHARS = 5000;
const MIN_WRITING_CHARS = 20;
const DAILY_EVAL_LIMIT = 5;

type SourceType = 'writing' | 'listening';

interface SourcePayload {
  studentId: string;
  studentText: string;
  taskContext: string;
}

function startOfUtcDay(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

async function loadStudentContext(
  admin: ReturnType<typeof createClient>,
  studentId: string,
): Promise<StudentCoachContext | null> {
  const { data: studentRow } = await admin
    .from('students')
    .select('id, level, exam_track, profile:profiles!students_user_id_fkey(name)')
    .eq('id', studentId)
    .maybeSingle();

  if (!studentRow) return null;

  const profile = studentRow.profile as { name: string | null } | null;

  const { data: hobbyRows } = await admin
    .from('student_hobbies')
    .select('hobby:hobbies(name)')
    .eq('student_id', studentId);

  const hobbies = (hobbyRows ?? [])
    .map((row) => {
      const h = row.hobby as { name: string } | { name: string }[] | null;
      if (Array.isArray(h)) return h[0]?.name;
      return h?.name;
    })
    .filter((n): n is string => Boolean(n));

  const { data: recentRows } = await admin
    .from('ai_text_evaluations')
    .select('overall_score, estimated_cefr, coach_note')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(2);

  return {
    name: profile?.name?.trim() || 'Student',
    level: studentRow.level || 'A1',
    examTrack: (studentRow.exam_track as string | null) ?? null,
    hobbies,
    recentEvaluations: (recentRows ?? []).map((r) => ({
      overall_score: r.overall_score as number,
      estimated_cefr: r.estimated_cefr as string,
      coach_note: r.coach_note as string,
    })),
  };
}

async function loadWritingSource(
  admin: ReturnType<typeof createClient>,
  sourceId: string,
): Promise<SourcePayload | null> {
  const { data: submission } = await admin
    .from('writing_submissions')
    .select('id, student_id, body_text, task:writing_tasks(title, instructions)')
    .eq('id', sourceId)
    .maybeSingle();

  if (!submission) return null;

  const bodyText = (submission.body_text as string | null)?.trim() ?? '';
  if (bodyText.length < MIN_WRITING_CHARS) {
    throw new Error('text_too_short');
  }
  if (bodyText.length > MAX_INPUT_CHARS) {
    throw new Error('text_too_long');
  }

  const task = submission.task as { title: string; instructions: string } | null;
  const taskContext = task
    ? `Writing assignment: ${task.title}\nPrompt: ${task.instructions}`
    : 'Writing assignment';

  return {
    studentId: submission.student_id as string,
    studentText: bodyText,
    taskContext,
  };
}

async function loadListeningSource(
  admin: ReturnType<typeof createClient>,
  sourceId: string,
): Promise<SourcePayload | null> {
  const { data: pick } = await admin
    .from('listening_picks')
    .select('id, student_id, clip_name, topic, why_chose, what_understood, opinion')
    .eq('id', sourceId)
    .maybeSingle();

  if (!pick) return null;

  const combined = [
    pick.what_understood?.trim(),
    pick.opinion?.trim(),
  ]
    .filter(Boolean)
    .join('\n\n');

  if (combined.length < MIN_WRITING_CHARS) {
    throw new Error('text_too_short');
  }
  if (combined.length > MAX_INPUT_CHARS) {
    throw new Error('text_too_long');
  }

  const taskContext = [
    `Listening pick: ${pick.clip_name}`,
    `Topic: ${pick.topic}`,
    `Why they chose it: ${pick.why_chose}`,
  ].join('\n');

  return {
    studentId: pick.student_id as string,
    studentText: combined,
    taskContext,
  };
}

function mapEvaluationRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    student_id: row.student_id,
    source_type: row.source_type,
    source_id: row.source_id,
    input_snapshot: row.input_snapshot,
    overall_score: row.overall_score,
    estimated_cefr: row.estimated_cefr,
    summary: row.summary,
    strengths: row.strengths,
    improvements: row.improvements,
    corrections: row.corrections,
    coach_note: row.coach_note,
    ai_model: row.ai_model,
    created_at: row.created_at,
    cached: true,
  };
}

export async function handleEvaluateText(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    return res.status(500).json({
      error: 'missing_gemini_key',
      detail:
        'GEMINI_API_KEY is missing or invalid on Vercel. Add your key from aistudio.google.com/apikey, then redeploy.',
    });
  }

  const env = getSupabaseServerEnv();
  if (!env.ok) {
    return res.status(500).json({ error: env.error });
  }

  const authHeader = req.headers.authorization;
  const body =
    typeof req.body === 'object' && req.body ? (req.body as Record<string, unknown>) : {};
  const bodyToken = typeof body.access_token === 'string' ? body.access_token : '';
  const token = (
    authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : bodyToken
  ).trim();

  if (!token) {
    return res.status(401).json({ error: 'missing_auth' });
  }

  const user = await verifySupabaseAccessToken(env.supabaseUrl, env.anonKey, token);
  if (!user) {
    return res.status(401).json({ error: 'invalid_auth' });
  }

  const sourceType = body.source_type as SourceType;
  const sourceId = typeof body.source_id === 'string' ? body.source_id : '';
  const force = body.force === true;

  if (sourceType !== 'writing' && sourceType !== 'listening') {
    return res.status(400).json({ error: 'invalid_source_type' });
  }
  if (!sourceId) {
    return res.status(400).json({ error: 'missing_source_id' });
  }

  const admin = createClient(env.supabaseUrl, env.serviceRoleKey);

  const { data: profile } = await admin
    .from('profiles')
    .select('role, status, is_locked')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.status !== 'active' || profile.is_locked === true) {
    return res.status(403).json({ error: 'account_not_active' });
  }
  if (profile.role !== 'student') {
    return res.status(403).json({ error: 'students_only' });
  }

  const { data: studentRow } = await admin
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!studentRow) {
    return res.status(403).json({ error: 'not_a_student' });
  }

  const callerStudentId = studentRow.id as string;

  if (!canStudentUseAiCoach(user.id)) {
    return res.status(403).json({
      error: 'ai_coach_locked',
      detail: AI_COACH_LOCKED_MESSAGE,
    });
  }

  if (!force) {
    const { data: existing } = await admin
      .from('ai_text_evaluations')
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .maybeSingle();

    if (existing) {
      return res.status(200).json(mapEvaluationRow(existing as Record<string, unknown>));
    }
  }

  const dayStart = startOfUtcDay();
  const { count: todayCount } = await admin
    .from('ai_text_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', callerStudentId)
    .gte('created_at', dayStart);

  if ((todayCount ?? 0) >= DAILY_EVAL_LIMIT) {
    return res.status(429).json({
      error: 'rate_limit',
      detail: `You can request up to ${DAILY_EVAL_LIMIT} AI checks per day. Try again tomorrow.`,
    });
  }

  let sourcePayload: SourcePayload | null;
  try {
    sourcePayload =
      sourceType === 'writing'
        ? await loadWritingSource(admin, sourceId)
        : await loadListeningSource(admin, sourceId);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'text_too_short') {
      return res.status(400).json({
        error: 'text_too_short',
        detail: 'Write at least 20 characters of typed text before requesting AI feedback.',
      });
    }
    if (msg === 'text_too_long') {
      return res.status(400).json({ error: 'text_too_long', detail: 'Text is too long for AI check.' });
    }
    throw e;
  }

  if (!sourcePayload) {
    return res.status(404).json({ error: 'source_not_found' });
  }

  if (sourcePayload.studentId !== callerStudentId) {
    return res.status(403).json({ error: 'not_your_submission' });
  }

  const studentContext = await loadStudentContext(admin, callerStudentId);
  if (!studentContext) {
    return res.status(500).json({ error: 'student_context_failed' });
  }

  let aiResult;
  try {
    aiResult = await evaluateStudentText(geminiKey, {
      sourceType,
      taskContext: sourcePayload.taskContext,
      studentText: sourcePayload.studentText,
      student: studentContext,
    });
  } catch (e) {
    const msg = (e as Error).message ?? 'evaluation_failed';
    const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    return res.status(isRateLimit ? 503 : 502).json({
      error: isRateLimit ? 'ai_busy' : 'evaluation_failed',
      detail: humanizeGeminiError(msg),
    });
  }

  const insertRow = {
    student_id: callerStudentId,
    source_type: sourceType,
    source_id: sourceId,
    input_snapshot: sourcePayload.studentText,
    overall_score: aiResult.overall_score,
    estimated_cefr: aiResult.estimated_cefr,
    summary: aiResult.summary,
    strengths: aiResult.strengths,
    improvements: aiResult.improvements,
    corrections: aiResult.corrections,
    coach_note: aiResult.coach_note,
    ai_model: aiResult.modelUsed,
  };

  if (force) {
    await admin
      .from('ai_text_evaluations')
      .delete()
      .eq('source_type', sourceType)
      .eq('source_id', sourceId);
  }

  const { data: saved, error: saveError } = await admin
    .from('ai_text_evaluations')
    .insert(insertRow)
    .select('*')
    .single();

  if (saveError) {
    return res.status(500).json({ error: 'save_failed', detail: saveError.message });
  }

  return res.status(200).json({
    ...mapEvaluationRow(saved as Record<string, unknown>),
    cached: false,
  });
}
