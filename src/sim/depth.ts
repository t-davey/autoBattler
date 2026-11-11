/**
 * How a Floor's numbers grow with depth (1–60). Depths 1–5 keep the demo's tuned values; deeper Floors extend
 * the curve as placeholders until they are tuned.
 */

export interface RarityOdds {
  /** Percentages. The rest is rare. */
  readonly common: number;
  readonly magic: number;
}

export interface DepthTuning {
  /** Multiplies enemy health, power, and Poison stack damage. */
  readonly enemyScale: number;
  readonly battleXp: number;
  /** The level the Floor's enemies count as, for XP falloff. */
  readonly floorLevel: number;
  readonly rarityOdds: RarityOdds;
  /** Multiplies rolled Affix values. */
  readonly affixScale: number;
  readonly levelRequirement: number;
}

const TUNED_RARITY: readonly RarityOdds[] = [
  { common: 78, magic: 19 },
  { common: 70, magic: 23 },
  { common: 60, magic: 28 },
  { common: 52, magic: 31 },
  { common: 44, magic: 34 },
];

function rarityOdds(depth: number): RarityOdds {
  const tuned = TUNED_RARITY[depth - 1];
  if (tuned) return tuned;
  const past = depth - TUNED_RARITY.length;
  return { common: Math.max(10, 44 - 2 * past), magic: Math.min(50, 34 + past) };
}

export function depthTuning(depth: number): DepthTuning {
  return {
    enemyScale: 1 + 0.15 * (depth - 1),
    battleXp: 10 + 5 * depth,
    floorLevel: depth + 3,
    rarityOdds: rarityOdds(depth),
    affixScale: 1 + 0.2 * (depth - 1),
    levelRequirement: depth === 1 ? 1 : depth + 1,
  };
}
