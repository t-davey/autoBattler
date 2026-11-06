import { describe, expect, it } from 'vitest';
import {
  createBattle,
  simulateBattle,
  stepBattle,
  type BattleEvent,
  type BattleSetup,
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
        } else {
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
