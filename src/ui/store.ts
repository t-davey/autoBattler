import {
  advance,
  applyAction,
  viewGame,
  viewStash,
  type ActionResult,
  type Game,
  type GameEvent,
  type GameView,
  type ItemView,
  type PlayerAction,
  type Rarity,
} from '../sim';
import { describeEvent } from './describeEvent';

const LIVE_LOG_CAP = 1_000;

export interface LogLine {
  readonly id: number;
  readonly text: string;
  /** Set on a line about a found item. */
  readonly rarity: Rarity | null;
}

export interface Snapshot {
  readonly view: GameView;
  readonly log: readonly LogLine[];
  /** The same array until the Stash changes. */
  readonly stash: readonly ItemView[];
}

/** Sends a player's choice to the sim. */
export type Dispatch = (action: PlayerAction) => ActionResult;

/** Holds the Game and publishes immutable Snapshots. Free of React and the DOM. */
export interface Store {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Snapshot;
  advance(elapsedMs: number): void;
  /** Sends a player's choice to the sim, publishing any change. */
  dispatch: Dispatch;
}

export function createStore(game: Game): Store {
  const listeners = new Set<() => void>();
  let snapshot: Snapshot = { view: viewGame(game), log: [], stash: viewStash(game) };
  let nextLineId = 0;

  /** Lines beyond the cap never reach the log, so their text isn't built. Ids still count them. */
  const withLines = (log: readonly LogLine[], events: readonly GameEvent[]): readonly LogLine[] => {
    if (events.length === 0) return log;
    const firstId = nextLineId;
    nextLineId += events.length;
    const kept = events.slice(-LIVE_LOG_CAP);
    const skipped = events.length - kept.length;
    const lines = kept.map((event, index) => ({ id: firstId + skipped + index, text: describeEvent(event), rarity: event.type === 'itemFound' ? event.item.rarity : null }));
    return [...log, ...lines].slice(-LIVE_LOG_CAP);
  };

  const publish = (view: GameView, events: readonly GameEvent[]): void => {
    const stash = view.stashRevision === snapshot.view.stashRevision ? snapshot.stash : viewStash(game);
    snapshot = { view, log: withLines(snapshot.log, events), stash };
    for (const listener of listeners) listener();
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

      publish(view, events);
    },
    dispatch(action) {
      const events: GameEvent[] = [];
      const result = applyAction(game, action, (event) => events.push(event));
      if (!result.ok) return result;
      publish(viewGame(game), events);
      return result;
    },
  };
}
