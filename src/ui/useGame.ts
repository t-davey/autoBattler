import { useSyncExternalStore } from 'react';
import type { Snapshot, Store } from './store';

export function useGame(store: Store): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
