import { isNumber, isRecord } from './guards';

/** Seeded pseudo-random source (mulberry32). Plain data, so it saves with the state it drives. */
export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/** A number in [0, 1). */
export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** An integer in [0, maxExclusive). */
export function nextInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(nextFloat(rng) * maxExclusive);
}

export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Saved data that is an Rng. */
export const isRng = (value: unknown): boolean => isRecord(value) && isNumber(value['state']);
