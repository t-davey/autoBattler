/** Seeded pseudo-random source (mulberry32). All randomness in a Battle flows through one Rng. */
export interface Rng {
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number): number => Math.floor(next() * maxExclusive);

  return {
    int,
    shuffle(items) {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [result[i], result[j]] = [result[j]!, result[i]!];
      }
      return result;
    },
  };
}
