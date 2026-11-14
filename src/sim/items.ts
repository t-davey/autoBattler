import { isNumber, isRecord } from './guards';
import type { Reach } from './battle';
import {
  AFFIX_COUNTS,
  AFFIXES,
  RARITIES,
  SLOTS,
  SLOTS_FOR,
  BASE_IDS,
  COMMON_BASE_IDS,
  ITEM_BASES,
  RARE_LEVEL_BONUS,
  UNIQUES,
  type AffixDefinition,
  type AffixId,
  type BaseId,
  type ItemBase,
  type ItemStat,
  type ItemStats,
  type Rarity,
  type Slot,
  type UniqueId,
} from './content/items';
import { CLASSES } from './content/party';
import type { ClassId } from './content/skills';
import { depthTuning } from './depth';
import type { Depth } from './floors';
import { createRng, nextFloat, nextInt, shuffled, type Rng } from './rng';

export interface RolledAffix {
  readonly id: AffixId;
  readonly value: number;
}

/** An item's whole make-up, before it has an id. */
export interface ItemSpec {
  /** A unique's id stands in for a base. */
  readonly baseId: BaseId | UniqueId;
  readonly rarity: Rarity;
  /** In table order. */
  readonly affixes: readonly RolledAffix[];
  readonly levelRequirement: number;
  /** Uniques only: the Affix scale of the Floor it dropped on, which multiplies its built-in stats. */
  readonly scale?: number;
}

/** Ids count up as items appear, so a higher id is a newer item. */
export type ItemId = number;

export interface ItemState extends ItemSpec {
  readonly id: ItemId;
  /** Kept from the cap, the auto-salvage rule, and salvaging by hand. */
  locked?: true;
}

/** What a unique adds, as its item shows it. */
export interface UniqueView {
  readonly classId: ClassId;
  readonly className: string;
  readonly change: string;
  readonly line: string;
}

export interface ItemView {
  readonly id: ItemId;
  readonly name: string;
  /** The first Slot it fits. */
  readonly slot: Slot;
  /** Every Slot it fits: both trinket Slots for a trinket. */
  readonly slots: readonly Slot[];
  readonly rarity: Rarity;
  /** Set on weapons only. */
  readonly reach: Reach | null;
  readonly levelRequirement: number;
  readonly locked: boolean;
  readonly affixes: readonly AffixId[];
  /** Built-in stats and Affixes together. */
  readonly stats: ItemStats;
  readonly unique: UniqueView | null;
}

const isUniqueId = (id: string): id is UniqueId => Object.hasOwn(UNIQUES, id);

/** The base an item is made from, or the unique it is. */
export const baseOf = (item: ItemSpec): ItemBase => (isUniqueId(item.baseId) ? UNIQUES[item.baseId] : ITEM_BASES[item.baseId as BaseId]);

/** The Class a unique is for, or null for an item any Hero can wear. */
export const classOnly = (item: ItemSpec): ClassId | null => (isUniqueId(item.baseId) ? UNIQUES[item.baseId].classId : null);

const affixById = (id: AffixId): AffixDefinition => AFFIXES.find((affix) => affix.id === id)!;

function rollRarity(rng: Rng, floor: Depth): Exclude<Rarity, 'unique'> {
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

/** Rolls an item from a Floor's table, or at a set Rarity. The Slot comes first, evenly, so trinkets drop twice as often. */
export function rollItemSpec(rng: Rng, floor: Depth, rarity: Exclude<Rarity, 'unique'> = rollRarity(rng, floor)): ItemSpec {
  const slot = SLOTS[nextInt(rng, SLOTS.length)]!;
  const bases = (rarity === 'common' ? COMMON_BASE_IDS : BASE_IDS).filter((id) => SLOTS_FOR[ITEM_BASES[id].kind].includes(slot));
  return {
    baseId: bases[nextInt(rng, bases.length)]!,
    rarity,
    affixes: rollAffixes(rng, floor, rarity),
    levelRequirement: depthTuning(floor).levelRequirement + (rarity === 'rare' ? RARE_LEVEL_BONUS : 0),
  };
}

/** A unique as it drops on a Floor. */
export const uniqueSpec = (uniqueId: UniqueId, floor: Depth): ItemSpec => ({
  baseId: uniqueId,
  rarity: 'unique',
  affixes: [],
  levelRequirement: depthTuning(floor).levelRequirement,
  scale: depthTuning(floor).affixScale,
});

/** The item a Seed gives on a Floor, on its own. Play draws from the Game's Seed instead. */
export const rollItem = (seed: number, floor: Depth): ItemSpec => rollItemSpec(createRng(seed), floor);

const NO_STATS: ItemStats = { power: 0, maxHealth: 0, armour: 0, poisonResistance: 0, critChance: 0, speed: 0, maxOil: 0 };

export function itemStats(item: ItemSpec): ItemStats {
  const stats: Record<ItemStat, number> = { ...NO_STATS };
  for (const [stat, value] of Object.entries(baseOf(item).builtIn) as [ItemStat, number][]) stats[stat] = Math.round(value * (item.scale ?? 1));
  for (const { id, value } of item.affixes) stats[affixById(id).stat] += value;
  return stats;
}

/** The common item a Hero starts with. */
export const starterItem = (baseId: BaseId): ItemSpec => ({ baseId, rarity: 'common', affixes: [], levelRequirement: 1 });

/** Every Slot the item fits, in order. */
export const slotsOf = (item: ItemSpec): readonly Slot[] => SLOTS_FOR[baseOf(item).kind];

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
  const base = baseOf(item);
  const unique = isUniqueId(item.baseId) ? UNIQUES[item.baseId] : null;
  return {
    id: item.id,
    name: [...item.affixes.map(({ id }) => affixById(id).name), base.name].join(' '),
    slot: SLOTS_FOR[base.kind][0]!,
    slots: SLOTS_FOR[base.kind],
    rarity: item.rarity,
    reach: base.reach,
    levelRequirement: item.levelRequirement,
    locked: item.locked === true,
    affixes: item.affixes.map(({ id }) => id),
    stats: itemStats(item),
    unique: unique && { classId: unique.classId, className: CLASSES[unique.classId].className, change: unique.change, line: unique.line },
  };
}

// Save validation.

const isAffix = (value: unknown): boolean =>
  isRecord(value) && AFFIXES.some((affix) => affix.id === value['id']) && isNumber(value['value']);

export function isItem(value: unknown): value is ItemState {
  if (!isRecord(value) || typeof value['baseId'] !== 'string') return false;
  const { id, baseId, rarity, affixes, levelRequirement, scale, locked } = value;
  if (locked !== undefined && locked !== true) return false;
  if (!Object.hasOwn(ITEM_BASES, baseId) && !isUniqueId(baseId)) return false;
  // A unique has no Affixes and carries its scale; nothing else does.
  if ((rarity === 'unique') !== isUniqueId(baseId) || (rarity === 'unique') !== isNumber(scale)) return false;
  return (
    isNumber(id) &&
    Number.isInteger(id) &&
    RARITIES.includes(rarity as Rarity) &&
    Array.isArray(affixes) &&
    affixes.every(isAffix) &&
    isNumber(levelRequirement)
  );
}

export const isEquipped = (value: unknown): boolean =>
  isRecord(value) &&
  Object.entries(value).every(([slot, item]) => (SLOTS as readonly string[]).includes(slot) && isItem(item) && slotsOf(item).includes(slot as Slot));
