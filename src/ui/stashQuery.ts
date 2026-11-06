import type { ItemStat, ItemView, Rarity, Slot } from '../sim';

export type StashSort = 'newest' | 'rarity' | 'levelRequirement';

export interface StashQuery {
  readonly sort: StashSort;
  readonly slot: Slot | 'all';
  readonly rarity: Rarity | 'all';
  /** Matches any item with this stat, built in or from an Affix. */
  readonly stat: ItemStat | 'all';
}

export const emptyStashQuery: StashQuery = { sort: 'newest', slot: 'all', rarity: 'all', stat: 'all' };

const RARITY_RANK: Readonly<Record<Rarity, number>> = { rare: 0, magic: 1, common: 2 };

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
        (slot === 'all' || item.slot === slot) &&
        (rarity === 'all' || item.rarity === rarity) &&
        (stat === 'all' || item.stats[stat] > 0),
    )
    .sort(COMPARE[sort]);
}
