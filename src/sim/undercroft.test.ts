import { describe, expect, it } from 'vitest';
import { advance, createGame, depthTuning, simulateBattle, viewGame, type UnitSpec, type UnitView } from './index';

const unit = (id: string, overrides: Partial<UnitSpec> = {}): UnitSpec => ({
  id,
  name: id,
  health: 1_000,
  power: 0,
  actionInterval: 100_000,
  row: 'front',
  reach: 'melee',
  targeting: 'frontFirst',
  damageType: 'physical',
  armour: 0,
  resistances: {},
  critChance: 0,
  ...overrides,
});

/** The enemies of the first Battle at a depth, over several Seeds. */
function enemiesAt(depth: number, seeds = 40): UnitView[] {
  return Array.from({ length: seeds }, (_, seed) => {
    const game = createGame({ seed, scenario: { startAt: { floor: depth, room: 0 }, heroLevel: 20 } });
    while (!viewGame(game).battle) advance(game, 1_000);
    return viewGame(game).battle!.enemies;
  }).flat();
}

const namesAt = (depth: number, seeds?: number): Set<string> => new Set(enemiesAt(depth, seeds).map((enemy) => enemy.name));

function guardianAt(depth: number): UnitView {
  const game = createGame({ seed: 1, scenario: { startAt: { floor: depth, room: 'guardian' } } });
  while (!viewGame(game).battle) advance(game, 1_000);
  return viewGame(game).battle!.enemies[0]!;
}

describe('the Undercroft’s Packs', () => {
  const FIRST = ['Sodden Thrall', 'Tallow Wight', 'Bone Chanter', 'Mire Bloat', 'Sporeling'];
  const OSSUARY = ['Charnel Brute', 'Knucklebone Flinger'];
  const DROWNED = ['Drowned Mourner', 'Silt Lurker', 'Drowned Bellman'];
  const DEEP = ['Shellcap Husk', 'Shroud Weaver'];

  it('rolls only the first 2 Families on Floors 1–5', () => {
    expect(namesAt(23)).toEqual(new Set(FIRST));
  });

  it('adds a Family with each band of 5 Floors, the older ones still rolling', () => {
    expect(namesAt(28)).toEqual(new Set([...FIRST, ...OSSUARY]));
    const drowned = namesAt(33, 60);
    expect(DROWNED.every((name) => drowned.has(name))).toBe(true);
    expect(OSSUARY.some((name) => drowned.has(name))).toBe(true);
    expect(DEEP.some((name) => drowned.has(name))).toBe(false);
    const deep = namesAt(38, 60);
    expect(DEEP.every((name) => deep.has(name))).toBe(true);
    expect(DROWNED.some((name) => deep.has(name))).toBe(true);
  });

  it('draws the band’s new Family about half the time', () => {
    const packs = 80;
    const ossuaryPacks = Array.from({ length: 80 }, (_, seed) => {
      const game = createGame({ seed, scenario: { startAt: { floor: 28, room: 0 } } });
      while (!viewGame(game).battle) advance(game, 1_000);
      return viewGame(game).battle!.enemies.some((enemy) => OSSUARY.includes(enemy.name));
    }).filter(Boolean).length;
    expect(ossuaryPacks / packs).toBeGreaterThan(0.35);
    expect(ossuaryPacks / packs).toBeLessThan(0.65);
  });

  it('scales a Pack enemy with its Floor', () => {
    const brute = enemiesAt(28).find((enemy) => enemy.name === 'Charnel Brute')!;
    expect(brute.maxHealth).toBeCloseTo(220 * depthTuning(28).enemyScale, 6);
  });
});

describe('Pack enemies with timed actions', () => {
  it('the Drowned Bellman tolls every 6 seconds, hitting and Slowing every Hero', () => {
    const bellman = enemiesAt(33, 60).find((enemy) => enemy.name === 'Drowned Bellman');
    expect(bellman).toBeDefined();
    const toll = { name: 'Toll', interval: 60, target: 'every', damage: 3, damageType: 'physical', slow: 20 } as const;
    const { log } = simulateBattle({
      seed: 1,
      maxTicks: 130,
      teams: { a: [unit('front'), unit('back', { row: 'back' })], b: [unit('bellman', { row: 'back', reach: 'ranged', actions: [toll] })] },
    });
    const tolls = log.filter((event) => event.type === 'action');
    expect(tolls.map((event) => event.tick)).toEqual([60, 120]);
    const slowed = log.flatMap((event) => (event.type === 'effect' && event.effect === 'slow' ? [`${event.tick} ${event.targetId}`] : []));
    expect(slowed).toEqual(['60 front', '60 back', '120 front', '120 back']);
    expect(log.filter((event) => event.type === 'attack').map((event) => event.type === 'attack' && event.targetId)).toEqual(['front', 'back', 'front', 'back']);
  });
});

describe('the one-back-Row-Hero action', () => {
  const undertow = { name: 'Undertow', interval: 10, target: 'oneBack', damage: 5, damageType: 'physical' } as const;
  const hitsOn = (party: UnitSpec[]) => {
    const { log } = simulateBattle({ seed: 2, maxTicks: 200, teams: { a: party, b: [unit('engine', { actions: [undertow] })] } });
    return log.flatMap((event) => (event.type === 'attack' ? [event.targetId] : []));
  };

  it('strikes only the back Row while it stands', () => {
    const hits = hitsOn([unit('front'), unit('back-1', { row: 'back' }), unit('back-2', { row: 'back' })]);
    expect(hits.length).toBeGreaterThan(5);
    expect(new Set(hits)).toEqual(new Set(['back-1', 'back-2']));
  });

  it('strikes the front Row when the back Row is empty', () => {
    expect(new Set(hitsOn([unit('front-1'), unit('front-2')]))).toEqual(new Set(['front-1', 'front-2']));
  });
});

describe('the Undercroft’s Guardians', () => {
  const scaleAt = (depth: number) => depthTuning(depth).enemyScale / depthTuning(5).enemyScale;

  it('fields each Wall’s Guardian at its Lamp, at its own tuned strength, scaled to its depth', () => {
    expect([30, 35, 40].map((depth) => [guardianAt(depth).name, guardianAt(depth).placeholder])).toEqual([
      ['The Iron Sexton', false],
      ['The Knell Engine', false],
      ['The Reliquary Engine', false],
    ]);
    expect(guardianAt(30).maxHealth).toBeCloseTo(2_800 * scaleAt(30) * 1.3, 6);
    expect(guardianAt(35).maxHealth).toBeCloseTo(2_400 * scaleAt(35) * 1.35, 6);
    expect(guardianAt(40).maxHealth).toBeCloseTo(3_200 * scaleAt(40) * 0.7, 6);
  });

  it('the Reliquary Engine shrugs off physical hits that a Burn ignores', () => {
    // A stand-in with its armour and resistance, against the same raw hit as physical and as fire.
    const engine = unit('engine', { armour: 80, resistances: { physical: 20 } });
    const hit = (damageType: 'physical' | 'fire') => {
      const { log } = simulateBattle({ seed: 1, maxTicks: 31, teams: { a: [unit('hero', { power: 100, actionInterval: 30, damageType })], b: [engine] } });
      return log.find((event) => event.type === 'attack')!;
    };
    const physical = hit('physical');
    const fire = hit('fire');
    expect(physical.type === 'attack' && fire.type === 'attack' && physical.damage / fire.damage).toBeCloseTo((100 / 180) * 0.8, 6);
  });
});
