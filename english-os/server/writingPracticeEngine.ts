import type { SupabaseClient } from '@supabase/supabase-js';
import { assertToeflStudent } from './readingPracticeEngine.js';
import { gradeBuildSentence } from './writingPractice/buildSentence.js';
import { analyzeExtendedWritingPair } from './writingPractice/geminiWritingEval.js';
import { punctuationScoreFromErrors, scanPunctuation } from './writingPractice/punctuationScan.js';
import {
  mergeRecurring,
  recurringSummaryForPrompt,
  tallyErrors,
  topRecurring,
} from './writingPractice/recurringErrors.js';
import type { DiagnosticReport, WritingQuotaInfo } from './writingPractice/types.js';
import {
  assertCanStartWritingTest,
  getWritingQuota,
} from './writingPractice/usageLimit.js';

export { assertToeflStudent, getWritingQuota };

const TOTAL_ITEMS = 12;

interface ItemPlanEntry {
  index: number;
  type: 'BUILD_SENTENCE' | 'EMAIL' | 'ACADEMIC_DISCUSSION';
  id: string;
}

async function buildItemPlan(admin: SupabaseClient): Promise<ItemPlanEntry[]> {
  const [{ data: buildItems }, { data: emailTasks }, { data: discussions }] = await Promise.all([
    admin
      .from('writing_build_sentence_items')
      .select('id')
      .eq('active', true)
      .order('order_hint', { ascending: true })
      .order('difficulty', { ascending: true })
      .limit(10),
    admin.from('writing_email_tasks').select('id').eq('active', true).limit(5),
    admin.from('writing_academic_discussions').select('id').eq('active', true).limit(5),
  ]);

  if ((buildItems?.length ?? 0) < 10) throw new Error('insufficient_build_sentence_content');
  if (!emailTasks?.length) throw new Error('insufficient_email_content');
  if (!discussions?.length) throw new Error('insufficient_discussion_content');

  const email = emailTasks[Math.floor(Math.random() * emailTasks.length)]!;
  const discussion = discussions[Math.floor(Math.random() * discussions.length)]!;

  const plan: ItemPlanEntry[] = buildItems!.map((b, i) => ({
    index: i,
    type: 'BUILD_SENTENCE',
    id: b.id as string,
  }));
  plan.push({ index: 10, type: 'EMAIL', id: email.id as string });
  plan.push({ index: 11, type: 'ACADEMIC_DISCUSSION', id: discussion.id as string });
  return plan;
}

export async function startWritingDiagnostic(
  admin: SupabaseClient,
  studentId: string,
): Promise<{ sessionId: string; quota: WritingQuotaInfo; item: StudentWritingItemPayload }> {
  const quota = await assertCanStartWritingTest(admin, studentId);
  const plan = await buildItemPlan(admin);

  const { data: session, error } = await admin
    .from('writing_diagnostic_sessions')
    .insert({
      student_id: studentId,
      item_plan: plan,
      status: 'active',
      current_index: 0,
    })
    .select('*')
    .single();
  if (error) throw error;

  const item = await loadItemPayload(admin, plan[0]!, 0);
  return { sessionId: session.id as string, quota, item };
}

export interface StudentWritingItemPayload {
  itemIndex: number;
  totalItems: number;
  itemType: ItemPlanEntry['type'];
  timeLimitSeconds: number;
  buildSentence?: Record<string, unknown>;
  email?: Record<string, unknown>;
  discussion?: Record<string, unknown>;
}

async function loadItemPayload(
  admin: SupabaseClient,
  entry: ItemPlanEntry,
  itemIndex: number,
): Promise<StudentWritingItemPayload> {
  const base: StudentWritingItemPayload = {
    itemIndex,
    totalItems: TOTAL_ITEMS,
    itemType: entry.type,
    timeLimitSeconds: 1380,
  };

  if (entry.type === 'BUILD_SENTENCE') {
    const { data } = await admin
      .from('writing_build_sentence_items')
      .select('id, prompt, word_bank, difficulty')
      .eq('id', entry.id)
      .single();
    if (!data) throw new Error('item_not_found');
    const bank = (data.word_bank as string[]) ?? [];
    const shuffled = [...bank].sort(() => Math.random() - 0.5);
    return {
      ...base,
      buildSentence: {
        itemId: data.id,
        prompt: data.prompt,
        wordBank: shuffled,
      },
    };
  }

  if (entry.type === 'EMAIL') {
    const { data } = await admin.from('writing_email_tasks').select('*').eq('id', entry.id).single();
    if (!data) throw new Error('item_not_found');
    return {
      ...base,
      email: {
        itemId: data.id,
        scenario: data.scenario,
        audience: data.audience,
        purpose: data.purpose,
        instructions: data.instructions,
        requiredComponents: data.required_components,
      },
    };
  }

  const { data } = await admin
    .from('writing_academic_discussions')
    .select('*')
    .eq('id', entry.id)
    .single();
  if (!data) throw new Error('item_not_found');
  return {
    ...base,
    discussion: {
      itemId: data.id,
      professorPrompt: data.professor_prompt,
      discussionQuestion: data.discussion_question,
      participantOneName: data.participant_one_name,
      participantOneResponse: data.participant_one_response,
      participantTwoName: data.participant_two_name,
      participantTwoResponse: data.participant_two_response,
      taskInstruction: data.task_instruction,
    },
  };
}

export async function saveWritingDraft(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
  itemIndex: number,
  responseText: string,
): Promise<void> {
  const session = await loadSession(admin, studentId, sessionId);
  const drafts = { ...(session.draft_responses as Record<string, string>) };
  drafts[String(itemIndex)] = responseText;
  await admin
    .from('writing_diagnostic_sessions')
    .update({ draft_responses: drafts, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

export async function submitWritingItem(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
  itemIndex: number,
  responseText: string,
): Promise<{ item: StudentWritingItemPayload | null; finished: boolean }> {
  const session = await loadSession(admin, studentId, sessionId);
  const plan = session.item_plan as ItemPlanEntry[];
  const entry = plan.find((p) => p.index === itemIndex);
  if (!entry) throw new Error('invalid_item_index');

  let buildResult = null;
  if (entry.type === 'BUILD_SENTENCE') {
    const { data: item } = await admin
      .from('writing_build_sentence_items')
      .select('target_sentence, accepted_variants')
      .eq('id', entry.id)
      .single();
    if (!item) throw new Error('item_not_found');
    buildResult = gradeBuildSentence({
      studentSentence: responseText,
      targetSentence: item.target_sentence as string,
      acceptedVariants: (item.accepted_variants as string[]) ?? [],
    });
  }

  await admin.from('writing_diagnostic_attempts').upsert(
    {
      session_id: sessionId,
      student_id: studentId,
      item_index: itemIndex,
      item_type: entry.type,
      item_id: entry.id,
      response_text: responseText,
      build_result: buildResult,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'session_id,item_index' },
  );

  const nextIndex = itemIndex + 1;
  if (nextIndex >= TOTAL_ITEMS) {
    return { item: null, finished: true };
  }

  await admin
    .from('writing_diagnostic_sessions')
    .update({ current_index: nextIndex, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  const nextEntry = plan.find((p) => p.index === nextIndex)!;
  const item = await loadItemPayload(admin, nextEntry, nextIndex);
  return { item, finished: false };
}

async function loadSession(admin: SupabaseClient, studentId: string, sessionId: string) {
  const { data } = await admin
    .from('writing_diagnostic_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (!data || data.status !== 'active') throw new Error('invalid_session');
  return data;
}

export async function finishWritingDiagnostic(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
): Promise<DiagnosticReport> {
  const { data: session } = await admin
    .from('writing_diagnostic_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (!session) throw new Error('invalid_session');

  const existingReport = session.diagnostic_report as DiagnosticReport | null;
  if (existingReport && session.status === 'completed') {
    return existingReport;
  }

  const { data: existingAi } = await admin
    .from('writing_ai_analyses')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();

  const { data: attempts } = await admin
    .from('writing_diagnostic_attempts')
    .select('*')
    .eq('session_id', sessionId)
    .order('item_index', { ascending: true });

  const list = attempts ?? [];
  if (list.length < TOTAL_ITEMS) throw new Error('incomplete_session');

  const buildResults = list
    .filter((a) => a.item_type === 'BUILD_SENTENCE')
    .map((a) => a.build_result)
    .filter(Boolean);
  const buildCorrect = buildResults.filter((r) => (r as { correct: boolean }).correct).length;
  const buildSentencePercent = Math.round((buildCorrect / 10) * 100);

  const emailAttempt = list.find((a) => a.item_type === 'EMAIL');
  const discussionAttempt = list.find((a) => a.item_type === 'ACADEMIC_DISCUSSION');
  const emailText = (emailAttempt?.response_text as string) ?? '';
  const discussionText = (discussionAttempt?.response_text as string) ?? '';

  let aiStatus: DiagnosticReport['aiStatus'] = 'pending';
  let emailPercent = 0;
  let discussionPercent = 0;
  let allErrors: import('./writingPractice/types.js').WritingErrorItem[] = [];
  let strengths: string[] = [];
  let topWeaknesses: string[] = [];
  let languageProfile: Record<string, number> = {};
  let writingSkills: Record<string, number> = {};
  let aiMessage: string | undefined;

  if (existingAi) {
    aiStatus = 'complete';
    emailPercent = Number((existingAi.email_analysis as { taskScorePercent?: number })?.taskScorePercent ?? 0);
    discussionPercent = Number(
      (existingAi.discussion_analysis as { taskScorePercent?: number })?.taskScorePercent ?? 0,
    );
    allErrors = (existingAi.combined_errors as typeof allErrors) ?? [];
    strengths = (existingAi.strengths as string[]) ?? [];
    topWeaknesses = ((existingAi.priorities as string[]) ?? []).slice(0, 3);
    languageProfile = (existingAi.dimension_scores as Record<string, number>) ?? {};
    writingSkills = languageProfile;
  } else {
    await admin
      .from('writing_diagnostic_sessions')
      .update({ ai_status: 'processing' })
      .eq('id', sessionId);

    const { data: profileRow } = await admin
      .from('writing_diagnostic_profiles')
      .select('recurring_errors')
      .eq('student_id', studentId)
      .maybeSingle();
    const recurring = (profileRow?.recurring_errors as Record<string, number>) ?? {};
    const recurringSummary = recurringSummaryForPrompt(recurring);

    const emailTask = emailAttempt
      ? await admin
          .from('writing_email_tasks')
          .select('*')
          .eq('id', emailAttempt.item_id)
          .single()
      : { data: null };
    const discTask = discussionAttempt
      ? await admin
          .from('writing_academic_discussions')
          .select('*')
          .eq('id', discussionAttempt.item_id)
          .single()
      : { data: null };

    try {
      const punctEmail = scanPunctuation(emailText);
      const punctDisc = scanPunctuation(discussionText);

      const gemini = await analyzeExtendedWritingPair({
        email: {
          taskType: 'EMAIL',
          studentText: emailText,
          recurringSummary,
          taskPrompt: formatEmailPrompt(emailTask.data),
        },
        discussion: {
          taskType: 'ACADEMIC_DISCUSSION',
          studentText: discussionText,
          recurringSummary,
          taskPrompt: formatDiscussionPrompt(discTask.data),
        },
      });

      emailPercent = gemini.email.taskScorePercent;
      discussionPercent = gemini.discussion.taskScorePercent;
      allErrors = [...gemini.email.errors, ...gemini.discussion.errors, ...punctEmail, ...punctDisc];
      strengths = [...gemini.email.strengths, ...gemini.discussion.strengths].slice(0, 4);
      topWeaknesses = [...gemini.email.topPriorities, ...gemini.discussion.topPriorities].slice(0, 3);

      languageProfile = averageDimensions(gemini.email.dimensionScores, gemini.discussion.dimensionScores);
      languageProfile.PUNCTUATION = Math.round(
        (punctuationScoreFromErrors(punctEmail.length, wordCount(emailText)) +
          punctuationScoreFromErrors(punctDisc.length, wordCount(discussionText))) /
          2,
      );
      writingSkills = {
        TASK_COMPLETION: avg([languageProfile.TASK_COMPLETION, languageProfile.RELEVANCE]),
        ORGANIZATION: languageProfile.ORGANIZATION ?? 70,
        DEVELOPMENT: languageProfile.DEVELOPMENT ?? 70,
        COHESION: languageProfile.COHESION ?? 70,
        REGISTER: languageProfile.REGISTER ?? 70,
        CLARITY: languageProfile.CLARITY ?? 70,
      };

      await admin.from('writing_ai_analyses').insert({
        session_id: sessionId,
        student_id: studentId,
        input_hash: gemini.inputHash,
        email_analysis: gemini.email,
        discussion_analysis: gemini.discussion,
        combined_errors: allErrors,
        dimension_scores: languageProfile,
        exercises: [...gemini.email.exercises, ...gemini.discussion.exercises],
        strengths,
        priorities: topWeaknesses,
        model_used: gemini.modelUsed,
      });

      aiStatus = 'complete';
      await admin
        .from('writing_diagnostic_sessions')
        .update({ ai_status: 'complete' })
        .eq('id', sessionId);
    } catch (e) {
      aiStatus = 'failed';
      aiMessage = (e as Error).message;
      await admin
        .from('writing_diagnostic_sessions')
        .update({ ai_status: 'failed', ai_error: aiMessage })
        .eq('id', sessionId);
    }
  }

  const diagnosticScore = Math.round(
    buildSentencePercent * 0.35 + emailPercent * 0.325 + discussionPercent * 0.325,
  );
  const estimatedCefr = scoreToCefr(diagnosticScore);

  const buildSentenceItems = list
    .filter((a) => a.item_type === 'BUILD_SENTENCE')
    .map((a) => a.build_result)
    .filter(Boolean) as DiagnosticReport['buildSentenceItems'];

  const report: DiagnosticReport = {
    sessionId,
    diagnosticScore,
    estimatedCefr,
    buildSentencePercent,
    emailPercent,
    discussionPercent,
    languageProfile,
    writingSkills,
    topWeaknesses,
    strengths,
    buildSentenceItems,
    errors: allErrors.slice(0, 30),
    aiStatus,
    aiMessage,
    recurringHighlights: [],
    emailResponse: emailText,
    discussionResponse: discussionText,
  };

  if (aiStatus === 'complete') {
    const delta = tallyErrors(allErrors);
    const { data: prof } = await admin
      .from('writing_diagnostic_profiles')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();
    const merged = mergeRecurring((prof?.recurring_errors as Record<string, number>) ?? {}, delta);
    report.recurringHighlights = topRecurring(merged, 5);

    const history = (prof?.history_scores as number[]) ?? [];
    history.push(diagnosticScore);

    await admin.from('writing_diagnostic_profiles').upsert(
      {
        student_id: studentId,
        recurring_errors: merged,
        attempt_count: (prof?.attempt_count ?? 0) + 1,
        last_score: diagnosticScore,
        last_estimated_cefr: estimatedCefr,
        history_scores: history.slice(-20),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id' },
    );
  }

  if (!session.counts_toward_limit) {
    await admin.from('writing_test_completions').upsert(
      { student_id: studentId, session_id: sessionId, completed_at: new Date().toISOString() },
      { onConflict: 'session_id' },
    );
  }

  await admin
    .from('writing_diagnostic_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      diagnostic_report: report,
      diagnostic_score: diagnosticScore,
      estimated_cefr: estimatedCefr,
      counts_toward_limit: true,
    })
    .eq('id', sessionId);

  return report;
}

export async function getWritingReport(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string,
): Promise<DiagnosticReport> {
  const { data: session } = await admin
    .from('writing_diagnostic_sessions')
    .select('diagnostic_report, student_id, status')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session || session.student_id !== studentId) throw new Error('report_not_found');
  const report = session.diagnostic_report as DiagnosticReport | null;
  if (!report) throw new Error('report_not_ready');
  return report;
}

function formatEmailPrompt(row: Record<string, unknown> | null): string {
  if (!row) return '';
  return `${row.scenario}\nAudience: ${row.audience}\nPurpose: ${row.purpose}\nInstructions: ${row.instructions}\nRequired: ${JSON.stringify(row.required_components)}`;
}

function formatDiscussionPrompt(row: Record<string, unknown> | null): string {
  if (!row) return '';
  return `${row.professor_prompt}\nQuestion: ${row.discussion_question}\n${row.participant_one_name}: ${row.participant_one_response}\n${row.participant_two_name}: ${row.participant_two_response}\nTask: ${row.task_instruction}`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function averageDimensions(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, number> = {};
  for (const k of keys) {
    out[k] = Math.round(((Number(a[k] ?? 0) + Number(b[k] ?? 0)) / 2) * 10) / 10;
  }
  return out;
}

function avg(nums: number[]): number {
  const valid = nums.filter((n) => !Number.isNaN(n));
  if (!valid.length) return 0;
  return Math.round(valid.reduce((s, n) => s + n, 0) / valid.length);
}

function scoreToCefr(score: number): string {
  if (score >= 85) return 'C1';
  if (score >= 72) return 'B2';
  if (score >= 58) return 'B1';
  if (score >= 42) return 'A2';
  return 'A1';
}
