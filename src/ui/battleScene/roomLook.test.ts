import { describe, expect, it } from 'vitest';
import { advance, createGame, viewGame, type FloorMapView, type Depth } from '../../sim';
import { roomLookOf } from './roomLook';

/** A real layout, read from a Game when it first reaches a Floor. */
function mapOf(seed: number): { map: FloorMapView; floor: Depth } {
  const game = createGame({ seed });
  for (let i = 0; i < 200; i++) {
    const { map, floor } = viewGame(game);
    if (map && floor) return { map, floor };
    advance(game, 100, () => {});
  }
  throw new Error('The Party never left Town');
}

const rooms = Array.from({ length: 60 }, (_, seed) => mapOf(seed + 1)).flatMap(({ map, floor }) =>
  map.rooms.map((_, index) => ({ map, floor, index, look: roomLookOf(map, floor, index) })),
);

describe('a Room look', () => {
  it('stays the same for the same Room', () => {
    const { map, floor, index, look } = rooms[3]!;
    expect(roomLookOf(map, floor, index)).toEqual(look);
  });

  it('always has a light source, and enough of it', () => {
    for (const { look } of rooms) {
      const lit = look.burners.filter((burner) => burner.lit).length;
      const sources = [lit, look.candles.length, look.foxfire.length].filter((count) => count > 0);
      expect(sources.length).toBeGreaterThan(0);
      expect(Math.min(...sources)).toBeGreaterThanOrEqual(sources.length === 1 ? 4 : 2);
    }
  });

  it('varies between Rooms', () => {
    const mixes = new Set(rooms.map(({ look }) => `${look.burners.length > 0}${look.candles.length > 0}${look.foxfire.length > 0}`));
    expect(mixes.size).toBe(7);
  });

  it('keeps burners clear of a way through the same wall', () => {
    for (const { look } of rooms) {
      for (const way of look.ways) {
        expect(look.burners.some((burner) => burner.wall === way.edge && burner.at === 4)).toBe(false);
      }
    }
  });
});

describe('the ways through a Room', () => {
  const facing = { backLeft: 'frontRight', frontRight: 'backLeft', backRight: 'frontLeft', frontLeft: 'backRight' } as const;

  it('lead back to the last Room and on to the next', () => {
    const { map, floor } = mapOf(1);
    for (let index = 1; index < map.rooms.length - 1; index++) {
      const { ways } = roomLookOf(map, floor, index);
      expect(ways.map((way) => way.role)).toEqual(['in', 'out']);
      expect(ways[0]!.edge).not.toBe(ways[1]!.edge);
      const nextIn = roomLookOf(map, floor, index + 1).ways.find((way) => way.role === 'in')!;
      expect(nextIn.edge).toBe(facing[ways[1]!.edge]);
    }
  });

  it('start a Floor with stairs in', () => {
    const { map, floor } = mapOf(1);
    expect(roomLookOf(map, floor, 0).ways[0]).toMatchObject({ role: 'in', kind: 'stairs' });
  });

  it('take stairs from a Stairs Room down to the Guardian, who has no way out', () => {
    const map: FloorMapView = {
      width: 9,
      height: 7,
      rooms: [
        { x: 0, y: 0, kind: 'battle', state: 'cleared' },
        { x: 1, y: 0, kind: 'stairs', state: 'cleared' },
        { x: 1, y: 1, kind: 'guardian', state: 'current' },
      ],
    };
    expect(roomLookOf(map, 3, 1).ways.at(-1)).toMatchObject({ role: 'out', kind: 'stairs' });
    expect(roomLookOf(map, 3, 2).ways).toEqual([expect.objectContaining({ role: 'in', kind: 'stairs' })]);
  });

  it('end a Floor with stairs out', () => {
    const { map, floor } = mapOf(1);
    const last = roomLookOf(map, floor, map.rooms.length - 1);
    expect(last.kind).toBe('stairs');
    expect(last.ways.at(-1)).toMatchObject({ role: 'out', kind: 'stairs' });
  });
});
