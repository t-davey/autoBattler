import type { DamageType, Row, UnitSpec } from '../battle';
import { nextInt, type Rng } from '../rng';
import type { ActNumber } from './world';

type EnemyTemplate = Omit<UnitSpec, 'id' | 'row' | 'critChance'>;

const melee = { reach: 'melee', targeting: 'frontFirst' } as const;
const ranged = { reach: 'ranged', targeting: 'frontFirst' } as const;

/** The damage of the Poison stack that fungal growth adds with each attack. */
const FUNGAL_STACK = 0.5;

const SODDEN_THRALL: EnemyTemplate = { name: 'Sodden Thrall', ...melee, health: 125, power: 2, actionInterval: 30, damageType: 'physical', armour: 5, resistances: {} };
const TALLOW_WIGHT: EnemyTemplate = { name: 'Tallow Wight', ...melee, health: 180, power: 3, actionInterval: 35, damageType: 'physical', armour: 15, resistances: { physical: 10 } };
const BONE_CHANTER: EnemyTemplate = { name: 'Bone Chanter', ...ranged, targeting: 'any', health: 85, power: 2, actionInterval: 30, damageType: 'physical', armour: 0, resistances: {} };
const MIRE_BLOAT: EnemyTemplate = { name: 'Mire Bloat', ...melee, health: 140, power: 1.5, actionInterval: 30, damageType: 'poison', poisonOnHit: FUNGAL_STACK, armour: 5, resistances: { physical: 20 } };
const SPORELING: EnemyTemplate = { name: 'Sporeling', ...ranged, health: 75, power: 1.5, actionInterval: 30, damageType: 'poison', poisonOnHit: FUNGAL_STACK, armour: 0, resistances: { physical: 20 } };

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

/** Act 1's damage leaning is undecided. Act 3 leans fire, which the sim doesn't have yet, so its stand-ins hit physical. */
export const FAMILIES_BY_ACT: Readonly<Record<ActNumber, readonly Family[]>> = {
  1: [placeholderFamily(1, 'physical')],
  2: [
    { front: [SODDEN_THRALL, TALLOW_WIGHT], back: [BONE_CHANTER] }, // the restless dead
    { front: [MIRE_BLOAT], back: [SPORELING] }, // fungal growth
  ],
  3: [placeholderFamily(3, 'physical')],
};

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

/** A Pack of 1–2 front and 1–2 back enemies, drawn from one of the Act's Families. Scale multiplies health, power, and Poison stacks. */
export function rollPack(rng: Rng, act: ActNumber, scale: number): UnitSpec[] {
  const families = FAMILIES_BY_ACT[act];
  const family = families[nextInt(rng, families.length)]!;
  const roll = (row: Row): UnitSpec[] =>
    Array.from({ length: 1 + nextInt(rng, 2) }, (_, index) => {
      const templates = family[row];
      const template = templates[nextInt(rng, templates.length)]!;
      return { ...scaleUnit(template, scale), id: `enemy-${row}-${index}`, row, critChance: 0 };
    });
  return [...roll('front'), ...roll('back')];
}
