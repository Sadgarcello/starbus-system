import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] ?? '.env.vercel.check';
const path = resolve(root, file);
if (!existsSync(path)) {
  console.log(file, 'missing');
  process.exit(1);
}
const t = readFileSync(path, 'utf8');
for (const k of ['VITE_SUPABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  const m = t.match(new RegExp(`^${k}=(.*)$`, 'm'));
  const v = m ? m[1].trim().replace(/^"|"$/g, '') : '';
  const ref = v.startsWith('https://') ? v.slice(8).split('.')[0] : 'n/a';
  console.log(`${k}: length=${v.length}${v ? ` ref=${ref}` : ' EMPTY'}`);
}
