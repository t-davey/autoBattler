import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SIM_ROOT = import.meta.dirname;

// Types can't catch these: both exist in the DOM-free lib that tsconfig.sim.json uses.
const FORBIDDEN_GLOBALS = [/\bMath\.random\b/, /\bDate\b/];
const IMPORT_SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g;

const sources = readdirSync(SIM_ROOT, { recursive: true, encoding: 'utf8' }).filter(
  (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
);

const staysInsideSim = (file: string, specifier: string): boolean => {
  const target = resolve(dirname(join(SIM_ROOT, file)), specifier);
  return specifier.startsWith('.') && !relative(SIM_ROOT, target).startsWith('..');
};

describe('src/sim purity (docs/adr/0001)', () => {
  it.each(sources)('%s uses only seeded randomness', (file) => {
    const source = readFileSync(join(SIM_ROOT, file), 'utf8');
    for (const pattern of FORBIDDEN_GLOBALS) expect(source).not.toMatch(pattern);
  });

  it.each(sources)('%s imports only from src/sim', (file) => {
    const source = readFileSync(join(SIM_ROOT, file), 'utf8');
    const escaping = [...source.matchAll(IMPORT_SPECIFIER)]
      .map(([, specifier]) => specifier as string)
      .filter((specifier) => !staysInsideSim(file, specifier));
    expect(escaping).toEqual([]);
  });
});
