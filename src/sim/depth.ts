/**
 * How a Floor's numbers grow with depth (1–60), at the weekend pace. Depths 1–5 keep the demo's values apart
 * from XP; deeper Floors extend the curve as placeholders until they are tuned.
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

/** Enemy scale grows linearly through Act 1, then compounds, so it keeps up with a Party whose levels and gear multiply. */
const LINEAR_UNTIL = 20;
const LINEAR_STEP = 0.15;
/** 4.5% a Floor, the best fit of 3%–10% in `npm run balance -- world` on 2026-11-11. */
const COMPOUND_RATE = 0.045;

/**
 * The level a Floor's enemies count as. Depths 1–5 keep the demo's, then it rises 0.28 a Floor, so XP falloff holds
 * Heroes near level 20 at the Undercroft's end and 25 at the Tier's, as docs/first-playable-tuning.md sets.
 */
const DEMO_DEPTHS = 5;
const LEVELS_PER_FLOOR = 0.28;
const floorLevel = (depth: number): number =>
  depth <= DEMO_DEPTHS ? depth + 3 : Math.round(DEMO_DEPTHS + 3 + LEVELS_PER_FLOOR * (depth - DEMO_DEPTHS));

/** Battle XP runs 25% above the demo's, part of the weekend pace measured on 2026-11-11. */
const XP_RATE = 1.25;

function enemyScale(depth: number): number {
  const linear = (until: number) => 1 + LINEAR_STEP * (until - 1);
  if (depth <= LINEAR_UNTIL) return linear(depth);
  return linear(LINEAR_UNTIL) * (1 + COMPOUND_RATE) ** (depth - LINEAR_UNTIL);
}

export function depthTuning(depth: number): DepthTuning {
  return {
    enemyScale: enemyScale(depth),
    battleXp: XP_RATE * (10 + 5 * depth),
    floorLevel: floorLevel(depth),
    rarityOdds: rarityOdds(depth),
    affixScale: 1 + 0.2 * (depth - 1),
    levelRequirement: depth === 1 ? 1 : floorLevel(depth) - 2,
  };
}
