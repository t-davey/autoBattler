import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createBattle,
  createGame,
  deserializeGame,
  serializeGame,
  simulateBattle,
  stepBattle,
  viewGame,
  type BattleEvent,
  type HeroView,
  type SkillId,
  type UnitSpec,
} from './index';

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

/** A back-Row Hexer, with an ally holding the front Row so it stays there. */
const hexer = (skills: readonly { id: SkillId; rank: number }[], overrides: Partial<UnitSpec> = {}): UnitSpec[] => [
  unit('hexer', { row: 'back', reach: 'ranged', actionInterval: 10, maxOil: 1_000, skills, ...overrides }),
  unit('ally'),
];

const battle = (a: readonly UnitSpec[], b: readonly UnitSpec[], maxTicks: number, seed = 1): BattleEvent[] =>
  simulateBattle({ seed, maxTicks, teams: { a, b } }).log as BattleEvent[];

const effectsOn = (log: readonly BattleEvent[], effect: string, targetId: string) =>
  log.filter((event) => event.type === 'effect' && event.effect === effect && event.targetId === targetId);

describe('the Hexer in a Game', () => {
  const party = ['sin-eater', 'hexer', 'lamplighter'] as const;
  const hexerIn = (game: ReturnType<typeof createGame>): HeroView => viewGame(game).heroes.find((hero) => hero.id === 'hexer')!;

  it('starts with Chill Word and the Rot and Malediction Branches', () => {
    const view = hexerIn(createGame({ seed: 1, party }));
    expect(view).toMatchObject({ className: 'Hexer', row: 'back', order: ['chill-word'] });
    expect(view.skills.map((skill) => [skill.branch, skill.id])).toEqual([
      ['Class skill', 'chill-word'],
      ['Rot', 'sow-rot'],
      ['Rot', 'ripening'],
      ['Rot', 'bloom'],
      ['Malediction', 'wasting-curse'],
      ['Malediction', 'spoiled-blood'],
      ['Malediction', 'leech-hex'],
    ]);
  });

  it('opens deeper steps only with points spent in that Branch', () => {
    const game = createGame({ seed: 1, party, scenario: { heroLevel: 7, skillRanks: { hexer: { 'sow-rot': 3 } } } });
    const spend = (skillId: SkillId) => applyAction(game, { type: 'spendSkillPoint', heroId: 'hexer', skillId });
    expect(spend('spoiled-blood')).toEqual({ ok: false, reason: 'stepLocked' });
    expect(spend('ripening')).toEqual({ ok: true });
    expect(spend('wasting-curse')).toEqual({ ok: true });
  });

  it('saves and loads', () => {
    const game = createGame({ seed: 1, party });
    expect(viewGame(deserializeGame(serializeGame(game))!).heroes.map((hero) => hero.id)).toEqual(party);
  });
});

describe('Hexer skills', () => {
  it('Chill Word hits for 100% of power as cold damage and Slows by 15%', () => {
    const log = battle(hexer([{ id: 'chill-word', rank: 1 }]), [unit('foe')], 10);
    expect(log).toContainEqual(expect.objectContaining({ type: 'attack', targetId: 'foe', damage: 100, damageType: 'cold' }));
    expect(effectsOn(log, 'slow', 'foe')).toHaveLength(1);
  });

  it('Sow Rot stacks Poison to the limit, and Ripening raises the limit on what it poisons', () => {
    const stacksAfter = (ripening: number) => {
      const skills = [{ id: 'sow-rot' as const, rank: 1 }, ...(ripening > 0 ? [{ id: 'ripening' as const, rank: ripening }] : [])];
      const state = createBattle({ seed: 1, teams: { a: hexer(skills), b: [unit('foe')] } });
      for (let tick = 0; tick < 150; tick++) stepBattle(state);
      return (state.units as unknown as { spec: { id: string }; poison: unknown[] }[]).find((u) => u.spec.id === 'foe')!.poison.length;
    };
    expect(stacksAfter(0)).toBe(5);
    expect(stacksAfter(3)).toBe(8);
  });

  it('Sow Rot deals 15% of power each time, and tops up Poison about to run out', () => {
    const log = battle(hexer([{ id: 'sow-rot', rank: 1 }]), [unit('foe')], 300);
    const poisonTicks = log.filter((event) => event.type === 'effectDamage' && event.effect === 'poison');
    expect(poisonTicks.every((event) => event.type === 'effectDamage' && Math.abs(event.damage - 15) < 1e-9)).toBe(true);
    // At the limit, it waits until under 40 Ticks of Poison are left, then refreshes the stacks.
    const sown = log.filter((event) => event.type === 'skill' && event.skillId === 'sow-rot').map((event) => event.tick);
    expect(sown.slice(0, 6)).toEqual([10, 20, 30, 40, 50, 120]);
  });

  it('Bloom copies half the stacks of the most-poisoned enemy, rounded up, to every other enemy', () => {
    // A helper fills the front foe with 5 stacks by Tick 10, when the Hexer first acts.
    const spreader = unit('spreader', { actions: [{ name: 'Spore', interval: 1, target: 'oneFront', damage: 0, damageType: 'poison', poisonStack: 1 }] });
    const team = [unit('hexer', { row: 'back', reach: 'ranged', actionInterval: 10, maxOil: 100, skills: [{ id: 'bloom', rank: 1 }] }), spreader];
    const state = createBattle({ seed: 1, teams: { a: team, b: [unit('first'), unit('second', { row: 'back' }), unit('third', { row: 'back' })] } });
    for (let tick = 0; tick < 10; tick++) stepBattle(state);
    const stacks = (id: string) => (state.units as unknown as { spec: { id: string }; poison: unknown[] }[]).find((u) => u.spec.id === id)!.poison.length;
    expect(stacks('first')).toBe(5);
    expect(stacks('second')).toBe(3);
    expect(stacks('third')).toBe(3);
  });

  it('Wasting Curse curses the strongest uncursed enemy, so it deals 10% less damage', () => {
    const foes = [unit('weak', { power: 50, actionInterval: 30 }), unit('strong', { power: 200, actionInterval: 30, row: 'back', reach: 'ranged', targeting: 'any' })];
    const log = battle(hexer([{ id: 'wasting-curse', rank: 1 }]), foes, 30);
    expect(effectsOn(log, 'curse', 'strong')).toHaveLength(1);
    const strongHits = log.filter((event) => event.type === 'attack' && event.attackerId === 'strong');
    expect(strongHits.every((event) => event.type === 'attack' && Math.abs(event.damage - 180) < 1e-9)).toBe(true);
  });

  it('Spoiled Blood makes a Cursed enemy take more damage from every source', () => {
    const hitsOn = (spoiled: boolean) => {
      const skills = [{ id: 'wasting-curse' as const, rank: 1 }, ...(spoiled ? [{ id: 'spoiled-blood' as const, rank: 1 }] : [])];
      const team = [unit('hexer', { row: 'back', reach: 'ranged', actionInterval: 10, maxOil: 100, skills }), unit('ally', { actionInterval: 20 })];
      return battle(team, [unit('foe')], 40).filter((event) => event.type === 'attack' && event.attackerId === 'ally').map((event) => event.type === 'attack' && event.damage);
    };
    expect(hitsOn(false)).toEqual([100, 100]);
    // Cursed at Tick 10, before the ally's first hit at 20.
    expect(hitsOn(true)).toEqual([expect.closeTo(106), expect.closeTo(106)]);
  });

  it('Leech Hex heals the Hexer for part of what it deals to Cursed enemies, Poison included', () => {
    const skills = [{ id: 'wasting-curse' as const, rank: 1 }, { id: 'sow-rot' as const, rank: 1 }, { id: 'leech-hex' as const, rank: 1 }];
    const log = battle(hexer(skills, { health: 10, maxHealth: 1_000 }), [unit('foe')], 60);
    const heals = log.filter((event) => event.type === 'heal' && event.targetId === 'hexer');
    expect(heals.length).toBeGreaterThan(0);
    // 10% of each 15-damage Poison tick.
    expect(heals.every((event) => event.type === 'heal' && Math.abs(event.amount - 1.5) < 1e-9)).toBe(true);
  });
});
