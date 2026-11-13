import type { Row } from '../battle';

export type HeroId = 'sin-eater' | 'warrener' | 'lamplighter';
export type ActiveSkillId = 'bar-the-way' | 'bleeders-cut' | 'the-long-cut' | 'mend-by-lamplight' | 'lantern-ward';
export type PassiveSkillId = 'iron-penance' | 'shared-burden' | 'open-veins' | 'warm-hands';
export type SkillId = ActiveSkillId | PassiveSkillId;
export type SkillKind = 'active' | 'passive';
export type SkillReach = 'self' | 'melee' | 'anyHero' | 'everyHero';

/** One number a skill scales by rank, running evenly from rank 1 to the top rank. */
export interface SkillValue {
  readonly label: string;
  readonly rank1: number;
  readonly rank5: number;
}

export interface SkillDefinition {
  readonly id: SkillId;
  readonly name: string;
  readonly heroId: HeroId;
  readonly branch: string;
  readonly step: 1 | 2 | 3;
  readonly kind: SkillKind;
  /** The Row the skill works from at full effect. */
  readonly row: Row | 'either';
  readonly reach: SkillReach | null;
  readonly oil: number;
  /** Ticks. 0 means none. */
  readonly cooldown: number;
  readonly summary: string;
  readonly values: readonly SkillValue[];
}

export const MAX_SKILL_RANK = 5;
export const POINTS_PER_STEP = 3;
export const OUT_OF_ROW_FACTOR = 0.6;
/** Ticks. */
export const BAR_THE_WAY_DURATION = 60;
export const BLEED_TICKS = 6;
export const BLEED_INTERVAL = 10;
export const LANTERN_WARD_DURATION = 80;
export const POISON_INTERVAL = 20;
export const POISON_DURATION = 100;
export const POISON_STACK_LIMIT = 5;
/** Usefulness conditions, as fractions of health. */
export const BAR_THE_WAY_BELOW = 0.8;
export const MEND_BELOW = 0.7;

const passive = { kind: 'passive', reach: null, oil: 0, cooldown: 0 } as const;

export const SKILLS: Readonly<Record<SkillId, SkillDefinition>> = {
  'bar-the-way': {
    id: 'bar-the-way', name: 'Bar the Way', heroId: 'sin-eater', branch: 'Bulwark', step: 1,
    kind: 'active', row: 'front', reach: 'self', oil: 15, cooldown: 200,
    summary: 'For 60 Ticks, every single-target enemy attack hits this Hero, and it gains bonus armour. Fires when another Hero is below 80% health.',
    values: [{ label: 'Bonus armour', rank1: 20, rank5: 60 }],
  },
  'iron-penance': {
    id: 'iron-penance', name: 'Iron Penance', heroId: 'sin-eater', branch: 'Bulwark', step: 2,
    ...passive, row: 'either',
    summary: 'Bonus armour.',
    values: [{ label: 'Bonus armour', rank1: 10, rank5: 30 }],
  },
  'shared-burden': {
    id: 'shared-burden', name: 'Shared Burden', heroId: 'sin-eater', branch: 'Bulwark', step: 3,
    ...passive, row: 'front',
    summary: 'Part of each direct hit and Poison tick on a back-Row Hero goes to this Hero instead.',
    values: [{ label: 'Damage redirected', rank1: 10, rank5: 30 }],
  },
  'bleeders-cut': {
    id: 'bleeders-cut', name: "Bleeder's Cut", heroId: 'warrener', branch: 'Bloodletting', step: 1,
    kind: 'active', row: 'front', reach: 'melee', oil: 10, cooldown: 0,
    summary: "Physical damage, plus Bleed over 60 Ticks. Fires when a reachable enemy isn't Bleeding.",
    values: [
      { label: 'Hit, of power', rank1: 80, rank5: 110 },
      { label: 'Bleed total, of power', rank1: 60, rank5: 100 },
    ],
  },
  'open-veins': {
    id: 'open-veins', name: 'Open Veins', heroId: 'warrener', branch: 'Bloodletting', step: 2,
    ...passive, row: 'front',
    summary: 'More damage to Bleeding enemies, except from Bleed itself.',
    values: [{ label: 'Bonus damage', rank1: 10, rank5: 30 }],
  },
  'the-long-cut': {
    id: 'the-long-cut', name: 'The Long Cut', heroId: 'warrener', branch: 'Bloodletting', step: 3,
    kind: 'active', row: 'front', reach: 'melee', oil: 20, cooldown: 150,
    summary: "Ends a target's Bleed, dealing its remaining damage multiplied. Fires when a reachable enemy is Bleeding.",
    values: [{ label: 'Remaining Bleed', rank1: 150, rank5: 200 }],
  },
  'mend-by-lamplight': {
    id: 'mend-by-lamplight', name: 'Mend by Lamplight', heroId: 'lamplighter', branch: 'Hearth', step: 1,
    kind: 'active', row: 'back', reach: 'anyHero', oil: 12, cooldown: 60,
    summary: 'Heals the Hero with the lowest health percentage. Fires when a Hero is below 70% health.',
    values: [{ label: 'Heal, of power', rank1: 150, rank5: 170 }],
  },
  'warm-hands': {
    id: 'warm-hands', name: 'Warm Hands', heroId: 'lamplighter', branch: 'Hearth', step: 2,
    ...passive, row: 'either',
    summary: 'The Party recovers more health between Rooms; only the highest in the Party counts.',
    values: [{ label: 'More health', rank1: 20, rank5: 60 }],
  },
  'lantern-ward': {
    id: 'lantern-ward', name: 'Lantern Ward', heroId: 'lamplighter', branch: 'Hearth', step: 3,
    kind: 'active', row: 'back', reach: 'everyHero', oil: 20, cooldown: 250,
    summary: 'Wards every Hero for 80 Ticks. Fires when no Hero holds a Ward.',
    values: [{ label: 'Ward, of power', rank1: 60, rank5: 120 }],
  },
};

export const SKILL_IDS = Object.keys(SKILLS) as readonly SkillId[];

export const isSkillId = (value: unknown): value is SkillId =>
  typeof value === 'string' && Object.hasOwn(SKILLS, value);

/** A skill's value at a rank, as a percentage. */
export function rankValue(id: SkillId, rank: number, index = 0): number {
  const value = SKILLS[id].values[index];
  if (!value) throw new Error(`${id} has no value ${index}`);
  return value.rank1 + ((value.rank5 - value.rank1) * (rank - 1)) / (MAX_SKILL_RANK - 1);
}
