import { describe, expect, it } from 'vitest';
import { createGame, viewStash, type ItemView } from '../sim';
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

const ANY: StashQuery = { sort: 'newest', slot: 'all', rarity: 'all', stat: 'all' };
const ids = (items: readonly ItemView[]): number[] => items.map((found) => found.id);

const STASH = [
  item(1, { rarity: 'rare', levelRequirement: 5, slot: 'weapon', stats: { ...NO_STATS, power: 5, poisonResistance: 12 } }),
  item(4, { rarity: 'common', levelRequirement: 3, stats: { ...NO_STATS, armour: 4, poisonResistance: 8 } }),
  item(2, { rarity: 'magic', levelRequirement: 5, slot: 'trinket', stats: { ...NO_STATS, poisonResistance: 6 } }),
  item(3, { rarity: 'rare', levelRequirement: 2, stats: { ...NO_STATS, critChance: 3, maxHealth: 12 } }),
];

describe('queryStash', () => {
  it('sorts by newest, rarity, and level requirement', () => {
    expect(ids(queryStash(STASH, ANY))).toEqual([4, 3, 2, 1]);
    expect(ids(queryStash(STASH, { ...ANY, sort: 'rarity' }))).toEqual([3, 1, 2, 4]);
    expect(ids(queryStash(STASH, { ...ANY, sort: 'levelRequirement' }))).toEqual([2, 1, 4, 3]);
  });

  it('filters by slot, rarity, and stat, counting built-in stats as well as Affixes', () => {
    expect(ids(queryStash(STASH, { ...ANY, slot: 'body' }))).toEqual([4, 3]);
    expect(ids(queryStash(STASH, { ...ANY, rarity: 'rare' }))).toEqual([3, 1]);
    // Item 4 stands for a plain Waxed Shroud: poison resistance built in, with no Affix.
    expect(ids(queryStash(STASH, { ...ANY, stat: 'poisonResistance' }))).toEqual([4, 2, 1]);
    expect(ids(queryStash(STASH, { ...ANY, stat: 'speed' }))).toEqual([]);
    expect(ids(queryStash(STASH, { ...ANY, slot: 'weapon', stat: 'poisonResistance', rarity: 'rare' }))).toEqual([1]);
    expect(queryStash(STASH, { ...ANY, slot: 'trinket', rarity: 'common' })).toEqual([]);
  });

  it('the poison resistance filter finds a plain Waxed Shroud from the sim', () => {
    const shroud = { baseId: 'waxed-shroud', rarity: 'common', affixes: [], levelRequirement: 1 } as const;
    const stash = viewStash(createGame({ seed: 1, scenario: { stash: [shroud] } }));
    expect(queryStash(stash, { ...ANY, stat: 'poisonResistance' }).map((found) => found.name)).toEqual(['Waxed Shroud']);
    expect(queryStash(stash, { ...ANY, stat: 'power' })).toEqual([]);
  });

  it('leaves the list it was given untouched', () => {
    const before = ids(STASH);
    queryStash(STASH, { ...ANY, sort: 'rarity' });
    expect(ids(STASH)).toEqual(before);
  });
});
