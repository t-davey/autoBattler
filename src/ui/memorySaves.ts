import { SAVE_KEY, type SaveStore } from './save';

/** A SaveStore in memory, for tests. */
export function memorySaves(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  let writes = 0;
  const store: SaveStore = {
    read: (key) => values.get(key) ?? null,
    write(key, value) {
      writes++;
      values.set(key, value);
    },
    remove: (key) => void values.delete(key),
  };
  return {
    store,
    values,
    writes: () => writes,
    /** The envelope last written. */
    envelope: () => JSON.parse(values.get(SAVE_KEY)!) as { savedAt: number; game: string },
  };
}
