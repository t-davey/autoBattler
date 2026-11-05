import { describe, expect, it } from 'vitest';
import { simulateBattle, type BattleSetup, type UnitSpec } from './index';

const unit = (id: string, overrides: Partial<UnitSpec> = {}): UnitSpec => ({
  id,
  hp: 20,
  attack: 3,
  attackInterval: 2,
  ...overrides,
});

const setup = (seed: number): BattleSetup => ({
  seed,
  teams: {
    a: [unit('a1'), unit('a2'), unit('a3')],
    b: [unit('b1'), unit('b2'), unit('b3')],
  },
});

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
      teams: { a: [unit('strong', { hp: 100, attack: 50 })], b: [unit('weak', { hp: 10, attack: 1 })] },
    });
    expect(result.winner).toBe('a');
    expect(result.log.at(-1)).toMatchObject({ type: 'death', unitId: 'weak' });
  });

  it('is a draw when the tick limit passes with both Teams alive', () => {
    const result = simulateBattle({
      seed: 1,
      maxTicks: 5,
      teams: { a: [unit('a1', { attack: 0 })], b: [unit('b1', { attack: 0 })] },
    });
    expect(result).toMatchObject({ winner: null, ticks: 5 });
  });

  it('caps a Battle at 1000 Ticks by default', () => {
    const result = simulateBattle({
      seed: 1,
      teams: { a: [unit('a1', { attack: 0 })], b: [unit('b1', { attack: 0 })] },
    });
    expect(result).toMatchObject({ winner: null, ticks: 1000 });
  });

  it('gives a Team with no Units an immediate loss', () => {
    const result = simulateBattle({ seed: 1, teams: { a: [unit('a1')], b: [] } });
    expect(result).toEqual({ winner: 'a', ticks: 0, log: [] });
  });

  it('is an immediate draw when neither Team has Units', () => {
    const result = simulateBattle({ seed: 1, teams: { a: [], b: [] } });
    expect(result).toEqual({ winner: null, ticks: 0, log: [] });
  });

  it('has each Unit attack once per attackInterval, starting after the first interval', () => {
    const { log } = simulateBattle({
      seed: 1,
      maxTicks: 7,
      teams: { a: [unit('a1', { hp: 100, attackInterval: 3 })], b: [unit('b1', { hp: 100, attackInterval: 2 })] },
    });
    const ticksOf = (attackerId: string) =>
      log.flatMap((event) => (event.type === 'attack' && event.attackerId === attackerId ? [event.tick] : []));
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
