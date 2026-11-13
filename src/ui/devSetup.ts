import { isPartyChoice, type GameSetup } from '../sim';

/** Reads a dev build's ?seed=, ?start=guardian, ?level=, and ?party=a,b,c into a setup. ?party= replaces the setup's own. */
export function devSetup(search: string, fresh: GameSetup): GameSetup {
  const query = new URLSearchParams(search);
  const seed = Number(query.get('seed') ?? fresh.seed);
  const level = Number(query.get('level'));
  const party = query.get('party')?.split(',') ?? [];
  return {
    seed: Number.isInteger(seed) ? seed : fresh.seed,
    ...(isPartyChoice(party) ? { party } : fresh.party ? { party: fresh.party } : {}),
    scenario: {
      ...(Number.isInteger(level) && level >= 1 ? { heroLevel: level } : {}),
      ...(query.get('start') === 'guardian' ? { startAt: { floor: 5, room: 'guardian' } } : {}),
    },
  };
}
