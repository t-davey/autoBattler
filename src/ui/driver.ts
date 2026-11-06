import { TICK_MS } from '../sim';
import type { Store } from './store';

/** A gap this long gets catch-up and an Away Report. A shorter one plays live (G19). */
export const CATCH_UP_MIN_GAP_MS = 60_000;
const SAVE_INTERVAL_MS = 30_000;

export interface DriverOptions {
  readonly now: () => number;
  readonly isHidden: () => boolean;
  readonly store: Store;
  /** The time the Game's state was last advanced to: a save's savedAt, or now for a new game. */
  readonly advancedTo: number;
}

export interface Driver {
  stop(): void;
  /** Saves now, unless catch-up is running. */
  save(): void;
}

/** Owns the clock, so rendering never sets game speed.
 *  Nothing steps while hidden, because throttled timers are too uneven to trust. The whole
 *  gap applies when the window returns, since the last-advanced time doesn't move until then. */
export function startDriver({ now, isHidden, store, advancedTo }: DriverOptions): Driver {
  let last = advancedTo;

  const pass = (): void => {
    // Time passing during catch-up stays in the gap, for the first pass after it.
    if (isHidden() || store.isCatchingUp()) return;
    const current = now();
    const gap = current - last;
    last = current;
    if (gap >= CATCH_UP_MIN_GAP_MS) store.catchUp(gap);
    else store.advance(gap);
  };

  const save = (): void => store.save(last);
  const stopSettled = store.onSettled(save);
  const stepper = setInterval(pass, TICK_MS);
  const saver = setInterval(save, SAVE_INTERVAL_MS);
  // A return from absence shows its progress straight away.
  pass();

  return {
    stop() {
      clearInterval(stepper);
      clearInterval(saver);
      stopSettled();
    },
    save,
  };
}
