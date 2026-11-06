import { describe, expect, it } from 'vitest';
import type { ItemView } from '../sim';
import { queryStash, type StashQuery } from './stashQuery';

const NO_STATS = { power: 0, maxHealth: 0, armour: 0, poisonResistance: 0, critChance: 0, speed: 0 };
const item = (id: number, overrides: Partial<ItemView> = {}): ItemView => ({
  id,
  name: `Item ${id}`,
  slot: 'body',
  rarity: 'common',
  reach: null,
  levelRequirement: 1,
  affixes: [],
  stats: NO_STATS,
  ...overrides,
});

const ANY: StashQuery = { sort: 'newest', slot: 'all', rarity: 'all', affix: 'all' };
const ids = (items: readonly ItemView[]): number[] => items.map((found) => found.id);

const STASH = [
  item(1, { rarity: 'rare', levelRequirement: 5, slot: 'weapon', affixes: ['keen', 'sallow', 'swift'] }),
  item(4, { rarity: 'common', levelRequirement: 3 }),
  item(2, { rarity: 'magic', levelRequirement: 5, slot: 'trinket', affixes: ['sallow'] }),
  item(3, { rarity: 'rare', levelRequirement: 2, affixes: ['cruel', 'hale', 'keen'] }),
];

describe('queryStash', () => {
  it('sorts by newest, rarity, and level requirement', () => {
    expect(ids(queryStash(STASH, ANY))).toEqual([4, 3, 2, 1]);
    expect(ids(queryStash(STASH, { ...ANY, sort: 'rarity' }))).toEqual([3, 1, 2, 4]);
    expect(ids(queryStash(STASH, { ...ANY, sort: 'levelRequirement' }))).toEqual([2, 1, 4, 3]);
  });

  it('filters by slot, rarity, and Affix', () => {
    expect(ids(queryStash(STASH, { ...ANY, slot: 'body' }))).toEqual([4, 3]);
    expect(ids(queryStash(STASH, { ...ANY, rarity: 'rare' }))).toEqual([3, 1]);
    expect(ids(queryStash(STASH, { ...ANY, affix: 'sallow' }))).toEqual([2, 1]);
    expect(ids(queryStash(STASH, { ...ANY, slot: 'weapon', affix: 'sallow', rarity: 'rare' }))).toEqual([1]);
    expect(queryStash(STASH, { ...ANY, slot: 'trinket', rarity: 'common' })).toEqual([]);
  });

  it('leaves the list it was given untouched', () => {
    const before = ids(STASH);
    queryStash(STASH, { ...ANY, sort: 'rarity' });
    expect(ids(STASH)).toEqual(before);
  });
});
