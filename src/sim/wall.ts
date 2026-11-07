export const SETBACKS_TO_FALL_BACK = 3;

export interface WallState {
  lampLit: boolean;
  /** Setbacks since the count last cleared. Stops at SETBACKS_TO_FALL_BACK. */
  setbacks: number;
  fallenBack: boolean;
  /** The lowest share of its health the Guardian has reached in a Setback. */
  bestAttempt?: number;
}

export type WallEvent =
  | { readonly type: 'fellBack' }
  | { readonly type: 'retryingGuardian' }
  | { readonly type: 'guardianFell' }
  | { readonly type: 'lampRelit' };

export type WallSink = (event: WallEvent) => void;

/** A Party's Wall, part-way through if a scenario says so. Setbacks past the limit count as the limit. */
export function createWall({ lampLit = false, setbacks = 0 }: { readonly lampLit?: boolean | undefined; readonly setbacks?: number | undefined } = {}): WallState {
  const counted = Math.min(setbacks, SETBACKS_TO_FALL_BACK);
  return { lampLit, setbacks: counted, fallenBack: counted === SETBACKS_TO_FALL_BACK };
}

/** Whether saved data is a Wall that createWall and these transitions could have made. */
export function isWallState(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const { lampLit, setbacks, fallenBack, bestAttempt } = value as Record<string, unknown>;
  return (
    (bestAttempt === undefined || (typeof bestAttempt === 'number' && bestAttempt >= 0 && bestAttempt <= 1)) &&
    typeof lampLit === 'boolean' &&
    Number.isInteger(setbacks) &&
    (setbacks as number) >= 0 &&
    (setbacks as number) <= SETBACKS_TO_FALL_BACK &&
    fallenBack === (setbacks === SETBACKS_TO_FALL_BACK)
  );
}

/** Keeps the lowest health share a Guardian has been left on. */
export function recordBestAttempt(wall: WallState, healthShare: number): void {
  wall.bestAttempt = Math.min(wall.bestAttempt ?? 1, healthShare);
}

/** A Party that has fallen back turns back before the Guardian Room. */
export const turnsBackBeforeGuardian = (wall: WallState): boolean => wall.fallenBack;

/** Counts a Wipe or draw, wherever it happened. */
export function recordSetback(wall: WallState, sink: WallSink): void {
  if (wall.fallenBack) return;
  wall.setbacks++;
  if (wall.setbacks >= SETBACKS_TO_FALL_BACK) {
    wall.fallenBack = true;
    sink({ type: 'fellBack' });
  }
}

/**
 * The Party grew stronger, by a level-up, a skill point, or equipping an item. Ends a fallback, if there is one,
 * giving fresh attempts at the Guardian. Other changes, such as unequipping, aren't growth.
 */
export function recordGrowth(wall: WallState, sink: WallSink): void {
  if (!wall.fallenBack) return;
  wall.fallenBack = false;
  wall.setbacks = 0;
  sink({ type: 'retryingGuardian' });
}

/** Clears the count and relights the Lamp. Returns whether this kill relit it, which only the first does. */
export function recordGuardianKill(wall: WallState, sink: WallSink): boolean {
  sink({ type: 'guardianFell' });
  wall.setbacks = 0;
  wall.fallenBack = false;
  const relit = !wall.lampLit;
  wall.lampLit = true;
  if (relit) sink({ type: 'lampRelit' });
  return relit;
}
