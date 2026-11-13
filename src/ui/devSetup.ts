import { CLASS_IDS, type GameSetup, type HeroId } from '../sim';

/** Reads a dev build's ?seed=, ?start=guardian, ?level=, and ?party=a,b,c into a setup. */
export function devSetup(search: string, fresh: GameSetup): GameSetup {
  const query = new URLSearchParams(search);
  const seed = Number(query.get('seed') ?? fresh.seed);
  const level = Number(query.get('level'));
  const party = query.get('party')?.split(',') as HeroId[] | undefined;
  return {
    seed: Number.isInteger(seed) ? seed : fresh.seed,
    scenario: {
      ...(Number.isInteger(level) && level >= 1 ? { heroLevel: level } : {}),
      ...(query.get('start') === 'guardian' ? { startAt: { floor: 5, room: 'guardian' } } : {}),
      ...(party?.length === 3 && new Set(party).size === 3 && party.every((id) => CLASS_IDS.includes(id)) ? { party } : {}),
    },
  };
}
