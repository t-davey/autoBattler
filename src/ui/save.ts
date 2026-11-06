import { deserializeGame, serializeGame, type Game } from '../sim';

export const SAVE_KEY = 'autobattler.save';
export const BAD_SAVE_KEY = 'autobattler.save.bad';

/** Somewhere to keep text. Any method may throw. */
export interface SaveStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export interface LoadedSave {
  readonly game: Game;
  /** The time the state was last advanced to, not the time of writing, so writes can't lose or double-count time. */
  readonly savedAt: number;
}

export interface LoadResult {
  readonly saved: LoadedSave | null;
  /** Says what went wrong, if the game has to start new because of it. */
  readonly notice: string | null;
}

const BAD_SAVE_NOTICE = 'The save could not be read, so a new game has started. The old save was set aside.';
const NOT_SET_ASIDE_NOTICE = 'The save could not be read or set aside, so a new game has started and will replace it.';
const NO_STORAGE_NOTICE = 'Saves could not be read here, so a new game has started.';

/** deserializeGame alone checks the version. */
function parseEnvelope(text: string): LoadedSave | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { savedAt, game } = parsed as Record<string, unknown>;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt) || typeof game !== 'string') return null;
  const restored = deserializeGame(game);
  return restored && { game: restored, savedAt };
}

/** Reads the save. An unreadable or old one moves to BAD_SAVE_KEY. */
export function loadSave(store: SaveStore): LoadResult {
  let text: string | null;
  try {
    text = store.read(SAVE_KEY);
  } catch {
    return { saved: null, notice: NO_STORAGE_NOTICE };
  }
  if (text === null) return { saved: null, notice: null };

  const saved = parseEnvelope(text);
  if (saved) return { saved, notice: null };
  try {
    store.write(BAD_SAVE_KEY, text);
  } catch (error) {
    return { saved: null, notice: `${NOT_SET_ASIDE_NOTICE} ${error instanceof Error ? error.message : String(error)}` };
  }
  try {
    store.remove(SAVE_KEY);
  } catch {
    // A copy is safe under BAD_SAVE_KEY, and the next write replaces this one.
  }
  return { saved: null, notice: BAD_SAVE_NOTICE };
}

export function writeSave(store: SaveStore, game: Game, savedAt: number): void {
  store.write(SAVE_KEY, JSON.stringify({ savedAt, game: serializeGame(game) }));
}

export const clearSave = (store: SaveStore): void => store.remove(SAVE_KEY);
