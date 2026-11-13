import type { Row } from '../battle';

export type HeroId = 'sin-eater' | 'warrener' | 'hexer' | 'lamplighter';
export type ActiveSkillId =
  | 'consume-sin'
  | 'tainted-shaft'
  | 'votive-spark'
  | 'chill-word'
  | 'sow-rot'
  | 'bloom'
  | 'wasting-curse'
  | 'bar-the-way'
  | 'bleeders-cut'
  | 'the-long-cut'
  | 'mend-by-lamplight'
  | 'lantern-ward';
export type PassiveSkillId = 'iron-penance' | 'shared-burden' | 'open-veins' | 'warm-hands' | 'ripening' | 'spoiled-blood' | 'leech-hex';
export type SkillId = ActiveSkillId | PassiveSkillId;
export type SkillKind = 'active' | 'passive';
export type SkillReach = 'self' | 'melee' | 'ranged' | 'spell' | 'anyHero' | 'everyHero';

/** One number a skill scales by rank, running evenly from rank 1 to the top rank. */
export interface SkillValue {
  readonly label: string;
  readonly rank1: number;
  readonly rank5: number;
  /** A plain count, such as extra Poison stacks, rather than a percentage. */
  readonly count?: true;
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
  /** A free Class skill: learned from the start at a fixed strength, costing no points. */
  readonly free?: true;
}

export const MAX_SKILL_RANK = 5;
/** A free Class skill's rank, which never changes. Its values are the same at every rank. */
export const FREE_SKILL_RANK = 1;
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
/** Ticks of Poison left under which Sow Rot tops it up. */
export const SOW_ROT_REFRESH_BELOW = 40;
/** Stacks an enemy needs before Bloom spreads them. */
export const BLOOM_FROM = 3;
export const MEND_BELOW = 0.7;

const passive = { kind: 'passive', reach: null, oil: 0, cooldown: 0 } as const;
const free = { branch: 'Class skill', step: 1, kind: 'active', cooldown: 0, free: true } as const;
const fixed = (label: string, value: number): SkillValue => ({ label, rank1: value, rank5: value });

export const SKILLS: Readonly<Record<SkillId, SkillDefinition>> = {
  'consume-sin': {
    id: 'consume-sin', name: 'Consume Sin', heroId: 'sin-eater', ...free,
    row: 'front', reach: 'melee', oil: 8,
    summary: 'Holy damage to one enemy, healing this Hero. Fires when a reachable enemy lives.',
    values: [fixed('Hit, of power', 110), fixed('Heal, of max health', 3)],
  },
  'tainted-shaft': {
    id: 'tainted-shaft', name: 'Tainted Shaft', heroId: 'warrener', ...free,
    row: 'back', reach: 'ranged', oil: 7,
    summary: 'Poison damage to an enemy in either Row, plus a Poison stack. Fires when an enemy lives.',
    values: [fixed('Hit, of power', 40), fixed('Poison each time, of power', 8)],
  },
  'chill-word': {
    id: 'chill-word', name: 'Chill Word', heroId: 'hexer', ...free,
    row: 'back', reach: 'spell', oil: 8,
    summary: 'Cold damage to an enemy in either Row, and a Slow for 40 Ticks. Fires when an enemy lives.',
    values: [fixed('Hit, of power', 100), fixed('Slow', 15)],
  },
  'votive-spark': {
    id: 'votive-spark', name: 'Votive Spark', heroId: 'lamplighter', ...free,
    row: 'back', reach: 'spell', oil: 6,
    summary: 'Holy damage to an enemy in either Row. Fires when an enemy lives.',
    values: [fixed('Hit, of power', 110)],
  },
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
  'sow-rot': {
    id: 'sow-rot', name: 'Sow Rot', heroId: 'hexer', branch: 'Rot', step: 1,
    kind: 'active', row: 'back', reach: 'spell', oil: 8, cooldown: 0,
    summary: 'Adds a Poison stack to an enemy in either Row. Fires when an enemy is below its stack limit, or its Poison has under 40 Ticks left.',
    values: [{ label: 'Poison each time, of power', rank1: 15, rank5: 25 }],
  },
  ripening: {
    id: 'ripening', name: 'Ripening', heroId: 'hexer', branch: 'Rot', step: 2,
    ...passive, row: 'either',
    summary: 'Raises the Poison stack limit on enemies this Hero poisons.',
    values: [{ label: 'Extra stacks', rank1: 1, rank5: 5, count: true }],
  },
  bloom: {
    id: 'bloom', name: 'Bloom', heroId: 'hexer', branch: 'Rot', step: 3,
    kind: 'active', row: 'back', reach: 'spell', oil: 20, cooldown: 180,
    summary: "Copies part of the most-poisoned enemy's Poison stacks to every other enemy, rounded up. Fires when an enemy has 3 or more stacks and another enemy lives.",
    values: [{ label: 'Stacks copied', rank1: 50, rank5: 90 }],
  },
  'wasting-curse': {
    id: 'wasting-curse', name: 'Wasting Curse', heroId: 'hexer', branch: 'Malediction', step: 1,
    kind: 'active', row: 'back', reach: 'spell', oil: 12, cooldown: 80,
    summary: 'Curses the uncursed enemy with the most power for 80 Ticks, so it deals less damage. Fires when an enemy has no Curse.',
    values: [{ label: 'Less damage', rank1: 10, rank5: 22 }],
  },
  'spoiled-blood': {
    id: 'spoiled-blood', name: 'Spoiled Blood', heroId: 'hexer', branch: 'Malediction', step: 2,
    ...passive, row: 'either',
    summary: 'Enemies this Hero has Cursed take more damage from every source.',
    values: [{ label: 'More damage taken', rank1: 6, rank5: 18 }],
  },
  'leech-hex': {
    id: 'leech-hex', name: 'Leech Hex', heroId: 'hexer', branch: 'Malediction', step: 3,
    ...passive, row: 'either',
    summary: 'Heals this Hero for part of the damage it deals to Cursed enemies, Poison included.',
    values: [{ label: 'Heal, of damage dealt', rank1: 10, rank5: 30 }],
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
