import { describe, expect, it } from 'vitest';
import { applyAction, createBattle, createGame, simulateBattle, stepBattle, viewGame, type BattleEvent, type SkillId, type UnitSpec } from './index';

const NEVER_ACTS = 100_000;

const unit = (id: string, overrides: Partial<UnitSpec> = {}): UnitSpec => ({
  id,
  name: id,
  health: 10_000,
  power: 100,
  actionInterval: NEVER_ACTS,
  row: 'front',
  reach: 'melee',
  targeting: 'frontFirst',
  damageType: 'physical',
  armour: 0,
  resistances: {},
  critChance: 0,
  ...overrides,
});

const skilled = (id: string, skills: readonly { id: SkillId; rank: number }[], overrides: Partial<UnitSpec> = {}): UnitSpec =>
  unit(id, { actionInterval: 10, maxOil: 1_000, skills, ...overrides });

const battle = (a: readonly UnitSpec[], b: readonly UnitSpec[], maxTicks: number, seed = 1): BattleEvent[] =>
  simulateBattle({ seed, maxTicks, teams: { a, b } }).log as BattleEvent[];

const attacksBy = (log: readonly BattleEvent[], id: string) => log.flatMap((event) => (event.type === 'attack' && event.attackerId === id ? [event] : []));

describe('Flagellation', () => {
  it('Penitent Blow hits for 140% of power and costs 4% of max health, only above 40% health', () => {
    const log = battle([skilled('sin', [{ id: 'penitent-blow', rank: 1 }], { health: 1_000 })], [unit('foe')], 10);
    expect(attacksBy(log, 'sin')[0]).toMatchObject({ damage: expect.closeTo(140), damageType: 'physical' });
    const state = createBattle({ seed: 1, teams: { a: [skilled('sin', [{ id: 'penitent-blow', rank: 1 }], { health: 1_000 })], b: [unit('foe')] } });
    for (let tick = 0; tick < 10; tick++) stepBattle(state);
    expect((state.units[0] as unknown as { health: number }).health).toBe(960);

    const weak = battle([skilled('sin', [{ id: 'penitent-blow', rank: 1 }], { health: 400, maxHealth: 1_000 })], [unit('foe')], 10);
    expect(weak.some((event) => event.type === 'skill')).toBe(false);
  });

  it('Mortified Flesh adds power for each whole 10% of health missing', () => {
    const hit = (health: number) =>
      attacksBy(battle([skilled('sin', [{ id: 'mortified-flesh', rank: 1 }], { health, maxHealth: 1_000 })], [unit('foe')], 10), 'sin')[0]!.damage;
    expect(hit(1_000)).toBeCloseTo(100);
    // 35% missing counts as 3 steps of 2%.
    expect(hit(650)).toBeCloseTo(106);
  });

  it('Red Tithe hits the whole enemy front Row and heals for a quarter of the damage', () => {
    const foes = [unit('a'), unit('b'), unit('c', { row: 'back' })];
    const log = battle([skilled('sin', [{ id: 'red-tithe', rank: 1 }], { health: 500, maxHealth: 1_000 })], foes, 10);
    expect(attacksBy(log, 'sin').map((event) => [event.targetId, Math.round(event.damage)])).toEqual([['a', 120], ['b', 120]]);
    expect(log).toContainEqual(expect.objectContaining({ type: 'heal', targetId: 'sin', amount: expect.closeTo(60) }));
    const alone = battle([skilled('sin', [{ id: 'red-tithe', rank: 1 }])], [unit('a'), unit('c', { row: 'back' })], 10);
    expect(alone.some((event) => event.type === 'skill')).toBe(false);
  });
});

describe('Fieldcraft', () => {
  it('Fall Back moves a hurt Hero behind an ally, heals it, and dodges the next attack, then steps up once healed', () => {
    const warrener = skilled('war', [{ id: 'fall-back', rank: 1 }], { health: 400, maxHealth: 1_000 });
    const foe = unit('foe', { actionInterval: 15, targeting: 'any', reach: 'ranged' });
    const log = battle([warrener, unit('ally')], [foe], 15, 2);
    expect(log).toContainEqual(expect.objectContaining({ type: 'moved', unitId: 'war', row: 'back' }));
    expect(log).toContainEqual(expect.objectContaining({ type: 'heal', targetId: 'war', amount: expect.closeTo(100) }));
    const attacksOnWar = log.filter((event) => (event.type === 'attack' || event.type === 'dodge') && event.targetId === 'war');
    expect(attacksOnWar.every((event) => event.type === 'dodge')).toBe(true);

    const healthy = battle([skilled('war', [{ id: 'fall-back', rank: 1 }], { health: 1_000, row: 'back' }), unit('ally')], [unit('foe')], 10);
    expect(healthy.some((event) => event.type === 'moved')).toBe(false);
  });

  it('Fall Back holds when no ally stands in the front Row', () => {
    const log = battle([skilled('war', [{ id: 'fall-back', rank: 1 }], { health: 400, maxHealth: 1_000 })], [unit('foe')], 10);
    expect(log.some((event) => event.type === 'moved')).toBe(false);
  });

  it('Light Step dodges some attacks, and Bind the Wound heals on each dodge', () => {
    const war = unit('war', { health: 500, maxHealth: 1e12, skills: [{ id: 'light-step', rank: 5 }, { id: 'bind-the-wound', rank: 1 }] });
    // Short enough that the heals, 3% of max health each, never fill it.
    const log = battle([war], [unit('foe', { actionInterval: 1, power: 1 })], 200);
    const dodges = log.filter((event) => event.type === 'dodge').length;
    const hits = attacksBy(log, 'foe').length;
    expect(dodges / (dodges + hits)).toBeGreaterThan(0.07);
    expect(dodges / (dodges + hits)).toBeLessThan(0.25);
    const heals = log.filter((event) => event.type === 'heal' && event.targetId === 'war');
    expect(heals.length).toBe(dodges);
  });
});

describe('Flame', () => {
  const lamplighter = (skills: readonly { id: SkillId; rank: number }[], overrides: Partial<UnitSpec> = {}): UnitSpec[] => [
    skilled('lamp', [{ id: 'flare', rank: 1 }, ...skills], { row: 'back', ...overrides }),
    unit('ally'),
  ];

  it('Flare hits either Row for 150% of power as fire damage', () => {
    const log = battle(lamplighter([]), [unit('foe', { armour: 500 })], 10);
    expect(attacksBy(log, 'lamp')[0]).toMatchObject({ damage: expect.closeTo(150), damageType: 'fire' });
  });

  it('Kindling adds a Burn worth 20% of the fire hit', () => {
    const log = battle(lamplighter([{ id: 'kindling', rank: 1 }]), [unit('foe')], 60);
    const burns = log.filter((event) => event.type === 'effectDamage' && event.effect === 'burn' && event.tick <= 50);
    expect(burns.map((event) => event.type === 'effectDamage' && event.damage)).toEqual([7.5, 7.5, 7.5, 7.5].map((value) => expect.closeTo(value)));
  });

  it('White Heat adds fire critical chance, and a fire critical hit splashes the rest of the Row', () => {
    const foes = [unit('a'), unit('b'), unit('c', { row: 'back' })];
    const log = battle(lamplighter([{ id: 'white-heat', rank: 5 }], { critChance: 85 }), foes, 10);
    const hits = attacksBy(log, 'lamp');
    expect(hits[0]).toMatchObject({ crit: true });
    const struck = hits[0]!.targetId;
    const splash = hits.slice(1);
    expect(splash).toHaveLength(1);
    expect(splash[0]!.targetId).not.toBe(struck);
    expect(splash[0]!.targetId).not.toBe('c');
    expect(splash[0]!.damage).toBeCloseTo(hits[0]!.damage * 0.7);
  });
});

describe('the second Branches in a Game', () => {
  it('each Class has two Branches and four active skills to pick 3 from', () => {
    const game = createGame({ seed: 1, scenario: { heroLevel: 30 } });
    for (const hero of viewGame(game).heroes) {
      expect(new Set(hero.skills.filter((skill) => !skill.free).map((skill) => skill.branch)).size).toBe(2);
    }
    const spend = (skillId: SkillId) => applyAction(game, { type: 'spendSkillPoint', heroId: 'sin-eater', skillId });
    for (const skillId of ['bar-the-way', 'bar-the-way', 'bar-the-way', 'penitent-blow', 'penitent-blow', 'penitent-blow', 'mortified-flesh', 'mortified-flesh', 'mortified-flesh', 'red-tithe'] as const) {
      expect(spend(skillId)).toEqual({ ok: true });
    }
    const sinEater = viewGame(game).heroes.find((hero) => hero.id === 'sin-eater')!;
    expect(sinEater.order).toEqual(['bar-the-way', 'penitent-blow', 'consume-sin']);
    // The order was full, so Red Tithe waits outside it.
    expect(sinEater.skills.find((skill) => skill.id === 'red-tithe')!.rank).toBe(1);
  });
});
