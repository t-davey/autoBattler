import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../sim';
import { startDriver } from './driver';
import { memorySaves } from './memorySaves';
import { createStore } from './store';

describe('driver', () => {
  let clock = 0;
  let hidden = false;

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 1_000_000;
    hidden = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const start = (advancedTo = clock) => {
    const saves = memorySaves();
    const store = createStore(createGame({ seed: 1 }), { saves: saves.store });
    const driver = startDriver({ now: () => clock, isHidden: () => hidden, store, advancedTo });
    return { store, driver, saves };
  };

  /** Moves the clock and the timers together, as a visible window does. */
  const play = (ms: number) => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  };

  it('a gap of 60 seconds or more runs catch-up', () => {
    const { store } = start(clock - 60_000);
    expect(store.isCatchingUp()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(store.isCatchingUp()).toBe(false);
    const { awayReport, view, log } = store.getSnapshot();
    expect(awayReport?.elapsedMs).toBe(60_000);
    expect(view.tick).toBe(600);
    expect(log).toHaveLength(1);
  });

  it('a shorter gap steps live', () => {
    const { store } = start(clock - 59_999);
    expect(store.isCatchingUp()).toBe(false);
    const { awayReport, view, log } = store.getSnapshot();
    expect(awayReport).toBeNull();
    expect(view.tick).toBe(599);
    expect(log.length).toBeGreaterThan(1);
  });

  it('a clock moved backwards steps nothing', () => {
    const { store } = start(clock + 3_600_000);
    expect(store.getSnapshot().view.tick).toBe(0);
    expect(store.isCatchingUp()).toBe(false);
    play(1_000);
    expect(store.getSnapshot().view.tick).toBe(10);
  });

  it('nothing steps while the window is hidden', () => {
    const { store } = start();
    play(1_000);
    expect(store.getSnapshot().view.tick).toBe(10);

    hidden = true;
    play(30_000);
    expect(store.getSnapshot().view.tick).toBe(10);

    hidden = false;
    play(100);
    expect(store.getSnapshot().view.tick).toBe(311);
    expect(store.getSnapshot().awayReport).toBeNull();
  });

  it('a long hidden stretch comes back as catch-up', () => {
    const { store } = start();
    hidden = true;
    play(120_000);
    hidden = false;
    play(100);
    expect(store.isCatchingUp()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(store.getSnapshot().awayReport?.elapsedMs).toBe(120_100);
  });

  it('time passing during catch-up counts once the Party is sent back', () => {
    const { store } = start(clock - 60_000);
    clock += 5_000;
    vi.advanceTimersByTime(0);
    expect(store.isCatchingUp()).toBe(false);
    store.sendPartyBack();
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(1);
    expect(store.getSnapshot().view.tick).toBe(650);
  });

  describe('a check-in', () => {
    const inCheckIn = () => {
      const started = start(clock - 60_000);
      vi.advanceTimersByTime(0);
      expect(started.store.inCheckIn()).toBe(true);
      return started;
    };

    it('pauses the Party', () => {
      const { store } = inCheckIn();
      play(30_000);
      expect(store.getSnapshot().view.tick).toBe(600);
    });

    it('saves the time it paused at, so closing the game loses nothing', () => {
      const pausedAt = clock;
      const { driver, saves } = inCheckIn();
      play(30_000);
      driver.save();
      expect(saves.envelope().savedAt).toBe(pausedAt);
    });

    it('counts its time once the Party is sent back, without opening another', () => {
      const { store } = inCheckIn();
      play(120_000);
      store.sendPartyBack();
      play(100);
      expect(store.isCatchingUp()).toBe(true);
      vi.advanceTimersByTime(1);

      const { view, awayReport, log } = store.getSnapshot();
      expect(view.tick).toBe(600 + 1_201);
      expect(awayReport).toBeNull();
      expect(store.inCheckIn()).toBe(false);
      expect(log.at(-1)?.text).toBe('2 minutes passed during the check-in.');
    });

    it('plays live again after its time has run', () => {
      const { store } = inCheckIn();
      play(1_000);
      store.sendPartyBack();
      play(100);
      vi.advanceTimersByTime(1);
      const { tick } = store.getSnapshot().view;
      play(1_000);
      expect(store.getSnapshot().view.tick).toBe(tick + 10);
    });

    it('adds its results to the next Away Report', () => {
      const { store } = inCheckIn();
      play(120_000);
      store.sendPartyBack();
      play(100);
      vi.advanceTimersByTime(1);

      store.catchUp(60_000);
      vi.advanceTimersByTime(0);
      expect(store.getSnapshot().awayReport?.elapsedMs).toBe(120_100 + 60_000);
    });
  });

  it('saves every 30 seconds', () => {
    const { saves } = start();
    expect(saves.writes()).toBe(0);
    play(29_900);
    expect(saves.writes()).toBe(0);
    play(100);
    expect(saves.writes()).toBe(1);
  });

  it('saves after a player action and after catch-up finishes', () => {
    const { store, saves } = start();
    store.dispatch({ type: 'renameHero', heroId: 'huntsman', name: 'Old Marrow' });
    expect(saves.writes()).toBe(1);
    store.catchUp(3_600_000);
    expect(saves.writes()).toBe(1);
    vi.advanceTimersByTime(0);
    expect(saves.writes()).toBe(2);
  });

  it('nothing saves during catch-up', () => {
    const saves = memorySaves();
    let time = 0;
    // Every chunk runs out of work time, so catch-up yields after each.
    const store = createStore(createGame({ seed: 1 }), { saves: saves.store, workClock: () => (time += 100) });
    const driver = startDriver({ now: () => clock, isHidden: () => hidden, store, advancedTo: clock - 3_600_000 });

    let passes = 0;
    while (store.isCatchingUp()) {
      driver.save();
      expect(saves.writes()).toBe(0);
      vi.advanceTimersByTime(1);
      passes++;
    }
    expect(passes).toBeGreaterThan(1);
    expect(saves.writes()).toBe(1);
    expect(saves.envelope().savedAt).toBe(clock);
  });

  it('stop ends stepping and saving', () => {
    const { store, driver, saves } = start();
    driver.stop();
    play(60_000);
    expect(store.getSnapshot().view.tick).toBe(0);
    expect(saves.writes()).toBe(0);
  });
});
