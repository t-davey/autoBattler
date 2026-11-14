// The Stash's cap, locks, auto-salvage rule, and Salvage.
import { isNumber, isRecord } from './guards';
import { AUTO_SALVAGE_RULES, SALVAGE_BY_RARITY, STASH_CAPACITY, VALUE_BONUS, type AutoSalvageRule, type ItemStat } from './content/items';
import { itemStats, viewItem, type ItemId, type ItemState, type ItemView } from './items';

/** The Party's unequipped items, its Salvage, and how loot is kept. */
export interface Stash {
  /** In the order they arrived. */
  readonly stash: ItemState[];
  /** Counts changes to the Stash. */
  stashRevision: number;
  salvage: number;
  autoSalvage: AutoSalvageRule;
  /** Items with this stat are kept whatever the rule. Null keeps nothing extra. */
  keepStat: ItemStat | null;
}

/** Why an item was broken down: the Party's rule, a full Stash, or the player's hand. */
export type SalvageCause = 'rule' | 'full' | 'hand';
export type StashEvent =
  | { readonly type: 'itemFound'; readonly item: ItemView }
  | { readonly type: 'itemSalvaged'; readonly item: ItemView; readonly salvage: number; readonly cause: SalvageCause };
export type StashRefusal = 'unknownItem' | 'lockedItem' | 'badAutoSalvage';
type StashSink = (event: StashEvent) => void;

const ITEM_STATS: readonly ItemStat[] = ['power', 'maxHealth', 'armour', 'poisonResistance', 'critChance', 'speed', 'maxOil'];
const isRule = (value: unknown): value is AutoSalvageRule => typeof value === 'string' && Object.hasOwn(AUTO_SALVAGE_RULES, value);
const isKeepStat = (value: unknown): value is ItemStat | null => value === null || ITEM_STATS.includes(value as ItemStat);

/** Ranks items for salvaging when the Stash is full, lowest first. Uniques have no rank, since only a hand salvages them. */
export const itemValue = (item: ItemState): number =>
  item.rarity === 'unique' ? Infinity : item.levelRequirement + VALUE_BONUS[item.rarity];

/** Every change to the Stash comes through here, so its revision always moves. */
export function putInStash(stash: Stash, item: ItemState): void {
  stash.stash.push(item);
  stash.stashRevision++;
}

export function takeFromStash(stash: Stash, itemId: ItemId): ItemState | undefined {
  const index = stash.stash.findIndex((item) => item.id === itemId);
  if (index === -1) return undefined;
  stash.stashRevision++;
  return stash.stash.splice(index, 1)[0];
}

function breakDown(stash: Stash, item: ItemState, cause: SalvageCause, sink: StashSink): void {
  const salvage = SALVAGE_BY_RARITY[item.rarity];
  stash.salvage += salvage;
  stash.stashRevision++;
  sink({ type: 'itemSalvaged', item: viewItem(item), salvage, cause });
}

/** Whether the Party's rule salvages this item as it lands. */
function ruleSalvages(stash: Stash, item: ItemState): boolean {
  if (!AUTO_SALVAGE_RULES[stash.autoSalvage].includes(item.rarity)) return false;
  return stash.keepStat === null || itemStats(item)[stash.keepStat] <= 0;
}

/** Salvages the lowest-value unlocked items, the oldest first on a tie, until the Stash fits. */
function trimToCapacity(stash: Stash, sink: StashSink): void {
  while (stash.stash.length > STASH_CAPACITY) {
    let lowest: ItemState | undefined;
    for (const item of stash.stash) {
      if (item.locked || item.rarity === 'unique') continue;
      if (!lowest || itemValue(item) < itemValue(lowest)) lowest = item;
    }
    if (!lowest) return;
    takeFromStash(stash, lowest.id);
    breakDown(stash, lowest, 'full', sink);
  }
}

/** A found item lands: the rule may salvage it at once, and a full Stash salvages its lowest-value item. */
export function receiveLoot(stash: Stash, item: ItemState, sink: StashSink): void {
  sink({ type: 'itemFound', item: viewItem(item) });
  if (ruleSalvages(stash, item)) {
    breakDown(stash, item, 'rule', sink);
    return;
  }
  putInStash(stash, item);
  trimToCapacity(stash, sink);
}

function findAll(stash: Stash, itemIds: readonly ItemId[]): ItemState[] | null {
  const items = itemIds.map((id) => stash.stash.find((item) => item.id === id));
  return items.every((item) => item !== undefined) ? (items as ItemState[]) : null;
}

/** Breaks down Stash items by hand. Uniques can go this way, but locked items can't. */
export function salvageItems(stash: Stash, itemIds: readonly ItemId[], sink: StashSink): StashRefusal | null {
  const items = findAll(stash, itemIds);
  if (!items) return 'unknownItem';
  if (items.some((item) => item.locked)) return 'lockedItem';
  for (const item of items) {
    takeFromStash(stash, item.id);
    breakDown(stash, item, 'hand', sink);
  }
  return null;
}

export function lockItems(stash: Stash, itemIds: readonly ItemId[], locked: boolean): StashRefusal | null {
  const items = findAll(stash, itemIds);
  if (!items) return 'unknownItem';
  for (const item of items) {
    if (locked) item.locked = true;
    else delete item.locked;
  }
  stash.stashRevision++;
  return null;
}

export function setAutoSalvage(stash: Stash, rule: AutoSalvageRule, keepStat: ItemStat | null): StashRefusal | null {
  if (!isRule(rule) || !isKeepStat(keepStat)) return 'badAutoSalvage';
  stash.autoSalvage = rule;
  stash.keepStat = keepStat;
  return null;
}

/** Whether saved data holds sound Salvage and settings. */
export const isStashRules = (value: Record<string, unknown>): boolean =>
  isNumber(value['salvage']) && value['salvage'] >= 0 && isRule(value['autoSalvage']) && isKeepStat(value['keepStat']);

/** Fills in what a version 7 or 8 save lacks: no Salvage, everything kept. */
export function withStashDefaults(game: unknown): void {
  if (!isRecord(game)) return;
  game['salvage'] ??= 0;
  game['autoSalvage'] ??= 'keepEverything';
  game['keepStat'] ??= null;
}
