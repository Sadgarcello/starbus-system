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

function projectRef(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return null;
  }
}

function mergeEnv() {
  const local = parseEnvFile(resolve(root, '.env'));
  const vercel = parseEnvFile(resolve(root, '.env.vercel.prod'));
  return { local, vercel };
}

async function queryStudents(label, url, serviceKey) {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, email, name, role, status')
    .eq('role', 'student')
    .ilike('name', '%test%')
    .limit(10);

  if (pErr) {
    console.log(`[${label}] profiles query failed:`, pErr.message);
    return;
  }

  console.log(`\n[${label}] student profiles matching "test" (${profiles?.length ?? 0}):`);
  for (const p of profiles ?? []) {
    const { data: student, error: sErr } = await admin
      .from('students')
      .select('id, user_id, level, exam_track')
      .eq('user_id', p.id)
      .maybeSingle();

    const status = sErr
      ? `ERROR: ${sErr.message}`
      : student
        ? `OK — students row exists (exam_track=${student.exam_track ?? 'null'})`
        : 'MISSING — no students row (not_a_student)';

    console.log(`  - ${p.name ?? '(no name)'} <${p.email}> role=${p.role} status=${p.status}`);
    console.log(`    user_id=${p.id}`);
    console.log(`    ${status}`);
  }

  const { count, error: cErr } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'student');

  const { count: studentCount, error: scErr } = await admin
    .from('students')
    .select('id', { count: 'exact', head: true });

  if (!cErr && !scErr) {
    console.log(`[${label}] totals: ${studentCount ?? 0} students rows / ${count ?? 0} student profiles`);
    if ((count ?? 0) > (studentCount ?? 0)) {
      console.log(`[${label}] WARNING: ${(count ?? 0) - (studentCount ?? 0)} student profile(s) lack a students row`);
    }
  }
}

async function main() {
  const check = parseEnvFile(resolve(root, '.env.vercel.check'));
  const { local, vercel } = mergeEnv();
  const localUrl = local.VITE_SUPABASE_URL;
  const vercelUrl =
    check.VITE_SUPABASE_URL ??
    check.SUPABASE_URL ??
    vercel.VITE_SUPABASE_URL ??
    vercel.SUPABASE_URL;
  const serviceKey =
    check.SUPABASE_SERVICE_ROLE_KEY ??
    vercel.SUPABASE_SERVICE_ROLE_KEY ??
    local.SUPABASE_SERVICE_ROLE_KEY ??
    parseEnvFile(resolve(root, '.env.vercel.local')).SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== Env comparison ===');
  console.log('local project ref:', projectRef(localUrl) ?? 'MISSING');
  console.log('vercel project ref:', projectRef(vercelUrl) ?? 'MISSING');
  console.log('URLs match:', localUrl && vercelUrl ? localUrl === vercelUrl : 'unknown');
  console.log('service role key available:', Boolean(serviceKey));

  if (!serviceKey) {
    console.log('\nNo SUPABASE_SERVICE_ROLE_KEY — cannot query DB. Add it to .env locally.');
    process.exit(1);
  }

  const url = vercelUrl ?? localUrl;
  if (!url) {
    console.log('\nNo Supabase URL found.');
    process.exit(1);
  }

  await queryStudents('production-env', url, serviceKey);

  if (localUrl && vercelUrl && localUrl !== vercelUrl && local.SUPABASE_SERVICE_ROLE_KEY) {
    await queryStudents('local-env', localUrl, local.SUPABASE_SERVICE_ROLE_KEY);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
