import type { UnitSpec } from '../battle';

const hero = (
  id: string,
  name: string,
  stats: Pick<UnitSpec, 'row' | 'reach' | 'health' | 'power' | 'actionInterval' | 'armour' | 'critChance'>,
): UnitSpec => ({ id, name, targeting: 'any', damageType: 'physical', resistances: {}, ...stats });

/** Temporary level 1 Heroes, with a starter weapon's power included, until levels arrive. */
export const PARTY: readonly UnitSpec[] = [
  hero('sin-eater', 'Sin-Eater', { row: 'front', reach: 'melee', health: 160, power: 14, actionInterval: 32, armour: 20, critChance: 3 }),
  hero('huntsman', 'Huntsman', { row: 'front', reach: 'melee', health: 110, power: 17, actionInterval: 27, armour: 8, critChance: 8 }),
  hero('lamplighter', 'Lamplighter', { row: 'back', reach: 'ranged', health: 95, power: 14, actionInterval: 30, armour: 5, critChance: 5 }),
];
