import type { UnitSpec } from '../battle';
import { depthTuning } from '../depth';
import { scaleUnit } from './enemies';
import type { LampDefinition } from './world';

/** Acts only through its actions, so power, actionInterval, and damageType go unused. */
const MOULDERING_WARDEN: UnitSpec = {
  id: 'guardian',
  name: 'The Mouldering Warden',
  health: 2_600,
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
      { name: 'Spore Breath', interval: 90, target: 'every', damage: 0, damageType: 'poison', poisonStack: 12 },
      { name: 'Grave Slam', interval: 50, target: 'oneFront', damage: 130, damageType: 'physical' },
      { name: 'Grave Maul', interval: 120, target: 'oneFront', damage: 300, damageType: 'physical' },
    ],
  },
};

const guardian = (spec: Omit<UnitSpec, 'id' | 'power' | 'actionInterval' | 'damageType' | 'critChance' | 'targeting'>): UnitSpec => ({
  id: 'guardian',
  power: 0,
  actionInterval: 0,
  targeting: 'frontFirst',
  damageType: 'physical',
  critChance: 0,
  ...spec,
});

/** Wall 2: physical, on the front Row. */
const IRON_SEXTON = guardian({
  name: 'The Iron Sexton',
  health: 2_800,
  row: 'front',
  reach: 'melee',
  armour: 25,
  resistances: {},
  actions: [
    { name: 'Piston Fist', interval: 70, target: 'oneFront', damage: 40, damageType: 'physical' },
    { name: 'Sweep', interval: 120, target: 'every', damage: 15, damageType: 'physical' },
  ],
  secondPhase: {
    atHealthShare: 0.5,
    actions: [
      { name: 'Piston Fist', interval: 45, target: 'oneFront', damage: 150, damageType: 'physical' },
      { name: 'Hammerfall', interval: 140, target: 'oneFront', damage: 350, damageType: 'physical' },
    ],
  },
});

/** Wall 3: the back Row, and Slow. */
const KNELL_ENGINE = guardian({
  name: 'The Knell Engine',
  health: 2_400,
  row: 'front',
  reach: 'ranged',
  armour: 15,
  resistances: { cold: 40 },
  actions: [
    { name: 'Knell', interval: 80, target: 'every', damage: 10, damageType: 'physical', slow: 25 },
    { name: 'Undertow', interval: 70, target: 'oneBack', damage: 45, damageType: 'physical' },
  ],
  secondPhase: {
    atHealthShare: 0.5,
    actions: [
      { name: 'Knell', interval: 60, target: 'every', damage: 20, damageType: 'physical', slow: 40 },
      { name: 'Undertow', interval: 45, target: 'oneBack', damage: 120, damageType: 'physical' },
    ],
  },
});

/** Wall 4, ending the Act: armour, and outlasting a Curse. */
const RELIQUARY_ENGINE = guardian({
  name: 'The Reliquary Engine',
  health: 3_200,
  row: 'front',
  reach: 'melee',
  armour: 80,
  resistances: { physical: 20 },
  actions: [
    { name: 'Censer of Spores', interval: 70, target: 'every', damage: 0, damageType: 'poison', poisonStack: 4, curse: 20 },
    { name: 'Grind', interval: 60, target: 'oneFront', damage: 25, damageType: 'physical' },
  ],
  secondPhase: {
    atHealthShare: 0.4,
    actions: [
      { name: 'Censer of Spores', interval: 60, target: 'every', damage: 0, damageType: 'poison', poisonStack: 10, curse: 35 },
      { name: 'Grind', interval: 45, target: 'oneFront', damage: 110, damageType: 'physical' },
      { name: 'Reliquary Crush', interval: 150, target: 'oneFront', damage: 280, damageType: 'physical' },
    ],
  },
});

const GUARDIANS_BY_NAME: Readonly<Record<string, UnitSpec>> = Object.fromEntries(
  [MOULDERING_WARDEN, IRON_SEXTON, KNELL_ENGINE, RELIQUARY_ENGINE].map((spec) => [spec.name, spec]),
);

/** Every Guardian at 60% of the Warden's demo strength, so a Wall takes hours, not days: the weekend pace with Picks, 2026-11-11. */
const GUARDIAN_STRENGTH = 0.6;

/**
 * A Lamp's Guardian, scaled from the depth it was tuned at to the Lamp's own. A placeholder copies the Warden's
 * actions under a stand-in name.
 */
export function guardianFor(lamp: LampDefinition): UnitSpec {
  const scale = depthTuning(lamp.depth).enemyScale / depthTuning(lamp.tunedDepth).enemyScale;
  const built = GUARDIANS_BY_NAME[lamp.guardianName];
  if (!lamp.placeholder && !built) throw new Error(`No Guardian is written for ${lamp.guardianName}`);
  const base = built ?? { ...MOULDERING_WARDEN, name: lamp.guardianName, placeholder: true };
  return scaleUnit(base, scale * GUARDIAN_STRENGTH);
}
