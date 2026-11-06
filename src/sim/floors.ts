import { createRng, nextInt, shuffled, type Rng } from './rng';

export type FloorNumber = 1 | 2 | 3;
export const ROOM_KINDS = ['battle', 'chest', 'stairs', 'guardian'] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

export interface RoomLayout {
  readonly x: number;
  readonly y: number;
  readonly kind: RoomKind;
}

export interface FloorLayout {
  /** In the order the Party visits them. */
  readonly rooms: readonly RoomLayout[];
}

export const GRID_WIDTH = 9;
export const GRID_HEIGHT = 7;
const LAST_FLOOR: FloorNumber = 3;

const MIN_ROOMS = 8;
const MAX_ROOMS = 12;
const BATTLE_SHARE = 2 / 3;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Enemy health, power, and Poison stack damage by Floor. */
export const FLOOR_SCALE: Readonly<Record<FloorNumber, number>> = { 1: 1, 2: 1.15, 3: 1.3 };
export const BATTLE_XP: Readonly<Record<FloorNumber, number>> = { 1: 15, 2: 20, 3: 25 };

/** XP falloff: full XP up to Floor level + this many levels, then less for each level past it. */
const XP_GRACE_LEVELS = 1;
const XP_LOST_PER_LEVEL = 0.25;
const MIN_XP_SHARE = 0.1;

const floorLevel = (floor: FloorNumber): number => floor + 3;

/** The share of a Floor's XP that a Hero of this level earns. */
export function xpShare(heroLevel: number, floor: FloorNumber): number {
  const levelsPast = Math.max(0, heroLevel - floorLevel(floor) - XP_GRACE_LEVELS);
  return Math.max(MIN_XP_SHARE, 1 - levelsPast * XP_LOST_PER_LEVEL);
}

export const isFloorNumber = (value: unknown): value is FloorNumber => value === 1 || value === 2 || value === 3;

const cellKey = (x: number, y: number): number => y * GRID_WIDTH + x;

/** One self-avoiding walk, or null if it boxed itself in before reaching its length. */
function tryWalk(rng: Rng, length: number): { x: number; y: number }[] | null {
  const start = { x: nextInt(rng, GRID_WIDTH), y: nextInt(rng, GRID_HEIGHT) };
  const cells = [start];
  const taken = new Set([cellKey(start.x, start.y)]);
  while (cells.length < length) {
    const { x, y } = cells.at(-1)!;
    const open = STEPS.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter(
      (cell) => cell.x >= 0 && cell.x < GRID_WIDTH && cell.y >= 0 && cell.y < GRID_HEIGHT && !taken.has(cellKey(cell.x, cell.y)),
    );
    if (open.length === 0) return null;
    const next = open[nextInt(rng, open.length)]!;
    cells.push(next);
    taken.add(cellKey(next.x, next.y));
  }
  return cells;
}

function walk(rng: Rng, length: number): { x: number; y: number }[] {
  for (;;) {
    const cells = tryWalk(rng, length);
    if (cells) return cells;
  }
}

function roomKinds(rng: Rng, roomCount: number, floor: FloorNumber): RoomKind[] {
  const others = roomCount - 1;
  const battles = Math.round(others * BATTLE_SHARE);
  const mixed = shuffled<RoomKind>(rng, Array.from({ length: others }, (_, index) => (index < battles ? 'battle' : 'chest')));
  return [...mixed, 'stairs', ...(floor === LAST_FLOOR ? (['guardian'] as const) : [])];
}

/** Lays out a Floor from its Seed. Floor 3's Guardian Room comes after its usual 8-12 Rooms. */
export function generateFloor(seed: number, floor: FloorNumber): FloorLayout {
  const rng = createRng(seed);
  const kinds = roomKinds(rng, MIN_ROOMS + nextInt(rng, MAX_ROOMS - MIN_ROOMS + 1), floor);
  const cells = walk(rng, kinds.length);
  return { rooms: cells.map((cell, index) => ({ ...cell, kind: kinds[index]! })) };
}
