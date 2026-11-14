import { describe, expect, it } from 'vitest';
import {
  advance,
  applyAction,
  beginCatchUp,
  continueCatchUp,
  createGame,
  deserializeGame,
  serializeGame,
  STASH_CAPACITY,
  TICK_MS,
  viewGame,
  viewStash,
  type Game,
  type GameEvent,
  type GameSetup,
  type ItemSpec,
} from './index';

type Scenario = NonNullable<GameSetup['scenario']>;
const game = (scenario: Scenario = {}, seed = 1): Game => createGame({ seed, scenario });
const spec = (overrides: Partial<ItemSpec> = {}): ItemSpec => ({ baseId: 'rust-mail', rarity: 'common', affixes: [], levelRequirement: 30, ...overrides });
const filler = (count: number, overrides: Partial<ItemSpec> = {}): ItemSpec[] => Array.from({ length: count }, () => spec(overrides));

/** Plays until the next item lands, returning every event on the way. */
function untilFound(played: Game, limit = 200_000): GameEvent[] {
  const seen: GameEvent[] = [];
  for (let i = 0; i < limit; i++) {
    let found = false;
    advance(played, TICK_MS, (event) => {
      seen.push(event);
      if (event.type === 'itemFound') found = true;
    });
    if (found) return seen;
  }
  throw new Error('no item came');
}
const salvagedIn = (events: readonly GameEvent[]) => events.flatMap((event) => (event.type === 'itemSalvaged' ? [event] : []));

describe('the Stash’s cap', () => {
  it('salvages the lowest-value unlocked item when a drop overfills it, by level requirement plus a rarity bonus', () => {
    // Value: a level 20 common is 20, a level 16 magic is 21, so the common goes first.
    // Floor 30 finds need level 31, so the new item is worth more than both.
    const played = game({ heroLevel: 40, startAt: { floor: 30, room: 0 }, stash: [...filler(STASH_CAPACITY - 2), spec({ rarity: 'magic', levelRequirement: 16, affixes: [{ id: 'keen', value: 1 }] }), spec({ levelRequirement: 20 })] });
    const lowestId = viewStash(played).find((item) => item.levelRequirement === 20)!.id;
    const [salvaged] = salvagedIn(untilFound(played));
    expect(salvaged).toMatchObject({ cause: 'full', salvage: 1 });
    expect(salvaged!.item.id).toBe(lowestId);
    expect(viewStash(played)).toHaveLength(STASH_CAPACITY);
    expect(viewGame(played).salvage).toBe(1);
  });

  it('salvages the older item on a tie', () => {
    const played = game({ stash: filler(STASH_CAPACITY, { levelRequirement: 1 }) });
    const [salvaged] = salvagedIn(untilFound(played));
    expect(salvaged!.item.id).toBe(viewStash(played)[0]!.id - 1);
  });

  it('skips locked items and uniques, and salvages the new item when nothing else can go', () => {
    const played = game({ stash: [...filler(STASH_CAPACITY - 1, { levelRequirement: 1 }), { baseId: 'dusk-taper', rarity: 'unique', affixes: [], levelRequirement: 1, scale: 1 }] });
    applyAction(played, { type: 'lockItems', itemIds: viewStash(played).filter((item) => item.rarity !== 'unique').map((item) => item.id), locked: true });
    const events = untilFound(played);
    const found = events.find((event) => event.type === 'itemFound');
    const [salvaged] = salvagedIn(events);
    expect(found?.type === 'itemFound' && salvaged?.item.id).toBe(found?.type === 'itemFound' && found.item.id);
    expect(viewStash(played).some((item) => item.rarity === 'unique')).toBe(true);
    expect(viewStash(played)).toHaveLength(STASH_CAPACITY);
  });
});

describe('locks', () => {
  it('stay on an item through equipping and unequipping', () => {
    const played = game({ stash: [spec({ levelRequirement: 1 })] });
    const id = viewStash(played)[0]!.id;
    applyAction(played, { type: 'lockItems', itemIds: [id], locked: true });
    applyAction(played, { type: 'equipItem', heroId: 'sin-eater', itemId: id });
    applyAction(played, { type: 'unequipItem', heroId: 'sin-eater', slot: 'body' });
    expect(viewStash(played)[0]).toMatchObject({ id, locked: true });
    applyAction(played, { type: 'lockItems', itemIds: [id], locked: false });
    expect(viewStash(played)[0]!.locked).toBe(false);
  });
});

describe('auto-salvage rules', () => {
  /** Plays an hour under a rule, pairing each found item with whether the rule salvaged it at once. */
  function underRule(rule: 'keepEverything' | 'commons' | 'commonsAndMagics', keepStat: 'poisonResistance' | null = null) {
    const played = game({ heroLevel: 20 });
    expect(applyAction(played, { type: 'setAutoSalvage', rule, keepStat })).toEqual({ ok: true });
    const events: GameEvent[] = [];
    advance(played, 3_600_000, (event) => events.push(event));
    const ruled = new Set(salvagedIn(events).filter((event) => event.cause === 'rule').map((event) => event.item.id));
    return { played, found: events.flatMap((event) => (event.type === 'itemFound' ? [{ item: event.item, salvaged: ruled.has(event.item.id) }] : [])) };
  }

  it('salvages the chosen rarities as they land, and keeps the rest', () => {
    for (const [rule, gone] of [['keepEverything', []], ['commons', ['common']], ['commonsAndMagics', ['common', 'magic']]] as const) {
      const { played, found } = underRule(rule);
      expect(found.length).toBeGreaterThan(20);
      for (const { item, salvaged } of found) expect(salvaged).toBe((gone as readonly string[]).includes(item.rarity));
      expect(viewStash(played).every((item) => !(gone as readonly string[]).includes(item.rarity))).toBe(true);
    }
  });

  it('keeps any item with the chosen stat, whatever the rule', () => {
    const { found } = underRule('commonsAndMagics', 'poisonResistance');
    const magics = found.filter(({ item }) => item.rarity === 'magic');
    expect(magics.some(({ item }) => item.stats.poisonResistance > 0)).toBe(true);
    for (const { item, salvaged } of magics) expect(salvaged).toBe(item.stats.poisonResistance === 0);
  });

  it('refuses a rule that doesn’t exist', () => {
    expect(applyAction(game(), { type: 'setAutoSalvage', rule: 'everything' as never, keepStat: null })).toEqual({ ok: false, reason: 'badAutoSalvage' });
  });
});

describe('Salvage', () => {
  it('gives 1, 3, 8, and 20 by rarity when salvaged by hand, and refuses locked items', () => {
    const played = game({
      stash: [
        spec(),
        spec({ rarity: 'magic', affixes: [{ id: 'keen', value: 1 }] }),
        spec({ rarity: 'rare', affixes: [{ id: 'keen', value: 1 }, { id: 'hale', value: 1 }, { id: 'swift', value: 1 }] }),
        { baseId: 'wake-platter', rarity: 'unique', affixes: [], levelRequirement: 1, scale: 1 },
      ],
    });
    const ids = viewStash(played).map((item) => item.id);
    applyAction(played, { type: 'lockItems', itemIds: [ids[0]!], locked: true });
    expect(applyAction(played, { type: 'salvageItems', itemIds: ids })).toEqual({ ok: false, reason: 'lockedItem' });
    expect(viewGame(played).salvage).toBe(0);
    const events: GameEvent[] = [];
    expect(applyAction(played, { type: 'salvageItems', itemIds: ids.slice(1) }, (event) => events.push(event))).toEqual({ ok: true });
    expect(salvagedIn(events).map((event) => [event.salvage, event.cause])).toEqual([[3, 'hand'], [8, 'hand'], [20, 'hand']]);
    expect(viewGame(played).salvage).toBe(31);
    expect(viewStash(played).map((item) => item.id)).toEqual([ids[0]]);
    expect(applyAction(played, { type: 'salvageItems', itemIds: [-1] })).toEqual({ ok: false, reason: 'unknownItem' });
  });
});

describe('the Away Report', () => {
  it('counts what the rule and a full Stash salvaged, naming rares lost to a full Stash', () => {
    const played = game({ heroLevel: 20, stash: filler(STASH_CAPACITY, { rarity: 'rare', levelRequirement: 1, affixes: [{ id: 'keen', value: 1 }] }) });
    applyAction(played, { type: 'setAutoSalvage', rule: 'commons', keepStat: null });
    const catchUp = beginCatchUp(played, 3_600_000);
    let report = null;
    while (!report) report = continueCatchUp(played, catchUp, 10_000);
    const { loot } = report;
    expect(loot.salvaged).toBeGreaterThanOrEqual(loot.common + loot.magic);
    expect(loot.salvageGained).toBeGreaterThan(loot.salvaged);
    expect(loot.lostToFullStash.length).toBeGreaterThan(0);
    expect(loot.lostToFullStash.every((item) => item.rarity === 'rare')).toBe(true);
  });
});

describe('saves', () => {
  it('round-trip Salvage, the rule, and locks', () => {
    const played = game({ stash: [spec()] });
    applyAction(played, { type: 'lockItems', itemIds: [viewStash(played)[0]!.id], locked: true });
    applyAction(played, { type: 'setAutoSalvage', rule: 'commons', keepStat: 'armour' });
    const text = serializeGame(played);
    const loaded = deserializeGame(text)!;
    expect(serializeGame(loaded)).toBe(text);
    expect(viewGame(loaded)).toMatchObject({ autoSalvage: 'commons', keepStat: 'armour' });
    expect(viewStash(loaded)[0]!.locked).toBe(true);
  });

  it('load a version 8 save with no Salvage and everything kept', () => {
    const old = JSON.parse(serializeGame(game({ stash: [spec()] })));
    old.version = 8;
    delete old.game.salvage;
    delete old.game.autoSalvage;
    delete old.game.keepStat;
    const loaded = deserializeGame(JSON.stringify(old))!;
    expect(viewGame(loaded)).toMatchObject({ salvage: 0, autoSalvage: 'keepEverything', keepStat: null });
  });

  it('refuse a bad lock or rule', () => {
    const bad = JSON.parse(serializeGame(game({ stash: [spec()] })));
    bad.game.stash[0].locked = false;
    expect(deserializeGame(JSON.stringify(bad))).toBeNull();
    const badRule = JSON.parse(serializeGame(game()));
    badRule.game.autoSalvage = 'everything';
    expect(deserializeGame(JSON.stringify(badRule))).toBeNull();
  });
});
