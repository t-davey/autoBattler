import { CATCH_UP_CAP_MS, TICK_MS } from '../sim';

export interface DriverOptions {
  readonly now: () => number;
  readonly isHidden: () => boolean;
  readonly step: (elapsedMs: number) => void;
}

/** Owns the clock, so rendering never sets game speed. Returns a function that stops it.
 *  Nothing steps while hidden, because throttled timers are too uneven to trust. The whole
 *  gap applies when the window returns, since the last-seen time doesn't move until then. */
export function startDriver({ now, isHidden, step }: DriverOptions): () => void {
  let last = now();
  const timer = setInterval(() => {
    if (isHidden()) return;
    const current = now();
    step(Math.min(current - last, CATCH_UP_CAP_MS));
    last = current;
  }, TICK_MS);
  return () => clearInterval(timer);
}
