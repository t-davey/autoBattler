import type { UnitSpec } from '../battle';

/** Acts only through its actions, so power, actionInterval, and damageType go unused. */
export const MOULDERING_WARDEN: UnitSpec = {
  id: 'guardian',
  name: 'The Mouldering Warden',
  health: 1_100,
  power: 0,
  actionInterval: 0,
  row: 'front',
  reach: 'melee',
  targeting: 'frontFirst',
  damageType: 'physical',
  armour: 15,
  resistances: {},
  critChance: 0,
  actions: [
    { name: 'Spore Breath', interval: 60, target: 'every', damage: 0, damageType: 'poison', poisonStack: 3 },
    { name: 'Grave Slam', interval: 80, target: 'oneFront', damage: 12, damageType: 'physical' },
  ],
};
