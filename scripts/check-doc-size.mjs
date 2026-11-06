// Fails when a tracked or new Markdown file outgrows what an agent can afford to read.
// AGENTS.md loads on every turn. Other docs load whole on a single Read, so past
// their limit they belong behind pointers: see docs/plans/poc-demo.md for the shape.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_LIMIT_KB = 32;
const LIMITS_KB = { 'AGENTS.md': 4 };

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '*.md'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter((file) => file && existsSync(file));

const tooLarge = files.flatMap((file) => {
  const limitKb = LIMITS_KB[file] ?? DEFAULT_LIMIT_KB;
  const sizeKb = statSync(file).size / 1024;
  return sizeKb > limitKb ? [`${file}: ${sizeKb.toFixed(1)} KB, limit ${limitKb} KB`] : [];
});

if (tooLarge.length > 0) {
  console.error(`Docs over their size limit. Retire finished content or split it by reader:\n${tooLarge.join('\n')}`);
  process.exit(1);
}
console.log(`${files.length} docs within their size limits.`);
