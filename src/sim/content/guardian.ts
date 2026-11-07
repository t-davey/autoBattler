import type { UnitSpec } from '../battle';

/** Acts only through its actions, so power, actionInterval, and damageType go unused. */
export const MOULDERING_WARDEN: UnitSpec = {
  id: 'guardian',
  name: 'The Mouldering Warden',
  health: 2_300,
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
  secondPhase: {
    atHealthShare: 0.5,
    actions: [
      { name: 'Spore Breath', interval: 90, target: 'every', damage: 0, damageType: 'poison', poisonStack: 9 },
      { name: 'Grave Slam', interval: 50, target: 'oneFront', damage: 90, damageType: 'physical' },
      // A placeholder name, for the human to replace.
      { name: 'Grave Maul', interval: 120, target: 'oneFront', damage: 220, damageType: 'physical' },
    ],
  },
};
