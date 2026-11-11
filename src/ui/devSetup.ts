import type { GameSetup } from '../sim';

/** Reads a dev build's ?seed=, ?start=guardian, and ?level= into a setup. */
export function devSetup(search: string, fresh: GameSetup): GameSetup {
  const query = new URLSearchParams(search);
  const seed = Number(query.get('seed') ?? fresh.seed);
  const level = Number(query.get('level'));
  return {
    seed: Number.isInteger(seed) ? seed : fresh.seed,
    scenario: {
      ...(Number.isInteger(level) && level >= 1 ? { heroLevel: level } : {}),
      ...(query.get('start') === 'guardian' ? { startAt: { floor: 5, room: 'guardian' } } : {}),
    },
  };
}
