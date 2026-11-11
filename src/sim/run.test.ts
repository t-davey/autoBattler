import { describe, expect, it } from 'vitest';
import {
  advance,
  applyAction,
  createGame,
  deserializeGame,
  serializeGame,
  TICK_MS,
  viewGame,
  type Game,
  type GameEvent,
  type GameSetup,
  type GameView,
  type HeroId,
  type HeroView,
} from './index';

type Scenario = NonNullable<GameSetup['scenario']>;
type Wanted = GameEvent['type'] | ((event: GameEvent) => boolean);

const LIMIT = 400_000;

/** Runs Ticks until a Tick reports the wanted event, and collects everything reported on the way. */
function stepUntil(game: Game, wanted: Wanted, seen: GameEvent[] = []): GameEvent {
  const matches = typeof wanted === 'string' ? (event: GameEvent) => event.type === wanted : wanted;
  for (let i = 0; i < LIMIT; i++) {
    let found: GameEvent | undefined;
    advance(game, TICK_MS, (event) => {
      seen.push(event);
      if (!found && matches(event)) found = event;
    });
    if (found) return found;
  }
  throw new Error('the wanted event never came');
}

const stepTicks = (game: Game, ticks: number, seen: GameEvent[] = []): void => {
  advance(game, ticks * TICK_MS, (event) => seen.push(event));
};

const hero = (view: GameView, id: HeroId): HeroView => {
  const found = view.heroes.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no Hero ${id}`);
  return found;
};

const game = (seed: number, scenario: Scenario = {}): Game => createGame({ seed, scenario });
const atGuardian = { startAt: { floor: 5, room: 'guardian' } } satisfies Scenario;

/** A Game whose Party has just Wiped, with what it held the Tick before. */
function afterWipe(seed: number): { game: Game; before: GameView } {
  const played = game(seed);
  let before = viewGame(played);
  for (let i = 0; i < LIMIT; i++) {
    let wiped = false;
    advance(played, TICK_MS, (event) => {
      if (event.type === 'wipe') wiped = true;
    });
    if (wiped) return { game: played, before };
    before = viewGame(played);
  }
  throw new Error('no Wipe');
}

describe('Rooms', () => {
  it('each Room takes 50 Ticks of travel, and a chest 200 more', () => {
    for (let seed = 0; seed < 50; seed++) {
      const played = game(seed);
      const entered = stepUntil(played, 'roomEntered');
      expect(viewGame(played).tick).toBe(50);
      if (entered.type !== 'roomEntered' || entered.kind !== 'chest') continue;
      expect(viewGame(played).phase).toBe('chest');
      const seen: GameEvent[] = [];
      stepTicks(played, 199, seen);
      expect(seen).toEqual([]);
      stepTicks(played, 1, seen);
      expect(seen[0]?.type).toBe('chestOpened');
      expect(seen.slice(1).every((event) => event.type === 'itemFound')).toBe(true);
      expect(seen[0]).toMatchObject({ line: expect.stringMatching(/\w/) });
      expect(viewGame(played).phase).toBe('travelling');
      return;
    }
    throw new Error('no first-Room chest in 50 Seeds');
  });

  it('a new game goes straight to Floor 1', () => {
    const played = game(1);
    expect(viewGame(played)).toMatchObject({ phase: 'travelling', floor: 1, townTicksLeft: null });
    expect(stepUntil(played, 'floorEntered')).toMatchObject({ floor: 1 });
  });

  it('the Party visits every Room in order, then moves to the next Floor', () => {
    const played = game(3, { heroLevel: 40 });
    const { rooms } = viewGame(played).map!;
    const seen: GameEvent[] = [];
    stepUntil(played, (event) => event.type === 'floorEntered' && event.floor === 2, seen);
    const visited = seen.flatMap((event) => (event.type === 'roomEntered' && event.floor === 1 ? [event] : []));
    expect(visited.map((room) => room.room)).toEqual(rooms.map((_, index) => index));
    expect(visited.map((room) => room.kind)).toEqual(rooms.map((room) => room.kind));
    expect(viewGame(played).floor).toBe(2);
  });

  it('a new visit to a Floor draws a new layout', () => {
    const played = game(5, { heroLevel: 40 });
    const first = viewGame(played).map!.rooms;
    stepUntil(played, 'returnedToTown');
    stepUntil(played, 'partySent');
    expect(viewGame(played).floor).toBe(1);
    expect(viewGame(played).map!.rooms).not.toEqual(first);
  });
});

describe('carrying over', () => {
  it('health and Oil carry between Rooms', () => {
    let sawHurt = false;
    let sawLowOil = false;
    const spender = { huntsman: { 'bleeders-cut': 3, 'the-long-cut': 3 } };
    for (let seed = 1; seed <= 20; seed++) {
      const played = game(seed, { heroLevel: 8, skillRanks: spender });
      for (let battles = 0; battles < 6 && viewGame(played).phase !== 'town'; battles++) {
        stepUntil(played, 'battleStarted');
        const next = viewGame(played);
        for (const unit of next.battle!.party) {
          const carried = hero(next, unit.id as HeroId);
          expect(unit.health).toBe(carried.health);
          expect(unit.oil).toBe(carried.oil);
          sawHurt ||= unit.health < unit.maxHealth;
          sawLowOil ||= unit.oil < unit.maxOil;
        }
      }
    }
    expect(sawHurt).toBe(true);
    expect(sawLowOil).toBe(true);
  });

  /** A Game with the Party searching a chest, each Hero at the health and Oil given. */
  function atChest(scenario: Scenario, health: number, oil: number): Game {
    for (let seed = 1; seed < 200; seed++) {
      const played = game(seed, { heroLevel: 40, ...scenario });
      const entered = stepUntil(played, 'roomEntered');
      if (entered.type !== 'roomEntered' || entered.kind !== 'chest') continue;
      const saved = JSON.parse(serializeGame(played)) as { game: { heroes: { health: number; oil: number }[] } };
      for (const candidate of saved.game.heroes) Object.assign(candidate, { health, oil });
      return deserializeGame(JSON.stringify(saved))!;
    }
    throw new Error('no first-Room chest');
  }

  const recoveredShare = (scenario: Scenario): number => {
    const played = atChest(scenario, 10, 100);
    stepUntil(played, 'chestOpened');
    const { health, stats } = hero(viewGame(played), 'sin-eater');
    return (health - 10) / stats.maxHealth;
  };

  it('leaving a Room recovers 15% of max health', () => {
    expect(recoveredShare({})).toBeCloseTo(0.15);
  });

  it('Warm Hands raises recovery between Rooms', () => {
    const withRank = (rank: number): Scenario => ({ skillRanks: { lamplighter: { 'warm-hands': rank } } });
    expect(recoveredShare(withRank(1))).toBeCloseTo(0.18);
    expect(recoveredShare(withRank(5))).toBeCloseTo(0.24);
  });

  it('leaving a chest adds 30 Oil, up to the maximum', () => {
    const low = atChest({}, 10, 40);
    stepUntil(low, 'chestOpened');
    expect(hero(viewGame(low), 'huntsman').oil).toBe(70);

    const high = atChest({}, 10, 90);
    stepUntil(high, 'chestOpened');
    expect(hero(viewGame(high), 'huntsman').oil).toBe(100);
  });

  it('a Hero who falls in a won Battle rises at 20% health', () => {
    const played = game(1, { heroLevel: 40 });
    stepUntil(played, 'battleStarted');
    // The Huntsman dies to Poison next Tick, and the enemies never act and die to one blow.
    const saved = JSON.parse(serializeGame(played)) as {
      game: { battle: { tick: number; units: { team: string; spec: { id: string }; health: number; poison: object[]; ticksToAction: number }[] } };
    };
    const { battle } = saved.game;
    for (const unit of battle.units) {
      if (unit.team === 'b') Object.assign(unit, { health: 0.01, ticksToAction: 100_000 });
      if (unit.spec.id === 'huntsman') Object.assign(unit, { health: 1, poison: [{ damage: 50, nextTickAt: battle.tick + 1, expiresAt: battle.tick + 100 }] });
    }
    const fallen = deserializeGame(JSON.stringify(saved))!;
    const xpBefore = hero(viewGame(fallen), 'sin-eater').xp;
    const seen: GameEvent[] = [];
    const ended = stepUntil(fallen, 'battleEnded', seen);
    expect(ended).toMatchObject({ outcome: 'won' });

    const risen = hero(viewGame(fallen), 'huntsman');
    expect(seen.find((event) => event.type === 'heroRose')).toMatchObject({ heroId: 'huntsman' });
    const rose = seen.find((event) => event.type === 'heroRose');
    if (rose?.type !== 'heroRose') throw new Error('no heroRose');
    expect(rose.health).toBeCloseTo(risen.stats.maxHealth * 0.2);
    // And the normal recovery for leaving the Room on top.
    expect(risen.health).toBeCloseTo(risen.stats.maxHealth * 0.35);
    // Same XP as a Hero who stood.
    expect(risen.xp - xpBefore).toBe(hero(viewGame(fallen), 'sin-eater').xp - xpBefore);
    expect(risen.xp - xpBefore).toBe(1); // XP falloff's 10% of 15, rounded down in the view.
  });

  describe('XP falloff', () => {
    /** The whole XP one Hero holds after winning one Battle, from a level's start. */
    function xpFromWin(heroLevel: number, startAt: Scenario['startAt'] = { floor: 1, room: 0 }): number {
      for (let seed = 1; seed < 500; seed++) {
        const played = game(seed, { heroLevel, startAt });
        const entered = stepUntil(played, (event) => event.type === 'battleStarted' || event.type === 'chestOpened');
        if (entered.type !== 'battleStarted') continue;
        const saved = JSON.parse(serializeGame(played)) as { game: { battle: { units: { team: string; health: number; ticksToAction: number }[] } } };
        for (const unit of saved.game.battle.units) if (unit.team === 'b') Object.assign(unit, { health: 0.01, ticksToAction: 100_000 });
        const fighting = deserializeGame(JSON.stringify(saved))!;
        stepUntil(fighting, 'battleEnded');
        return hero(viewGame(fighting), 'sin-eater').xp;
      }
      throw new Error('no Battle');
    }

    it.each([
      [1, 15],
      [5, 15],
      [6, 11],
      [7, 7],
      [8, 3],
      [9, 1],
      [30, 1],
    ])('on Floor 1, a level %i Hero earns %i of its 15 XP', (level, xp) => {
      expect(xpFromWin(level)).toBe(xp);
    });

    it('a deeper Floor keeps its full XP for longer', () => {
      expect(xpFromWin(7, { floor: 3, room: 0 })).toBe(25);
      expect(xpFromWin(8, { floor: 3, room: 0 })).toBe(18);
    });

    it("a Guardian's XP falls off like its Floor's", () => {
      expect(xpFromWin(9, atGuardian.startAt)).toBe(100);
      expect(xpFromWin(10, atGuardian.startAt)).toBe(75);
    });
  });

  it('a level-up raises max health but heals nothing', () => {
    const played = game(1);
    stepUntil(played, 'battleStarted');
    // The Party is 1 XP short of level 2, hurt, and facing enemies that never act.
    const saved = JSON.parse(serializeGame(played)) as {
      game: {
        heroes: { xp: number }[];
        battle: { units: { team: string; health: number; ticksToAction: number }[] };
      };
    };
    for (const candidate of saved.game.heroes) candidate.xp = 59;
    for (const unit of saved.game.battle.units) {
      if (unit.team === 'a') unit.health = 50;
      else Object.assign(unit, { health: 0.01, ticksToAction: 100_000 });
    }
    const levelling = deserializeGame(JSON.stringify(saved))!;
    stepUntil(levelling, 'levelUp');
    // 50, plus the usual 15% of the new max for leaving the Room. Nothing for the level.
    expect(hero(viewGame(levelling), 'sin-eater')).toMatchObject({ level: 2, stats: { maxHealth: 176 } });
    expect(hero(viewGame(levelling), 'sin-eater').health).toBeCloseTo(76.4);
  });
});

describe('Enemy scale', () => {
  const firstBattleAt = (floor: 1 | 2 | 3, seed: number) => {
    const played = game(seed, { heroLevel: 1, startAt: { floor, room: 0 } });
    stepUntil(played, 'battleStarted');
    return played;
  };

  it('deeper Floors scale enemy health, power, and XP', () => {
    const healthOf: Record<number, number> = {};
    const powerOf: Record<number, number> = {};
    const stackOf: Record<number, number> = {};
    const xpOf: Record<number, number> = {};
    for (const floor of [1, 2, 3] as const) {
      for (let seed = 1; seed < 200 && (!healthOf[floor] || !stackOf[floor]); seed++) {
        const played = firstBattleAt(floor, seed);
        const thrall = viewGame(played).battle!.enemies.find((enemy) => enemy.name === 'Sodden Thrall');
        if (thrall) {
          healthOf[floor] = thrall.maxHealth;
          // Hits round, which hides a small power, so this reads it from the save.
          powerOf[floor] = JSON.parse(serializeGame(played)).game.battle.units.find((unit: { spec: { name: string } }) => unit.spec.name === 'Sodden Thrall').spec.power;
        }
        const seen: GameEvent[] = [];
        const xpBefore = hero(viewGame(played), 'huntsman').xp;
        stepUntil(played, 'battleEnded', seen);
        xpOf[floor] = hero(viewGame(played), 'huntsman').xp - xpBefore;
        for (const event of seen) {
          if (event.type === 'effectDamage' && event.effect === 'poison') stackOf[floor] = event.damage;
        }
      }
    }
    expect(healthOf[2]).toBeGreaterThan(healthOf[1]!);
    expect(healthOf[3]).toBeGreaterThan(healthOf[2]!);
    // One scale multiplies all three.
    for (const floor of [2, 3]) {
      const scale = healthOf[floor]! / healthOf[1]!;
      expect(powerOf[floor]! / powerOf[1]!).toBeCloseTo(scale);
      expect(stackOf[floor]! / stackOf[1]!).toBeCloseTo(scale);
    }
    expect([xpOf[1], xpOf[2], xpOf[3]]).toEqual([15, 20, 25]);
  });
});

describe('Setbacks', () => {
  it('a Wipe returns the Party to Town and keeps XP and levels', () => {
    const { game: played, before } = afterWipe(2);
    const view = viewGame(played);
    expect(before.heroes[0]!.level > 1 || before.heroes[0]!.xp > 0).toBe(true);
    expect(view).toMatchObject({ phase: 'town', battle: null, map: null, floor: null, townTicksLeft: 100 });
    for (const previous of before.heroes) {
      expect(hero(view, previous.id)).toMatchObject({ level: previous.level, xp: previous.xp, pointsSpent: previous.pointsSpent });
    }
    expect(view.wall.setbacksTowardsFallback).toBe(1);
  });

  it('Town restores health and Oil, then the Party leaves on its own', () => {
    const { game: played } = afterWipe(2);
    for (const candidate of viewGame(played).heroes) {
      expect(candidate.health).toBe(candidate.stats.maxHealth);
      expect(candidate.oil).toBe(candidate.stats.maxOil);
    }
    const seen: GameEvent[] = [];
    stepTicks(played, 99, seen);
    expect(viewGame(played)).toMatchObject({ phase: 'town', townTicksLeft: 1 });
    expect(seen).toEqual([]);
    stepTicks(played, 1, seen);
    expect(seen.map((event) => event.type)).toEqual(['partySent']);
    expect(viewGame(played)).toMatchObject({ phase: 'travelling', floor: 1, townTicksLeft: null });
  });

  it('sendParty leaves Town at once, and is refused elsewhere', () => {
    const { game: played } = afterWipe(2);
    const seen: GameEvent[] = [];
    expect(applyAction(played, { type: 'sendParty' }, (event) => seen.push(event))).toEqual({ ok: true });
    expect(seen.map((event) => event.type)).toEqual(['partySent']);
    expect(viewGame(played)).toMatchObject({ phase: 'travelling', floor: 1, townTicksLeft: null });

    const before = serializeGame(played);
    expect(applyAction(played, { type: 'sendParty' })).toEqual({ ok: false, reason: 'notInTown' });
    expect(serializeGame(played)).toBe(before);
  });

  it('a draw returns the Party to Town and counts towards the 3 Wipes', () => {
    const played = game(1, { battleTicks: 1 });
    const seen: GameEvent[] = [];
    stepUntil(played, 'returnedToTown', seen);
    const types = seen.map((event) => event.type);
    expect(types).toContain('draw');
    expect(types).not.toContain('wipe');
    expect(seen.find((event) => event.type === 'battleEnded')).toMatchObject({ outcome: 'draw' });
    expect(seen.find((event) => event.type === 'draw')).toMatchObject({ floor: 1, enemyName: expect.stringMatching(/\w/) });
    expect(viewGame(played)).toMatchObject({ phase: 'town', wall: { setbacksTowardsFallback: 1, fallenBack: false } });
    expect(hero(viewGame(played), 'huntsman').xp).toBe(0);
  });

  it('a Battle in which every Hero falls is a Wipe even if every enemy falls too', () => {
    const played = game(1, atGuardian);
    stepUntil(played, 'battleStarted');
    // Everyone is one Poison or Bleed tick from death, on the same Tick.
    const saved = JSON.parse(serializeGame(played)) as {
      game: { battle: { tick: number; units: { team: string; health: number; poison: object[]; bleed: object | null }[] } };
    };
    const { battle } = saved.game;
    for (const unit of battle.units) {
      unit.health = 1;
      const nextTickAt = battle.tick + 1;
      if (unit.team === 'a') unit.poison = [{ damage: 50, nextTickAt, expiresAt: nextTickAt + 100 }];
      else unit.bleed = { perTick: 50, ticksLeft: 1, nextTickAt };
    }
    const dying = deserializeGame(JSON.stringify(saved))!;
    const seen: GameEvent[] = [];
    stepTicks(dying, 1, seen);
    expect(seen.filter((event) => event.type === 'death')).toHaveLength(4);
    expect(seen.find((event) => event.type === 'battleEnded')).toMatchObject({ outcome: 'lost' });
    expect(seen.map((event) => event.type)).toContain('wipe');
    expect(seen.map((event) => event.type)).not.toContain('draw');
  });
});

describe('falling back', () => {
  it('the 3rd Wipe makes Runs turn back before the Guardian', () => {
    const wiping = game(1, { heroLevel: 1, setbacks: 2, ...atGuardian });
    const seen: GameEvent[] = [];
    stepUntil(wiping, 'returnedToTown', seen);
    expect(seen.map((event) => event.type)).toContain('fellBack');
    expect(viewGame(wiping).wall).toMatchObject({ setbacksTowardsFallback: 3, fallenBack: true });

    const farming = game(4, { heroLevel: 40, setbacks: 3 });
    const run: GameEvent[] = [];
    const back = stepUntil(farming, 'returnedToTown', run);
    expect(back).toMatchObject({ reason: 'turnedBack' });
    const floors = new Set(run.flatMap((event) => (event.type === 'floorEntered' ? [event.floor] : [])));
    expect(floors).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(run.some((event) => event.type === 'roomEntered' && event.kind === 'guardian')).toBe(false);
    expect(viewGame(farming)).toMatchObject({ phase: 'town', wall: { fallenBack: true, setbacksTowardsFallback: 3 } });
  });

  it('a Setback during fallback keeps it on, with the count at 3', () => {
    const played = game(1, { setbacks: 3, battleTicks: 1 });
    const seen: GameEvent[] = [];
    stepUntil(played, 'returnedToTown', seen);
    expect(seen.map((event) => event.type)).not.toContain('fellBack');
    expect(viewGame(played).wall).toMatchObject({ setbacksTowardsFallback: 3, fallenBack: true });
  });

  it('a level-up during fallback resumes Guardian attempts and clears the count', () => {
    const played = game(1, { setbacks: 3 });
    const seen: GameEvent[] = [];
    stepUntil(played, 'retryingGuardian', seen);
    expect(seen.map((event) => event.type)).toContain('levelUp');
    expect(viewGame(played).wall).toMatchObject({ setbacksTowardsFallback: 0, fallenBack: false });
  });

  it('spending a skill point during fallback resumes Guardian attempts and clears the count', () => {
    const played = game(1, { heroLevel: 2, setbacks: 3 });
    const seen: GameEvent[] = [];
    applyAction(played, { type: 'spendSkillPoint', heroId: 'huntsman', skillId: 'bleeders-cut' }, (event) => seen.push(event));
    expect(seen.map((event) => event.type)).toEqual(['retryingGuardian']);
    expect(viewGame(played).wall).toMatchObject({ setbacksTowardsFallback: 0, fallenBack: false });
  });

  it("other actions don't end a fallback, and a refused spend doesn't either", () => {
    const played = game(1, { heroLevel: 2, setbacks: 3 });
    applyAction(played, { type: 'respec', heroId: 'huntsman' });
    applyAction(played, { type: 'renameHero', heroId: 'huntsman', name: 'Old Marrow' });
    applyAction(played, { type: 'spendSkillPoint', heroId: 'huntsman', skillId: 'the-long-cut' });
    expect(viewGame(played).wall).toMatchObject({ setbacksTowardsFallback: 3, fallenBack: true });
  });

  it("spending a skill point before the 3rd Setback doesn't clear the count", () => {
    const played = game(1, { heroLevel: 2, setbacks: 2 });
    const seen: GameEvent[] = [];
    applyAction(played, { type: 'spendSkillPoint', heroId: 'huntsman', skillId: 'bleeders-cut' }, (event) => seen.push(event));
    expect(seen).toEqual([]);
    expect(viewGame(played).wall.setbacksTowardsFallback).toBe(2);
  });

  it("level-ups before the 3rd Wipe don't clear the count", () => {
    const played = game(1, { setbacks: 2 });
    stepUntil(played, 'levelUp');
    expect(viewGame(played).wall).toMatchObject({ setbacksTowardsFallback: 2, fallenBack: false });
  });

  it('a Guardian kill clears the count', () => {
    const played = game(1, { heroLevel: 40, setbacks: 2, ...atGuardian });
    stepUntil(played, 'guardianFell');
    expect(viewGame(played).wall.setbacksTowardsFallback).toBe(0);
  });
});

describe('the Guardian', () => {
  it('fields the Mouldering Warden alone, in the front Row', () => {
    const played = game(1, atGuardian);
    stepUntil(played, 'battleStarted');
    expect(viewGame(played).battle!.enemies).toMatchObject([{ name: 'The Mouldering Warden', row: 'front' }]);
    const [warden] = viewGame(played).battle!.enemies;
    expect(warden!.health).toBe(warden!.maxHealth);
  });

  it('a level 40 Party kills the Guardian and relights the Lamp', () => {
    const played = game(1, { heroLevel: 40, ...atGuardian });
    expect(viewGame(played).wall.lampLit).toBe(false);
    const xpBefore = hero(viewGame(played), 'huntsman').xp;
    const seen: GameEvent[] = [];
    stepUntil(played, 'returnedToTown', seen);
    const types = seen.map((event) => event.type);
    expect(types.indexOf('guardianFell')).toBeLessThan(types.indexOf('lampRelit'));
    expect(seen.at(-1)).toMatchObject({ type: 'returnedToTown', reason: 'lampRelit' });
    expect(hero(viewGame(played), 'huntsman').xp - xpBefore).toBe(10); // XP falloff's 10%.
    expect(viewGame(played)).toMatchObject({ phase: 'town', wall: { lampLit: true } });
  });

  it('a level 1 Party Wipes at the Guardian, mostly from poison damage', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const played = game(seed, { heroLevel: 1, ...atGuardian });
      const seen: GameEvent[] = [];
      stepUntil(played, 'returnedToTown', seen);
      expect(seen.map((event) => event.type)).toContain('wipe');
      const damageOf = (type: string) =>
        seen.reduce(
          (total, event) =>
            (event.type === 'attack' || event.type === 'effectDamage') && event.damageType === type && event.targetId !== 'guardian'
              ? total + event.damage
              : total,
          0,
        );
      expect(damageOf('poison')).toBeGreaterThan(damageOf('physical'));
    }
  });

  it('the Guardian respawns on Runs after the Lamp is lit', () => {
    const played = game(1, { heroLevel: 40, ...atGuardian });
    stepUntil(played, 'lampRelit');
    stepUntil(played, 'partySent');
    expect(viewGame(played).floor).toBe(1);
    const nextRun: GameEvent[] = [];
    stepUntil(played, 'returnedToTown', nextRun);
    expect(nextRun.some((event) => event.type === 'roomEntered' && event.kind === 'guardian')).toBe(true);
    expect(nextRun.map((event) => event.type)).toContain('guardianFell');
    expect(nextRun.map((event) => event.type)).not.toContain('lampRelit');
    expect(viewGame(played)).toMatchObject({ phase: 'town', wall: { lampLit: true } });
  });

  it('a scenario can start with the Lamp lit', () => {
    expect(viewGame(game(1, { lampLit: true })).wall.lampLit).toBe(true);
  });
});

describe('saves', () => {
  it('serializeGame round-trips a Game mid-Run, and the copy plays on identically', () => {
    const played = game(11);
    const phases = new Set<string>();
    for (let step = 0; step < 40; step++) {
      advance(played, 7_300);
      phases.add(viewGame(played).phase);
      const copy = deserializeGame(serializeGame(played));
      expect(copy).not.toBeNull();
      expect(serializeGame(copy!)).toBe(serializeGame(played));
    }
    expect(phases.has('battle')).toBe(true);
    const copy = deserializeGame(serializeGame(played))!;
    advance(played, 900_000);
    advance(copy, 900_000);
    expect(serializeGame(copy)).toBe(serializeGame(played));
  });

  it('a Guardian Battle round-trips with its actions', () => {
    const played = game(1, atGuardian);
    stepUntil(played, 'battleStarted');
    stepTicks(played, 70);
    const copy = deserializeGame(serializeGame(played))!;
    expect(copy).not.toBeNull();
    advance(played, 100_000);
    advance(copy, 100_000);
    expect(serializeGame(copy)).toBe(serializeGame(played));
  });

  it('deserializeGame refuses a bad Run', () => {
    const good = JSON.parse(serializeGame(game(1))) as { game: Record<string, unknown> };
    const withGame = (changes: object) => JSON.stringify({ ...good, game: { ...good.game, ...changes } });
    const run = good.game['run'] as object;
    const bad = [
      withGame({ run: null }),
      withGame({ run: { ...run, phase: 'elsewhere' } }),
      withGame({ run: { ...run, floor: 9 } }),
      withGame({ run: { ...run, room: 99 } }),
      withGame({ run: { ...run, layout: { rooms: [{ x: 'a', y: 0, kind: 'battle' }] } } }),
      withGame({ run: { ...run, phase: 'battle' } }),
      withGame({ wall: null }),
      withGame({ wall: { lampLit: 'yes', setbacks: 0, fallenBack: false } }),
      withGame({ wall: { lampLit: false, setbacks: 9, fallenBack: false } }),
      withGame({ wall: { lampLit: false, setbacks: 0, fallenBack: true } }),
      withGame({ wall: { lampLit: false, setbacks: 3, fallenBack: false } }),
      withGame({ battleTicks: 'soon' }),
    ];
    for (const text of bad) expect(deserializeGame(text)).toBeNull();
    expect(deserializeGame(JSON.stringify(good))).not.toBeNull();

    const heroes = good.game['heroes'] as object[];
    const withFirstHero = (changes: object) => withGame({ heroes: [{ ...heroes[0], ...changes }, ...heroes.slice(1)] });
    expect(deserializeGame(withFirstHero({ health: 0 }))).toBeNull();

    const fighting = game(1, atGuardian);
    stepUntil(fighting, 'battleStarted');
    const inBattle = JSON.parse(serializeGame(fighting)) as { game: { battle: { units: { spec: { id: string }; ticksToEachAction: number[] }[] } } };
    inBattle.game.battle.units.find((unit) => unit.spec.id === 'guardian')!.ticksToEachAction = [1];
    expect(deserializeGame(JSON.stringify(inBattle))).toBeNull();
  });
});
