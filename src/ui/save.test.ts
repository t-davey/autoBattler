import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, createGame, deserializeGame, SAVE_VERSION, serializeGame, viewGame } from '../sim';
import { startDriver } from './driver';
import { BAD_SAVE_KEY, loadSave, SAVE_KEY, writeSave, type SaveStore } from './save';
import { createStore } from './store';

const memoryStore = (entries: Record<string, string> = {}) => {
  const values = new Map(Object.entries(entries));
  const store: SaveStore = {
    read: (key) => values.get(key) ?? null,
    write: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
  };
  return { store, values };
};

const failing = (message: string): SaveStore => ({
  read() {
    throw new Error(message);
  },
  write() {
    throw new Error(message);
  },
  remove() {
    throw new Error(message);
  },
});

describe('loadSave', () => {
  it('finds nothing in empty storage, and says nothing about it', () => {
    expect(loadSave(memoryStore().store)).toEqual({ saved: null, notice: null });
  });

  it('restores what writeSave wrote', () => {
    const { store } = memoryStore();
    const game = createGame({ seed: 3 });
    advance(game, 90_000);
    writeSave(store, game, 12_345);

    const { saved, notice } = loadSave(store);
    expect(notice).toBeNull();
    expect(saved?.savedAt).toBe(12_345);
    expect(serializeGame(saved!.game)).toBe(serializeGame(game));
  });

  it('an old version moves aside and starts a new game', () => {
    const inner = JSON.parse(serializeGame(createGame({ seed: 1 }))) as Record<string, unknown>;
    const old = JSON.stringify({ savedAt: 5, game: JSON.stringify({ ...inner, version: SAVE_VERSION + 1 }) });
    const { store, values } = memoryStore({ [SAVE_KEY]: old });

    const { saved, notice } = loadSave(store);
    expect(saved).toBeNull();
    expect(notice).toContain('new game');
    expect(values.get(BAD_SAVE_KEY)).toBe(old);
    expect(values.has(SAVE_KEY)).toBe(false);
  });

  it.each([
    ['not JSON', 'not json'],
    ['the wrong shape', '[]'],
    ['no savedAt', JSON.stringify({ game: '{}' })],
    ['a bad Game', JSON.stringify({ savedAt: 5, game: '{}' })],
  ])('an unreadable save moves aside: %s', (_name, text) => {
    const { store, values } = memoryStore({ [SAVE_KEY]: text });
    expect(loadSave(store).saved).toBeNull();
    expect(values.get(BAD_SAVE_KEY)).toBe(text);
    expect(values.has(SAVE_KEY)).toBe(false);
  });

  it('storage that throws still starts a new game, with a notice', () => {
    const { saved, notice } = loadSave(failing('denied'));
    expect(saved).toBeNull();
    expect(notice).not.toBeNull();
  });
});

describe('saving from the store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('savedAt is the time state was last advanced to', () => {
    let clock = 1_000_000;
    let hidden = false;
    const { store: saves, values } = memoryStore();
    const store = createStore(createGame({ seed: 1 }), { saves });
    const driver = startDriver({ now: () => clock, isHidden: () => hidden, store, advancedTo: clock });

    clock += 5_000;
    vi.advanceTimersByTime(100);
    const advancedTo = clock;

    // Hidden, the state stands still however late the write comes.
    hidden = true;
    clock += 500_000;
    vi.advanceTimersByTime(100);
    driver.save();

    const { savedAt, game } = JSON.parse(values.get(SAVE_KEY)!) as { savedAt: number; game: string };
    expect(savedAt).toBe(advancedTo);
    expect(viewGame(deserializeGame(game)!).tick).toBe(50);
    driver.stop();
  });

  it('a Skip leaves savedAt alone, since no real time passed', () => {
    const clock = 1_000_000;
    const { store: saves, values } = memoryStore();
    const store = createStore(createGame({ seed: 1 }), { saves });
    const driver = startDriver({ now: () => clock, isHidden: () => false, store, advancedTo: clock });

    store.catchUp(3_600_000);
    vi.advanceTimersByTime(0);

    const { savedAt, game } = JSON.parse(values.get(SAVE_KEY)!) as { savedAt: number; game: string };
    expect(savedAt).toBe(clock);
    expect(viewGame(deserializeGame(game)!).tick).toBe(36_000);
    driver.stop();
  });

  it('a failed write raises a warning', () => {
    const store = createStore(createGame({ seed: 1 }), { saves: failing('quota exceeded') });
    let calls = 0;
    store.subscribe(() => calls++);

    store.save(1);
    expect(store.getSnapshot().saveWarning).toContain('quota exceeded');
    expect(calls).toBe(1);
  });

  it('a later write that works clears the warning', () => {
    let full = true;
    const { store: saves } = memoryStore();
    const store = createStore(createGame({ seed: 1 }), {
      saves: {
        ...saves,
        write(key, value) {
          if (full) throw new Error('quota exceeded');
          saves.write(key, value);
        },
      },
    });

    store.save(1);
    expect(store.getSnapshot().saveWarning).not.toBeNull();
    full = false;
    store.save(2);
    expect(store.getSnapshot().saveWarning).toBeNull();
  });

  it('starting over removes the save and writes no more', () => {
    const { store: saves, values } = memoryStore();
    const store = createStore(createGame({ seed: 1 }), { saves });
    store.save(1);
    expect(values.has(SAVE_KEY)).toBe(true);

    store.startOver();
    expect(values.has(SAVE_KEY)).toBe(false);
    store.save(2);
    expect(values.has(SAVE_KEY)).toBe(false);
  });
});
