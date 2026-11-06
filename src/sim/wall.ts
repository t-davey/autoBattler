export const SETBACKS_TO_FALL_BACK = 3;

export interface WallState {
  lampLit: boolean;
  /** Setbacks since the count last cleared. Stops at SETBACKS_TO_FALL_BACK. */
  setbacks: number;
  fallenBack: boolean;
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
  const { lampLit, setbacks, fallenBack } = value as Record<string, unknown>;
  return (
    typeof lampLit === 'boolean' &&
    Number.isInteger(setbacks) &&
    (setbacks as number) >= 0 &&
    (setbacks as number) <= SETBACKS_TO_FALL_BACK &&
    fallenBack === (setbacks === SETBACKS_TO_FALL_BACK)
  );
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
 * giving 3 fresh attempts at the Guardian. Other changes, such as unequipping, aren't growth.
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
