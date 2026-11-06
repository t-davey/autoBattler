import { describe, expect, it } from 'vitest';
import {
  createBattle,
  simulateBattle,
  stepBattle,
  type BattleEvent,
  type BattleState,
  type SkillId,
  type UnitSpec,
} from './index';

const NEVER_ACTS = 100_000;

const unit = (id: string, overrides: Partial<UnitSpec> = {}): UnitSpec => ({
  id,
  name: id,
  health: 100_000,
  power: 100,
  actionInterval: 10,
  row: 'front',
  reach: 'melee',
  targeting: 'frontFirst',
  damageType: 'physical',
  armour: 0,
  resistances: {},
  critChance: 0,
  ...overrides,
});

const idle = (id: string, overrides: Partial<UnitSpec> = {}): UnitSpec =>
  unit(id, { actionInterval: NEVER_ACTS, ...overrides });

const hero = (id: string, skills: readonly (readonly [SkillId, number])[], overrides: Partial<UnitSpec> = {}): UnitSpec =>
  unit(id, { maxOil: 100, oil: 100, skills: skills.map(([skill, rank]) => ({ id: skill, rank })), ...overrides });

const run = (a: readonly UnitSpec[], b: readonly UnitSpec[], maxTicks = 300, seed = 1) =>
  simulateBattle({ seed, teams: { a, b }, maxTicks }).log;

const battleOf = (a: readonly UnitSpec[], b: readonly UnitSpec[], maxTicks = 1_000): BattleState =>
  createBattle({ seed: 1, teams: { a, b }, maxTicks });

const stepTo = (battle: BattleState, tick: number): BattleEvent[] => {
  const events: BattleEvent[] = [];
  while (battle.tick < tick) events.push(...stepBattle(battle));
  return events;
};

const unitIn = (battle: BattleState, id: string) => {
  const found = battle.units.find((candidate) => candidate.spec.id === id);
  if (!found) throw new Error(`no Unit ${id}`);
  return found;
};

const uses = (log: readonly BattleEvent[], skillId: SkillId) =>
  log.flatMap((event) => (event.type === 'skill' && event.skillId === skillId ? [event] : []));
const attacksOn = (log: readonly BattleEvent[], targetId: string) =>
  log.flatMap((event) => (event.type === 'attack' && event.targetId === targetId ? [event] : []));
const ticksOn = (log: readonly BattleEvent[], targetId: string) =>
  log.flatMap((event) => (event.type === 'effectDamage' && event.targetId === targetId ? [event] : []));

describe('skill choice', () => {
  it('a Hero uses the first available skill in its order', () => {
    const enemies = [idle('e1'), idle('e2')];
    const cutFirst = run([hero('h', [['bleeders-cut', 1], ['the-long-cut', 1]])], enemies, 20);
    const longFirst = run([hero('h', [['the-long-cut', 1], ['bleeders-cut', 1]])], enemies, 20);
    expect(uses(cutFirst, 'bleeders-cut')).toHaveLength(2);
    expect(uses(cutFirst, 'the-long-cut')).toHaveLength(0);
    expect(uses(longFirst, 'bleeders-cut')).toHaveLength(1);
    expect(uses(longFirst, 'the-long-cut')).toHaveLength(1);
  });

  it('a Hero with too little Oil falls back to the basic attack', () => {
    const log = run([hero('h', [['bleeders-cut', 1]], { oil: 5 })], [idle('e')], 10);
    expect(uses(log, 'bleeders-cut')).toHaveLength(0);
    expect(attacksOn(log, 'e')).toMatchObject([{ damage: 100 }]);
  });

  it('a skill costs its Oil', () => {
    const battle = battleOf([hero('h', [['bleeders-cut', 1]], { oil: 50 })], [idle('e')]);
    stepTo(battle, 10);
    expect(unitIn(battle, 'h').oil).toBe(50 - 10 + 2);
  });

  it('Oil regenerates 1 every 5 Ticks in a Battle, up to the maximum', () => {
    const battle = battleOf([idle('h', { oil: 50, maxOil: 52 })], [idle('e')]);
    stepTo(battle, 4);
    expect(unitIn(battle, 'h').oil).toBe(50);
    stepTo(battle, 5);
    expect(unitIn(battle, 'h').oil).toBe(51);
    stepTo(battle, 50);
    expect(unitIn(battle, 'h').oil).toBe(52);
  });

  it('a skill on cooldown is skipped until it is ready', () => {
    const log = run([hero('h', [['the-long-cut', 1], ['bleeders-cut', 1]])], [idle('e')], 200);
    expect(uses(log, 'the-long-cut').map((event) => event.tick)).toEqual([20, 170]);
  });

  it("a Hero whose weapon can't reach in melee can't use melee skills", () => {
    const log = run([hero('h', [['bleeders-cut', 1]], { reach: 'ranged' })], [idle('e')], 10);
    expect(uses(log, 'bleeders-cut')).toHaveLength(0);
  });
});

describe('Bleed and the Bloodletting Branch', () => {
  it("Bleeder's Cut doesn't fire when every reachable enemy is Bleeding", () => {
    const log = run([hero('h', [['bleeders-cut', 1]])], [idle('e')], 90);
    expect(uses(log, 'bleeders-cut').map((event) => event.tick)).toEqual([10, 70]);
  });

  it("Bleeder's Cut only targets enemies that aren't Bleeding", () => {
    const log = run([hero('h', [['bleeders-cut', 1]])], [idle('e1'), idle('e2')], 20);
    const targets = log.flatMap((event) => (event.type === 'attack' ? [event.targetId] : []));
    expect(new Set(targets).size).toBe(2);
  });

  it("Bleeder's Cut deals its hit and spreads its Bleed over 6 ticks, by rank", () => {
    const low = run([hero('h', [['bleeders-cut', 1]], { actionInterval: 70 })], [idle('e')], 69 + 70);
    expect(attacksOn(low, 'e')[0]).toMatchObject({ damage: 80 });
    expect(ticksOn(low, 'e').map((event) => [event.tick, event.damage])).toEqual(
      [80, 90, 100, 110, 120, 130].map((tick) => [tick, 10]),
    );
    const high = run([hero('h', [['bleeders-cut', 5]], { actionInterval: 70 })], [idle('e')], 90);
    expect(attacksOn(high, 'e')[0]?.damage).toBeCloseTo(110);
    expect(ticksOn(high, 'e')[0]?.damage).toBeCloseTo(100 / 6);
  });

  it('Bleed ignores armour, but physical resistance reduces it', () => {
    const log = run([hero('h', [['bleeders-cut', 1]], { actionInterval: 70 })], [idle('e', { armour: 100, resistances: { physical: 50 } })], 90);
    expect(ticksOn(log, 'e')[0]?.damage).toBeCloseTo(5);
  });

  it('The Long Cut ends a Bleed and deals its remaining damage multiplied', () => {
    const log = run([hero('h', [['the-long-cut', 1], ['bleeders-cut', 1]])], [idle('e', { armour: 100, resistances: { physical: 50 } })], 35);
    const ticksBefore = ticksOn(log, 'e').filter((event) => event.tick <= 20);
    expect(ticksBefore).toHaveLength(1);
    // Rank 1: 5 ticks of 10 remain, × 150%, ignoring armour, then × 50% for resistance.
    const longCut = attacksOn(log, 'e').find((event) => event.tick === 20);
    expect(longCut?.damage).toBeCloseTo(37.5);
    expect(longCut?.crit).toBe(false);
    expect(ticksOn(log, 'e').filter((event) => event.tick > 20 && event.tick <= 30)).toHaveLength(0);
  });

  it('critical hits apply to Bleeder\'s Cut\'s hit, but not to The Long Cut or Bleed', () => {
    const log = run([hero('h', [['the-long-cut', 1], ['bleeders-cut', 1]], { critChance: 100 })], [idle('e')], 20);
    const hits = attacksOn(log, 'e');
    expect(hits[0]).toMatchObject({ crit: true, damage: 120 });
    expect(hits[1]).toMatchObject({ crit: false, damage: 75 });
    expect(ticksOn(log, 'e')[0]?.damage).toBe(10);
  });

  it('Open Veins raises basic attacks and The Long Cut on Bleeding enemies, but not Bleed ticks', () => {
    const veins = hero('h', [['bleeders-cut', 1], ['open-veins', 1]]);
    const log = run([veins], [idle('e')], 20);
    const hits = attacksOn(log, 'e');
    expect(hits[0]?.damage).toBe(80);
    expect(hits[1]?.damage).toBeCloseTo(110);
    expect(ticksOn(log, 'e')[0]?.damage).toBe(10);

    const withLongCut = hero('h', [['the-long-cut', 1], ['bleeders-cut', 1], ['open-veins', 1]]);
    expect(attacksOn(run([withLongCut], [idle('e')], 20), 'e')[1]?.damage).toBeCloseTo(82.5);
  });
});

describe('Poison', () => {
  const poisoner = (overrides: Partial<UnitSpec> = {}) => unit('p', { poisonOnHit: 2, damageType: 'poison', power: 1, ...overrides });

  it('Poison stops at 5 stacks and a new stack refreshes them all', () => {
    const battle = battleOf([idle('h')], [poisoner()]);
    stepTo(battle, 10);
    expect(unitIn(battle, 'h').poison).toHaveLength(1);
    stepTo(battle, 150);
    const { poison } = unitIn(battle, 'h');
    expect(poison).toHaveLength(5);
    expect(poison.every((stack) => stack.expiresAt === 250)).toBe(true);
  });

  it('a stack deals its damage every 20 Ticks for 100 Ticks', () => {
    const log = run([idle('h')], [poisoner({ actionInterval: 200 })], 390);
    expect(ticksOn(log, 'h').map((event) => [event.tick, event.damage])).toEqual(
      [220, 240, 260, 280, 300].map((tick) => [tick, 2]),
    );
  });

  it('a refresh keeps each stack on its own clock', () => {
    const log = run([idle('h')], [poisoner({ actionInterval: 15 })], 40);
    // Stacks land at 15 and 30, and tick 20 Ticks after landing.
    expect(ticksOn(log, 'h').map((event) => event.tick)).toEqual([35]);
  });

  it('poison resistance reduces Poison damage', () => {
    const log = run([idle('h', { resistances: { poison: 50 } })], [poisoner({ actionInterval: 200 })], 220);
    expect(ticksOn(log, 'h')[0]?.damage).toBe(1);
  });

  it('armour does not reduce Poison damage', () => {
    const log = run([idle('h', { armour: 100 })], [poisoner({ actionInterval: 200 })], 220);
    expect(ticksOn(log, 'h')[0]?.damage).toBe(2);
  });
});

describe('the Hearth Branch', () => {
  it("Mend by Lamplight doesn't fire when every Hero is above 70% health", () => {
    const battle = battleOf([hero('h', [['mend-by-lamplight', 1]], { row: 'back', reach: 'ranged' }), idle('ally', { health: 100 })], [idle('e')]);
    unitIn(battle, 'ally').health = 71;
    expect(uses(stepTo(battle, 10), 'mend-by-lamplight')).toHaveLength(0);
  });

  it('Mend by Lamplight heals the Hero with the lowest health percentage, up to its maximum', () => {
    const battle = battleOf(
      [hero('h', [['mend-by-lamplight', 1]], { row: 'back', reach: 'ranged' }), idle('a1', { health: 1000 }), idle('a2', { health: 200 })],
      [idle('e')],
    );
    unitIn(battle, 'a1').health = 500;
    unitIn(battle, 'a2').health = 90;
    const events = stepTo(battle, 10);
    expect(uses(events, 'mend-by-lamplight')).toHaveLength(1);
    expect(unitIn(battle, 'a2').health).toBe(200);
    expect(unitIn(battle, 'a1').health).toBe(500);
    expect(events.find((event) => event.type === 'heal')).toMatchObject({ targetId: 'a2', amount: 110 });
  });

  it('heals ignore fallen Heroes', () => {
    const battle = battleOf([hero('h', [['mend-by-lamplight', 1]], { row: 'back', reach: 'ranged' }), idle('ally', { health: 100 })], [idle('e')]);
    unitIn(battle, 'ally').health = 0;
    expect(uses(stepTo(battle, 10), 'mend-by-lamplight')).toHaveLength(0);
  });

  it("Lantern Ward doesn't fire while a Hero holds a Ward", () => {
    // Two holders act on the same Ticks, so the second is stopped only by the first's Ward.
    const log = run([hero('h1', [['lantern-ward', 1]]), hero('h2', [['lantern-ward', 1]])], [idle('e')], 80);
    expect(uses(log, 'lantern-ward').map((event) => event.tick)).toEqual([10]);
  });

  it('Lantern Ward wards every Hero at its rank value', () => {
    const battle = battleOf([hero('h', [['lantern-ward', 5]], { row: 'back', reach: 'ranged' }), idle('ally')], [idle('e')]);
    stepTo(battle, 10);
    expect(unitIn(battle, 'ally').ward).toEqual({ amount: 120, expiresAt: 90 });
  });

  it('a Ward absorbs damage before health, and all damage types', () => {
    const battle = battleOf(
      [hero('h', [['lantern-ward', 1]], { health: 1000, actionInterval: 1 })],
      [unit('e', { power: 25, actionInterval: 3, poisonOnHit: 10, damageType: 'poison' })],
    );
    const events = stepTo(battle, 3);
    expect(attacksOn(events, 'h')[0]).toMatchObject({ damage: 0, absorbed: 25 });
    expect(unitIn(battle, 'h').health).toBe(1000);
    // From the front Row, the Ward holds 60% of 60.
    expect(unitIn(battle, 'h').ward?.amount).toBe(11);
    unitIn(battle, 'h').ward = { amount: 500, expiresAt: 1_000 };
    const tick = ticksOn(stepTo(battle, 23), 'h')[0];
    expect(tick).toMatchObject({ damage: 0, absorbed: 10 });
  });

  it('damage past a Ward reaches health', () => {
    const battle = battleOf(
      [hero('h', [['lantern-ward', 1]], { health: 1000, actionInterval: 1 })],
      [unit('e', { power: 80, actionInterval: 3 })],
    );
    const events = stepTo(battle, 3);
    expect(attacksOn(events, 'h')[0]).toMatchObject({ damage: 44, absorbed: 36 });
    expect(unitIn(battle, 'h').health).toBe(956);
    expect(unitIn(battle, 'h').ward).toBeNull();
  });

  it('a Ward expires after 80 Ticks', () => {
    const battle = battleOf([hero('h', [['lantern-ward', 1]], { row: 'back', reach: 'ranged', actionInterval: 1 })], [unit('e', { power: 1, actionInterval: 90 })]);
    const events = stepTo(battle, 90);
    expect(attacksOn(events, 'h')[0]).toMatchObject({ damage: 1, absorbed: 0 });
  });
});

describe('the Bulwark Branch', () => {
  const wounded = (barrer: UnitSpec, enemy: UnitSpec): BattleState => {
    const battle = battleOf([barrer, idle('ally', { health: 100 })], [enemy]);
    unitIn(battle, 'ally').health = 50;
    return battle;
  };

  it('Bar the Way forces single-target enemy attacks onto the Hero', () => {
    const barrer = hero('s', [['bar-the-way', 1]]);
    const battle = wounded(barrer, unit('e', { power: 1, actionInterval: 3 }));
    const events = stepTo(battle, 70);
    const hits = events.flatMap((event) => (event.type === 'attack' && event.attackerId === 'e' && event.tick > 10 ? [event] : []));
    expect(hits.length).toBeGreaterThan(5);
    expect(hits.filter((hit) => hit.tick < 70).every((hit) => hit.targetId === 's')).toBe(true);
  });

  it("Bar the Way doesn't fire unless another Hero is below 80% health", () => {
    const barrer = hero('s', [['bar-the-way', 1]]);
    const battle = battleOf([barrer, idle('ally', { health: 100 })], [idle('e')]);
    unitIn(battle, 'ally').health = 80;
    expect(uses(stepTo(battle, 10), 'bar-the-way')).toHaveLength(0);
  });

  it('Bar the Way grants bonus armour until it ends', () => {
    const barrer = hero('s', [['bar-the-way', 1]], { armour: 100, oil: 100 });
    const battle = wounded(barrer, unit('e', { power: 100, actionInterval: 15 }));
    const damageAt = (events: readonly BattleEvent[], tick: number) => events.find((event) => event.type === 'attack' && event.tick === tick && event.attackerId === 'e');
    const events = stepTo(battle, 75);
    expect(damageAt(events, 15)).toMatchObject({ targetId: 's' });
    expect((damageAt(events, 15) as { damage: number }).damage).toBeCloseTo((100 * 100) / 220);
    expect(unitIn(battle, 's').barUntil).toBe(70);
  });

  it('Bar the Way\'s armour ends with it', () => {
    const barrer = hero('s', [['bar-the-way', 1]], { armour: 100 });
    const battle = battleOf([barrer, idle('ally', { row: 'back', reach: 'ranged', health: 100 })], [unit('e', { power: 100, actionInterval: 75 })]);
    unitIn(battle, 'ally').health = 50;
    const hit = attacksOn(stepTo(battle, 75), 's')[0];
    expect(hit?.damage).toBeCloseTo(50);
  });

  it('Bar the Way stops when its Hero falls', () => {
    const barrer = hero('s', [['bar-the-way', 1]], { health: 100 });
    const battle = battleOf([barrer, idle('ally', { health: 100_000 })], [unit('e', { power: 1, actionInterval: 3 })]);
    unitIn(battle, 'ally').health = 50_000;
    stepTo(battle, 10);
    expect(unitIn(battle, 's').barUntil).toBe(70);
    unitIn(battle, 's').health = 0;
    const hits = attacksOn(stepTo(battle, 30), 'ally');
    expect(hits.length).toBeGreaterThan(0);
    expect(attacksOn(stepTo(battle, 60), 's')).toHaveLength(0);
  });

  it('Iron Penance and Bar the Way add up before multiplying armour', () => {
    const barrer = hero('s', [['bar-the-way', 5], ['iron-penance', 5]], { armour: 100 });
    const battle = wounded(barrer, unit('e', { power: 100, actionInterval: 15 }));
    const events = stepTo(battle, 15);
    const hit = events.find((event) => event.type === 'attack' && event.attackerId === 'e');
    expect((hit as { damage: number }).damage).toBeCloseTo((100 * 100) / 290);
  });

  describe('Shared Burden', () => {
    const backHero = idle('back', { row: 'back', reach: 'ranged', armour: 0 });
    const chanter = unit('e', { reach: 'ranged', targeting: 'any', power: 100 });

    it('Shared Burden redirects part of a direct hit on a back-Row Hero', () => {
      const holder = idle('s', { skills: [{ id: 'shared-burden', rank: 1 }], armour: 100 });
      const log = run([holder, backHero], [chanter], 200);
      const onBack = attacksOn(log, 'back')[0];
      expect(onBack?.damage).toBe(90);
      const redirected = attacksOn(log, 's').find((event) => event.redirectedFromName === 'back');
      expect(redirected?.damage).toBeCloseTo(5);
    });

    it('Shared Burden redirects part of a Poison tick on a back-Row Hero', () => {
      const holder = idle('s', { skills: [{ id: 'shared-burden', rank: 5 }], armour: 100, resistances: { poison: 50 } });
      const log = run([holder, idle('back', { row: 'back', reach: 'ranged' })], [unit('e', { reach: 'ranged', targeting: 'any', power: 1, poisonOnHit: 10, damageType: 'poison', actionInterval: 50 })], 150, 3);
      const backTick = ticksOn(log, 'back')[0];
      expect(backTick?.damage).toBe(7);
      const shared = ticksOn(log, 's').find((event) => event.redirectedFromName === 'back');
      expect(shared?.damage).toBeCloseTo(1.5);
    });

    it("doesn't redirect damage to front-Row Heroes", () => {
      const holder = idle('s', { skills: [{ id: 'shared-burden', rank: 5 }] });
      const log = run([holder, idle('front')], [unit('e', { power: 100 })], 100);
      expect(attacksOn(log, 'front').every((event) => event.damage === 100)).toBe(true);
      expect(attacksOn(log, 's').every((event) => event.redirectedFromName === null)).toBe(true);
    });

    it('stops when its holder falls', () => {
      const holder = idle('s', { skills: [{ id: 'shared-burden', rank: 5 }] });
      const battle = battleOf([holder, backHero], [unit('e', { reach: 'ranged', targeting: 'any', power: 100, actionInterval: 10 })]);
      unitIn(battle, 's').health = 0;
      const events = stepTo(battle, 10);
      expect(attacksOn(events, 'back')[0]?.damage).toBe(100);
    });
  });
});

describe('the out-of-Row penalty', () => {
  it('a skill used from the wrong Row has 60% of its effects', () => {
    const battle = battleOf([hero('h', [['mend-by-lamplight', 1]], { row: 'front' }), idle('ally', { health: 1000 })], [idle('e')]);
    unitIn(battle, 'ally').health = 100;
    stepTo(battle, 10);
    expect(unitIn(battle, 'ally').health).toBe(100 + 90);
  });

  it('a skill from the wrong Row costs the same and keeps its duration', () => {
    const battle = battleOf([hero('h', [['lantern-ward', 1]], { row: 'front' })], [idle('e')]);
    stepTo(battle, 10);
    expect(unitIn(battle, 'h').ward).toEqual({ amount: 36, expiresAt: 90 });
    expect(unitIn(battle, 'h').oil).toBe(100 - 20);
  });

  it('a skill that works from either Row has no penalty', () => {
    const back = hero('s', [['iron-penance', 1]], { row: 'back', reach: 'ranged', armour: 100 });
    const log = run([back], [unit('e', { power: 100, actionInterval: 10 })], 10);
    expect(attacksOn(log, 's')[0]?.damage).toBeCloseTo((100 * 100) / 210);
  });

  it('a Hero stepping forward pays the penalty on a back-Row skill', () => {
    const battle = battleOf([hero('h', [['mend-by-lamplight', 1]], { row: 'back', reach: 'ranged', health: 1000 }), idle('front', { health: 1 })], [unit('e', { power: 5, actionInterval: 8 })]);
    unitIn(battle, 'h').health = 100;
    stepTo(battle, 10);
    expect(unitIn(battle, 'h').row).toBe('front');
    expect(unitIn(battle, 'h').health).toBeCloseTo(100 + 90);
  });
});

describe('a Battle with skills', () => {
  it('stays deterministic for one Seed', () => {
    const setup = {
      seed: 9,
      teams: {
        a: [hero('h', [['bleeders-cut', 2], ['the-long-cut', 1]], { health: 500, critChance: 30 }), hero('l', [['mend-by-lamplight', 2]], { row: 'back', reach: 'ranged', health: 300 })],
        b: [unit('e', { health: 1500, power: 20, poisonOnHit: 1, damageType: 'poison' }), unit('f', { health: 1500, power: 20, row: 'back', reach: 'ranged', targeting: 'any' })],
      },
    } as const;
    expect(simulateBattle(setup)).toEqual(simulateBattle(setup));
  });
});
