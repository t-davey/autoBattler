import { isPartyChoice, MAX_DEPTH, type GameSetup } from '../sim';

/**
 * Reads a dev build's ?seed=, ?floor= (a depth, 1–60), ?start=guardian (that Floor's Guardian, or Floor 5's), ?level=, and
 * ?party=a,b,c into a setup. ?party= replaces the setup's own.
 */
export function devSetup(search: string, fresh: GameSetup): GameSetup {
  const query = new URLSearchParams(search);
  const seed = Number(query.get('seed') ?? fresh.seed);
  const level = Number(query.get('level'));
  const depth = Number(query.get('floor'));
  const floor = Number.isInteger(depth) && depth >= 1 && depth <= MAX_DEPTH ? depth : undefined;
  const party = query.get('party')?.split(',') ?? [];
  return {
    seed: Number.isInteger(seed) ? seed : fresh.seed,
    ...(isPartyChoice(party) ? { party } : fresh.party ? { party: fresh.party } : {}),
    scenario: {
      ...(Number.isInteger(level) && level >= 1 ? { heroLevel: level } : {}),
      ...(query.get('start') === 'guardian' ? { startAt: { floor: floor ?? 5, room: 'guardian' } } : floor ? { startAt: { floor, room: 0 } } : {}),
    },
  };
}
