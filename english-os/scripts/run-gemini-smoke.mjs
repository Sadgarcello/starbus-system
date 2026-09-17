import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const env = fs.readFileSync('.env.vercel.prod', 'utf8');
const line = env.split(/\r?\n/).find((l) => l.startsWith('GEMINI_API_KEY='));
if (!line) {
  console.log('NO_GEMINI_LINE');
  process.exit(0);
}
const key = line.slice('GEMINI_API_KEY='.length).replace(/^"|"$/g, '').trim();
console.log('KEY_LEN', key.length);
if (key.length < 10) {
  console.log('KEY_EMPTY');
  process.exit(0);
}
spawnSync(process.execPath, ['scripts/test-gemini-eval.mjs', key], { stdio: 'inherit' });
