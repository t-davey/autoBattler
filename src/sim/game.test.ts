import { describe, expect, it } from 'vitest';
import {
  advance,
  createGame,
  deserializeGame,
  SAVE_VERSION,
  serializeGame,
  TICK_MS,
  viewGame,
  type Game,
  type GameEvent,
} from './index';

/** Steps one Tick at a time until a Tick reports the wanted event. */
const stepUntil = (game: Game, wanted: GameEvent['type']): void => {
  let found = false;
  for (let i = 0; i < 100_000 && !found; i++) {
    advance(game, TICK_MS, (event) => {
      if (event.type === wanted) found = true;
    });
  }
  if (!found) throw new Error(`no ${wanted} event`);
};

/** A Game one Tick in, with its first Battle started. */
const started = (seed: number): Game => {
  const game = createGame({ seed });
  advance(game, TICK_MS);
  return game;
};

describe('createGame', () => {
  it('starts a Battle on the first Tick, and reports it', () => {
    const game = createGame({ seed: 1 });
    expect(viewGame(game)).toMatchObject({ tick: 0, phase: 'travelling', battle: null });
    const events: GameEvent[] = [];
    advance(game, TICK_MS, (event) => events.push(event));
    expect(events.map((event) => event.type)).toEqual(['battleStarted']);
  });

  it('puts the Party in its fixed Rows', () => {
    const { phase, battle } = viewGame(started(1));
    expect(phase).toBe('battle');
    expect(battle?.party.map(({ name, row }) => [name, row])).toEqual([
      ['Sin-Eater', 'front'],
      ['Huntsman', 'front'],
      ['Lamplighter', 'back'],
    ]);
  });

  it('draws a Pack of 1–2 front and 1–2 back enemies from one Family', () => {
    const restlessDead = ['Sodden Thrall', 'Tallow Wight', 'Bone Chanter'];
    const fungalGrowth = ['Mire Bloat', 'Sporeling'];
    const families = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const enemies = viewGame(started(seed)).battle!.enemies;
      const inRow = (row: string) => enemies.filter((enemy) => enemy.row === row).length;
      expect(inRow('front')).toBeGreaterThanOrEqual(1);
      expect(inRow('front')).toBeLessThanOrEqual(2);
      expect(inRow('back')).toBeGreaterThanOrEqual(1);
      expect(inRow('back')).toBeLessThanOrEqual(2);

      const names = enemies.map((enemy) => enemy.name);
      const family = [restlessDead, fungalGrowth].find((members) => names.every((name) => members.includes(name)));
      expect(family).toBeDefined();
      families.add(family === restlessDead ? 'restless dead' : 'fungal growth');
    }
    expect(families.size).toBe(2);
  });

  it('gives every Unit in a Battle its own id', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { party, enemies } = viewGame(started(seed)).battle!;
      const ids = [...party, ...enemies].map((unit) => unit.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('advance', () => {
  it('a new Battle follows 50 Ticks after the last ends, with the Party restored', () => {
    const game = createGame({ seed: 1 });
    stepUntil(game, 'battleEnded');
    const endedAt = viewGame(game).tick;
    expect(viewGame(game)).toMatchObject({ phase: 'travelling', battle: null });

    stepUntil(game, 'battleStarted');
    const view = viewGame(game);
    expect(view.tick).toBe(endedAt + 50);
    expect(view.phase).toBe('battle');
    for (const hero of view.battle!.party) expect(hero.health).toBe(hero.maxHealth);
  });

  it('advance runs the same Ticks however elapsed time is sliced', () => {
    const elapsedMs = 600_000;
    const whole = createGame({ seed: 7 });
    advance(whole, elapsedMs);

    for (const slice of [7, 100, 333, 4_999]) {
      const sliced = createGame({ seed: 7 });
      let left = elapsedMs;
      while (left > 0) {
        const step = Math.min(slice, left);
        advance(sliced, step);
        left -= step;
      }
      expect(serializeGame(sliced)).toBe(serializeGame(whole));
    }
    expect(viewGame(whole).tick).toBe(elapsedMs / TICK_MS);
  });

  it('runs no Tick until a whole Tick has been banked', () => {
    const game = createGame({ seed: 1 });
    advance(game, TICK_MS - 1);
    expect(viewGame(game).tick).toBe(0);
    advance(game, 1);
    expect(viewGame(game).tick).toBe(1);
  });

  it('advance ignores negative and NaN elapsed time', () => {
    const game = createGame({ seed: 1 });
    advance(game, 250);
    const before = serializeGame(game);
    advance(game, -1_000);
    advance(game, Number.NaN);
    advance(game, Number.POSITIVE_INFINITY);
    expect(serializeGame(game)).toBe(before);
  });

  it('reports Battle events to the sink, including how each Battle ended', () => {
    const game = createGame({ seed: 3 });
    const events: GameEvent[] = [];
    advance(game, 600_000, (event) => events.push(event));
    expect(new Set(events.map((event) => event.type))).toEqual(
      new Set(['attack', 'death', 'battleEnded', 'battleStarted']),
    );
    // Every Battle that ends was first reported as started.
    expect(events.filter((event) => event.type === 'battleStarted').length).toBeGreaterThanOrEqual(
      events.filter((event) => event.type === 'battleEnded').length,
    );
    expect(events.find((event) => event.type === 'battleEnded')).toMatchObject({
      outcome: expect.stringMatching(/^(won|lost|draw)$/),
    });
  });

  it('plays the same for the same Seed and differently across Seeds', () => {
    const run = (seed: number) => {
      const game = createGame({ seed });
      advance(game, 300_000);
      return serializeGame(game);
    };
    expect(run(5)).toBe(run(5));
    expect(run(5)).not.toBe(run(6));
  });
});

describe('saves', () => {
  it('serializeGame round-trips a Game mid-Battle, and the copy plays on identically', () => {
    const game = createGame({ seed: 11 });
    advance(game, 5_000);
    expect(viewGame(game).phase).toBe('battle');

    const copy = deserializeGame(serializeGame(game));
    expect(copy).not.toBeNull();
    expect(serializeGame(copy!)).toBe(serializeGame(game));

    advance(game, 500_000);
    advance(copy!, 500_000);
    expect(serializeGame(copy!)).toBe(serializeGame(game));
  });

  it('deserializeGame returns null for bad data and another SAVE_VERSION', () => {
    const good = JSON.parse(serializeGame(started(1))) as {
      version: number;
      game: { battle: { units: { spec: object }[] } };
    };
    const withBattle = (battle: object) => ({ ...good, game: { ...good.game, battle: { ...good.game.battle, ...battle } } });
    const [firstUnit, ...otherUnits] = good.game.battle.units;
    const badData = [
      '',
      '{',
      'null',
      '[]',
      '{}',
      JSON.stringify({ version: SAVE_VERSION }),
      JSON.stringify({ version: SAVE_VERSION, game: {} }),
      JSON.stringify({ ...good, game: { ...good.game, tick: 'soon' } }),
      JSON.stringify({ ...good, game: { ...good.game, rng: null } }),
      JSON.stringify(withBattle({ units: 'none' })),
      JSON.stringify(withBattle({ winner: 'c' })),
      JSON.stringify(withBattle({ units: [{ ...firstUnit, spec: {} }, ...otherUnits] })),
      JSON.stringify(withBattle({ units: [{ ...firstUnit, spec: { ...firstUnit!.spec, resistances: { poison: 'high' } } }, ...otherUnits] })),
    ];
    for (const text of badData) expect(deserializeGame(text)).toBeNull();
    expect(deserializeGame(JSON.stringify({ ...good, version: SAVE_VERSION + 1 }))).toBeNull();
    expect(deserializeGame(JSON.stringify(good))).not.toBeNull();
  });
});
