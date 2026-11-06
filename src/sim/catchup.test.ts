import { describe, expect, it } from 'vitest';
import {
  advance,
  applyAction,
  beginCatchUp,
  CATCH_UP_CAP_MS,
  continueCatchUp,
  createGame,
  deserializeGame,
  serializeGame,
  TICK_MS,
  viewGame,
  viewStash,
  type AwayReport,
  type Game,
  type GameEvent,
  type GameSetup,
  type PlayerAction,
} from './index';

type Scenario = NonNullable<GameSetup['scenario']>;

const HOUR_MS = 3_600_000;
const SLICES = [16, 33, 100, 1_000, 7_000];
const atGuardian = { startAt: { floor: 3, room: 'guardian' } } satisfies Scenario;

const newGame = (seed: number, scenario: Scenario = {}): Game => createGame({ seed, scenario });

/** Plays elapsedMs live, cut into uneven slices. */
function playLive(game: Game, elapsedMs: number): void {
  let left = elapsedMs;
  for (let i = 0; left > 0; i++) {
    const slice = Math.min(SLICES[i % SLICES.length]!, left);
    advance(game, slice);
    left -= slice;
  }
}

function catchUp(game: Game, elapsedMs: number, chunk = 5_000): AwayReport {
  const running = beginCatchUp(game, elapsedMs);
  for (;;) {
    const report = continueCatchUp(game, running, chunk);
    if (report) return report;
  }
}

/** The Away Report for elapsedMs, and what live play reported over the same time. */
function reportAndEvents(seed: number, elapsedMs: number, scenario: Scenario = {}): { report: AwayReport; events: GameEvent[]; live: Game } {
  const events: GameEvent[] = [];
  const live = newGame(seed, scenario);
  advance(live, elapsedMs, (event) => events.push(event));
  return { report: catchUp(newGame(seed, scenario), elapsedMs), events, live };
}

const count = (events: readonly GameEvent[], type: GameEvent['type']): number => events.filter((event) => event.type === type).length;

describe('catch-up', () => {
  it.each([1, 2, 3, 4, 5])('catch-up and live play reach identical state for the same Seed and elapsed time (Seed %i)', (seed) => {
    const caughtUp = newGame(seed);
    catchUp(caughtUp, HOUR_MS);
    const live = newGame(seed);
    playLive(live, HOUR_MS);
    expect(serializeGame(caughtUp)).toBe(serializeGame(live));
  });

  it('catch-up and live play stay identical over 12 hours', { timeout: 60_000 }, () => {
    const caughtUp = newGame(7);
    catchUp(caughtUp, CATCH_UP_CAP_MS);
    const live = newGame(7);
    playLive(live, CATCH_UP_CAP_MS);
    expect(serializeGame(caughtUp)).toBe(serializeGame(live));
  });

  it('catch-up and live play stay identical when the same action lands on the same Tick', () => {
    const action: PlayerAction = { type: 'spendSkillPoint', heroId: 'huntsman', skillId: 'bleeders-cut' };
    const scenario = { heroLevel: 5 };

    const live = newGame(3, scenario);
    playLive(live, 600_000);
    expect(applyAction(live, action)).toEqual({ ok: true });
    playLive(live, 600_000);

    const betweenCatchUps = newGame(3, scenario);
    catchUp(betweenCatchUps, 600_000);
    expect(applyAction(betweenCatchUps, action)).toEqual({ ok: true });
    catchUp(betweenCatchUps, 600_000);

    const betweenChunks = newGame(3, scenario);
    const running = beginCatchUp(betweenChunks, 1_200_000);
    continueCatchUp(betweenChunks, running, 6_000);
    expect(applyAction(betweenChunks, action)).toEqual({ ok: true });
    while (!continueCatchUp(betweenChunks, running, 1_000));

    expect(serializeGame(betweenCatchUps)).toBe(serializeGame(live));
    expect(serializeGame(betweenChunks)).toBe(serializeGame(live));
  });

  it('catch-up gives the same result in any chunk size', () => {
    const whole = newGame(4);
    const wholeReport = catchUp(whole, HOUR_MS, Number.MAX_SAFE_INTEGER);
    for (const chunk of [1, 7, 5_000]) {
      const game = newGame(4);
      expect(catchUp(game, HOUR_MS, chunk)).toEqual(wholeReport);
      expect(serializeGame(game)).toBe(serializeGame(whole));
    }
  });

  it('catch-up keeps the sub-Tick remainder, as live play does', () => {
    const caughtUp = newGame(1);
    advance(caughtUp, 50);
    const running = beginCatchUp(caughtUp, 60_070);
    expect(running.ticksTotal).toBe(601);
    while (!continueCatchUp(caughtUp, running, 100));

    const live = newGame(1);
    advance(live, 60_120);
    expect(serializeGame(caughtUp)).toBe(serializeGame(live));
  });

  it('catch-up runs nothing until continued, and counts down what is left', () => {
    const game = newGame(1);
    const running = beginCatchUp(game, 60_000);
    expect(viewGame(game).tick).toBe(0);
    expect(running.ticksTotal).toBe(600);

    expect(continueCatchUp(game, running, 250)).toBeNull();
    expect(running.ticksLeft).toBe(350);
    expect(viewGame(game).tick).toBe(250);
    expect(continueCatchUp(game, running, 350)).not.toBeNull();
    expect(viewGame(game).tick).toBe(600);
  });

  it('catch-up stops at the 12-hour cap and the Away Report says so', { timeout: 60_000 }, () => {
    const game = newGame(1);
    const report = catchUp(game, CATCH_UP_CAP_MS + HOUR_MS);
    expect(report.capped).toBe(true);
    expect(report.elapsedMs).toBe(CATCH_UP_CAP_MS + HOUR_MS);
    expect(report.appliedMs).toBe(CATCH_UP_CAP_MS);
    expect(viewGame(game).tick).toBe(CATCH_UP_CAP_MS / TICK_MS);

    const exact = catchUp(newGame(1), HOUR_MS);
    expect(exact.capped).toBe(false);
    expect(exact.appliedMs).toBe(HOUR_MS);
  });

  it.each([-1, Number.NaN])('catch-up treats negative and NaN elapsed time as none (%d)', (elapsedMs) => {
    const game = newGame(1);
    const before = serializeGame(game);
    const report = catchUp(game, elapsedMs);
    expect(serializeGame(game)).toBe(before);
    expect(report).toMatchObject({ elapsedMs: 0, appliedMs: 0, capped: false, floorsCleared: 0, setbacks: [] });
  });
});

describe('the Away Report', () => {
  it('the Away Report counts Floors, Wipes, levels, and loot from the same events as live play', () => {
    const { report, events, live } = reportAndEvents(2, 4 * HOUR_MS);

    const floorEntries = events.filter((event) => event.type === 'floorEntered');
    expect(report.floorsCleared).toBe(floorEntries.filter((event) => event.floor > 1).length + count(events, 'guardianFell'));
    expect(report.floorsCleared).toBeGreaterThan(0);
    expect(report.deepestFloor).toBe(Math.max(...floorEntries.map((event) => event.floor)));
    expect(report.setbacks.filter((setback) => setback.kind === 'wipe')).toHaveLength(count(events, 'wipe'));
    expect(report.setbacks.filter((setback) => setback.kind === 'draw')).toHaveLength(count(events, 'draw'));
    expect(report.guardianKills).toBe(count(events, 'guardianFell'));

    const view = viewGame(live);
    expect(report.levels).toEqual(view.heroes.filter((hero) => hero.level > 1).map((hero) => ({ heroId: hero.id, from: 1, to: hero.level })));
    expect(report.unspentSkillPoints).toBe(view.heroes.reduce((total, hero) => total + hero.unspentPoints, 0));

    const stash = viewStash(live);
    const ofRarity = (rarity: string) => stash.filter((item) => item.rarity === rarity);
    expect(report.loot.common).toBe(ofRarity('common').length);
    expect(report.loot.magic).toBe(ofRarity('magic').length);
    expect(report.loot.rare).toBe(ofRarity('rare').length);
    expect(report.loot.notable).toEqual(ofRarity('rare'));
  });

  it('the Away Report starts its deepest Floor from where the Party already is', () => {
    const game = newGame(1, { startAt: { floor: 2, room: 1 } });
    expect(catchUp(game, 1_000).deepestFloor).toBe(2);
  });

  it('the Away Report names poison as the main damage type of a Guardian Wipe', () => {
    const { report, events } = reportAndEvents(1, 300_000, atGuardian);
    const wipeAt = events.findIndex((event) => event.type === 'wipe');
    expect(wipeAt).toBeGreaterThan(-1);

    let poison = 0;
    let total = 0;
    const heroes = new Set<string>(viewGame(newGame(1)).heroes.map((hero) => hero.id));
    for (const event of events.slice(0, wipeAt)) {
      if ((event.type === 'attack' || event.type === 'effectDamage') && heroes.has(event.targetId)) {
        total += event.damage + event.absorbed;
        if (event.damageType === 'poison') poison += event.damage + event.absorbed;
      }
    }

    const [first] = report.setbacks;
    expect(first).toMatchObject({ kind: 'wipe', floor: 3, enemyName: 'The Mouldering Warden', mainDamageType: 'poison' });
    expect(first!.mainDamageShare).toBeCloseTo(poison / total);
    expect(first!.mainDamageShare).toBeGreaterThan(0.5);
  });

  it('the Away Report notes a fall back and a relit Lamp', () => {
    const fallen = catchUp(newGame(1, atGuardian), HOUR_MS);
    expect(fallen.fellBack).toBe(true);
    expect(fallen.lampRelit).toBe(false);
    expect(fallen.guardianKills).toBe(0);

    const strong = catchUp(newGame(1, { ...atGuardian, heroLevel: 40 }), 120_000);
    expect(strong.lampRelit).toBe(true);
    expect(strong.fellBack).toBe(false);
    expect(strong.guardianKills).toBeGreaterThanOrEqual(1);
    expect(strong.loot.rare).toBeGreaterThanOrEqual(1);
    expect(strong.loot.notable.length).toBe(strong.loot.rare);
  });

  it('the Away Report leaves a Lamp alone that was already lit', () => {
    const report = catchUp(newGame(1, { ...atGuardian, heroLevel: 40, lampLit: true }), 120_000);
    expect(report.guardianKills).toBeGreaterThanOrEqual(1);
    expect(report.lampRelit).toBe(false);
  });

  it('the Away Report lists a draw as a draw, with its main damage type', () => {
    const report = catchUp(newGame(1, { ...atGuardian, heroLevel: 40, battleTicks: 100 }), 30_000);
    const [first] = report.setbacks;
    expect(first).toMatchObject({ kind: 'draw', floor: 3, enemyName: 'The Mouldering Warden', mainDamageType: 'poison' });
    expect(first!.mainDamageShare).toBeGreaterThan(0.5);
  });

  it('the Away Report gives a Setback with no damage taken as physical with a share of 0', () => {
    const report = catchUp(newGame(1, { ...atGuardian, heroLevel: 40, battleTicks: 1 }), 30_000);
    expect(report.setbacks[0]).toMatchObject({ kind: 'draw', mainDamageType: 'physical', mainDamageShare: 0 });
  });
});

describe('saves', () => {
  const restored = (game: Game): Game => {
    const copy = deserializeGame(serializeGame(game));
    if (!copy) throw new Error('the save did not restore');
    return copy;
  };

  const stepUntil = (game: Game, type: GameEvent['type']): void => {
    for (let i = 0; i < 400_000; i++) {
      let found = false;
      advance(game, TICK_MS, (event) => {
        if (event.type === type) found = true;
      });
      if (found) return;
    }
    throw new Error(`${type} never came`);
  };

  it.each([
    ['after a Wipe', 'town', (game: Game) => stepUntil(game, 'wipe')],
    ['in Town', 'town', (game: Game) => {
      stepUntil(game, 'wipe');
      advance(game, 3_000);
    }],
    ['mid-Battle', 'battle', (game: Game) => {
      stepUntil(game, 'battleStarted');
      advance(game, 4_000);
    }],
  ])('a Game restored from serializeGame plays on identically %s', (_name, phase, reach) => {
    const game = newGame(6, atGuardian);
    reach(game);
    expect(viewGame(game).phase).toBe(phase);
    const copy = restored(game);
    advance(game, 1_800_000);
    catchUp(copy, 1_800_000);
    expect(serializeGame(copy)).toBe(serializeGame(game));
  });

  it('a Game restores at any moment of a long run', () => {
    const game = newGame(8);
    for (let i = 0; i < 400; i++) {
      advance(game, 9_700);
      expect(deserializeGame(serializeGame(game))).not.toBeNull();
    }
  });
});
