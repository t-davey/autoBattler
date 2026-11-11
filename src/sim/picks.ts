import type { UnitSpec } from './battle';
import { OFFERS_PER_PICK, PICK_TAGS, PICKS, picksFor, type PickId, type PickMoment, type PickTag } from './content/picks';
import { shuffled, type Rng } from './rng';

export interface PickView {
  readonly id: PickId;
  readonly name: string;
  readonly line: string;
  readonly placeholder: boolean;
}

export const viewPick = (id: PickId): PickView => {
  const { name, line, placeholder } = PICKS[id];
  return { id, name, line, placeholder };
};

/** How highly a rule ranks an offer: by its best tag, lower first. Untagged by the rule ranks last. */
function rankOf(id: PickId, priority: readonly PickTag[]): number {
  const ranks = PICKS[id].tags.map((tag) => priority.indexOf(tag)).filter((rank) => rank >= 0);
  return ranks.length > 0 ? Math.min(...ranks) : priority.length;
}

/** Rolls the offers for one Pick and chooses one by the rule. Ties go to the earlier offer. */
export function rollPick(rng: Rng, moment: PickMoment, priority: readonly PickTag[]): { readonly offers: readonly PickId[]; readonly taken: PickId } {
  const offers = shuffled(rng, picksFor(moment)).slice(0, OFFERS_PER_PICK);
  const taken = offers.reduce((best, offer) => (rankOf(offer, priority) < rankOf(best, priority) ? offer : best));
  return { offers, taken };
}

/** A Pick rule names every tag once. */
export const isPickPriority = (value: unknown): value is readonly PickTag[] =>
  Array.isArray(value) && value.length === PICK_TAGS.length && PICK_TAGS.every((tag) => value.includes(tag));

export interface PickContext {
  /** Floors the Run has cleared since it set out. */
  readonly floorsCleared: number;
  readonly guardian: boolean;
}

/** A Hero's Battle Unit with this Run's Picks applied. */
export function applyPicks(spec: UnitSpec, picks: readonly PickId[], { floorsCleared, guardian }: PickContext): UnitSpec {
  let { power, armour, critChance } = spec;
  let poison = spec.resistances.poison ?? 0;
  for (const id of picks) {
    const { effect } = PICKS[id];
    switch (effect.type) {
      case 'power':
        power *= 1 + effect.share;
        break;
      case 'armour':
        armour += effect.amount;
        break;
      case 'critChance':
        critChance += effect.amount;
        break;
      case 'poisonResistance':
        poison += effect.amount;
        break;
      case 'powerPerFloor':
        power *= 1 + effect.share * floorsCleared;
        break;
      case 'powerAgainstGuardians':
        if (guardian) power *= 1 + effect.share;
        break;
    }
  }
  return { ...spec, power, armour, critChance, resistances: { ...spec.resistances, poison } };
}
