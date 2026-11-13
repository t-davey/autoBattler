import type { DamageType, Row, UnitSpec } from '../battle';
import { nextInt, type Rng } from '../rng';
import type { ActNumber } from './world';

type EnemyTemplate = Omit<UnitSpec, 'id' | 'row' | 'critChance'>;

const melee = { reach: 'melee', targeting: 'frontFirst' } as const;
const ranged = { reach: 'ranged', targeting: 'frontFirst' } as const;

/** The damage of the Poison stack that fungal growth adds with each attack. */
const FUNGAL_STACK = 0.5;

/** The dead are cold already. */
const DEAD_COLD = { cold: 25 } as const;
/** The Drowned, from the flooded lower crypts, colder still. */
const DROWNED_COLD = { cold: 40 } as const;
/** For a Unit that acts only through its actions, so power, actionInterval, and damageType go unused. */
const actsByActions = { power: 0, actionInterval: 0, damageType: 'physical' } as const;

const SODDEN_THRALL: EnemyTemplate = { name: 'Sodden Thrall', ...melee, health: 125, power: 2, actionInterval: 30, damageType: 'physical', armour: 5, resistances: DEAD_COLD };
const TALLOW_WIGHT: EnemyTemplate = { name: 'Tallow Wight', ...melee, health: 180, power: 3, actionInterval: 35, damageType: 'physical', armour: 15, resistances: { physical: 10, ...DEAD_COLD } };
const BONE_CHANTER: EnemyTemplate = { name: 'Bone Chanter', ...ranged, targeting: 'any', health: 85, power: 2, actionInterval: 30, damageType: 'physical', armour: 0, resistances: DEAD_COLD };
const MIRE_BLOAT: EnemyTemplate = { name: 'Mire Bloat', ...melee, health: 140, power: 1.5, actionInterval: 30, damageType: 'poison', poisonOnHit: FUNGAL_STACK, armour: 5, resistances: { physical: 20 } };
const SPORELING: EnemyTemplate = { name: 'Sporeling', ...ranged, health: 75, power: 1.5, actionInterval: 30, damageType: 'poison', poisonOnHit: FUNGAL_STACK, armour: 0, resistances: { physical: 20 } };

// The Ossuary, Floors 6-10: heavy physical blows on the front Row, ahead of Wall 2.
const CHARNEL_BRUTE: EnemyTemplate = { name: 'Charnel Brute', ...melee, health: 220, power: 5, actionInterval: 50, damageType: 'physical', armour: 20, resistances: DEAD_COLD };
const KNUCKLEBONE_FLINGER: EnemyTemplate = { name: 'Knucklebone Flinger', ...ranged, health: 80, power: 2.5, actionInterval: 30, damageType: 'physical', armour: 0, resistances: DEAD_COLD };

// The Drowned, Floors 11-15: they reach past the front Row and Slow, ahead of Wall 3.
const DROWNED_MOURNER: EnemyTemplate = { name: 'Drowned Mourner', ...melee, health: 150, power: 2, actionInterval: 30, damageType: 'physical', armour: 5, resistances: DROWNED_COLD };
const SILT_LURKER: EnemyTemplate = { name: 'Silt Lurker', ...ranged, targeting: 'any', health: 90, power: 2.5, actionInterval: 30, damageType: 'physical', armour: 0, resistances: DROWNED_COLD, dodgeChance: 15 };
const DROWNED_BELLMAN: EnemyTemplate = {
  name: 'Drowned Bellman', ...ranged, ...actsByActions, health: 100, armour: 0, resistances: DROWNED_COLD,
  actions: [{ name: 'Toll', interval: 60, target: 'every', damage: 3, damageType: 'physical', slow: 20 }],
};

// The Deep Growth, Floors 16-20: armour that damage over time and other types slip past, and Curses, ahead of Wall 4.
const SHELLCAP_HUSK: EnemyTemplate = { name: 'Shellcap Husk', ...melee, health: 200, power: 2, actionInterval: 35, damageType: 'poison', poisonOnHit: FUNGAL_STACK, armour: 40, resistances: { physical: 20, poison: 30 } };
const SHROUD_WEAVER: EnemyTemplate = {
  name: 'Shroud Weaver', ...ranged, ...actsByActions, health: 90, armour: 0, resistances: { poison: 30 },
  actions: [
    { name: 'Spore Lash', interval: 30, target: 'oneFront', damage: 3, damageType: 'poison', poisonStack: FUNGAL_STACK },
    { name: 'Shroud', interval: 90, target: 'every', damage: 0, damageType: 'poison', curse: 20 },
  ],
};

export interface Family {
  readonly front: readonly EnemyTemplate[];
  readonly back: readonly EnemyTemplate[];
}

/** A stand-in Family with a Sodden Thrall's and a Bone Chanter's stats, until the Act's enemies are designed. */
function placeholderFamily(act: ActNumber, damageType: DamageType): Family {
  const stand = { damageType, placeholder: true } as const;
  return {
    front: [{ ...SODDEN_THRALL, ...stand, name: `Placeholder Brute (Act ${act})` }],
    back: [{ ...BONE_CHANTER, ...stand, name: `Placeholder Skulker (Act ${act})` }],
  };
}

/** Floors from fromFloor (within the Act) onwards add these Families. */
interface Band {
  readonly fromFloor: number;
  readonly families: readonly Family[];
}

/** Act 1's damage leaning is undecided. Act 3's stand-ins hit physical until its enemies are designed. */
const BANDS_BY_ACT: Readonly<Record<ActNumber, readonly Band[]>> = {
  1: [{ fromFloor: 1, families: [placeholderFamily(1, 'physical')] }],
  2: [
    {
      fromFloor: 1,
      families: [
        { front: [SODDEN_THRALL, TALLOW_WIGHT], back: [BONE_CHANTER] }, // the restless dead
        { front: [MIRE_BLOAT], back: [SPORELING] }, // fungal growth
      ],
    },
    { fromFloor: 6, families: [{ front: [CHARNEL_BRUTE], back: [KNUCKLEBONE_FLINGER] }] }, // the Ossuary
    { fromFloor: 11, families: [{ front: [DROWNED_MOURNER], back: [SILT_LURKER, DROWNED_BELLMAN] }] }, // the Drowned
    { fromFloor: 16, families: [{ front: [SHELLCAP_HUSK], back: [SHROUD_WEAVER] }] }, // the Deep Growth
  ],
  3: [{ fromFloor: 1, families: [placeholderFamily(3, 'physical')] }],
};

/** The Floor's band's own Families half the time, and the earlier bands' evenly the rest. The first band rolls its own evenly. */
function rollFamily(rng: Rng, act: ActNumber, floor: number): Family {
  const bands = BANDS_BY_ACT[act].filter((band) => band.fromFloor <= floor);
  const newest = bands.at(-1)!.families;
  const earlier = bands.slice(0, -1).flatMap((band) => band.families);
  const from = earlier.length === 0 || nextInt(rng, 2) === 0 ? newest : earlier;
  return from[nextInt(rng, from.length)]!;
}

/** Multiplies a Unit's health, damage, and Poison. */
export function scaleUnit<T extends Omit<UnitSpec, 'id' | 'row' | 'critChance'>>(spec: T, scale: number): T {
  const scaleActions = (actions: UnitSpec['actions']) =>
    actions?.map((action) => ({ ...action, damage: action.damage * scale, ...(action.poisonStack === undefined ? {} : { poisonStack: action.poisonStack * scale }) }));
  return {
    ...spec,
    health: spec.health * scale,
    ...(spec.maxHealth === undefined ? {} : { maxHealth: spec.maxHealth * scale }),
    power: spec.power * scale,
    ...(spec.poisonOnHit === undefined ? {} : { poisonOnHit: spec.poisonOnHit * scale }),
    ...(spec.actions === undefined ? {} : { actions: scaleActions(spec.actions) }),
    ...(spec.secondPhase === undefined ? {} : { secondPhase: { ...spec.secondPhase, actions: scaleActions(spec.secondPhase.actions)! } }),
  };
}

/**
 * A Pack of 1–2 front and 1–2 back enemies, drawn from one Family open at the Floor (1–20 within its Act).
 * Scale multiplies health, power, and Poison stacks.
 */
export function rollPack(rng: Rng, act: ActNumber, floor: number, scale: number): UnitSpec[] {
  const family = rollFamily(rng, act, floor);
  const roll = (row: Row): UnitSpec[] =>
    Array.from({ length: 1 + nextInt(rng, 2) }, (_, index) => {
      const templates = family[row];
      const template = templates[nextInt(rng, templates.length)]!;
      return { ...scaleUnit(template, scale), id: `enemy-${row}-${index}`, row, critChance: 0 };
    });
  return [...roll('front'), ...roll('back')];
}
