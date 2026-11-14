import { describe, expect, it } from 'vitest';
import {
  advance,
  AFFIXES,
  applyAction,
  battleWorth,
  createGame,
  depthTuning,
  deserializeGame,
  LAMPS,
  serializeGame,
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
const magic = (overrides: Partial<ItemSpec> = {}): ItemSpec => ({
  baseId: 'rust-mail',
  rarity: 'magic',
  affixes: [{ id: 'keen', value: 2 }, { id: 'hale', value: 20 }],
  levelRequirement: 31,
  ...overrides,
});

function eventsUntil(played: Game, wanted: (event: GameEvent) => boolean, limit = 400_000): GameEvent[] {
  const seen: GameEvent[] = [];
  for (let i = 0; i < limit; i++) {
    let found = false;
    advance(played, TICK_MS, (event) => {
      seen.push(event);
      if (wanted(event)) found = true;
    });
    if (found) return seen;
  }
  throw new Error('never came');
}

describe('gold', () => {
  it('a won Battle gives a Battle’s worth at its depth, 5 + depth', () => {
    const played = game({ heroLevel: 40, startAt: { floor: 25, room: 0 } });
    const seen = eventsUntil(played, (event) => event.type === 'goldFound');
    expect(seen.some((event) => event.type === 'battleEnded' && event.outcome === 'won')).toBe(true);
    expect(seen.at(-1)).toEqual({ type: 'goldFound', amount: 30 });
    expect(viewGame(played).gold).toBe(30);
  });

  it('a Guardian gives 10 Battles’ worth', () => {
    const played = game({ heroLevel: 60, lampsLit: 8, startAt: { floor: 5, room: 'guardian' } });
    const seen = eventsUntil(played, (event) => event.type === 'guardianFell');
    expect(seen.find((event) => event.type === 'goldFound')).toEqual({ type: 'goldFound', amount: 10 * battleWorth(5) });
  });
});

describe('respecs', () => {
  const built = (gold: number) => game({ heroLevel: 7, gold, skillRanks: { warrener: { 'bleeders-cut': 1 } } });

  it('cost 10 gold per Hero level, and nothing with no point spent', () => {
    const played = built(100);
    expect(viewGame(played).heroes.map((hero) => hero.respecCost)).toEqual([0, 70, 0]);
    expect(applyAction(played, { type: 'respec', heroId: 'warrener' })).toEqual({ ok: true });
    expect(viewGame(played).gold).toBe(30);
    expect(applyAction(played, { type: 'respec', heroId: 'sin-eater' })).toEqual({ ok: true });
    expect(viewGame(played).gold).toBe(30);
  });

  it('are refused without the gold', () => {
    const played = built(69);
    expect(applyAction(played, { type: 'respec', heroId: 'warrener' })).toEqual({ ok: false, reason: 'notEnoughGold' });
    expect(viewGame(played).heroes[1]!.pointsSpent).toBe(1);
  });
});

describe('rerolls', () => {
  it('change the picked Affix into one the item lacks, at the item’s depth, for Salvage', () => {
    for (let seed = 0; seed < 30; seed++) {
      const played = game({ salvage: 12, stash: [magic()] }, seed);
      const id = viewStash(played)[0]!.id;
      expect(viewStash(played)[0]!.rerollCost).toBe(5);
      expect(applyAction(played, { type: 'rerollAffix', itemId: id, affixId: 'keen' })).toEqual({ ok: true });
      const [item] = viewStash(played);
      expect(viewGame(played).salvage).toBe(7);
      expect(item!.affixes).toHaveLength(2);
      expect(item!.affixes).toContain('hale');
      expect(item!.affixes).not.toContain('keen');
      const fresh = AFFIXES.find((affix) => affix.id === item!.affixes.find((affixId) => affixId !== 'hale'))!;
      const value = item!.stats[fresh.stat] - (fresh.stat === 'armour' ? 8 : fresh.stat === 'maxHealth' ? 20 : 0);
      const scale = depthTuning(30).affixScale;
      expect(value).toBeGreaterThanOrEqual(Math.round(fresh.min * scale));
      expect(value).toBeLessThanOrEqual(Math.round(fresh.max * scale));
    }
  });

  it('work on worn items, and are refused without Salvage or an Affix', () => {
    const played = game({ salvage: 20, equipped: { 'sin-eater': [magic({ rarity: 'rare', levelRequirement: 1, affixes: [{ id: 'keen', value: 2 }, { id: 'hale', value: 20 }, { id: 'swift', value: 3 }] })] }, stash: [magic({ rarity: 'common', affixes: [] })] });
    const worn = viewGame(played).heroes[0]!.equipment.body!;
    expect(worn.rerollCost).toBe(15);
    expect(applyAction(played, { type: 'rerollAffix', itemId: worn.id, affixId: 'swift' })).toEqual({ ok: true });
    expect(viewGame(played).heroes[0]!.equipment.body!.affixes).not.toContain('swift');
    expect(applyAction(played, { type: 'rerollAffix', itemId: worn.id, affixId: 'keen' })).toEqual({ ok: false, reason: 'notEnoughSalvage' });
    expect(applyAction(played, { type: 'rerollAffix', itemId: viewStash(played)[0]!.id, affixId: 'keen' })).toEqual({ ok: false, reason: 'noSuchAffix' });
  });
});

describe('the merchant', () => {
  const lampDepth = (lit: number) => LAMPS[lit - 1]!.depth;

  it('stocks 4 items, plus 1 for every 2 Lamps, rolled at the deepest relit Lamp, magic or rare', () => {
    expect(viewGame(game()).town.merchant).toHaveLength(4);
    const town = viewGame(game({ lampsLit: 8 })).town;
    expect(town.merchant).toHaveLength(8);
    expect(town.shopDepth).toBe(lampDepth(8));
    for (const { item, price } of town.merchant) {
      expect(['magic', 'rare']).toContain(item.rarity);
      expect(item.levelRequirement).toBe(depthTuning(lampDepth(8)).levelRequirement + (item.rarity === 'rare' ? 1 : 0));
      expect(price).toBe((item.rarity === 'rare' ? 80 : 30) * battleWorth(lampDepth(8)));
    }
    expect(new Set(town.merchant.slice(0, 5).map(({ item }) => item.slot === 'secondTrinket' ? 'trinket' : item.slot)).size).toBe(5);
  });

  it('sells for gold into the Stash, and refuses without the gold', () => {
    const { price, item } = viewGame(game()).town.merchant[0]!;
    const poor = game({ gold: price - 1 });
    expect(applyAction(poor, { type: 'buyItem', index: 0 })).toEqual({ ok: false, reason: 'notEnoughGold' });
    const rich = game({ gold: price });
    expect(applyAction(rich, { type: 'buyItem', index: 0 })).toEqual({ ok: true });
    expect(viewGame(rich).gold).toBe(0);
    expect(viewStash(rich).map((bought) => bought.name)).toEqual([item.name]);
    expect(viewGame(rich).town.merchant).toHaveLength(3);
    expect(applyAction(rich, { type: 'buyItem', index: 9 })).toEqual({ ok: false, reason: 'unknownOffer' });
  });

  it('restocks each time the Party passes through Town', () => {
    const played = game({ gold: 100_000 });
    for (let i = 0; i < 4; i++) applyAction(played, { type: 'buyItem', index: 0 });
    expect(viewGame(played).town.merchant).toHaveLength(0);
    eventsUntil(played, (event) => event.type === 'returnedToTown');
    expect(viewGame(played).town.merchant).toHaveLength(4);
  });
});

describe('the gamble vendor', () => {
  it('sells a hidden item of the Slot, with better odds and uniques as Lamps relight', () => {
    const rolls = (lampsLit: number, count: number) => {
      const played = game({ lampsLit, gold: 1e9 });
      const price = viewGame(played).town.gamblePrice;
      expect(price).toBe(25 * battleWorth(lampsLit === 0 ? 1 : LAMPS[lampsLit - 1]!.depth));
      for (let i = 0; i < count; i++) expect(applyAction(played, { type: 'gamble', slot: 'helm' })).toEqual({ ok: true });
      expect(viewGame(played).gold).toBe(1e9 - price * count);
      return viewStash(played);
    };
    const early = rolls(4, 400);
    expect(early.every((item) => item.slot === 'helm' && item.rarity !== 'common' && item.rarity !== 'unique')).toBe(true);
    const share = (items: readonly { rarity: string }[], rarity: string) => items.filter((item) => item.rarity === rarity).length / items.length;
    // 28% + 2% for each of 4 Lamps, plus the 2% unique roll that has no unique to give.
    expect(share(early, 'rare')).toBeCloseTo(0.38, 1);
    const late = rolls(8, 1_000);
    expect(share(late, 'rare')).toBeCloseTo(0.44, 1);
    expect(share(late, 'unique')).toBeGreaterThan(0.005);
    expect(new Set(late.filter((item) => item.rarity === 'unique').map((item) => item.name))).toEqual(new Set(["The Layer-Out's Coif"]));
  });

  it('refuses without the gold', () => {
    expect(applyAction(game(), { type: 'gamble', slot: 'weapon' })).toEqual({ ok: false, reason: 'notEnoughGold' });
  });
});

describe('saves', () => {
  it('round-trip gold and stock, and load version 9 with none', () => {
    const played = game({ gold: 500 });
    const text = serializeGame(played);
    expect(serializeGame(deserializeGame(text)!)).toBe(text);
    const old = JSON.parse(text);
    old.version = 9;
    delete old.game.gold;
    delete old.game.merchant;
    expect(viewGame(deserializeGame(JSON.stringify(old))!)).toMatchObject({ gold: 0, town: { merchant: [] } });
  });
});
