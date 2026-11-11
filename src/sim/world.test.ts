import { describe, expect, it } from 'vitest';
import { ACTS, advance, createGame, depthOf, depthTuning, floorAt, LAMPS, MAX_DEPTH, viewGame } from './index';

describe('The world map', () => {
  it('has 3 Acts of 20 Floors with 12 Lamps, one every 5 Floors', () => {
    expect(ACTS.map((act) => act.act)).toEqual([1, 2, 3]);
    expect(MAX_DEPTH).toBe(60);
    expect(LAMPS.map((lamp) => lamp.depth)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
    expect(depthOf(2, 5)).toBe(25);
  });

  it('turns a depth into its Act and the Floor within it', () => {
    expect(floorAt(1)).toEqual({ act: 1, floor: 1, actName: 'The Wilderness' });
    expect(floorAt(20)).toEqual({ act: 1, floor: 20, actName: 'The Wilderness' });
    expect(floorAt(25)).toEqual({ act: 2, floor: 5, actName: 'The Undercroft' });
    expect(floorAt(60)).toEqual({ act: 3, floor: 20, actName: 'The Ember Works' });
    expect(() => floorAt(61)).toThrow();
  });

  it('starts a new game at Act 1, Floor 1', () => {
    const { floor } = viewGame(createGame({ seed: 1 }));
    expect(floor && floorAt(floor)).toMatchObject({ act: 1, floor: 1 });
  });

  it('places the Mouldering Warden at the Undercroft’s first Lamp and placeholders everywhere else', () => {
    const built = LAMPS.filter((lamp) => !lamp.placeholder);
    expect(built).toEqual([{ act: 2, lamp: 1, depth: 25, guardianName: 'The Mouldering Warden', tunedDepth: 5, placeholder: false }]);
    expect(LAMPS.filter((lamp) => lamp.placeholder)).toHaveLength(11);
    expect(LAMPS[0]?.guardianName).toBe('Placeholder Guardian (Act 1, Lamp 1)');
  });
});

describe('Placeholders', () => {
  it('fill Acts 1 and 3 with stand-in Packs, and the Undercroft with none', () => {
    const enemiesAt = (floor: number) =>
      Array.from({ length: 30 }, (_, seed) => {
        const game = createGame({ seed, scenario: { startAt: { floor, room: 0 } } });
        while (!viewGame(game).battle) advance(game, 1_000);
        return viewGame(game).battle!.enemies;
      }).flat();
    for (const [floor, act] of [[1, 1], [41, 3]] as const) {
      const enemies = enemiesAt(floor);
      expect(enemies.every((enemy) => enemy.placeholder)).toBe(true);
      expect(new Set(enemies.map((enemy) => enemy.name))).toEqual(new Set([`Placeholder Brute (Act ${act})`, `Placeholder Skulker (Act ${act})`]));
    }
    expect(enemiesAt(21).some((enemy) => enemy.placeholder)).toBe(false);
  });

  it('give placeholder Acts placeholder chest lines', () => {
    const chestLinesAt = (floor: number) => {
      const lines = new Set<string>();
      for (let seed = 0; seed < 20; seed++) {
        const game = createGame({ seed, scenario: { startAt: { floor, room: 0 }, heroLevel: 60 } });
        for (let step = 0; step < 300; step++) advance(game, 1_000, (event) => event.type === 'chestOpened' && lines.add(event.line));
      }
      return [...lines];
    };
    expect(chestLinesAt(1)).toEqual(['[placeholder] A chest. Its story is still to be written.']);
    expect(chestLinesAt(21).some((line) => line.includes('placeholder'))).toBe(false);
  });

  it('list what is still to design: 2 Acts and 11 Guardians', () => {
    expect(ACTS.filter((act) => act.placeholder).map((act) => act.name)).toEqual(['The Wilderness', 'The Ember Works']);
    expect(LAMPS.filter((lamp) => lamp.placeholder)).toHaveLength(11);
  });
});

describe('Depth tuning', () => {
  it('keeps the demo’s tuned values at depths 1–5', () => {
    expect([1, 2, 3, 4, 5].map((depth) => depthTuning(depth))).toEqual([
      { enemyScale: 1, battleXp: 15, floorLevel: 4, rarityOdds: { common: 78, magic: 19 }, affixScale: 1, levelRequirement: 1 },
      { enemyScale: 1.15, battleXp: 20, floorLevel: 5, rarityOdds: { common: 70, magic: 23 }, affixScale: 1.2, levelRequirement: 3 },
      { enemyScale: 1.3, battleXp: 25, floorLevel: 6, rarityOdds: { common: 60, magic: 28 }, affixScale: 1.4, levelRequirement: 4 },
      { enemyScale: 1.45, battleXp: 30, floorLevel: 7, rarityOdds: { common: 52, magic: 31 }, affixScale: 1.6, levelRequirement: 5 },
      { enemyScale: 1.6, battleXp: 35, floorLevel: 8, rarityOdds: { common: 44, magic: 34 }, affixScale: 1.8, levelRequirement: 6 },
    ].map((tuning) => ({ ...tuning, enemyScale: expect.closeTo(tuning.enemyScale, 10), affixScale: expect.closeTo(tuning.affixScale, 10) })));
  });

  it('keeps growing to depth 60, with valid rarity odds throughout', () => {
    for (let depth = 2; depth <= MAX_DEPTH; depth++) {
      const here = depthTuning(depth);
      const before = depthTuning(depth - 1);
      expect(here.enemyScale).toBeGreaterThan(before.enemyScale);
      expect(here.battleXp).toBeGreaterThan(before.battleXp);
      expect(here.levelRequirement).toBeGreaterThan(before.levelRequirement);
      expect(here.rarityOdds.common).toBeLessThanOrEqual(before.rarityOdds.common);
      expect(here.rarityOdds.common + here.rarityOdds.magic).toBeLessThan(100);
    }
  });
});
