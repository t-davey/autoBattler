import {
  advance,
  applyAction,
  viewGame,
  type ActionResult,
  type Game,
  type GameEvent,
  type GameView,
  type PlayerAction,
} from '../sim';
import { describeEvent } from './describeEvent';

const LIVE_LOG_CAP = 1_000;

export interface LogLine {
  readonly id: number;
  readonly text: string;
}

export interface Snapshot {
  readonly view: GameView;
  readonly log: readonly LogLine[];
}

/** Holds the Game and publishes immutable Snapshots. Free of React and the DOM. */
export interface Store {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Snapshot;
  advance(elapsedMs: number): void;
  /** Sends a player's choice to the sim, publishing any change. */
  dispatch(action: PlayerAction): ActionResult;
}

export function createStore(game: Game): Store {
  const listeners = new Set<() => void>();
  let snapshot: Snapshot = { view: viewGame(game), log: [] };
  let nextLineId = 0;

  /** Lines beyond the cap never reach the log, so their text isn't built. Ids still count them. */
  const withLines = (log: readonly LogLine[], events: readonly GameEvent[]): readonly LogLine[] => {
    if (events.length === 0) return log;
    const firstId = nextLineId;
    nextLineId += events.length;
    const kept = events.slice(-LIVE_LOG_CAP);
    const skipped = events.length - kept.length;
    const lines = kept.map((event, index) => ({ id: firstId + skipped + index, text: describeEvent(event) }));
    return [...log, ...lines].slice(-LIVE_LOG_CAP);
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    advance(elapsedMs) {
      const events: GameEvent[] = [];
      advance(game, elapsedMs, (event) => events.push(event));
      const view = viewGame(game);
      if (view.tick === snapshot.view.tick) return;

      snapshot = { view, log: withLines(snapshot.log, events) };
      for (const listener of listeners) listener();
    },
    dispatch(action) {
      const events: GameEvent[] = [];
      const result = applyAction(game, action, (event) => events.push(event));
      if (!result.ok) return result;
      snapshot = { view: viewGame(game), log: withLines(snapshot.log, events) };
      for (const listener of listeners) listener();
      return result;
    },
  };
}
