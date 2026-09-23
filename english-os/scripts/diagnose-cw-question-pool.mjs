import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const local = parseEnvFile(resolve(root, '.env'));
const vercel = parseEnvFile(resolve(root, '.env.vercel.prod'));
const url =
  vercel.VITE_SUPABASE_URL ??
  vercel.SUPABASE_URL ??
  local.VITE_SUPABASE_URL ??
  local.SUPABASE_URL;
const serviceKey =
  vercel.SUPABASE_SERVICE_ROLE_KEY ??
  local.SUPABASE_SERVICE_ROLE_KEY ??
  parseEnvFile(resolve(root, '.env.vercel.local')).SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE URL or service role key in env files.');
  process.exit(1);
}

// Mirror server/readingPractice/completeWords.ts blank counting (simplified import via dynamic eval)
const { buildCompleteWordsTask, DEFAULT_MASK_BLANK_COUNT } = await import(
  '../server/readingPractice/completeWords.ts'
);

const DIFFICULTY_POOLS = [
  { pool: 1, min: 1, max: 3 },
  { pool: 2, min: 3, max: 5 },
  { pool: 3, min: 5, max: 6 },
  { pool: 4, min: 6, max: 7 },
  { pool: 5, min: 7, max: 8 },
  { pool: 6, min: 8, max: 10 },
];

function clampSessionDifficulty(value) {
  return Math.min(10, Math.max(1, Math.round(value)));
}

function poolForDifficulty(difficulty) {
  const d = clampSessionDifficulty(difficulty);
  for (const pool of DIFFICULTY_POOLS) {
    if (d >= pool.min && d <= pool.max) return pool;
  }
  return d <= 3 ? DIFFICULTY_POOLS[0] : DIFFICULTY_POOLS[DIFFICULTY_POOLS.length - 1];
}

function difficultyInPool(difficulty, pool) {
  return difficulty >= pool.min && difficulty <= pool.max;
}

function pickRandomCandidate(candidates) {
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function selectCompleteWordsByPool(candidates, sessionDifficulty, sessionQuestionIds, recentQuestionIds) {
  const targetDifficulty = clampSessionDifficulty(sessionDifficulty);
  const exclude = new Set([...sessionQuestionIds, ...recentQuestionIds]);
  let pool = poolForDifficulty(targetDifficulty);
  let cw = candidates.filter((c) => c.questionType === 'COMPLETE_WORDS' && !exclude.has(c.questionId));

  let usedFallback = false;
  if (cw.length === 0) {
    usedFallback = true;
    cw = candidates.filter(
      (c) => c.questionType === 'COMPLETE_WORDS' && !sessionQuestionIds.includes(c.questionId),
    );
  }
  if (cw.length === 0) return { pick: null, usedFallback };

  const pickFromPool = (p) => cw.filter((c) => difficultyInPool(c.difficulty, p));
  let poolCandidates = pickFromPool(pool);

  if (poolCandidates.length === 0) {
    const idx = DIFFICULTY_POOLS.findIndex((p) => p.pool === pool.pool);
    for (const offset of [1, -1, 2, -2, 3]) {
      const neighbor = DIFFICULTY_POOLS[idx + offset];
      if (!neighbor) continue;
      poolCandidates = pickFromPool(neighbor);
      if (poolCandidates.length > 0) {
        pool = neighbor;
        break;
      }
    }
  }

  if (poolCandidates.length === 0) poolCandidates = cw;

  const exactMatches = poolCandidates.filter((c) => c.difficulty === targetDifficulty);
  const pick =
    exactMatches.length > 0
      ? pickRandomCandidate(exactMatches)
      : pickRandomCandidate(
          poolCandidates.filter(
            (c) =>
              Math.abs(c.difficulty - targetDifficulty) ===
              Math.abs(poolCandidates[0].difficulty - targetDifficulty),
          ),
        );

  return { pick, usedFallback, exactPoolSize: exactMatches.length, eligibleAfterExclude: cw.length };
}

function adjustDifficulty(current, passageScore) {
  if (passageScore >= 85) return clampSessionDifficulty(current + 1);
  if (passageScore >= 50) return current;
  return clampSessionDifficulty(current - 1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: rows, error } = await admin
  .from('complete_words_questions')
  .select('id, sentence, difficulty, active')
  .eq('active', true);

if (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
}

const all = rows ?? [];
const byDifficulty = new Map();
const validCandidates = [];
const invalid = [];
const sentenceToIds = new Map();

for (const q of all) {
  const d = Number(q.difficulty);
  byDifficulty.set(d, (byDifficulty.get(d) ?? 0) + 1);

  const task = buildCompleteWordsTask(q.sentence);
  const blankCount = task.blanks.length;
  const sentenceKey = q.sentence.trim().toLowerCase();
  if (!sentenceToIds.has(sentenceKey)) sentenceToIds.set(sentenceKey, []);
  sentenceToIds.get(sentenceKey).push(q.id);

  if (blankCount === DEFAULT_MASK_BLANK_COUNT) {
    validCandidates.push({
      questionId: q.id,
      questionType: 'COMPLETE_WORDS',
      difficulty: d,
    });
  } else {
    invalid.push({ id: q.id, difficulty: d, blankCount });
  }
}

console.log('\n=== Complete the Words pool audit ===\n');
console.log(`Active in DB: ${all.length}`);
console.log(`Valid (exactly ${DEFAULT_MASK_BLANK_COUNT} blanks): ${validCandidates.length}`);
console.log(`Invalid blank count (still in candidate pool until fetch fails): ${invalid.length}`);

console.log('\nPer difficulty (active rows):');
for (const d of [...byDifficulty.keys()].sort((a, b) => a - b)) {
  const validAtD = validCandidates.filter((c) => c.difficulty === d).length;
  console.log(`  difficulty ${d}: ${byDifficulty.get(d)} total, ${validAtD} playable`);
}

const dupSentences = [...sentenceToIds.entries()].filter(([, ids]) => ids.length > 1);
if (dupSentences.length > 0) {
  console.log(`\nDuplicate sentence text: ${dupSentences.length} groups`);
  for (const [text, ids] of dupSentences.slice(0, 5)) {
    console.log(`  ${ids.length}x: "${text.slice(0, 80)}..."`);
  }
} else {
  console.log('\nNo duplicate sentence text among active questions.');
}

if (invalid.length > 0) {
  console.log('\nInvalid passages (sample):');
  for (const row of invalid.slice(0, 8)) {
    console.log(`  ${row.id.slice(0, 8)}… diff=${row.difficulty} blanks=${row.blankCount}`);
  }
}

// Simulate 10-question placement sessions using ONLY valid candidates (best case)
function simulateSession(candidates, startDifficulty = 1, recentQuestionIds = []) {
  const sessionIds = [];
  let difficulty = startDifficulty;
  let fallbackHits = 0;
  const picks = [];

  for (let i = 0; i < 10; i++) {
    const { pick, usedFallback, exactPoolSize, eligibleAfterExclude } = selectCompleteWordsByPool(
      candidates,
      difficulty,
      sessionIds,
      recentQuestionIds,
    );
    if (!pick) return { error: 'no_pick', picks, sessionIds };
    if (usedFallback) fallbackHits++;
    picks.push({ id: pick.questionId, difficulty, exactPoolSize, eligibleAfterExclude });
    sessionIds.push(pick.questionId);
    recentQuestionIds = [pick.questionId, ...recentQuestionIds].slice(0, 10);
    difficulty = adjustDifficulty(difficulty, 70);
  }

  const unique = new Set(sessionIds);
  return {
    duplicatesInSession: sessionIds.length - unique.size,
    fallbackHits,
    sessionIds,
    picks,
  };
}

console.log('\n=== Simulation (valid candidates only, 500 sessions) ===');
let sessionsWithDup = 0;
let totalFallback = 0;
for (let i = 0; i < 500; i++) {
  const r = simulateSession(validCandidates);
  if (r.duplicatesInSession > 0) sessionsWithDup++;
  totalFallback += r.fallbackHits;
}
console.log(`Sessions with duplicate within 10 questions: ${sessionsWithDup}/500`);
console.log(`Total fallback-to-recent-pool hits: ${totalFallback}`);

// Simulate including invalid candidates (what server actually does)
console.log('\n=== Simulation (all active DB rows as candidates, 500 sessions) ===');
const allCandidates = all.map((q) => ({
  questionId: q.id,
  questionType: 'COMPLETE_WORDS',
  difficulty: Number(q.difficulty),
}));
let sessionsWithDupAll = 0;
for (let i = 0; i < 500; i++) {
  const r = simulateSession(allCandidates);
  if (r.duplicatesInSession > 0) sessionsWithDupAll++;
}
console.log(`Sessions with duplicate within 10 questions: ${sessionsWithDupAll}/500`);

// Cross-session repeat rate after 3 back-to-back tests
console.log('\n=== Cross-session repeat check (3 tests in a row, HISTORY window=10) ===');
let recent = [];
const seenAcross = [];
for (let test = 0; test < 3; test++) {
  const r = simulateSession(validCandidates, 1, recent);
  seenAcross.push(...r.sessionIds);
  recent = r.sessionIds.concat(recent).slice(0, 10);
}
const firstTest = seenAcross.slice(0, 10);
const thirdTest = seenAcross.slice(20, 30);
const overlap = thirdTest.filter((id) => firstTest.includes(id));
console.log(`Test 3 repeats from test 1: ${overlap.length}/10 (expected with 10-history window)`);

// Show effective pool at difficulty 1
const atDiff1 = validCandidates.filter((c) => c.difficulty === 1);
console.log(`\nAt session difficulty 1, exact-match playable pool size: ${atDiff1.length}`);
