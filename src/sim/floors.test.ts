import { describe, expect, it } from 'vitest';
import { createGame, viewGame, type FloorMapView, type GameSetup } from './index';

const mapOf = (seed: number, scenario?: GameSetup['scenario']): FloorMapView => {
  const { map } = viewGame(createGame({ seed, ...(scenario ? { scenario } : {}) }));
  if (!map) throw new Error('no map');
  return map;
};

describe('Floor layouts', () => {
  it('the same Seed produces the same Floor layouts', () => {
    expect(mapOf(42)).toEqual(mapOf(42));
    expect(mapOf(42)).not.toEqual(mapOf(43));
  });

  it('layouts have 8-12 connected Rooms on the grid across 1,000 Seeds', () => {
    const sizes = new Set<number>();
    for (let seed = 0; seed < 1_000; seed++) {
      const { rooms, width, height } = mapOf(seed);
      sizes.add(rooms.length);
      expect(rooms.length).toBeGreaterThanOrEqual(8);
      expect(rooms.length).toBeLessThanOrEqual(12);
      expect(new Set(rooms.map(({ x, y }) => `${x},${y}`)).size).toBe(rooms.length);
      rooms.forEach((room, index) => {
        expect(room.x).toBeGreaterThanOrEqual(0);
        expect(room.x).toBeLessThan(width);
        expect(room.y).toBeGreaterThanOrEqual(0);
        expect(room.y).toBeLessThan(height);
        const previous = rooms[index - 1];
        if (previous) expect(Math.abs(room.x - previous.x) + Math.abs(room.y - previous.y)).toBe(1);
      });
    }
    expect([...sizes].sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12]);
    expect(mapOf(1)).toMatchObject({ width: 9, height: 7 });
  });

  it('about two-thirds of Rooms are Battles across many Seeds', () => {
    let rooms = 0;
    let battles = 0;
    for (let seed = 0; seed < 2_000; seed++) {
      for (const room of mapOf(seed).rooms) {
        rooms++;
        if (room.kind === 'battle' || room.kind === 'stairs') battles++;
      }
    }
    expect(battles / rooms).toBeGreaterThan(0.62);
    expect(battles / rooms).toBeLessThan(0.74);
  });

  it('the last Room holds the stairs', () => {
    for (let seed = 0; seed < 100; seed++) {
      const kinds = mapOf(seed).rooms.map((room) => room.kind);
      expect(kinds.at(-1)).toBe('stairs');
      expect(kinds.filter((kind) => kind === 'stairs')).toHaveLength(1);
    }
  });

  it('Floor 5 ends in a Guardian Room', () => {
    for (let seed = 0; seed < 100; seed++) {
      const kinds = mapOf(seed, { startAt: { floor: 5, room: 0 } }).rooms.map((room) => room.kind);
      expect(kinds.at(-1)).toBe('guardian');
      expect(kinds.at(-2)).toBe('stairs');
      expect(kinds.length - 1).toBeGreaterThanOrEqual(8);
      expect(kinds.length - 1).toBeLessThanOrEqual(12);
      expect(kinds.filter((kind) => kind === 'guardian')).toHaveLength(1);
      for (const floor of [1, 2] as const) {
        expect(mapOf(seed, { startAt: { floor, room: 0 } }).rooms.some((room) => room.kind === 'guardian')).toBe(false);
      }
    }
  });
});
