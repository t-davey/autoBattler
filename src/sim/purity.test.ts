import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Types can't catch these: Math.random and Date exist in the DOM-free lib that tsconfig.sim.json uses.
const FORBIDDEN = [/\bMath\.random\b/, /\bDate\b/, /\bperformance\b/, /from\s+['"]\.\.\//, /from\s+['"]node:/];

const sources = readdirSync(import.meta.dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

describe('src/sim purity (docs/adr/0001)', () => {
  it.each(sources)('%s uses only seeded randomness and sim-local imports', (file) => {
    const source = readFileSync(join(import.meta.dirname, file), 'utf8');
    for (const pattern of FORBIDDEN) expect(source).not.toMatch(pattern);
  });
});
