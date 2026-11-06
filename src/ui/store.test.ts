import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, createGame, serializeGame, type GameEvent } from '../sim';
import { describeEvent } from './describeEvent';
import { createStore } from './store';

describe('store', () => {
  it('tells the Battle scene what each step played, and that catch-up jumped', () => {
    vi.useFakeTimers();
    try {
      const store = createStore(createGame({ seed: 2 }));
      const batches: { events: number; ticks: number | null }[] = [];
      store.onPlayed(({ events, ticks }) => batches.push({ events: events.length, ticks }));

      store.advance(50);
      expect(batches).toEqual([]);
      store.advance(50);
      expect(batches.at(-1)).toMatchObject({ ticks: 1 });

      store.catchUp(120_000);
      vi.runAllTimers();
      expect(batches.at(-1)).toEqual({ events: 0, ticks: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it('the Live Log keeps the newest 1,000 lines', () => {
    const elapsedMs = 3_600_000;
    const events: GameEvent[] = [];
    advance(createGame({ seed: 2 }), elapsedMs, (event) => events.push(event));
    expect(events.length).toBeGreaterThan(1_000);

    const store = createStore(createGame({ seed: 2 }));
    for (let i = 0; i < 60; i++) store.advance(elapsedMs / 60);

    expect(store.getSnapshot().log.map((line) => line.text)).toEqual(events.slice(-1_000).map(describeEvent));
  });

  it('sending the Party back from Town sends it out', () => {
    const store = createStore(createGame({ seed: 1 }));
    for (let i = 0; i < 100_000 && store.getSnapshot().view.phase !== 'town'; i++) store.advance(100);
    expect(store.getSnapshot().view.phase).toBe('town');

    store.sendPartyBack();
    expect(store.getSnapshot().view.phase).not.toBe('town');
  });

  it('gives Live Log lines ids that never repeat', () => {
    const store = createStore(createGame({ seed: 2 }));
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) {
      store.advance(10_000);
      for (const line of store.getSnapshot().log) seen.add(line.id);
    }
    const { log } = store.getSnapshot();
    expect(log.at(-1)!.id - log[0]!.id).toBe(log.length - 1);
    expect(seen.size).toBeGreaterThan(log.length);
  });

  it('getSnapshot returns the same object until something changes', () => {
    const store = createStore(createGame({ seed: 1 }));
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);

    store.advance(50);
    expect(store.getSnapshot()).toBe(first);

    store.advance(50);
    const second = store.getSnapshot();
    expect(second).not.toBe(first);
    expect(second.view.tick).toBe(1);
    expect(first.view.tick).toBe(0);
  });

  it('notifies subscribers once a pass, and not after they unsubscribe', () => {
    const store = createStore(createGame({ seed: 1 }));
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);

    store.advance(60_000);
    expect(calls).toBe(1);
    store.advance(1);
    expect(calls).toBe(1);

    unsubscribe();
    store.advance(60_000);
    expect(calls).toBe(1);
  });

  it('dispatch publishes an accepted action and keeps the Live Log', () => {
    const store = createStore(createGame({ seed: 1 }));
    store.advance(60_000);
    const { log } = store.getSnapshot();
    let calls = 0;
    store.subscribe(() => calls++);

    expect(store.dispatch({ type: 'renameHero', heroId: 'huntsman', name: 'Old Marrow' })).toEqual({ ok: true });
    expect(calls).toBe(1);
    expect(store.getSnapshot().log).toBe(log);
    expect(store.getSnapshot().view.heroes.find((hero) => hero.id === 'huntsman')?.name).toBe('Old Marrow');
  });

  it('dispatch adds the lines of what an action caused to the Live Log', () => {
    const store = createStore(createGame({ seed: 1, scenario: { heroLevel: 2, setbacks: 3 } }));
    store.dispatch({ type: 'spendSkillPoint', heroId: 'huntsman', skillId: 'bleeders-cut' });
    expect(store.getSnapshot().log.map((line) => line.text)).toEqual([describeEvent({ type: 'retryingGuardian' })]);
  });

  it('publishes a new Stash only when the Stash changes', () => {
    const store = createStore(createGame({ seed: 9, scenario: { heroLevel: 40 } }));
    const empty = store.getSnapshot().stash;
    store.advance(1_000);
    expect(store.getSnapshot().stash).toBe(empty);

    while (store.getSnapshot().stash.length === 0) store.advance(1_000);
    const line = store.getSnapshot().log.findLast((candidate) => candidate.rarity !== null);
    const [found] = store.getSnapshot().stash;
    expect(line?.rarity).toBe(found?.rarity);
    expect(line?.text).toContain(found?.name);

    expect(store.dispatch({ type: 'equipItem', heroId: 'huntsman', itemId: found!.id })).toEqual({ ok: true });
    expect(store.getSnapshot().stash.some((item) => item.id === found!.id)).toBe(false);
  });

  it('counts items as new until the Party is sent back from a check-in', () => {
    const store = createStore(createGame({ seed: 9, scenario: { heroLevel: 40 } }));
    expect(store.getSnapshot().stash.some((item) => item.id > store.getSnapshot().seenItemId)).toBe(false);

    while (store.getSnapshot().stash.length === 0) store.advance(1_000);
    expect(store.getSnapshot().stash.every((item) => item.id > store.getSnapshot().seenItemId)).toBe(true);

    store.sendPartyBack();
    expect(store.getSnapshot().stash.some((item) => item.id > store.getSnapshot().seenItemId)).toBe(false);
  });

  it('dispatch returns a refusal and publishes nothing', () => {
    const store = createStore(createGame({ seed: 1 }));
    const before = store.getSnapshot();
    let calls = 0;
    store.subscribe(() => calls++);

    expect(store.dispatch({ type: 'renameHero', heroId: 'huntsman', name: ' ' })).toEqual({ ok: false, reason: 'emptyName' });
    expect(calls).toBe(0);
    expect(store.getSnapshot()).toBe(before);
  });

  describe('catch-up', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const HOUR_MS = 3_600_000;

    it('catch-up adds one Live Log line, pointing at the Away Report', () => {
      const store = createStore(createGame({ seed: 2 }));
      store.advance(30_000);
      const before = store.getSnapshot().log;

      store.catchUp(HOUR_MS);
      vi.advanceTimersByTime(0);

      const { log, awayReport } = store.getSnapshot();
      expect(log.length).toBe(before.length + 1);
      expect(log.at(-1)!.text).toContain('Away Report');
      expect(log.at(-1)!.id).toBeGreaterThan(before.at(-1)!.id);
      expect(awayReport?.appliedMs).toBe(HOUR_MS);
    });

    it('catch-up reaches the same state as stepping, and publishes it', () => {
      const caughtUp = createGame({ seed: 2 });
      const liveGame = createGame({ seed: 2 });
      const store = createStore(caughtUp);
      const live = createStore(liveGame);
      store.catchUp(HOUR_MS);
      vi.advanceTimersByTime(0);
      live.advance(HOUR_MS);

      expect(serializeGame(caughtUp)).toBe(serializeGame(liveGame));
      expect(store.getSnapshot().view.tick).toBe(live.getSnapshot().view.tick);
      expect(store.getSnapshot().stash.length).toBe(live.getSnapshot().stash.length);
      expect(store.getSnapshot().stash.length).toBeGreaterThan(0);
    });

    it('catch-up yields between chunks and reports its progress', () => {
      let time = 0;
      const store = createStore(createGame({ seed: 2 }), { workClock: () => (time += 100) });
      const progress: (number | null)[] = [];
      store.subscribe(() => progress.push(store.getSnapshot().catchUpProgress));

      store.catchUp(HOUR_MS);
      expect(store.getSnapshot().view.tick).toBe(0);
      expect(progress).toEqual([0]);

      while (store.isCatchingUp()) vi.advanceTimersByTime(1);

      expect(progress.at(-1)).toBeNull();
      const during = progress.slice(0, -1) as number[];
      expect(during.length).toBe(8);
      expect(during).toEqual([...during].sort((a, b) => a - b));
      expect(during.at(-1)!).toBeLessThan(1);
    });

    it('stepping, player actions, and a second catch-up wait until catch-up finishes', () => {
      const store = createStore(createGame({ seed: 2 }));
      store.catchUp(60_000);

      store.advance(10_000);
      store.catchUp(HOUR_MS);
      expect(store.dispatch({ type: 'renameHero', heroId: 'huntsman', name: 'Old Marrow' })).toEqual({ ok: false, reason: 'catchingUp' });
      expect(store.getSnapshot().view.tick).toBe(0);

      vi.advanceTimersByTime(0);
      expect(store.getSnapshot().view.tick).toBe(600);
      expect(store.dispatch({ type: 'renameHero', heroId: 'huntsman', name: 'Old Marrow' })).toEqual({ ok: true });
    });

    it('a second absence adds to an undismissed Away Report', () => {
      const store = createStore(createGame({ seed: 2 }));
      store.catchUp(HOUR_MS);
      vi.advanceTimersByTime(0);
      store.catchUp(60_000);
      vi.advanceTimersByTime(1);
      expect(store.getSnapshot().awayReport?.elapsedMs).toBe(HOUR_MS + 60_000);

      store.sendPartyBack();
      store.catchUp(60_000);
      vi.advanceTimersByTime(1);
      expect(store.getSnapshot().awayReport?.elapsedMs).toBe(60_000);
    });

    it('the Away Report stays until the player dismisses it', () => {
      const store = createStore(createGame({ seed: 2 }));
      store.catchUp(60_000);
      vi.advanceTimersByTime(0);
      store.advance(10_000);
      expect(store.getSnapshot().awayReport).not.toBeNull();

      store.sendPartyBack();
      expect(store.getSnapshot().awayReport).toBeNull();
    });

    it('a save notice shows until dismissed', () => {
      const store = createStore(createGame({ seed: 2 }), { saveNotice: 'The save could not be read.' });
      expect(store.getSnapshot().saveNotice).toBe('The save could not be read.');
      store.dismissSaveNotice();
      expect(store.getSnapshot().saveNotice).toBeNull();
    });
  });
});
