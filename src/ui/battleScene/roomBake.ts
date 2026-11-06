import {
  ART_HEIGHT,
  ART_WIDTH,
  FRONT_WAY_AT,
  ORIGIN_Y,
  ROOM_TILES,
  SCENE_WIDTH,
  TILE_HALF_HEIGHT,
  TILE_HALF_WIDTH,
  UNITS_PER_PIXEL,
  WALL_HEIGHT,
  WALL_WAY_AT,
  tilePoint,
  wallPoint,
  type BackWall,
  type Point,
} from './iso';
import type { RoomLook, Way } from './roomLook';

export const MATERIAL_VOID = 0;
export const MATERIAL_STONE = 1;
export const MATERIAL_WATER = 2;
export const MATERIAL_LAMP = 3;
export const MATERIAL_FOXFIRE = 4;

export interface Flame {
  readonly x: number;
  readonly y: number;
  readonly big: boolean;
}

/** A Room with its light worked out in advance, ready to draw each frame. */
export interface BakedRoom {
  readonly albedo: Float32Array;
  readonly material: Uint8Array;
  /** Light that never moves: warm from flames, cold from foxfire. */
  readonly warm: Float32Array;
  readonly cool: Float32Array;
  readonly flames: readonly Flame[];
}

interface Light extends Point {
  readonly radius: number;
  readonly strength: number;
}

const PIXELS = ART_WIDTH * ART_HEIGHT;
const POOLS = [[5.5, 5.5, 1.35], [1.1, 5.9, 0.85], [6.2, 2, 0.7]] as const;
const FLOOR_FOXFIRE = [[4.3, 6.55, 9], [6.5, 3.5, 8], [2.5, 6.1, 7], [0.45, 3.8, 8], [3.6, 0.4, 7], [0.5, 1.6, 6]] as const;
const WALL_FOXFIRE = [['backLeft', 4.8, 8], ['backRight', 3.2, 7], ['backRight', 5.5, 11]] as const;
const PIPE_HEIGHT = 51;
const LAMP_TOP = ORIGIN_Y - 48;
const LAMP_GLASS_TOP = ORIGIN_Y - 44;
const LAMP_GLASS_BOTTOM = ORIGIN_Y - 30;

export const noise = (a: number, b: number): number => {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const sceneX = (px: number): number => (px + 0.5) * UNITS_PER_PIXEL;
const sceneY = (py: number): number => (py + 0.5) * UNITS_PER_PIXEL;

function bakeBase(): { albedo: Float32Array; material: Uint8Array } {
  const albedo = new Float32Array(PIXELS);
  const material = new Uint8Array(PIXELS);
  for (let py = 0; py < ART_HEIGHT; py++) {
    for (let px = 0; px < ART_WIDTH; px++) {
      const i = py * ART_WIDTH + px;
      const x = sceneX(px);
      const y = sceneY(py);
      const a = (x - SCENE_WIDTH / 2) / TILE_HALF_WIDTH;
      const b = (y - ORIGIN_Y) / TILE_HALF_HEIGHT;
      const tx = (a + b) / 2;
      const ty = (b - a) / 2;
      const grain = noise(px, py);
      if (tx >= 0 && ty >= 0 && tx < ROOM_TILES && ty < ROOM_TILES) {
        const inPool = POOLS.some(([cx, cy, r]) => Math.hypot(tx - cx, ty - cy) + Math.sin(tx * 5 + ty * 3) * 0.1 < r);
        if (inPool) {
          material[i] = MATERIAL_WATER;
          albedo[i] = 0.85 + grain * 0.1;
          continue;
        }
        const fx = tx - Math.floor(tx);
        const fy = ty - Math.floor(ty);
        const stone = noise(Math.floor(tx), Math.floor(ty));
        let value = 0.72 + stone * 0.28 + (grain - 0.5) * 0.1;
        if (fx < 0.07 || fy < 0.07) value = 0.28;
        else if (stone > 0.72 && Math.abs(fx - fy * (0.6 + stone * 0.5) - 0.12) < 0.04) value = 0.34;
        else if (fx < 0.14 || fy < 0.14) value *= 1.12;
        material[i] = MATERIAL_STONE;
        albedo[i] = value;
        continue;
      }
      const slabB = (y - 10 - ORIGIN_Y) / TILE_HALF_HEIGHT;
      const slabX = (a + slabB) / 2;
      const slabY = (slabB - a) / 2;
      if (slabX >= 0 && slabY >= 0 && slabX < ROOM_TILES && slabY < ROOM_TILES && b > 0) {
        material[i] = MATERIAL_STONE;
        albedo[i] = 0.3 + grain * 0.06 - (Math.floor(y / 6) % 2 ? 0 : 0.05);
        continue;
      }
      const along = Math.abs(a);
      const height = ORIGIN_Y + along * TILE_HALF_HEIGHT - y;
      if (along >= ROOM_TILES || height <= 0 || height >= WALL_HEIGHT) continue;
      const shade = a < 0 ? 1 : 0.8;
      const course = Math.floor(height / 9);
      const brickX = along * TILE_HALF_WIDTH + (course % 2 ? 13 : 0);
      let value = (0.5 + noise(Math.floor(brickX / 26), course) * 0.28 + (grain - 0.5) * 0.1) * shade;
      if (height % 9 < 1.8 || brickX % 26 < 1.8) value = 0.2;
      if (height > WALL_HEIGHT - 5) value = 0.95 * shade;
      // A burial niche with its skull.
      const fromNiche = Math.abs((along % 2) - 1) * TILE_HALF_WIDTH;
      if (along > 0.6 && along < 6.4 && fromNiche < 12 && height > 14 && height < 46 - (fromNiche * fromNiche) / 18) {
        value = 0.07;
        if (Math.hypot(fromNiche, height - 23) < 5.2) value = Math.hypot(fromNiche - 2, height - 24) < 1.6 ? 0.1 : 0.9;
        else if (height < 18.5 && fromNiche < 9) value = 0.55;
      }
      if (along < 0.11) value = 0.3;
      material[i] = MATERIAL_STONE;
      albedo[i] = value;
    }
  }
  return { albedo, material };
}

const base = bakeBase();

/** Bakes a Room. A Lamp stands only where a Guardian guards it. */
export function bakeRoom(look: RoomLook, lampLit: boolean): BakedRoom {
  const albedo = base.albedo.slice();
  const material = base.material.slice();
  const flames: Flame[] = [];
  const warm: Light[] = [];
  const cold: Light[] = [];

  const put = (point: Point, value: number, kind: number = MATERIAL_STONE): void => {
    const px = Math.floor(point.x / UNITS_PER_PIXEL);
    const py = Math.floor(point.y / UNITS_PER_PIXEL);
    if (px < 0 || py < 0 || px >= ART_WIDTH || py >= ART_HEIGHT) return;
    const i = py * ART_WIDTH + px;
    material[i] = kind;
    albedo[i] = value;
  };
  const addFlame = (point: Point, big: boolean): void => {
    flames.push({ x: Math.floor(point.x / UNITS_PER_PIXEL), y: Math.floor(point.y / UNITS_PER_PIXEL), big });
  };

  if (look.burners.length > 0) {
    for (const wall of ['backLeft', 'backRight'] as const) {
      for (let along = 0.15; along < 6.9; along += 0.012) {
        const inDoorway = look.ways.some((way) => way.edge === wall) && Math.abs(along - WALL_WAY_AT) < 0.62;
        if (inDoorway) continue;
        put(wallPoint(wall, along, PIPE_HEIGHT), 0.62);
        put(wallPoint(wall, along, PIPE_HEIGHT + 2), 0.42);
      }
    }
    for (const { wall, at, lit } of look.burners) {
      for (let height = 40; height <= PIPE_HEIGHT; height++) {
        put(wallPoint(wall, at, height), 0.72);
        put(wallPoint(wall, at + 0.03, height), 0.5);
      }
      for (let offset = -0.09; offset <= 0.09; offset += 0.02) put(wallPoint(wall, at + offset, 39), 0.8);
      if (lit) {
        const flame = wallPoint(wall, at, 31);
        addFlame(flame, true);
        warm.push({ ...flame, radius: 135, strength: 0.68 });
      }
    }
  }

  for (const { wall, at } of look.candles) {
    for (const offset of [-0.22, 0.22]) {
      for (let height = 14; height <= 19; height++) {
        put(wallPoint(wall, at + offset, height), 0.98);
        put(wallPoint(wall, at + offset + 0.028, height), 0.8);
      }
      addFlame(wallPoint(wall, at + offset, 22), false);
    }
    const middle = wallPoint(wall, at, 16);
    warm.push({ ...middle, radius: 92, strength: 0.58 });
  }

  const growPatch = (centre: Point, spread: number, count: number, salt: number): void => {
    for (let k = 0; k < count; k++) {
      const angle = noise(salt, k) * 6.28;
      const distance = noise(k, salt + 3) * spread;
      const px = Math.floor(centre.x / UNITS_PER_PIXEL + Math.cos(angle) * distance);
      const py = Math.floor(centre.y / UNITS_PER_PIXEL + Math.sin(angle) * distance * 0.5);
      const i = py * ART_WIDTH + px;
      if (i >= 0 && i < PIXELS && material[i] === MATERIAL_STONE) {
        material[i] = MATERIAL_FOXFIRE;
        albedo[i] = noise(px, py);
      }
    }
  };
  for (const patch of look.foxfire) {
    const [tx, ty, spread] = FLOOR_FOXFIRE[patch]!;
    const centre = tilePoint(tx, ty);
    growPatch(centre, spread, spread * 5, patch);
    cold.push({ ...centre, radius: 125, strength: 0.9 });
  }
  if (look.foxfire.length > 0) {
    WALL_FOXFIRE.forEach(([wall, along, height], index) => {
      const centre = wallPoint(wall, along, height);
      growPatch(centre, 6, 28, 10 + index);
      cold.push({ ...centre, radius: 100, strength: 0.75 });
    });
  }

  for (const way of look.ways) {
    if (way.edge === 'backLeft' || way.edge === 'backRight') cutWallWay(way, way.edge, albedo, material);
    else cutFrontWay(way, albedo, material);
    if (way.role !== 'out') continue;
    // The way out is always lit, so the Room always shows where the Party is heading.
    if (way.edge === 'backLeft' || way.edge === 'backRight') {
      for (const offset of [-0.72, 0.72]) addFlame(wallPoint(way.edge, WALL_WAY_AT + offset, 34), true);
      warm.push({ ...wallPoint(way.edge, WALL_WAY_AT, 24), radius: 100, strength: 0.6 });
    } else {
      const along = (offset: number): Point => (way.edge === 'frontRight' ? tilePoint(ROOM_TILES + 0.05, FRONT_WAY_AT + offset) : tilePoint(FRONT_WAY_AT + offset, ROOM_TILES + 0.05));
      for (const offset of [-0.62, 0.62]) {
        const foot = along(offset);
        for (let height = 0; height < 18; height += 1) {
          put({ x: foot.x, y: foot.y - height }, 0.7);
          put({ x: foot.x + 2, y: foot.y - height }, 0.5);
        }
        addFlame({ x: foot.x, y: foot.y - 22 }, true);
      }
      const middle = along(0);
      warm.push({ x: middle.x, y: middle.y - 14, radius: 100, strength: 0.6 });
    }
  }

  if (look.kind === 'guardian') {
    for (let py = 0; py < ART_HEIGHT; py++) {
      for (let px = 0; px < ART_WIDTH; px++) {
        const fromCorner = Math.abs(sceneX(px) - SCENE_WIDTH / 2);
        const y = sceneY(py);
        const i = py * ART_WIDTH + px;
        if (fromCorner < 2.5 && y > LAMP_GLASS_BOTTOM && y < ORIGIN_Y + 3) {
          material[i] = MATERIAL_STONE;
          albedo[i] = 0.42;
        }
        if (fromCorner < 7 && ((y > LAMP_GLASS_BOTTOM && y < LAMP_GLASS_BOTTOM + 4) || (y > LAMP_TOP && y < LAMP_GLASS_TOP))) {
          material[i] = MATERIAL_STONE;
          albedo[i] = 0.55;
        }
        if (fromCorner < 6 && y >= LAMP_GLASS_TOP && y <= LAMP_GLASS_BOTTOM) {
          material[i] = lampLit ? MATERIAL_LAMP : MATERIAL_STONE;
          albedo[i] = 0.16;
        }
      }
    }
    if (lampLit) warm.push({ x: SCENE_WIDTH / 2, y: ORIGIN_Y - 37, radius: 190, strength: 0.85 });
  }

  const warmMap = new Float32Array(PIXELS);
  const coolMap = new Float32Array(PIXELS);
  const lightAt = (lights: readonly Light[], x: number, y: number): number => {
    let total = 0;
    for (const light of lights) {
      const dx = x - light.x;
      const dy = (y - light.y) * 1.45;
      const squared = dx * dx + dy * dy;
      if (squared >= light.radius * light.radius) continue;
      const falloff = 1 - Math.sqrt(squared) / light.radius;
      total += falloff * falloff * light.strength;
    }
    return total;
  };
  for (let py = 0; py < ART_HEIGHT; py++) {
    for (let px = 0; px < ART_WIDTH; px++) {
      const i = py * ART_WIDTH + px;
      if (material[i] === MATERIAL_VOID) continue;
      warmMap[i] = lightAt(warm, sceneX(px), sceneY(py));
      coolMap[i] = Math.min(1, lightAt(cold, sceneX(px), sceneY(py)));
    }
  }
  return { albedo, material, warm: warmMap, cool: coolMap, flames };
}

/** An arch through a back wall. Stairs show as lit treads; a door is a black opening. */
function cutWallWay(way: Way, wall: BackWall, albedo: Float32Array, material: Uint8Array): void {
  const frameValue = way.role === 'out' ? 0.95 : 0.62;
  const onLeft = wall === 'backLeft';
  for (let py = 0; py < ART_HEIGHT; py++) {
    for (let px = 0; px < ART_WIDTH; px++) {
      const i = py * ART_WIDTH + px;
      const x = sceneX(px);
      const y = sceneY(py);
      const a = (x - SCENE_WIDTH / 2) / TILE_HALF_WIDTH;
      if (a < 0 !== onLeft) continue;
      const along = Math.abs(a);
      const height = ORIGIN_Y + along * TILE_HALF_HEIGHT - y;
      const fromMiddle = Math.abs(along - WALL_WAY_AT) * TILE_HALF_WIDTH;
      if (height > 0 && fromMiddle < 21 && height < 30 + Math.sqrt(21 * 21 - fromMiddle * fromMiddle) * 0.8) {
        material[i] = MATERIAL_STONE;
        const inside = fromMiddle < 17 && height < 30 + Math.sqrt(17 * 17 - fromMiddle * fromMiddle) * 0.8;
        if (!inside) albedo[i] = frameValue;
        else if (way.kind === 'stairs') albedo[i] = (height % 6 < 2 ? 0.55 : 0.14) * Math.max(0.1, 1 - height / 46);
        else albedo[i] = 0.02;
        continue;
      }
      // A worn threshold on the floor in front of it.
      const b = (y - ORIGIN_Y) / TILE_HALF_HEIGHT;
      const tx = (a + b) / 2;
      const ty = (b - a) / 2;
      const [depth, sideways] = onLeft ? [tx, ty] : [ty, tx];
      if (depth >= 0 && depth < 0.34 && Math.abs(sideways - WALL_WAY_AT) < 0.5) {
        material[i] = MATERIAL_STONE;
        albedo[i] = 0.95 + noise(px, py) * 0.05;
      }
    }
  }
}

/** A front edge has no wall, so its way is a stone landing running off into the dark. */
function cutFrontWay(way: Way, albedo: Float32Array, material: Uint8Array): void {
  const onRight = way.edge === 'frontRight';
  for (let py = 0; py < ART_HEIGHT; py++) {
    for (let px = 0; px < ART_WIDTH; px++) {
      const i = py * ART_WIDTH + px;
      const a = (sceneX(px) - SCENE_WIDTH / 2) / TILE_HALF_WIDTH;
      const b = (sceneY(py) - ORIGIN_Y) / TILE_HALF_HEIGHT;
      const tx = (a + b) / 2;
      const ty = (b - a) / 2;
      const [outward, sideways] = onRight ? [tx, ty] : [ty, tx];
      if (Math.abs(sideways - FRONT_WAY_AT) >= 0.55) continue;
      const beyond = outward - ROOM_TILES;
      if (beyond >= 0 && beyond < 0.75) {
        material[i] = MATERIAL_STONE;
        const fade = 1 - beyond / 0.75;
        if (way.kind === 'stairs') albedo[i] = (Math.floor(beyond * 14) % 2 ? 0.95 : 0.2) * fade;
        else albedo[i] = (0.8 + noise(px, py) * 0.15) * fade;
      } else if (beyond < 0 && beyond > -0.34) {
        material[i] = MATERIAL_STONE;
        albedo[i] = 0.95 + noise(px, py) * 0.05;
      }
    }
  }
}
