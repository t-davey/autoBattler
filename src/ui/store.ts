import {
  advance,
  applyAction,
  beginCatchUp,
  continueCatchUp,
  viewGame,
  viewStash,
  type ActionRefusal,
  type AwayReport,
  type Game,
  type GameEvent,
  type GameView,
  type ItemView,
  type PlayerAction,
  type Rarity,
} from '../sim';
import { describeDuration, mergeAwayReports } from './describeAwayReport';
import { describeEvent } from './describeEvent';
import { clearSave, writeSave, type SaveStore } from './save';

const LIVE_LOG_CAP = 1_000;
const CATCH_UP_CHUNK_TICKS = 5_000;
/** Work this long, then yield, so a long catch-up never blocks the window. */
const CATCH_UP_WORK_MS = 16;

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
  /** 0-1 while catch-up runs, else null. */
  readonly catchUpProgress: number | null;
  /** Held in memory only. Set means a check-in is under way, until the player sends the Party back. */
  readonly awayReport: AwayReport | null;
  /** Something the player should know about their save. */
  readonly saveNotice: string | null;
  /** Set while the latest write failed. */
  readonly saveWarning: string | null;
}

export type DispatchRefusal = ActionRefusal | 'catchingUp';
export type DispatchResult = { readonly ok: true } | { readonly ok: false; readonly reason: DispatchRefusal };

/** Sends a player's choice to the sim. */
export type Dispatch = (action: PlayerAction) => DispatchResult;

/** Holds the Game and publishes immutable Snapshots. Free of React and the DOM. */
export interface Store {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Snapshot;
  advance(elapsedMs: number): void;
  /** Sends a player's choice to the sim, publishing any change. Refused while catch-up runs. */
  dispatch: Dispatch;
  /** A return from absence: runs elapsedMs in chunks, then publishes the Away Report. */
  catchUp(elapsedMs: number): void;
  /** Runs time a check-in paused. Its results wait for the next Away Report, so no new check-in opens. */
  catchUpPausedTime(elapsedMs: number): void;
  isCatchingUp(): boolean;
  /** Whether an Away Report is up, which pauses the Party. */
  inCheckIn(): boolean;
  /** Ends the check-in, and sends the Party out if it's in Town. */
  sendPartyBack(): void;
  dismissSaveNotice(): void;
  /** Writes the state, as of the time it was last advanced to. Does nothing during catch-up, which has already banked its time. */
  save(savedAt: number): void;
  /** Hears the end of a check-in, so the driver can run the time it paused. */
  onSentBack(listener: () => void): () => void;
  /** Hears when state changed apart from the clock: an accepted action, or catch-up finishing. */
  onSettled(listener: () => void): () => void;
  /** Removes the save and writes no more, for a reload to start over. */
  startOver(): void;
}

export interface StoreOptions {
  /** Where saves go. Without one, nothing saves. */
  readonly saves?: SaveStore;
  readonly saveNotice?: string | null;
  /** Measures catch-up's work between yields. */
  readonly workClock?: () => number;
}

const keepNewest = (lines: readonly LogLine[]): readonly LogLine[] => lines.slice(-LIVE_LOG_CAP);

const writeFailure = (error: unknown): string =>
  `The game could not be saved, so progress since the last save will be lost on closing. ${error instanceof Error ? error.message : String(error)}`;

export function createStore(game: Game, { saves, saveNotice = null, workClock = () => performance.now() }: StoreOptions = {}): Store {
  const listeners = new Set<() => void>();
  const settledListeners = new Set<() => void>();
  const sentBackListeners = new Set<() => void>();
  let snapshot: Snapshot = { view: viewGame(game), log: [], stash: viewStash(game), catchUpProgress: null, awayReport: null, saveNotice, saveWarning: null };
  let nextLineId = 0;
  let savingStopped = false;
  /** Results of a check-in's paused time, waiting for the next Away Report. */
  let heldReport: AwayReport | null = null;

  /** Lines beyond the cap never reach the log, so their text isn't built. Ids still count them. */
  const withLines = (log: readonly LogLine[], events: readonly GameEvent[]): readonly LogLine[] => {
    if (events.length === 0) return log;
    const firstId = nextLineId;
    nextLineId += events.length;
    const kept = events.slice(-LIVE_LOG_CAP);
    const skipped = events.length - kept.length;
    const lines = kept.map((event, index) => ({ id: firstId + skipped + index, text: describeEvent(event), rarity: event.type === 'itemFound' ? event.item.rarity : null }));
    return keepNewest([...log, ...lines]);
  };

  const catchingUp = (): boolean => snapshot.catchUpProgress !== null;

  const replace = (changes: Partial<Snapshot>): void => {
    snapshot = { ...snapshot, ...changes };
    for (const listener of listeners) listener();
  };

  const stashFor = (view: GameView): readonly ItemView[] => (view.stashRevision === snapshot.view.stashRevision ? snapshot.stash : viewStash(game));

  const publish = (view: GameView, events: readonly GameEvent[]): void => {
    replace({ view, log: withLines(snapshot.log, events), stash: stashFor(view) });
  };

  const settled = (): void => {
    for (const listener of settledListeners) listener();
  };

  const merged = (earlier: AwayReport | null, later: AwayReport): AwayReport => (earlier ? mergeAwayReports(earlier, later) : later);

  /** Catch-up reports nothing to the Live Log but this one line. */
  const finishCatchUp = (report: AwayReport, holdReport: boolean): void => {
    const view = viewGame(game);
    const passed = describeDuration(report.appliedMs);
    const line: LogLine = { id: nextLineId++, text: holdReport ? `${passed} passed during the check-in.` : `${passed} passed. See the Away Report.`, rarity: null };
    // A pause under a second has nothing worth a line.
    const log = holdReport && report.appliedMs < 1_000 ? snapshot.log : keepNewest([...snapshot.log, line]);
    const awayReport = holdReport ? snapshot.awayReport : merged(snapshot.awayReport ?? heldReport, report);
    heldReport = holdReport ? merged(heldReport, report) : null;
    replace({ view, stash: stashFor(view), log, catchUpProgress: null, awayReport });
    settled();
  };

  const runCatchUp = (elapsedMs: number, holdReport: boolean): void => {
    if (catchingUp()) return;
    const running = beginCatchUp(game, elapsedMs);
    const work = (): void => {
      const started = workClock();
      do {
        const report = continueCatchUp(game, running, CATCH_UP_CHUNK_TICKS);
        if (report) {
          finishCatchUp(report, holdReport);
          return;
        }
      } while (workClock() - started < CATCH_UP_WORK_MS);
      replace({ catchUpProgress: 1 - running.ticksLeft / running.ticksTotal });
      setTimeout(work, 0);
    };
    replace({ catchUpProgress: 0 });
    setTimeout(work, 0);
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    advance(elapsedMs) {
      if (catchingUp()) return;
      const events: GameEvent[] = [];
      advance(game, elapsedMs, (event) => events.push(event));
      const view = viewGame(game);
      if (view.tick === snapshot.view.tick) return;

      publish(view, events);
    },
    dispatch(action) {
      if (catchingUp()) return { ok: false, reason: 'catchingUp' };
      const events: GameEvent[] = [];
      const result = applyAction(game, action, (event) => events.push(event));
      if (!result.ok) return result;
      publish(viewGame(game), events);
      settled();
      return result;
    },
    catchUp(elapsedMs) {
      runCatchUp(elapsedMs, false);
    },
    catchUpPausedTime(elapsedMs) {
      runCatchUp(elapsedMs, true);
    },
    isCatchingUp: catchingUp,
    inCheckIn: () => snapshot.awayReport !== null,
    sendPartyBack() {
      if (catchingUp()) return;
      const events: GameEvent[] = [];
      if (snapshot.view.phase === 'town') applyAction(game, { type: 'sendParty' }, (event) => events.push(event));
      publish(viewGame(game), events);
      replace({ awayReport: null });
      settled();
      for (const listener of sentBackListeners) listener();
    },
    onSentBack(listener) {
      sentBackListeners.add(listener);
      return () => sentBackListeners.delete(listener);
    },
    dismissSaveNotice() {
      replace({ saveNotice: null });
    },
    save(savedAt) {
      if (!saves || savingStopped || catchingUp()) return;
      try {
        writeSave(saves, game, savedAt);
        if (snapshot.saveWarning !== null) replace({ saveWarning: null });
      } catch (error) {
        replace({ saveWarning: writeFailure(error) });
      }
    },
    onSettled(listener) {
      settledListeners.add(listener);
      return () => settledListeners.delete(listener);
    },
    startOver() {
      savingStopped = true;
      if (!saves) return;
      try {
        clearSave(saves);
      } catch (error) {
        replace({ saveWarning: writeFailure(error) });
      }
    },
  };
}
