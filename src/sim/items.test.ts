import { describe, expect, it } from 'vitest';
import {
  advance,
  applyAction,
  createGame,
  deserializeGame,
  partyUnitSpecs,
  rollItem,
  serializeGame,
  simulateBattle,
  TICK_MS,
  viewGame,
  viewStash,
  type FloorNumber,
  type Game,
  type GameEvent,
  type GameSetup,
  type HeroId,
  type HeroView,
  type ItemSpec,
  type Rarity,
  type UnitSpec,
} from './index';

const SEEDS = 20_000;
const rolls = (floor: FloorNumber, count = SEEDS): ItemSpec[] =>
  Array.from({ length: count }, (_, seed) => rollItem(seed, floor));
const withRarity = (floor: FloorNumber, rarity: Rarity): ItemSpec[] =>
  rolls(floor).filter((item) => item.rarity === rarity);

describe('rolling items', () => {
  it('the same Seed produces the same items', () => {
    expect(rolls(3, 500)).toEqual(rolls(3, 500));
    const distinct = new Set(rolls(3, 500).map((item) => JSON.stringify(item)));
    expect(distinct.size).toBeGreaterThan(100);
  });

  it('items roll Affix counts by rarity with no repeats', () => {
    for (const floor of [1, 2, 3] as const) {
      for (const item of rolls(floor, 5_000)) {
        const ids = item.affixes.map((affix) => affix.id);
        expect(new Set(ids).size).toBe(ids.length);
        const [low, high] = { common: [0, 0], magic: [1, 2], rare: [3, 4] }[item.rarity] as [number, number];
        expect(ids.length).toBeGreaterThanOrEqual(low);
        expect(ids.length).toBeLessThanOrEqual(high);
      }
    }
    const counts = new Set(withRarity(3, 'rare').map((item) => item.affixes.length));
    expect([...counts].sort()).toEqual([3, 4]);
  });

  it.each([
    [1, 0.8, 0.18, 0.02],
    [2, 0.72, 0.23, 0.05],
    [3, 0.62, 0.28, 0.1],
  ] as const)("Rarity odds match each Floor's table across many Seeds: Floor %i", (floor, common, magic, rare) => {
    const share = (rarity: Rarity) => withRarity(floor, rarity).length / SEEDS;
    expect(Math.abs(share('common') - common)).toBeLessThan(0.015);
    expect(Math.abs(share('magic') - magic)).toBeLessThan(0.015);
    expect(Math.abs(share('rare') - rare)).toBeLessThan(0.01);
  });

  it("a common is never a blank Saint's Knuckle, while magic and rare can be Saint's Knuckles", () => {
    expect(withRarity(3, 'common').some((item) => item.baseId === 'saints-knuckle')).toBe(false);
    expect(withRarity(3, 'magic').some((item) => item.baseId === 'saints-knuckle')).toBe(true);
    expect(withRarity(3, 'rare').some((item) => item.baseId === 'saints-knuckle')).toBe(true);
  });

  it('Affix values roll in their range, scaled by Floor', () => {
    const keens = (floor: FloorNumber) =>
      rolls(floor).flatMap((item) => item.affixes.filter((affix) => affix.id === 'keen').map((affix) => affix.value));
    expect([...new Set(keens(1))].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    // 1-4 × 1.4 rounds to 1, 3, 4, 6.
    expect([...new Set(keens(3))].sort((a, b) => a - b)).toEqual([1, 3, 4, 6]);
  });

  it('the level requirement follows the Floor, and a rare adds 1', () => {
    const requirement = (floor: FloorNumber, rarity: Rarity) =>
      new Set(withRarity(floor, rarity).map((item) => item.levelRequirement));
    expect(requirement(1, 'common')).toEqual(new Set([1]));
    expect(requirement(1, 'rare')).toEqual(new Set([2]));
    expect(requirement(2, 'magic')).toEqual(new Set([3]));
    expect(requirement(2, 'rare')).toEqual(new Set([4]));
    expect(requirement(3, 'common')).toEqual(new Set([4]));
    expect(requirement(3, 'rare')).toEqual(new Set([5]));
  });
});

const item = (overrides: Partial<ItemSpec> = {}): ItemSpec => ({
  baseId: 'rust-mail',
  rarity: 'common',
  affixes: [],
  levelRequirement: 1,
  ...overrides,
});
const SALLOW_MAIL = item({ rarity: 'magic', affixes: [{ id: 'sallow', value: 15 }] });
const HALE_MAIL = item({ rarity: 'magic', affixes: [{ id: 'hale', value: 30 }] });
const BONE_SLING = item({ baseId: 'bone-sling' });

type Scenario = NonNullable<GameSetup['scenario']>;
const game = (scenario: Scenario = {}, seed = 1): Game => createGame({ seed, scenario });
const heroIn = (from: Game, id: HeroId): HeroView => viewGame(from).heroes.find((hero) => hero.id === id)!;
const stashIds = (from: Game): number[] => viewStash(from).map((stashed) => stashed.id);
const firstInStash = (from: Game): number => viewStash(from)[0]!.id;

function stepUntil(from: Game, wanted: GameEvent['type'], seen: GameEvent[] = [], limit = 400_000): void {
  for (let i = 0; i < limit; i++) {
    let found = false;
    advance(from, TICK_MS, (event) => {
      seen.push(event);
      if (event.type === wanted) found = true;
    });
    if (found) return;
  }
  throw new Error(`${wanted} never came`);
}

describe('starter gear', () => {
  it('each Hero starts with a common weapon, and nothing else, with an empty Stash', () => {
    const start = game();
    const weapons = viewGame(start).heroes.map((hero) => hero.equipment.weapon?.name);
    expect(weapons).toEqual(['Iron Cudgel', 'Flensing Knife', 'Bone Sling']);
    for (const hero of viewGame(start).heroes) {
      expect(hero.equipment.weapon?.rarity).toBe('common');
      expect(hero.equipment.body).toBeNull();
      expect(hero.equipment.trinket).toBeNull();
    }
    expect(viewStash(start)).toEqual([]);
  });

  it('starter weapons set power and Reach, and the Flensing Knife adds crit', () => {
    const specs = partyUnitSpecs(game());
    expect(specs.map((spec) => spec.power)).toEqual([14, 17, 14]);
    expect(specs.map((spec) => spec.reach)).toEqual(['melee', 'melee', 'ranged']);
    expect(specs[1]?.critChance).toBe(10);
  });
});

describe('equipping', () => {
  it('equipItem is refused below the level requirement', () => {
    const start = game({ heroLevel: 3, stash: [item({ levelRequirement: 4 })] });
    const before = serializeGame(start);
    expect(applyAction(start, { type: 'equipItem', heroId: 'huntsman', itemId: firstInStash(start) })).toEqual({ ok: false, reason: 'belowLevelRequirement' });
    expect(serializeGame(start)).toBe(before);
  });

  it('equipItem accepts a Hero exactly at the level requirement', () => {
    const start = game({ heroLevel: 4, stash: [item({ levelRequirement: 4 })] });
    expect(applyAction(start, { type: 'equipItem', heroId: 'huntsman', itemId: firstInStash(start) })).toEqual({ ok: true });
  });

  it('equipItem swaps the old item back into the Stash', () => {
    const start = game({ stash: [BONE_SLING] });
    const oldWeapon = heroIn(start, 'huntsman').equipment.weapon!;
    const newId = firstInStash(start);
    expect(applyAction(start, { type: 'equipItem', heroId: 'huntsman', itemId: newId })).toEqual({ ok: true });
    expect(heroIn(start, 'huntsman').equipment.weapon?.id).toBe(newId);
    expect(stashIds(start)).toEqual([oldWeapon.id]);
  });

  it('equipping an item during fallback resumes Guardian attempts', () => {
    const start = game({ setbacks: 3, stash: [item()] });
    const seen: GameEvent[] = [];
    applyAction(start, { type: 'equipItem', heroId: 'huntsman', itemId: firstInStash(start) }, (event) => seen.push(event));
    expect(viewGame(start).wall).toMatchObject({ fallenBack: false, setbacksTowardsFallback: 0 });
    expect(seen.map((event) => event.type)).toEqual(['retryingGuardian']);
  });

  it('equipping before the 3rd Setback does not clear the count, and unequipping never ends a fallback', () => {
    const counting = game({ setbacks: 2, stash: [item()] });
    applyAction(counting, { type: 'equipItem', heroId: 'huntsman', itemId: firstInStash(counting) });
    expect(viewGame(counting).wall.setbacksTowardsFallback).toBe(2);

    const fallen = game({ setbacks: 3 });
    applyAction(fallen, { type: 'unequipItem', heroId: 'huntsman', slot: 'weapon' });
    expect(viewGame(fallen).wall.fallenBack).toBe(true);
  });

  it('unequipItem returns the item to the Stash', () => {
    const start = game();
    const weapon = heroIn(start, 'sin-eater').equipment.weapon!;
    expect(applyAction(start, { type: 'unequipItem', heroId: 'sin-eater', slot: 'weapon' })).toEqual({ ok: true });
    expect(heroIn(start, 'sin-eater').equipment.weapon).toBeNull();
    expect(stashIds(start)).toEqual([weapon.id]);
  });

  it('unequipItem is refused on an empty Slot', () => {
    expect(applyAction(game(), { type: 'unequipItem', heroId: 'sin-eater', slot: 'trinket' })).toEqual({ ok: false, reason: 'emptySlot' });
  });

  it('a Hero with no weapon fights in melee with no weapon power', () => {
    const start = game();
    applyAction(start, { type: 'unequipItem', heroId: 'lamplighter', slot: 'weapon' });
    const spec = partyUnitSpecs(start).find((unit) => unit.id === 'lamplighter')!;
    expect(spec.reach).toBe('melee');
    expect(spec.power).toBe(11);
  });

  it('an unknown itemId is refused and changes nothing', () => {
    const start = game({ stash: [item()] });
    const before = serializeGame(start);
    expect(applyAction(start, { type: 'equipItem', heroId: 'huntsman', itemId: 999 })).toEqual({ ok: false, reason: 'unknownItem' });
    const equippedElsewhere = heroIn(start, 'sin-eater').equipment.weapon!.id;
    expect(applyAction(start, { type: 'equipItem', heroId: 'huntsman', itemId: equippedElsewhere })).toEqual({ ok: false, reason: 'unknownItem' });
    expect(serializeGame(start)).toBe(before);
  });

  it('equipped gear changes a Hero\'s stats in the next Battle, not the one under way', () => {
    const start = game({ stash: [HALE_MAIL] });
    stepUntil(start, 'battleStarted');
    const health = viewGame(start).battle!.party[0]!.maxHealth;
    applyAction(start, { type: 'equipItem', heroId: 'sin-eater', itemId: firstInStash(start) });
    expect(heroIn(start, 'sin-eater').stats.maxHealth).toBe(health + 30);
    expect(viewGame(start).battle!.party[0]!.maxHealth).toBe(health);

    stepUntil(start, 'battleEnded');
    stepUntil(start, 'battleStarted');
    expect(viewGame(start).battle!.party[0]!.maxHealth).toBe(health + 30);
  });

  it('removing a Hale item clamps health to the lower maximum', () => {
    const start = game({ equipped: { 'sin-eater': [HALE_MAIL] } });
    expect(heroIn(start, 'sin-eater').health).toBe(190);
    applyAction(start, { type: 'unequipItem', heroId: 'sin-eater', slot: 'body' });
    expect(heroIn(start, 'sin-eater').health).toBe(160);
  });

  it('removing a Hale item during a Battle still clamps health when the Battle ends', () => {
    const start = game({ heroLevel: 40, equipped: { 'sin-eater': [HALE_MAIL] } });
    stepUntil(start, 'battleStarted');
    applyAction(start, { type: 'unequipItem', heroId: 'sin-eater', slot: 'body' });
    stepUntil(start, 'battleEnded');
    const hero = heroIn(start, 'sin-eater');
    expect(hero.health).toBeLessThanOrEqual(hero.stats.maxHealth);
  });

  it('a Sallow item raises poison resistance and reduces Poison damage in Battle', () => {
    const poisoner: UnitSpec = {
      id: 'poisoner',
      name: 'Poisoner',
      health: 10_000,
      power: 10,
      actionInterval: 20,
      row: 'front',
      reach: 'ranged',
      targeting: 'any',
      damageType: 'poison',
      armour: 0,
      resistances: {},
      critChance: 0,
      poisonOnHit: 5,
    };
    const damageTaken = (start: Game): number => {
      const { log } = simulateBattle({ seed: 3, teams: { a: partyUnitSpecs(start).filter((unit) => unit.id === 'sin-eater'), b: [poisoner] }, maxTicks: 300 });
      const ticks = log.filter((event) => event.type === 'effectDamage' && event.damageType === 'poison');
      expect(ticks.length).toBeGreaterThan(0);
      return ticks.reduce((total, event) => total + (event.type === 'effectDamage' ? event.damage : 0), 0);
    };

    const bare = game({ heroLevel: 40 });
    const sallow = game({ heroLevel: 40, equipped: { 'sin-eater': [SALLOW_MAIL] } });
    expect(heroIn(bare, 'sin-eater').stats.poisonResistance).toBe(0);
    expect(heroIn(sallow, 'sin-eater').stats.poisonResistance).toBe(15);
    expect(damageTaken(sallow)).toBeLessThan(damageTaken(bare));
  });

  it('a Swift item shortens the time between actions', () => {
    const start = game({ equipped: { huntsman: [item({ baseId: 'saints-knuckle', affixes: [{ id: 'swift', value: 40 }] })] } });
    expect(heroIn(game(), 'huntsman').stats.actionInterval).toBe(27);
    expect(heroIn(start, 'huntsman').stats.actionInterval).toBe(20);
  });

  it('a ranged weapon makes melee skills unavailable', () => {
    const skillRanks = { huntsman: { 'bleeders-cut': 1 } };
    const enemy: UnitSpec = { id: 'e', name: 'E', health: 2_000, power: 1, actionInterval: 30, row: 'front', reach: 'melee', targeting: 'frontFirst', damageType: 'physical', armour: 0, resistances: {}, critChance: 0 };
    const cuts = (start: Game): number =>
      simulateBattle({ seed: 1, teams: { a: partyUnitSpecs(start).filter((unit) => unit.id === 'huntsman'), b: [enemy] }, maxTicks: 300 })
        .log.filter((event) => event.type === 'skill' && event.skillId === 'bleeders-cut').length;
    const blocked = (start: Game) => heroIn(start, 'huntsman').skills.find((skill) => skill.id === 'bleeders-cut')?.blockedByWeapon;

    const start = game({ heroLevel: 2, skillRanks, stash: [BONE_SLING] });
    expect(cuts(start)).toBeGreaterThan(0);
    expect(blocked(start)).toBe(false);

    applyAction(start, { type: 'equipItem', heroId: 'huntsman', itemId: firstInStash(start) });
    expect(partyUnitSpecs(start).find((unit) => unit.id === 'huntsman')?.reach).toBe('ranged');
    expect(cuts(start)).toBe(0);
    expect(blocked(start)).toBe(true);
    expect(heroIn(start, 'huntsman').skills.filter((skill) => skill.blockedByWeapon).map((skill) => skill.id)).toEqual(['bleeders-cut', 'the-long-cut']);
  });
});

describe('item saves', () => {
  it('serializeGame round-trips a Game with items', () => {
    const start = game({ stash: [SALLOW_MAIL, BONE_SLING], equipped: { huntsman: [HALE_MAIL] } });
    applyAction(start, { type: 'equipItem', heroId: 'sin-eater', itemId: firstInStash(start) });
    advance(start, 60_000);
    const text = serializeGame(start);
    const loaded = deserializeGame(text)!;
    expect(serializeGame(loaded)).toBe(text);
    expect(viewStash(loaded)).toEqual(viewStash(start));

    advance(start, 60_000);
    advance(loaded, 60_000);
    expect(serializeGame(loaded)).toBe(serializeGame(start));
  });

  it.each([
    ['a Stash item with an unknown base', (save: any) => { save.game.stash[0].baseId = 'nothing'; }],
    ['a Stash item with an unknown Affix', (save: any) => { save.game.stash[0].affixes = [{ id: 'nothing', value: 1 }]; }],
    ['an item in the wrong Slot', (save: any) => { save.game.heroes[0].equipped.body = save.game.heroes[0].equipped.weapon; }],
    ['a missing Stash', (save: any) => { delete save.game.stash; }],
    ['a repeated item id', (save: any) => { save.game.stash[0].id = save.game.heroes[0].equipped.weapon.id; }],
    ['an item id not yet handed out', (save: any) => { save.game.stash[0].id = save.game.nextItemId; }],
  ])('deserializeGame refuses %s', (_name, damage) => {
    const save = JSON.parse(serializeGame(game({ stash: [SALLOW_MAIL] })));
    damage(save);
    expect(deserializeGame(JSON.stringify(save))).toBeNull();
  });
});

describe('drops', () => {
  const strong = { heroLevel: 40 } satisfies Scenario;
  const atGuardian = { heroLevel: 40, startAt: { floor: 3, room: 'guardian' } } satisfies Scenario;

  /** The most recent event before each itemFound that says where it came from. */
  function sources(seen: readonly GameEvent[]): string[] {
    const found: string[] = [];
    let last = '';
    for (const event of seen) {
      if (event.type === 'chestOpened' || event.type === 'battleEnded' || event.type === 'guardianFell') last = event.type;
      if (event.type === 'itemFound') found.push(last);
    }
    return found;
  }

  it('a chest, a Battle, and a Guardian kill can each add an item to the Stash', () => {
    const played = game(strong);
    const seen: GameEvent[] = [];
    advance(played, 7_200_000, (event) => seen.push(event));
    expect(new Set(sources(seen))).toEqual(new Set(['chestOpened', 'battleEnded', 'guardianFell']));
    expect(viewStash(played).map((stashed) => stashed.name)).toEqual(
      seen.flatMap((event) => (event.type === 'itemFound' ? [event.item.name] : [])),
    );
  });

  it('chests hold an item 60% of the time, Battles 10%, and Guardian kills always', () => {
    const seen: GameEvent[] = [];
    for (let seed = 1; seed <= 5; seed++) advance(game(strong, seed), 7_200_000, (event) => seen.push(event));
    const found = sources(seen);
    const count = (source: string) => found.filter((candidate) => candidate === source).length;
    const events = (type: GameEvent['type']) => seen.filter((event) => event.type === type).length;
    const battlesOutsideGuardian = events('battleEnded') - events('guardianFell');
    expect(count('chestOpened') / events('chestOpened')).toBeCloseTo(0.6, 1);
    expect(count('battleEnded') / battlesOutsideGuardian).toBeCloseTo(0.1, 1);
    expect(count('guardianFell')).toBe(events('guardianFell'));
  });

  it('a lost Battle drops nothing', () => {
    const played = game({ startAt: { floor: 3, room: 'guardian' } });
    const seen: GameEvent[] = [];
    stepUntil(played, 'wipe', seen);
    expect(seen.some((event) => event.type === 'itemFound')).toBe(false);
  });

  it('the first Guardian kill drops a rare, and later kills may not', () => {
    const killRarity = (scenario: Scenario, seed: number): Rarity => {
      const played = game(scenario, seed);
      stepUntil(played, 'guardianFell');
      const stash = viewStash(played);
      return stash[stash.length - 1]!.rarity;
    };
    const first = Array.from({ length: 30 }, (_, seed) => killRarity(atGuardian, seed));
    const later = Array.from({ length: 30 }, (_, seed) => killRarity({ ...atGuardian, lampLit: true }, seed));
    expect(new Set(first)).toEqual(new Set(['rare']));
    expect(new Set(later).has('common')).toBe(true);
  });

  it('only the first kill in a Game is sure to drop a rare', () => {
    const rarities: Rarity[][] = Array.from({ length: 10 }, (_, seed) => {
      const kills: Rarity[] = [];
      let killed = false;
      advance(game(strong, seed), 14_400_000, (event) => {
        if (event.type === 'guardianFell') killed = true;
        if (event.type === 'itemFound' && killed) kills.push(event.item.rarity);
        if (event.type === 'returnedToTown') killed = false;
      });
      return kills;
    });
    for (const kills of rarities) {
      expect(kills.length).toBeGreaterThan(1);
      expect(kills[0]).toBe('rare');
    }
    expect(rarities.flatMap((kills) => kills.slice(1))).toContain('common');
  });

  it('a rare from the first Guardian kill can be equipped and changes the stat sheet', () => {
    const played = game(atGuardian);
    stepUntil(played, 'guardianFell');
    const rare = viewStash(played).at(-1)!;
    const before = heroIn(played, 'sin-eater').stats;
    expect(applyAction(played, { type: 'equipItem', heroId: 'sin-eater', itemId: rare.id })).toEqual({ ok: true });
    expect(heroIn(played, 'sin-eater').stats).not.toEqual(before);
  });

  it('the same Seed drops the same items in play', () => {
    const items = () => {
      const played = game(strong, 9);
      advance(played, 3_600_000);
      return viewStash(played);
    };
    expect(items().length).toBeGreaterThan(5);
    expect(items()).toEqual(items());
  });

  it('stashRevision changes only when the Stash does', () => {
    const played = game(strong, 9);
    const revision = () => viewGame(played).stashRevision;
    const start = revision();
    stepUntil(played, 'battleStarted');
    expect(revision()).toBe(start);
    stepUntil(played, 'itemFound');
    const found = revision();
    expect(found).toBeGreaterThan(start);
    applyAction(played, { type: 'equipItem', heroId: 'huntsman', itemId: viewStash(played)[0]!.id });
    expect(revision()).toBeGreaterThan(found);
  });
});
