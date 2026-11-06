/** The scene's geometry. Positions are in scene units, 2 to each art pixel. */
export const ART_WIDTH = 320;
export const ART_HEIGHT = 170;
export const UNITS_PER_PIXEL = 2;
export const SCENE_WIDTH = ART_WIDTH * UNITS_PER_PIXEL;
export const TILE_HALF_WIDTH = 36;
export const TILE_HALF_HEIGHT = 18;
export const ROOM_TILES = 7;
export const ORIGIN_Y = 78;
export const WALL_HEIGHT = 66;

export type BackWall = 'backLeft' | 'backRight';
export type Edge = BackWall | 'frontLeft' | 'frontRight';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const tilePoint = (tx: number, ty: number): Point => ({
  x: SCENE_WIDTH / 2 + (tx - ty) * TILE_HALF_WIDTH,
  y: ORIGIN_Y + (tx + ty) * TILE_HALF_HEIGHT,
});

/** A point on a back wall: `along` tiles from the far corner, `height` above the floor. */
export function wallPoint(wall: BackWall, along: number, height: number): Point {
  const side = wall === 'backLeft' ? -1 : 1;
  return { x: SCENE_WIDTH / 2 + side * along * TILE_HALF_WIDTH, y: ORIGIN_Y + along * TILE_HALF_HEIGHT - height };
}

/** u runs across the screen, Party on the left, and v runs down it. */
export const formationPoint = (u: number, v: number): Point => ({
  x: SCENE_WIDTH / 2 + u * 2 * TILE_HALF_WIDTH,
  y: ORIGIN_Y + (ROOM_TILES + 2 * v) * TILE_HALF_HEIGHT,
});

/** How far along a back wall its way through sits, clear of the niches at 3 and 5. */
export const WALL_WAY_AT = 4;
export const FRONT_WAY_AT = 3.5;
const FRONT_WAY_OUT = 0.4;

/** Where a Party stands as it passes through a way on this edge. */
export function wayPoint(edge: Edge): Point {
  switch (edge) {
    case 'backLeft':
      return tilePoint(0, WALL_WAY_AT);
    case 'backRight':
      return tilePoint(WALL_WAY_AT, 0);
    case 'frontLeft':
      return tilePoint(FRONT_WAY_AT, ROOM_TILES + FRONT_WAY_OUT);
    case 'frontRight':
      return tilePoint(ROOM_TILES + FRONT_WAY_OUT, FRONT_WAY_AT);
  }
}
