import { describe, expect, it } from 'vitest';
import {
  createBattle,
  simulateBattle,
  stepBattle,
  type BattleEvent,
  type BattleSetup,
  type UnitAction,
  type UnitSpec,
} from './index';

const NEVER_ACTS = 100_000;

const unit = (id: string, overrides: Partial<UnitSpec> = {}): UnitSpec => ({
  id,
  name: id,
  health: 20,
  power: 3,
  actionInterval: 2,
  row: 'front',
  reach: 'melee',
  targeting: 'frontFirst',
  damageType: 'physical',
  armour: 0,
  resistances: {},
  critChance: 0,
  ...overrides,
});

const setup = (seed: number): BattleSetup => ({
  seed,
  teams: {
    a: [unit('a1'), unit('a2'), unit('a3')],
    b: [unit('b1'), unit('b2'), unit('b3')],
  },
});

const attacksBy = (log: readonly BattleEvent[], attackerId: string) =>
  log.flatMap((event) => (event.type === 'attack' && event.attackerId === attackerId ? [event] : []));

/** The damage of one attacker's first hit on one target. */
const firstHit = (attacker: Partial<UnitSpec>, target: Partial<UnitSpec>): number => {
  const { log } = simulateBattle({
    seed: 1,
    maxTicks: 2,
    teams: {
      a: [unit('attacker', attacker)],
      b: [unit('target', { health: 1000, actionInterval: NEVER_ACTS, ...target })],
    },
  });
  return attacksBy(log, 'attacker')[0]!.damage;
};

describe('simulateBattle', () => {
  it('produces an identical result for the same setup', () => {
    expect(simulateBattle(setup(42))).toEqual(simulateBattle(setup(42)));
  });

  it('plays out differently across seeds', () => {
    const logs = new Set([1, 2, 3, 4, 5].map((seed) => JSON.stringify(simulateBattle(setup(seed)).log)));
    expect(logs.size).toBeGreaterThan(1);
  });

  it('declares the Team with survivors the winner', () => {
    const result = simulateBattle({
      seed: 1,
      teams: { a: [unit('strong', { health: 100, power: 50 })], b: [unit('weak', { health: 10, power: 1 })] },
    });
    expect(result.winner).toBe('a');
    expect(result.log.at(-1)).toMatchObject({ type: 'death', unitId: 'weak' });
  });

  it('is a draw when the tick limit passes with both Teams alive', () => {
    const result = simulateBattle({
      seed: 1,
      maxTicks: 5,
      teams: { a: [unit('a1', { actionInterval: NEVER_ACTS })], b: [unit('b1', { actionInterval: NEVER_ACTS })] },
    });
    expect(result).toMatchObject({ winner: null, ticks: 5 });
  });

  it('caps a Battle at 1200 Ticks as a draw', () => {
    const result = simulateBattle({
      seed: 1,
      teams: { a: [unit('a1', { actionInterval: NEVER_ACTS })], b: [unit('b1', { actionInterval: NEVER_ACTS })] },
    });
    expect(result).toMatchObject({ winner: null, ticks: 1200 });
  });

  it('gives a Team with no Units an immediate loss', () => {
    const result = simulateBattle({ seed: 1, teams: { a: [unit('a1')], b: [] } });
    expect(result).toEqual({ winner: 'a', ticks: 0, log: [] });
  });

  it('is an immediate draw when neither Team has Units', () => {
    const result = simulateBattle({ seed: 1, teams: { a: [], b: [] } });
    expect(result).toEqual({ winner: null, ticks: 0, log: [] });
  });

  it('has each Unit act once per actionInterval, starting after the first interval', () => {
    const { log } = simulateBattle({
      seed: 1,
      maxTicks: 7,
      teams: { a: [unit('a1', { health: 100, actionInterval: 3 })], b: [unit('b1', { health: 100, actionInterval: 2 })] },
    });
    const ticksOf = (attackerId: string) => attacksBy(log, attackerId).map((event) => event.tick);
    expect(ticksOf('a1')).toEqual([3, 6]);
    expect(ticksOf('b1')).toEqual([2, 4, 6]);
  });

  it('never lets a dead Unit attack or be targeted', () => {
    for (let seed = 0; seed < 50; seed++) {
      const dead = new Set<string>();
      for (const event of simulateBattle(setup(seed)).log) {
        if (event.type === 'death') {
          dead.add(event.unitId);
        } else if (event.type === 'attack') {
          expect(dead).not.toContain(event.attackerId);
          expect(dead).not.toContain(event.targetId);
        }
      }
    }
  });
});

describe('stepping', () => {
  it('stepping a Battle to its end matches simulateBattle', () => {
    for (let seed = 0; seed < 20; seed++) {
      const battle = createBattle(setup(seed));
      const log: BattleEvent[] = [];
      while (!battle.over) log.push(...stepBattle(battle));
      expect({ winner: battle.winner, ticks: battle.tick, log }).toEqual(simulateBattle(setup(seed)));
    }
  });

  it('does nothing once a Battle is over', () => {
    const battle = createBattle({ seed: 1, teams: { a: [unit('a1')], b: [] } });
    expect(stepBattle(battle)).toEqual([]);
    expect(battle.tick).toBe(0);
  });
});

describe('Rows and targeting', () => {
  const standing = { health: 100_000, actionInterval: NEVER_ACTS };
  const targetsAcrossSeeds = (attacker: Partial<UnitSpec>): Set<string> => {
    const targets = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const { log } = simulateBattle({
        seed,
        maxTicks: 20,
        teams: {
          a: [unit('attacker', attacker)],
          b: [unit('front', standing), unit('back', { ...standing, row: 'back' })],
        },
      });
      for (const attack of attacksBy(log, 'attacker')) targets.add(attack.targetId);
    }
    return targets;
  };

  it("melee Units can't target the back Row while the front Row lives", () => {
    expect(targetsAcrossSeeds({ reach: 'melee', targeting: 'any' })).toEqual(new Set(['front']));
  });

  it('enemies target the front Row first', () => {
    expect(targetsAcrossSeeds({ reach: 'ranged', targeting: 'frontFirst' })).toEqual(new Set(['front']));
  });

  it('a Unit with any-Row targeting can hit the back Row', () => {
    expect(targetsAcrossSeeds({ reach: 'ranged', targeting: 'any' })).toEqual(new Set(['front', 'back']));
  });

  it('the back Row steps forward when the front Row dies', () => {
    const { log } = simulateBattle({
      seed: 1,
      maxTicks: 10,
      teams: {
        a: [unit('attacker', { power: 50, reach: 'melee' })],
        b: [
          unit('front', { health: 50, actionInterval: NEVER_ACTS }),
          unit('back', { health: 100_000, actionInterval: NEVER_ACTS, row: 'back' }),
        ],
      },
    });
    expect(attacksBy(log, 'attacker').map((attack) => attack.targetId)).toEqual([
      'front',
      'back',
      'back',
      'back',
      'back',
    ]);
  });

  it('moves a Team with only a back Row forward from the start', () => {
    const battle = createBattle({ seed: 1, teams: { a: [unit('a1', { row: 'back' })], b: [unit('b1')] } });
    expect(battle.units[0]).toMatchObject({ row: 'front' });
  });
});

describe('damage', () => {
  it('a critical hit deals 1.5 times the damage', () => {
    expect(firstHit({ power: 10, critChance: 100 }, {})).toBe(15);
    expect(firstHit({ power: 10, critChance: 0 }, {})).toBe(10);
  });

  it('armour reduces physical damage but not poison damage', () => {
    expect(firstHit({ power: 20, damageType: 'physical' }, { armour: 100 })).toBe(10);
    expect(firstHit({ power: 20, damageType: 'poison' }, { armour: 100 })).toBe(20);
  });

  it('armour and physical resistance multiply', () => {
    expect(firstHit({ power: 20 }, { armour: 100, resistances: { physical: 50 } })).toBe(5);
  });

  it('resistance reduces only its own damage type and caps at 75%', () => {
    expect(firstHit({ power: 20, damageType: 'poison' }, { resistances: { poison: 50 } })).toBe(10);
    expect(firstHit({ power: 20, damageType: 'poison' }, { resistances: { physical: 50 } })).toBe(20);
    expect(firstHit({ power: 20, damageType: 'poison' }, { resistances: { poison: 90 } })).toBe(5);
  });

  it('a hit always deals at least 1 damage', () => {
    expect(firstHit({ power: 1 }, { armour: 900 })).toBe(1);
    expect(firstHit({ power: 0 }, {})).toBe(1);
  });

  it('keeps damage fractional above the minimum', () => {
    expect(firstHit({ power: 3 }, { resistances: { physical: 50 } })).toBe(1.5);
  });
});

describe('carried health', () => {
  it('a Unit can start a Battle below its max health', () => {
    const hurt = unit('hurt', { health: 5, maxHealth: 20, actionInterval: NEVER_ACTS });
    const battle = createBattle({ seed: 1, teams: { a: [hurt], b: [unit('foe', { power: 5, actionInterval: 1 })] } });
    expect(battle.units[0]).toMatchObject({ health: 5 });
    const { log } = simulateBattle({ seed: 1, teams: { a: [hurt], b: [unit('foe', { power: 5, actionInterval: 1 })] } });
    expect(log.filter((event) => event.type === 'attack')).toHaveLength(1);
  });

  it('healing stops at max health, not at the health a Unit started with', () => {
    const healer = unit('healer', {
      row: 'back',
      power: 10,
      actionInterval: 1,
      maxOil: 100,
      skills: [{ id: 'mend-by-lamplight', rank: 1 }],
    });
    const hurt = unit('hurt', { health: 5, maxHealth: 20, actionInterval: NEVER_ACTS });
    const foe = unit('foe', { health: 10_000, actionInterval: NEVER_ACTS });
    const battle = createBattle({ seed: 1, teams: { a: [hurt, healer], b: [foe] } });
    for (let i = 0; i < 200; i++) stepBattle(battle);
    expect(battle.units[0]).toMatchObject({ health: 20 });
  });
});

describe('Phases', () => {
  const quiet = { name: 'Quiet', interval: 1_000, target: 'oneFront', damage: 0, damageType: 'physical' } as const;
  const hard = { name: 'Hard', interval: 20, target: 'oneFront', damage: 1, damageType: 'physical' } as const;
  const setup = (seed: number, power = 60) => ({
    seed,
    teams: {
      a: [unit('hero', { health: 100_000, power, actionInterval: 30, armour: 0 })],
      b: [unit('warden', { health: 500, armour: 0, actions: [quiet], secondPhase: { atHealthShare: 0.5, actions: [hard] } })],
    },
  });
  const changesIn = (seed: number, power?: number) =>
    simulateBattle(setup(seed, power)).log.filter((event) => event.type === 'phaseChanged');

  it('changes once at the threshold, and the new actions replace the old on fresh clocks', () => {
    const { log, winner } = simulateBattle(setup(1));
    const actionTicks = (name: string) =>
      log.flatMap((event) => (event.type === 'action' && event.actionName === name ? [event.tick] : []));
    expect(winner).toBe('a');
    const changes = log.filter((event) => event.type === 'phaseChanged');
    expect(changes).toHaveLength(1);
    const at = changes[0]!.tick;
    expect(actionTicks('Hard')[0]).toBe(at + 20);
    expect(actionTicks('Quiet').every((tick) => tick < at)).toBe(true);
  });

  it('a burst past the threshold still changes only once', () => {
    expect(changesIn(1, 300)).toHaveLength(1);
  });

  it('a Unit killed outright never changes', () => {
    expect(changesIn(1, 5_000)).toHaveLength(0);
  });

  it('plays the same from the same Seed', () => {
    expect(simulateBattle(setup(7))).toEqual(simulateBattle(setup(7)));
  });

  it('carries on the same after a save in the middle of the second Phase', () => {
    const live = createBattle(setup(3));
    while (!live.units.some((candidate) => candidate.health <= 250)) stepBattle(live);
    stepBattle(live);
    const resumed = JSON.parse(JSON.stringify(live)) as typeof live;
    for (let i = 0; i < 40; i++) expect(stepBattle(resumed)).toEqual(stepBattle(live));
  });
});

describe('timed actions', () => {
  const slam = { name: 'Slam', interval: 8, target: 'oneFront', damage: 4, damageType: 'physical' } as const;
  const breath = { name: 'Breath', interval: 6, target: 'every', damage: 0, damageType: 'poison', poisonStack: 3 } as const;
  const warden = (overrides: Partial<UnitSpec> = {}) =>
    unit('warden', { health: 100_000, actions: [slam, breath], ...overrides });
  const dummy = (id: string, row: 'front' | 'back' = 'front') =>
    unit(id, { health: 100_000, actionInterval: NEVER_ACTS, row });

  const eventsOver = (ticks: number, teams: BattleSetup['teams']) => {
    const battle = createBattle({ seed: 1, teams });
    const events: BattleEvent[] = [];
    for (let i = 0; i < ticks; i++) events.push(...stepBattle(battle));
    return events;
  };

  it('a Unit with several actions times each on its own interval', () => {
    const events = eventsOver(24, { a: [dummy('a1')], b: [warden()] });
    const ticksOf = (name: string) =>
      events.flatMap((event) => (event.type === 'action' && event.actionName === name ? [event.tick] : []));
    expect(ticksOf('Slam')).toEqual([8, 16, 24]);
    expect(ticksOf('Breath')).toEqual([6, 12, 18, 24]);
  });

  it('a Unit with actions ignores its power and actionInterval', () => {
    const events = eventsOver(24, { a: [dummy('a1')], b: [warden({ power: 999, actionInterval: 1 })] });
    const hits = events.flatMap((event) => (event.type === 'attack' ? [event] : []));
    expect(hits).toHaveLength(3);
    for (const hit of hits) expect(hit).toMatchObject({ damage: 4, damageType: 'physical' });
  });

  it('an action can hit every Hero', () => {
    const events = eventsOver(6, { a: [dummy('a1'), dummy('a2'), dummy('a3', 'back')], b: [warden()] });
    const poisoned = events.flatMap((event) => (event.type === 'effect' && event.effect === 'poison' ? [event.targetId] : []));
    expect(poisoned).toEqual(['a1', 'a2', 'a3']);
  });

  it('an action with direct damage on every Hero hits each of them', () => {
    const blast = { name: 'Blast', interval: 5, target: 'every', damage: 2, damageType: 'physical' } as const;
    const events = eventsOver(5, { a: [dummy('a1'), dummy('a3', 'back')], b: [warden({ actions: [blast] })] });
    expect(events.flatMap((event) => (event.type === 'attack' ? [event.targetId] : []))).toEqual(['a1', 'a3']);
  });

  it('a single-target action reaches only the front Row', () => {
    const events = eventsOver(80, { a: [dummy('a1'), dummy('a3', 'back')], b: [warden()] });
    const targets = new Set(events.flatMap((event) => (event.type === 'attack' ? [event.targetId] : [])));
    expect(targets).toEqual(new Set(['a1']));
  });

  it("an action's Poison stack deals its own damage", () => {
    const events = eventsOver(26, { a: [dummy('a1')], b: [warden({ actions: [breath] })] });
    const tick = events.find((event) => event.type === 'effectDamage');
    expect(tick).toMatchObject({ tick: 26, damage: 3, damageType: 'poison' });
  });
});

describe('damage types and effects', () => {
  const caster = (action: Partial<UnitAction>, overrides: Partial<UnitSpec> = {}): UnitSpec =>
    unit('caster', { health: 1000, actions: [{ name: 'Cast', interval: 10, target: 'oneFront', damage: 0, damageType: 'fire', ...action }], ...overrides });
  const dummy = (overrides: Partial<UnitSpec> = {}): UnitSpec => unit('dummy', { health: 10_000, actionInterval: NEVER_ACTS, ...overrides });
  const run = (ticks: number, a: readonly UnitSpec[], b: readonly UnitSpec[]): BattleEvent[] =>
    simulateBattle({ seed: 3, maxTicks: ticks, teams: { a, b } }).log as BattleEvent[];

  it.each(['fire', 'cold', 'holy'] as const)('%s hits ignore armour and are cut by their own resistance, up to 75%%', (type) => {
    expect(firstHit({ power: 100, damageType: type }, { armour: 100 })).toBe(100);
    expect(firstHit({ power: 100, damageType: type }, { resistances: { [type]: 40 } })).toBe(60);
    expect(firstHit({ power: 100, damageType: type }, { resistances: { [type]: 90 } })).toBe(25);
    expect(firstHit({ power: 100, damageType: type }, { resistances: { poison: 90 } })).toBe(100);
  });

  it('a Burn deals its fire damage over 4 ticks, cut by fire resistance, and reapplying replaces it', () => {
    const log = run(95, [caster({ burn: 80, interval: 50 })], [dummy({ armour: 500, resistances: { fire: 50 } })]);
    const burns = log.filter((event) => event.type === 'effectDamage' && event.effect === 'burn');
    expect(burns).toHaveLength(4);
    expect(burns.every((event) => event.type === 'effectDamage' && event.damageType === 'fire' && event.damage === 10)).toBe(true);
    expect(log.filter((event) => event.type === 'effect' && event.effect === 'burn')).toHaveLength(1);

    const reapplied = run(45, [caster({ burn: 80, interval: 20 })], [dummy()]);
    // Applied at 20 and 40: the second replaces the first before it finishes.
    const ticks = reapplied.filter((event) => event.type === 'effectDamage' && event.effect === 'burn').map((event) => event.tick);
    expect(ticks).toEqual([30, 40]);
  });

  it('a Slow makes the target act less often until it wears off', () => {
    const attacksIn = (slow: number | undefined, ticks: number) =>
      attacksBy(run(ticks, [caster(slow === undefined ? { interval: 1 } : { slow, interval: 1 })], [unit('target', { health: 10_000, actionInterval: 10 })]), 'target').length;
    expect(attacksIn(undefined, 100)).toBe(10);
    expect(attacksIn(50, 100)).toBe(5);
  });

  it('a Curse cuts the damage its target deals, until it wears off', () => {
    const hits = (curse: number | undefined, interval: number) =>
      attacksBy(run(200, [caster(curse === undefined ? { interval } : { curse, interval })], [unit('target', { health: 10_000, power: 100, actionInterval: 30 })]), 'target').map((event) => event.damage);
    expect(hits(undefined, 5)).toEqual([100, 100, 100, 100, 100, 100]);
    expect(hits(25, 5)).toEqual([75, 75, 75, 75, 75, 75]);
    // Cursed at Tick 100 for 80 Ticks.
    expect(hits(25, 100)).toEqual([100, 100, 100, 75, 75, 100]);
  });

  it('a Dodge misses the whole hit and its on-hit Poison, but damage over time still lands', () => {
    const log = run(60, [unit('striker', { power: 50, actionInterval: 10, poisonOnHit: 5 }), caster({ burn: 40, interval: 20 }, { row: 'back' })], [dummy({ dodgeChance: 100 })]);
    expect(attacksBy(log, 'striker')).toHaveLength(0);
    expect(log.filter((event) => event.type === 'dodge' && event.attackerId === 'striker')).toHaveLength(6);
    expect(log.some((event) => event.type === 'effect' && event.effect === 'poison')).toBe(false);
    expect(log.some((event) => event.type === 'effectDamage' && event.effect === 'burn' && event.damage > 0)).toBe(true);
  });

  it('a Unit that can never dodge draws the same Battle as before', () => {
    const withZero = { ...setup(7), teams: { a: setup(7).teams.a, b: setup(7).teams.b.map((spec) => ({ ...spec, dodgeChance: 0 })) } };
    expect(simulateBattle(withZero).log).toEqual(simulateBattle(setup(7)).log);
  });
});

describe('free Class skills', () => {
  const hero = (skill: 'consume-sin' | 'tainted-shaft' | 'votive-spark', overrides: Partial<UnitSpec> = {}): UnitSpec =>
    unit('hero', { power: 100, maxOil: 100, actionInterval: 10, skills: [{ id: skill, rank: 1 }], ...overrides });
  const enemies = (): UnitSpec[] => [
    unit('front', { health: 10_000, actionInterval: NEVER_ACTS, armour: 100 }),
    unit('back', { health: 10_000, actionInterval: NEVER_ACTS, row: 'back', armour: 100 }),
  ];
  const firstSkillTurn = (spec: UnitSpec): BattleEvent[] =>
    simulateBattle({ seed: 1, maxTicks: 10, teams: { a: [spec], b: enemies() } }).log.filter((event) => event.tick === 10);

  it('Consume Sin hits the front Row for 110% of power as holy damage and heals 3% of max health', () => {
    const events = firstSkillTurn(hero('consume-sin', { health: 50, maxHealth: 1000 }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'skill', skillId: 'consume-sin' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'attack', targetId: 'front', damage: expect.closeTo(110), damageType: 'holy' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'heal', targetId: 'hero', amount: 30 }));
  });

  it('Tainted Shaft reaches either Row with poison and a Poison stack, at 60% from the front Row', () => {
    const fromBack = (seed: number) =>
      simulateBattle({ seed, maxTicks: 60, teams: { a: [hero('tainted-shaft', { row: 'back' }), unit('ally', { actionInterval: NEVER_ACTS })], b: enemies() } }).log;
    const targets = new Set([1, 2, 3, 4, 5, 6].flatMap((seed) => fromBack(seed).flatMap((event) => (event.type === 'attack' ? [event.targetId] : []))));
    expect(targets).toEqual(new Set(['front', 'back']));
    const events = fromBack(1).filter((event) => event.tick === 10);
    expect(events).toContainEqual(expect.objectContaining({ type: 'attack', damage: expect.closeTo(40), damageType: 'poison' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'effect', effect: 'poison' }));
    expect(firstSkillTurn(hero('tainted-shaft'))).toContainEqual(expect.objectContaining({ type: 'attack', damage: expect.closeTo(24), damageType: 'poison' }));
  });

  it('Votive Spark hits either Row for 110% of power as holy damage', () => {
    // An ally holds the front Row, so the Hero stays in the back.
    const events = simulateBattle({ seed: 1, maxTicks: 10, teams: { a: [hero('votive-spark', { row: 'back' }), unit('ally', { actionInterval: NEVER_ACTS })], b: enemies() } }).log;
    expect(events).toContainEqual(expect.objectContaining({ type: 'skill', skillId: 'votive-spark' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'attack', damage: expect.closeTo(110), damageType: 'holy' }));
  });

  it('a Hero out of Oil falls back on the basic attack', () => {
    const events = firstSkillTurn(hero('votive-spark', { oil: 0 }));
    expect(events.some((event) => event.type === 'skill')).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: 'attack', damageType: 'physical' }));
  });
});
