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

/** Every Guardian at half the Warden's demo strength, so a Wall takes hours, not days: the weekend pace of 2026-11-11. */
const GUARDIAN_STRENGTH = 0.5;

/**
 * A Lamp's Guardian, scaled from the depth it was tuned at to the Lamp's own. A placeholder copies the Warden's
 * actions under a stand-in name.
 */
export function guardianFor(lamp: LampDefinition): UnitSpec {
  const scale = depthTuning(lamp.depth).enemyScale / depthTuning(lamp.tunedDepth).enemyScale;
  const base = lamp.placeholder ? { ...MOULDERING_WARDEN, name: lamp.guardianName, placeholder: true } : MOULDERING_WARDEN;
  return scaleUnit(base, scale * GUARDIAN_STRENGTH);
}
