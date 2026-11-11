import type { Reach } from './battle';
import {
  AFFIX_COUNTS,
  AFFIXES,
  BASE_IDS,
  COMMON_BASE_IDS,
  ITEM_BASES,
  RARE_LEVEL_BONUS,
  type AffixDefinition,
  type AffixId,
  type BaseId,
  type ItemStat,
  type ItemStats,
  type Rarity,
  type Slot,
} from './content/items';
import { depthTuning } from './depth';
import type { Depth } from './floors';
import { createRng, nextFloat, nextInt, shuffled, type Rng } from './rng';

export interface RolledAffix {
  readonly id: AffixId;
  readonly value: number;
}

/** An item's whole make-up, before it has an id. */
export interface ItemSpec {
  readonly baseId: BaseId;
  readonly rarity: Rarity;
  /** In table order. */
  readonly affixes: readonly RolledAffix[];
  readonly levelRequirement: number;
}

/** Ids count up as items appear, so a higher id is a newer item. */
export type ItemId = number;

export interface ItemState extends ItemSpec {
  readonly id: ItemId;
}

export interface ItemView {
  readonly id: ItemId;
  readonly name: string;
  readonly slot: Slot;
  readonly rarity: Rarity;
  /** Set on weapons only. */
  readonly reach: Reach | null;
  readonly levelRequirement: number;
  readonly affixes: readonly AffixId[];
  /** Built-in stats and Affixes together. */
  readonly stats: ItemStats;
}

const affixById = (id: AffixId): AffixDefinition => AFFIXES.find((affix) => affix.id === id)!;

function rollRarity(rng: Rng, floor: Depth): Rarity {
  const roll = nextFloat(rng) * 100;
  const { common, magic } = depthTuning(floor).rarityOdds;
  if (roll < common) return 'common';
  return roll < common + magic ? 'magic' : 'rare';
}

function rollAffixes(rng: Rng, floor: Depth, rarity: Rarity): RolledAffix[] {
  const { min, max } = AFFIX_COUNTS[rarity];
  const count = min + nextInt(rng, max - min + 1);
  const chosen = new Set(shuffled(rng, AFFIXES).slice(0, count));
  return AFFIXES.filter((affix) => chosen.has(affix)).map((affix) => {
    const rolled = affix.min + nextInt(rng, affix.max - affix.min + 1);
    return { id: affix.id, value: Math.round(rolled * depthTuning(floor).affixScale) };
  });
}

/** Rolls an item from a Floor's table, or at a set Rarity. */
export function rollItemSpec(rng: Rng, floor: Depth, rarity: Rarity = rollRarity(rng, floor)): ItemSpec {
  const bases = rarity === 'common' ? COMMON_BASE_IDS : BASE_IDS;
  return {
    baseId: bases[nextInt(rng, bases.length)]!,
    rarity,
    affixes: rollAffixes(rng, floor, rarity),
    levelRequirement: depthTuning(floor).levelRequirement + (rarity === 'rare' ? RARE_LEVEL_BONUS : 0),
  };
}

/** The item a Seed gives on a Floor, on its own. Play draws from the Game's Seed instead. */
export const rollItem = (seed: number, floor: Depth): ItemSpec => rollItemSpec(createRng(seed), floor);

const NO_STATS: ItemStats = { power: 0, maxHealth: 0, armour: 0, poisonResistance: 0, critChance: 0, speed: 0 };

export function itemStats(item: ItemSpec): ItemStats {
  const stats: Record<ItemStat, number> = { ...NO_STATS, ...ITEM_BASES[item.baseId].builtIn };
  for (const { id, value } of item.affixes) stats[affixById(id).stat] += value;
  return stats;
}

/** The common item a Hero starts with. */
export const starterItem = (baseId: BaseId): ItemSpec => ({ baseId, rarity: 'common', affixes: [], levelRequirement: 1 });

export const slotOf = (item: ItemSpec): Slot => ITEM_BASES[item.baseId].slot;

/** Adds up what a Hero's gear gives. */
export function gearStats(items: readonly ItemSpec[]): ItemStats {
  const total: Record<ItemStat, number> = { ...NO_STATS };
  for (const item of items) {
    const stats = itemStats(item);
    for (const stat of Object.keys(total) as ItemStat[]) total[stat] += stats[stat];
  }
  return total;
}

export function viewItem(item: ItemState): ItemView {
  const base = ITEM_BASES[item.baseId];
  return {
    id: item.id,
    name: [...item.affixes.map(({ id }) => affixById(id).name), base.name].join(' '),
    slot: base.slot,
    rarity: item.rarity,
    reach: base.reach,
    levelRequirement: item.levelRequirement,
    affixes: item.affixes.map(({ id }) => id),
    stats: itemStats(item),
  };
}
