import { describe, expect, it } from 'vitest';
import { advance, createGame, type GameEvent } from '../sim';
import { describeEvent } from './describeEvent';
import { createStore } from './store';

describe('store', () => {
  it('the Live Log keeps the newest 1,000 lines', () => {
    const elapsedMs = 3_600_000;
    const events: GameEvent[] = [];
    advance(createGame({ seed: 2 }), elapsedMs, (event) => events.push(event));
    expect(events.length).toBeGreaterThan(1_000);

    const store = createStore(createGame({ seed: 2 }));
    for (let i = 0; i < 60; i++) store.advance(elapsedMs / 60);

    expect(store.getSnapshot().log.map((line) => line.text)).toEqual(events.slice(-1_000).map(describeEvent));
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

  it('dispatch returns a refusal and publishes nothing', () => {
    const store = createStore(createGame({ seed: 1 }));
    const before = store.getSnapshot();
    let calls = 0;
    store.subscribe(() => calls++);

    expect(store.dispatch({ type: 'renameHero', heroId: 'huntsman', name: ' ' })).toEqual({ ok: false, reason: 'emptyName' });
    expect(calls).toBe(0);
    expect(store.getSnapshot()).toBe(before);
  });
});
