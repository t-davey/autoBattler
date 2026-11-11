import { PICK_IDS, PICKS, picksFor, type PickMoment, type PickTag } from '../sim';

export const TAG_TEXT: Readonly<Record<PickTag, string>> = {
  guardian: 'Guardian',
  poison: 'Poison',
  stacking: 'Stacking',
  power: 'Power',
  armour: 'Armour',
  crit: 'Critical chance',
};

const MOMENT_TEXT: Readonly<Record<PickMoment, string>> = {
  setOut: 'when setting out',
  guardian: 'before a Guardian',
};

const MOMENTS: readonly PickMoment[] = ['setOut', 'guardian'];

/** One line per Pick that carries this tag: what it does, and when it can be offered. */
export function describeTag(tag: PickTag): readonly string[] {
  return PICK_IDS.filter((id) => (PICKS[id].tags as readonly PickTag[]).includes(tag)).map((id) => {
    const { name, line } = PICKS[id];
    const when = MOMENTS.filter((moment) => picksFor(moment).includes(id)).map((moment) => MOMENT_TEXT[moment]);
    return `${name}: ${line}, offered ${when.join(' or ')}`;
  });
}
