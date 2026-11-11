/**
 * Placeholder Picks: the first kinds the design names, with stand-in names and untuned numbers. A Pick lasts until
 * the Run ends.
 */

export type PickKind = 'boon' | 'stacking' | 'wallPrep';
export const PICK_TAGS = ['power', 'armour', 'crit', 'poison', 'guardian', 'stacking'] as const;
export type PickTag = (typeof PICK_TAGS)[number];
/** When a Run offers a Pick: as it sets out from Town, and as it reaches its Guardian. */
export type PickMoment = 'setOut' | 'guardian';

export type PickEffect =
  /** Multiplies power. */
  | { readonly type: 'power'; readonly share: number }
  | { readonly type: 'armour'; readonly amount: number }
  /** Percentage points. */
  | { readonly type: 'critChance'; readonly amount: number }
  /** Percentage points, capped by the Battle like any resistance. */
  | { readonly type: 'poisonResistance'; readonly amount: number }
  /** Multiplies power by this share for each Floor the Run has cleared. */
  | { readonly type: 'powerPerFloor'; readonly share: number }
  /** Multiplies power, in Guardian Battles only. */
  | { readonly type: 'powerAgainstGuardians'; readonly share: number };

export interface PickDefinition {
  readonly name: string;
  /** What it does, in one line. */
  readonly line: string;
  readonly kind: PickKind;
  readonly tags: readonly PickTag[];
  readonly effect: PickEffect;
  /** True until its name and numbers are designed. */
  readonly placeholder: boolean;
}

export const PICKS = {
  'boon-power': { name: 'Power boon', line: '+15% power', kind: 'boon', tags: ['power'], effect: { type: 'power', share: 0.15 }, placeholder: true },
  'boon-armour': { name: 'Armour boon', line: '+10 armour', kind: 'boon', tags: ['armour'], effect: { type: 'armour', amount: 10 }, placeholder: true },
  'boon-crit': { name: 'Critical boon', line: '+5% critical chance', kind: 'boon', tags: ['crit'], effect: { type: 'critChance', amount: 5 }, placeholder: true },
  'stacking-power': { name: 'Stacking power', line: '+4% power for each Floor cleared this Run', kind: 'stacking', tags: ['stacking', 'power'], effect: { type: 'powerPerFloor', share: 0.04 }, placeholder: true },
  'prep-poison': { name: 'Poison prep', line: '+30% poison resistance', kind: 'wallPrep', tags: ['poison'], effect: { type: 'poisonResistance', amount: 30 }, placeholder: true },
  'prep-guardian': { name: 'Guardian prep', line: '+25% power against Guardians', kind: 'wallPrep', tags: ['guardian', 'power'], effect: { type: 'powerAgainstGuardians', share: 0.25 }, placeholder: true },
} as const satisfies Record<string, PickDefinition>;

export type PickId = keyof typeof PICKS;
export const PICK_IDS = Object.keys(PICKS) as PickId[];

/** What each moment can offer: Boons always, Stacking only when the Run has Floors ahead, Wall prep only at the Guardian. */
const KINDS_BY_MOMENT: Readonly<Record<PickMoment, readonly PickKind[]>> = {
  setOut: ['boon', 'stacking'],
  guardian: ['boon', 'wallPrep'],
};

export const picksFor = (moment: PickMoment): readonly PickId[] => PICK_IDS.filter((id) => KINDS_BY_MOMENT[moment].includes(PICKS[id].kind));

export const OFFERS_PER_PICK = 3;

/**
 * The Pick rule a new Game starts with: earlier tags win. The player can reorder it.
 * Guardian prep leads: in `npm run balance -- world` on 2026-11-11 it doubled frontier Guardian wins, and poison prep didn't help.
 */
export const DEFAULT_PICK_PRIORITY: readonly PickTag[] = ['guardian', 'poison', 'stacking', 'power', 'armour', 'crit'];
