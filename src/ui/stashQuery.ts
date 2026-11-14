import type { ItemStat, ItemView, Rarity, Slot } from '../sim';

export type StashSort = 'newest' | 'rarity' | 'levelRequirement';

export interface StashQuery {
  readonly sort: StashSort;
  readonly slot: Slot | 'all';
  readonly rarity: Rarity | 'all';
  /** Matches any item with this stat, built in or from an Affix. */
  readonly stat: ItemStat | 'all';
}

export const emptyStashQuery: StashQuery = { sort: 'rarity', slot: 'all', rarity: 'all', stat: 'all' };

const RARITY_RANK: Readonly<Record<Rarity, number>> = { unique: 0, rare: 1, magic: 2, common: 3 };

const newestFirst = (a: ItemView, b: ItemView): number => b.id - a.id;

const COMPARE: Readonly<Record<StashSort, (a: ItemView, b: ItemView) => number>> = {
  newest: newestFirst,
  rarity: (a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] || newestFirst(a, b),
  levelRequirement: (a, b) => b.levelRequirement - a.levelRequirement || newestFirst(a, b),
};

/** What the Stash tab lists. Presentation only: it has no effect on rules. */
export function queryStash(items: readonly ItemView[], { sort, slot, rarity, stat }: StashQuery): readonly ItemView[] {
  return items
    .filter(
      (item) =>
        (slot === 'all' || item.slots.includes(slot)) &&
        (rarity === 'all' || item.rarity === rarity) &&
        (stat === 'all' || item.stats[stat] > 0),
    )
    .sort(COMPARE[sort]);
}

/** Identical items, listed as one. Their level requirements can differ. */
export interface ItemGroup {
  readonly key: string;
  /** The one to equip: the lowest level requirement, so any Hero who can use one of these can use it. */
  readonly item: ItemView;
  readonly count: number;
  readonly newestId: number;
  readonly highestLevel: number;
}

/** Groups items in the order given, so a group sits where its first item would. */
export function groupItems(items: readonly ItemView[]): readonly ItemGroup[] {
  const groups = new Map<string, ItemView[]>();
  for (const item of items) {
    const key = JSON.stringify([item.name, item.rarity, item.reach, item.stats]);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups].map(([key, group]) => ({
    key,
    item: group.reduce((lowest, item) => (item.levelRequirement < lowest.levelRequirement ? item : lowest)),
    count: group.length,
    newestId: Math.max(...group.map((item) => item.id)),
    highestLevel: Math.max(...group.map((item) => item.levelRequirement)),
  }));
}

/** The Slot to open on: the query's own, or else where its first match is, so a filter never opens on an empty list. */
export function openingSlot(items: readonly ItemView[], query: StashQuery): Slot {
  if (query.slot !== 'all') return query.slot;
  return queryStash(items, query)[0]?.slot ?? 'weapon';
}
