import type { Row, UnitSpec } from '../battle';
import { nextInt, type Rng } from '../rng';

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

interface Family {
  readonly front: readonly EnemyTemplate[];
  readonly back: readonly EnemyTemplate[];
}

const FAMILIES: readonly Family[] = [
  { front: [SODDEN_THRALL, TALLOW_WIGHT], back: [BONE_CHANTER] }, // the restless dead
  { front: [MIRE_BLOAT], back: [SPORELING] }, // fungal growth
];

/** A Pack of 1–2 front and 1–2 back enemies, drawn from one Family. Scale multiplies health, power, and Poison stacks. */
export function rollPack(rng: Rng, scale: number): UnitSpec[] {
  const family = FAMILIES[nextInt(rng, FAMILIES.length)]!;
  const roll = (row: Row): UnitSpec[] =>
    Array.from({ length: 1 + nextInt(rng, 2) }, (_, index) => {
      const templates = family[row];
      const template = templates[nextInt(rng, templates.length)]!;
      return {
        ...template,
        id: `enemy-${row}-${index}`,
        row,
        critChance: 0,
        health: template.health * scale,
        power: template.power * scale,
        ...(template.poisonOnHit === undefined ? {} : { poisonOnHit: template.poisonOnHit * scale }),
      };
    });
  return [...roll('front'), ...roll('back')];
}
