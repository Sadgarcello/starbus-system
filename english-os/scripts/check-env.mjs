import fs from 'fs';

const t = fs.readFileSync('.env.vercel.prod', 'utf8');
for (const k of [
  'GEMINI_API_KEY',
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
]) {
  const m = t.match(new RegExp(`^${k}=(.*)$`, 'm'));
  const v = m ? m[1].trim() : '';
  let s = 'MISSING';
  if (v) {
    const unquoted =
      (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
        ? v.slice(1, -1)
        : v;
    s = unquoted.length === 0 ? 'EMPTY' : `SET len=${unquoted.length}`;
  }
  console.log(`${k}: ${s}`);
}
