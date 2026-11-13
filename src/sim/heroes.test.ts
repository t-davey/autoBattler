import { describe, expect, it } from 'vitest';
import {
  advance,
  applyAction,
  createGame,
  deserializeGame,
  partyUnitSpecs,
  serializeGame,
  TICK_MS,
  viewGame,
  type Game,
  type GameEvent,
  type GameSetup,
  type HeroId,
  type HeroView,
  type SkillId,
} from './index';

const heroIn = (game: Game, id: HeroId): HeroView => {
  const hero = viewGame(game).heroes.find((candidate) => candidate.id === id);
  if (!hero) throw new Error(`no Hero ${id}`);
  return hero;
};

const specOf = (game: Game, id: HeroId) => {
  const spec = partyUnitSpecs(game).find((candidate) => candidate.id === id);
  if (!spec) throw new Error(`no Unit ${id}`);
  return spec;
};

const rankOf = (game: Game, id: HeroId, skillId: SkillId): number =>
  heroIn(game, id).skills.find((skill) => skill.id === skillId)?.rank ?? 0;

const atLevel = (heroLevel: number, extra: Omit<NonNullable<GameSetup['scenario']>, 'heroLevel'> = {}): Game =>
  createGame({ seed: 1, scenario: { heroLevel, ...extra } });

const spend = (game: Game, heroId: HeroId, skillId: SkillId) =>
  applyAction(game, { type: 'spendSkillPoint', heroId, skillId });

/** Steps one Tick at a time until the predicate sees an event. */
const stepUntil = (game: Game, wanted: (event: GameEvent) => boolean, limit = 200_000): GameEvent => {
  for (let i = 0; i < limit; i++) {
    let found: GameEvent | undefined;
    advance(game, TICK_MS, (event) => {
      if (!found && wanted(event)) found = event;
    });
    if (found) return found;
  }
  throw new Error('event never came');
};

const STRONG: GameSetup['scenario'] = { heroLevel: 40 };

describe('levels', () => {
  it('a new Hero is level 1 with no points, and only its free Class skill in its order', () => {
    expect(heroIn(createGame({ seed: 1 }), 'warrener')).toMatchObject({
      name: 'Warrener',
      level: 1,
      xp: 0,
      xpToNext: 60,
      unspentPoints: 0,
      order: ['tainted-shaft'],
      oil: 100,
    });
  });

  it('a Hero gains a level and a skill point at the XP threshold', () => {
    const game = createGame({ seed: 1, scenario: STRONG });
    const before = heroIn(game, 'sin-eater');
    while (heroIn(game, 'sin-eater').level === 40) {
      stepUntil(game, (event) => event.type === 'battleEnded' && event.outcome === 'won');
      if (heroIn(game, 'sin-eater').level === 40) expect(heroIn(game, 'sin-eater').xp).toBeLessThan(before.xpToNext);
    }
    expect(heroIn(game, 'sin-eater')).toMatchObject({ level: 41, unspentPoints: before.unspentPoints + 1 });
  });

  it('every Hero gets the full XP of a won Battle, and a levelUp is reported', () => {
    const game = createGame({ seed: 1 });
    for (let wins = 0; wins < 3; wins++) stepUntil(game, (event) => event.type === 'battleEnded');
    expect(viewGame(game).heroes.map((hero) => hero.xp)).toEqual([56, 56, 56]); // 3 × 18.75, rounded down in the view.
    const level = stepUntil(game, (event) => event.type === 'levelUp');
    expect(level).toMatchObject({ type: 'levelUp', level: 2 });
  });

  it('only won Battles give XP', () => {
    // A new Party rarely loses, so a saved Game is edited to make it fall.
    const game = createGame({ seed: 1 });
    stepUntil(game, (event) => event.type === 'battleStarted');
    const saved = JSON.parse(serializeGame(game));
    for (const unit of saved.game.battle.units) if (unit.team === 'a') unit.health = 0.01;
    for (const unit of saved.game.battle.units) if (unit.team === 'b') unit.spec = { ...unit.spec, power: 500 };
    const losing = deserializeGame(JSON.stringify(saved))!;
    const ended = stepUntil(losing, (event) => event.type === 'battleEnded');
    expect(ended).toMatchObject({ outcome: 'lost' });
    expect(heroIn(losing, 'warrener').xp).toBe(0);
  });

  it('a drawn Battle gives no XP', () => {
    const game = createGame({ seed: 1 });
    stepUntil(game, (event) => event.type === 'battleStarted');
    const saved = JSON.parse(serializeGame(game));
    saved.game.battle.maxTicks = saved.game.battle.tick + 1;
    const drawing = deserializeGame(JSON.stringify(saved))!;
    expect(stepUntil(drawing, (event) => event.type === 'battleEnded')).toMatchObject({ outcome: 'draw' });
    expect(heroIn(drawing, 'warrener').xp).toBe(0);
  });

  it("stats rise by Class rates, and speed and crit stay fixed, with starter weapons in hand", () => {
    const game = atLevel(7);
    expect(specOf(game, 'sin-eater')).toMatchObject({ health: 256, power: 20, armour: 38, actionInterval: 32, critChance: 3, maxOil: 100 });
    expect(specOf(game, 'warrener')).toMatchObject({ health: 170, power: 29, armour: 14, actionInterval: 27, critChance: 10 });
    expect(specOf(game, 'lamplighter')).toMatchObject({ health: 149, power: 20, armour: 11, actionInterval: 30, critChance: 5 });
  });

  it('stops at the level cap of 60', () => {
    const game = atLevel(60);
    stepUntil(game, (event) => event.type === 'battleEnded');
    expect(heroIn(game, 'sin-eater')).toMatchObject({ level: 60, xp: 0 });
  });
});

describe('spending points', () => {
  it('spending a point raises a rank and uses the point', () => {
    const game = atLevel(2);
    expect(spend(game, 'warrener', 'bleeders-cut')).toEqual({ ok: true });
    expect(rankOf(game, 'warrener', 'bleeders-cut')).toBe(1);
    expect(heroIn(game, 'warrener').unspentPoints).toBe(0);
  });

  it('spending a point is refused below 3 points a step in the Branch', () => {
    const game = atLevel(9);
    expect(spend(game, 'warrener', 'open-veins')).toEqual({ ok: false, reason: 'stepLocked' });
    spend(game, 'warrener', 'bleeders-cut');
    spend(game, 'warrener', 'bleeders-cut');
    expect(spend(game, 'warrener', 'open-veins')).toEqual({ ok: false, reason: 'stepLocked' });
    spend(game, 'warrener', 'bleeders-cut');
    expect(spend(game, 'warrener', 'open-veins')).toEqual({ ok: true });
    spend(game, 'warrener', 'open-veins');
    expect(spend(game, 'warrener', 'the-long-cut')).toEqual({ ok: false, reason: 'stepLocked' });
    spend(game, 'warrener', 'open-veins');
    expect(spend(game, 'warrener', 'the-long-cut')).toEqual({ ok: true });
  });

  it('spending a point is refused with no points', () => {
    expect(spend(createGame({ seed: 1 }), 'warrener', 'bleeders-cut')).toEqual({ ok: false, reason: 'noPoints' });
  });

  it('spending a point is refused above rank 5', () => {
    const game = atLevel(10);
    for (let i = 0; i < 5; i++) expect(spend(game, 'warrener', 'bleeders-cut')).toEqual({ ok: true });
    expect(spend(game, 'warrener', 'bleeders-cut')).toEqual({ ok: false, reason: 'maxRank' });
  });

  it("spending a point is refused on another Class's skill", () => {
    expect(spend(atLevel(5), 'warrener', 'mend-by-lamplight')).toEqual({ ok: false, reason: 'otherClass' });
  });

  it('an unknown Hero or skill is refused', () => {
    const game = atLevel(5);
    expect(applyAction(game, { type: 'spendSkillPoint', heroId: 'nobody' as HeroId, skillId: 'bleeders-cut' })).toEqual({ ok: false, reason: 'unknownHero' });
    expect(spend(game, 'warrener', 'constructor' as SkillId)).toEqual({ ok: false, reason: 'unknownSkill' });
  });

  it('learning an active skill adds it to the end of the order', () => {
    const game = atLevel(8);
    spend(game, 'warrener', 'bleeders-cut');
    expect(heroIn(game, 'warrener').order).toEqual(['bleeders-cut', 'tainted-shaft']);
    spend(game, 'warrener', 'bleeders-cut');
    spend(game, 'warrener', 'bleeders-cut');
    spend(game, 'warrener', 'open-veins');
    spend(game, 'warrener', 'open-veins');
    spend(game, 'warrener', 'open-veins');
    spend(game, 'warrener', 'the-long-cut');
    expect(heroIn(game, 'warrener').order).toEqual(['bleeders-cut', 'the-long-cut', 'tainted-shaft']);
  });
});

describe('skill order and respec', () => {
  const builtWarrener = (): Game =>
    atLevel(7, { skillRanks: { warrener: { 'bleeders-cut': 2, 'open-veins': 2, 'the-long-cut': 1 } } });

  it('setSkillOrder changes the order', () => {
    const game = builtWarrener();
    const order = ['tainted-shaft', 'the-long-cut', 'bleeders-cut'] as const;
    expect(applyAction(game, { type: 'setSkillOrder', heroId: 'warrener', order })).toEqual({ ok: true });
    expect(heroIn(game, 'warrener').order).toEqual(order);
  });

  it('setSkillOrder takes up to 3 learned active skills, each once, and may leave skills out', () => {
    const game = builtWarrener();
    const refused = { ok: false, reason: 'badOrder' };
    const tryOrder = (order: readonly SkillId[]) => applyAction(game, { type: 'setSkillOrder', heroId: 'warrener', order });
    expect(tryOrder(['bleeders-cut', 'bleeders-cut'])).toEqual(refused);
    expect(tryOrder(['bleeders-cut', 'open-veins'])).toEqual(refused);
    expect(tryOrder(['bleeders-cut', 'consume-sin'])).toEqual(refused);
    expect(tryOrder(['bleeders-cut', 'the-long-cut', 'tainted-shaft', 'bleeders-cut'])).toEqual(refused);
    expect(heroIn(game, 'warrener').order).toEqual(['bleeders-cut', 'the-long-cut', 'tainted-shaft']);
    expect(tryOrder(['bleeders-cut', 'the-long-cut'])).toEqual({ ok: true });
    expect(tryOrder([])).toEqual({ ok: true });
  });

  it('a skill left out of the order never fires', () => {
    const game = builtWarrener();
    applyAction(game, { type: 'setSkillOrder', heroId: 'warrener', order: ['bleeders-cut', 'the-long-cut'] });
    const used = new Set<SkillId>();
    advance(game, 600_000, (event) => {
      if (event.type === 'skill' && event.unitId === 'warrener') used.add(event.skillId);
    });
    expect(used.has('bleeders-cut')).toBe(true);
    expect(used.has('tainted-shaft')).toBe(false);
  });

  it('a skill learned while the order is full waits outside it', () => {
    const game = atLevel(9, { skillRanks: { warrener: { 'bleeders-cut': 3, 'open-veins': 3 } } });
    applyAction(game, { type: 'setSkillOrder', heroId: 'warrener', order: ['bleeders-cut'] });
    spend(game, 'warrener', 'the-long-cut');
    expect(heroIn(game, 'warrener').order).toEqual(['bleeders-cut', 'the-long-cut']);
  });

  it('respec refunds every point and leaves only the free Class skill in the order', () => {
    const game = builtWarrener();
    expect(applyAction(game, { type: 'respec', heroId: 'warrener' })).toEqual({ ok: true });
    expect(heroIn(game, 'warrener')).toMatchObject({ unspentPoints: 6, order: ['tainted-shaft'] });
    expect(rankOf(game, 'warrener', 'bleeders-cut')).toBe(0);
  });

  it('a chosen order keeps its place when another active skill is learned', () => {
    const game = atLevel(9, { skillRanks: { warrener: { 'bleeders-cut': 2, 'open-veins': 2, 'the-long-cut': 1 } } });
    applyAction(game, { type: 'setSkillOrder', heroId: 'warrener', order: ['the-long-cut', 'tainted-shaft', 'bleeders-cut'] });
    spend(game, 'warrener', 'the-long-cut');
    expect(heroIn(game, 'warrener').order).toEqual(['the-long-cut', 'tainted-shaft', 'bleeders-cut']);
  });

  it('a newly learned skill goes just ahead of the free Class skill, which always has a target', () => {
    const game = atLevel(9, { skillRanks: { warrener: { 'bleeders-cut': 3, 'open-veins': 3 } } });
    applyAction(game, { type: 'setSkillOrder', heroId: 'warrener', order: ['tainted-shaft', 'bleeders-cut'] });
    spend(game, 'warrener', 'the-long-cut');
    expect(heroIn(game, 'warrener').order).toEqual(['the-long-cut', 'tainted-shaft', 'bleeders-cut']);
  });

  it('the free Class skill takes no points and has a fixed strength', () => {
    const game = atLevel(3);
    expect(spend(game, 'warrener', 'tainted-shaft')).toEqual({ ok: false, reason: 'freeSkill' });
    const shaft = heroIn(game, 'warrener').skills.find((skill) => skill.id === 'tainted-shaft')!;
    expect(shaft).toMatchObject({ free: true, rank: 1, maxRank: 1 });
    expect(heroIn(game, 'warrener').unspentPoints).toBe(2);
  });

  it('after a respec, skills come back into the order as they are relearned', () => {
    const game = builtWarrener();
    applyAction(game, { type: 'respec', heroId: 'warrener' });
    spend(game, 'warrener', 'bleeders-cut');
    expect(heroIn(game, 'warrener').order).toEqual(['bleeders-cut', 'tainted-shaft']);
  });
});

describe('renameHero', () => {
  const rename = (game: Game, name: string) => applyAction(game, { type: 'renameHero', heroId: 'warrener', name });

  it('renameHero trims the name', () => {
    const game = createGame({ seed: 1 });
    expect(rename(game, '  Old Marrow  ')).toEqual({ ok: true });
    expect(heroIn(game, 'warrener').name).toBe('Old Marrow');
    expect(specOf(game, 'warrener').name).toBe('Old Marrow');
  });

  it('renameHero refuses empty names and names over 24 characters', () => {
    const game = createGame({ seed: 1 });
    expect(rename(game, '   ')).toEqual({ ok: false, reason: 'emptyName' });
    expect(rename(game, 'x'.repeat(25))).toEqual({ ok: false, reason: 'nameTooLong' });
    expect(rename(game, 'x'.repeat(24))).toEqual({ ok: true });
  });
});

describe('between Battles', () => {
  const builtGame = (): Game =>
    atLevel(40, { skillRanks: { warrener: { 'bleeders-cut': 2 } } });

  it('a build change reaches the next Battle but not the current one', () => {
    const game = atLevel(7);
    stepUntil(game, (event) => event.type === 'battleStarted');
    spend(game, 'warrener', 'bleeders-cut');
    let usedInCurrent = false;
    while (viewGame(game).phase === 'battle') {
      advance(game, TICK_MS, (event) => {
        if (event.type === 'skill' && event.skillId === 'bleeders-cut') usedInCurrent = true;
      });
    }
    expect(usedInCurrent).toBe(false);
    const nextUse = stepUntil(game, (event) => event.type === 'skill' && event.skillId === 'bleeders-cut');
    expect(nextUse).toMatchObject({ skillId: 'bleeders-cut' });
  });

  it('a changed order changes what the Hero does in the next Battle', () => {
    const skillsWith = (order: readonly SkillId[]): SkillId[] => {
      const game = atLevel(7, { skillRanks: { warrener: { 'bleeders-cut': 2, 'open-veins': 2, 'the-long-cut': 1 } } });
      applyAction(game, { type: 'setSkillOrder', heroId: 'warrener', order });
      const used: SkillId[] = [];
      advance(game, 600_000, (event) => {
        if (event.type === 'skill' && event.unitId === 'warrener') used.push(event.skillId);
      });
      return used;
    };
    expect(skillsWith(['the-long-cut', 'bleeders-cut', 'tainted-shaft'])).not.toEqual(skillsWith(['bleeders-cut', 'the-long-cut', 'tainted-shaft']));
  });

  it('Oil carries out of a Battle, with 30 more on leaving the Room, up to the maximum', () => {
    const started = atLevel(20);
    stepUntil(started, (event) => event.type === 'battleStarted');
    const saved = JSON.parse(serializeGame(started));
    saved.game.battle.units[1].oil = 10;
    const game = deserializeGame(JSON.stringify(saved))!;
    const startedAt = viewGame(game).tick;
    let spent = 0;
    while (viewGame(game).phase === 'battle') {
      advance(game, TICK_MS, (event) => {
        if (event.type === 'skill' && event.unitId === 'warrener') spent += 7;
      });
    }
    // Tainted Shaft, the free Class skill, costs 7 Oil.
    const battleTicks = viewGame(game).tick - startedAt;
    const expected = 10 + Math.floor(battleTicks / 5) - spent + 30;
    expect(expected).toBeLessThan(100);
    expect(heroIn(game, 'warrener').oil).toBe(expected);

    const full = createGame({ seed: 1 });
    stepUntil(full, (event) => event.type === 'battleEnded');
    expect(heroIn(full, 'warrener').oil).toBe(100);
  });

  it('cooldowns end with the Battle', () => {
    const game = atLevel(7, { skillRanks: { warrener: { 'bleeders-cut': 2, 'open-veins': 2, 'the-long-cut': 1 } } });
    const battleUnits = () => JSON.parse(serializeGame(game)).game.battle?.units ?? [];
    let cooling = false;
    for (let i = 0; i < 20_000 && !cooling; i++) {
      advance(game, TICK_MS);
      cooling = battleUnits().some((unit: { skillReadyAt: object }) => Object.keys(unit.skillReadyAt).length > 0);
    }
    expect(cooling).toBe(true);
    stepUntil(game, (event) => event.type === 'battleEnded');
    stepUntil(game, (event) => event.type === 'battleStarted');
    expect(battleUnits().every((unit: { skillReadyAt: object }) => Object.keys(unit.skillReadyAt).length === 0)).toBe(true);
  });

  it('health is restored and effects end with the Battle', () => {
    const game = builtGame();
    advance(game, TICK_MS);
    stepUntil(game, (event) => event.type === 'battleEnded');
    stepUntil(game, (event) => event.type === 'battleStarted');
    const warrener = viewGame(game).battle?.party.find((unit) => unit.id === 'warrener');
    expect(warrener).toMatchObject({ health: warrener?.maxHealth, poisonStacks: 0, wardAmount: 0 });
  });

  it('partyUnitSpecs reflects a Hero\'s level, ranks, and skill order', () => {
    const game = atLevel(7, { skillRanks: { warrener: { 'bleeders-cut': 2, 'open-veins': 2, 'the-long-cut': 1 } } });
    applyAction(game, { type: 'setSkillOrder', heroId: 'warrener', order: ['the-long-cut', 'bleeders-cut', 'tainted-shaft'] });
    const spec = specOf(game, 'warrener');
    expect(spec.power).toBe(29);
    expect(spec.skills).toEqual([
      { id: 'the-long-cut', rank: 1 },
      { id: 'bleeders-cut', rank: 2 },
      { id: 'tainted-shaft', rank: 1 },
      { id: 'open-veins', rank: 2 },
    ]);
  });
});

describe('saves', () => {
  const inFight = (): Game => {
    const game = atLevel(7, {
      skillRanks: {
        'sin-eater': { 'bar-the-way': 2, 'iron-penance': 2, 'shared-burden': 2 },
        warrener: { 'bleeders-cut': 2, 'open-veins': 2, 'the-long-cut': 2 },
        lamplighter: { 'mend-by-lamplight': 4, 'lantern-ward': 2 },
      },
    });
    // Runs until a Bleed and a Ward are both live, so the round trip carries them.
    for (let i = 0; i < 20_000; i++) {
      advance(game, TICK_MS);
      const units = viewGame(game).battle;
      if (units?.enemies.some((enemy) => enemy.bleeding && enemy.health > 0) && units.party.some((hero) => hero.wardAmount > 0)) return game;
    }
    throw new Error('no Battle with live effects');
  };

  it('serializeGame round-trips a Game with skills, effects, and cooldowns', () => {
    const game = inFight();
    const copy = deserializeGame(serializeGame(game));
    expect(copy).not.toBeNull();
    expect(serializeGame(copy!)).toBe(serializeGame(game));
    advance(game, 100_000);
    advance(copy!, 100_000);
    expect(serializeGame(copy!)).toBe(serializeGame(game));
  });

  it.each<[string, (save: { game: Record<string, any> }) => void]>([
    ['a Hero with no name', (save) => { save.game['heroes'][0].name = 3; }],
    ['an unknown Hero', (save) => { save.game['heroes'][0].id = 'nobody'; }],
    ['a level below 1', (save) => { save.game['heroes'][0].level = 0; }],
    ['bad XP', (save) => { save.game['heroes'][0].xp = 'lots'; }],
    ['bad Oil', (save) => { save.game['heroes'][0].oil = null; }],
    ['an unknown skill rank', (save) => { save.game['heroes'][0].ranks = { nonsense: 1 }; }],
    ['a rank above the limit', (save) => { save.game['heroes'][0].ranks = { 'bar-the-way': 6 }; }],
    ['an order with an unlearned skill', (save) => { save.game['heroes'][0].order = ['lantern-ward']; }],
    ['missing Heroes', (save) => { delete save.game['heroes']; }],
    ['a Unit with bad Oil', (save) => { save.game['battle'].units[0].oil = 'full'; }],
    ['a Unit with a bad Bleed', (save) => { save.game['battle'].units[0].bleed = { perTick: 'x' }; }],
    ['a Unit with bad Poison', (save) => { save.game['battle'].units[0].poison = [{ damage: 1 }]; }],
    ['a Unit with a bad Ward', (save) => { save.game['battle'].units[0].ward = { amount: 1 }; }],
    ['a Unit with a bad cooldown', (save) => { save.game['battle'].units[0].skillReadyAt = { 'bar-the-way': 'soon' }; }],
    ['a Unit with an unknown skill', (save) => { save.game['battle'].units[0].spec.skills = [{ id: 'nonsense', rank: 1 }]; }],
  ])('deserializeGame returns null for %s', (_name, corrupt) => {
    const save = JSON.parse(serializeGame(inFight()));
    corrupt(save);
    expect(deserializeGame(JSON.stringify(save))).toBeNull();
  });
});

describe('saves from before free Class skills', () => {
  it('load from version 5 with each free Class skill added to the end of its Hero\'s order', () => {
    const game = atLevel(3, { skillRanks: { warrener: { 'bleeders-cut': 2 } } });
    const saved = JSON.parse(serializeGame(game)) as { version: number; game: { heroes: { order: string[] }[] } };
    saved.version = 5;
    for (const savedHero of saved.game.heroes) savedHero.order = savedHero.order.filter((id) => !['consume-sin', 'tainted-shaft', 'votive-spark'].includes(id));
    const loaded = deserializeGame(JSON.stringify(saved))!;
    expect(heroIn(loaded, 'warrener').order).toEqual(['bleeders-cut', 'tainted-shaft']);
    expect(heroIn(loaded, 'sin-eater').order).toEqual(['consume-sin']);
  });

  it('keep a free Class skill the player left out in a current save', () => {
    const game = atLevel(3);
    applyAction(game, { type: 'setSkillOrder', heroId: 'warrener', order: [] });
    expect(heroIn(deserializeGame(serializeGame(game))!, 'warrener').order).toEqual([]);
  });

  it('refuse a free Class skill bought with points', () => {
    const saved = JSON.parse(serializeGame(atLevel(3))) as { game: { heroes: { ranks: Record<string, number> }[] } };
    saved.game.heroes[1]!.ranks['tainted-shaft'] = 1;
    expect(deserializeGame(JSON.stringify(saved))).toBeNull();
  });
});
