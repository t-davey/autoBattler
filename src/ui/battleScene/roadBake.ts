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
  type Edge,
  type Point,
} from './iso';
import type { RoomLook, Way } from './roomLook';
import {
  MATERIAL_HEATH,
  MATERIAL_HEATHER,
  MATERIAL_SKY,
  MATERIAL_STONE,
  MATERIAL_WARDGLASS,
  MATERIAL_WATER,
  PIXELS,
  cutFrontWay,
  lightMaps,
  noise,
  sceneX,
  sceneY,
  type BakedRoom,
  type CoolTint,
  type Flame,
  type Light,
} from './roomBake';

/** Heather violet, from the Barrier Lamps' ward-glass. docs/lore/bible.md#the-lamp-road. */
const WARDGLASS_TINT: CoolTint = { stone: [70, 38, 98], water: [76, 42, 108], unit: [40, 22, 54] };

/** The drystone walls stand low, so the moor shows over them. */
const DRYSTONE_HEIGHT = 20;
/** How far the gloaming reaches above the ridges before the Dark takes it. */
const GLOAMING_DEPTH = 30;
const ROAD_HALF_WIDTH = 1.05;
const GATE_HALF_WIDTH = 0.62;
const LAMP_TOP = ORIGIN_Y - 48;
const LAMP_GLASS_TOP = ORIGIN_Y - 44;
const LAMP_GLASS_BOTTOM = ORIGIN_Y - 30;

const WAY_TILES: Readonly<Record<Edge, readonly [number, number]>> = {
  backLeft: [0, WALL_WAY_AT],
  backRight: [WALL_WAY_AT, 0],
  frontLeft: [FRONT_WAY_AT, ROOM_TILES],
  frontRight: [ROOM_TILES, FRONT_WAY_AT],
};
const MIDDLE = ROOM_TILES / 2;

interface Segment {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
}

/** How far a tile point is from a segment, and which side of it, in tiles. */
function fromSegment({ ax, ay, bx, by }: Segment, tx: number, ty: number): { distance: number; side: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((tx - ax) * dx + (ty - ay) * dy) / (dx * dx + dy * dy)));
  const px = ax + dx * t - tx;
  const py = ay + dy * t - ty;
  const length = Math.hypot(dx, dy);
  return { distance: Math.hypot(px, py), side: (dx * (ty - ay) - dy * (tx - ax)) / length };
}

/** Where the moor's ridges stand above a back edge, as a height over the floor. */
const ridgeAt = (wall: BackWall, along: number): number =>
  36 + 8 * Math.sin(along * 0.85 + (wall === 'backLeft' ? 1.2 : 4.1)) + 4 * Math.sin(along * 2.3 + 0.7) + 1.5 * Math.sin(along * 7.1);

/** Bakes a Room on the lamp road: flagstones from way to way across heath, low drystone walls, and the moor beyond. */
export function bakeRoad(look: RoomLook, lampLit: boolean): BakedRoom {
  const albedo = new Float32Array(PIXELS);
  const material = new Uint8Array(PIXELS);
  const flames: Flame[] = [];
  const warm: Light[] = [];
  const cold: Light[] = [];
  const segments: Segment[] = look.ways.map((way) => {
    const [ax, ay] = WAY_TILES[way.edge];
    return { ax, ay, bx: MIDDLE, by: MIDDLE };
  });
  const gapOn = (wall: BackWall): Way | undefined => look.ways.find((way) => way.edge === wall);

  const put = (point: Point, value: number, kind: number = MATERIAL_STONE): void => {
    const px = Math.floor(point.x / UNITS_PER_PIXEL);
    const py = Math.floor(point.y / UNITS_PER_PIXEL);
    if (px < 0 || py < 0 || px >= ART_WIDTH || py >= ART_HEIGHT) return;
    const i = py * ART_WIDTH + px;
    material[i] = kind;
    albedo[i] = value;
  };
  const putPixel = (px: number, py: number, value: number, kind: number = MATERIAL_STONE): void => {
    if (px < 0 || py < 0 || px >= ART_WIDTH || py >= ART_HEIGHT) return;
    const i = py * ART_WIDTH + px;
    material[i] = kind;
    albedo[i] = value;
  };
  const addFlame = (point: Point, big: boolean): void => {
    flames.push({ x: Math.floor(point.x / UNITS_PER_PIXEL), y: Math.floor(point.y / UNITS_PER_PIXEL), big });
  };

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
        const near = segments.map((segment) => fromSegment(segment, tx, ty)).sort((p, q) => p.distance - q.distance)[0];
        const ragged = (noise(Math.floor(tx * 6), Math.floor(ty * 6)) - 0.5) * 0.3;
        if (near && near.distance < ROAD_HALF_WIDTH + ragged) {
          // Cart ruts run either side of the crown, and hold rainwater.
          const inRut = Math.abs(Math.abs(near.side) - 0.48) < 0.09;
          if (inRut && noise(Math.floor(tx * 3), Math.floor(ty * 3) + 40) > 0.62) {
            material[i] = MATERIAL_WATER;
            albedo[i] = 0.75 + grain * 0.1;
            continue;
          }
          const u = tx * 2.4;
          const v = ty * 2.4 + (Math.floor(u) % 2) * 0.5;
          const fu = u - Math.floor(u);
          const fv = v - Math.floor(v);
          const stone = noise(Math.floor(u), Math.floor(v) + 7);
          let value = 0.6 + stone * 0.3 + (grain - 0.5) * 0.12;
          if (fu < 0.1 || fv < 0.1) {
            // Grass grows up between the flags.
            material[i] = MATERIAL_HEATH;
            albedo[i] = 0.35 + grain * 0.2;
            continue;
          }
          if (inRut) value *= 0.62;
          else if (fu < 0.18 || fv < 0.18) value *= 1.1;
          material[i] = MATERIAL_STONE;
          albedo[i] = value;
          continue;
        }
        // Heath: peat grass in tufts, heather in clumps.
        const clump = noise(Math.floor(tx * 1.6), Math.floor(ty * 1.6) + 90);
        if (clump > 0.45 && grain > 0.7 - (clump - 0.45) * 0.6) {
          material[i] = MATERIAL_HEATHER;
          albedo[i] = 0.6 + noise(px + 3, py) * 0.4;
          continue;
        }
        const tuft = noise(Math.floor(px / 2), py);
        material[i] = MATERIAL_HEATH;
        albedo[i] = 0.5 + tuft * 0.3 + (grain - 0.5) * 0.15 - (py % 2 ? 0 : 0.04);
        continue;
      }

      // The front bank: the road's earth cut away where the Room ends.
      const slabB = (y - 10 - ORIGIN_Y) / TILE_HALF_HEIGHT;
      const slabX = (a + slabB) / 2;
      const slabY = (slabB - a) / 2;
      if (slabX >= 0 && slabY >= 0 && slabX < ROOM_TILES && slabY < ROOM_TILES && b > 0) {
        material[i] = MATERIAL_HEATH;
        albedo[i] = 0.2 + grain * 0.08 - (Math.floor(y / 5) % 2 ? 0 : 0.05);
        continue;
      }

      const along = Math.abs(a);
      const wall: BackWall = a < 0 ? 'backLeft' : 'backRight';
      const height = ORIGIN_Y + along * TILE_HALF_HEIGHT - y;
      if (along >= ROOM_TILES || height <= 0) continue;
      const shade = a < 0 ? 1 : 0.8;
      const ridge = ridgeAt(wall, along);
      const gap = gapOn(wall);
      const inGap = gap !== undefined && Math.abs(along - WALL_WAY_AT) < GATE_HALF_WIDTH;
      const course = Math.floor(height / 5);
      const coping = DRYSTONE_HEIGHT + (noise(Math.floor(along * 6), 3) > 0.5 ? 2 : 0);

      if (!inGap && height < coping) {
        // Drystone: uneven courses of field stone, no mortar.
        const run = along * TILE_HALF_WIDTH + course * 7 + noise(course, 11) * 6;
        const stone = Math.floor(run / (9 + noise(course, 5) * 5));
        let value = (0.42 + noise(stone, course) * 0.34 + (grain - 0.5) * 0.1) * shade;
        if (height % 5 < 1.2 || run % (9 + noise(course, 5) * 5) < 1.3) value = 0.12;
        if (height > coping - 3) value = (0.7 + noise(Math.floor(along * 6), 4) * 0.2) * shade;
        if (along < 0.08) value = 0.25;
        material[i] = MATERIAL_STONE;
        albedo[i] = value;
        continue;
      }
      if (inGap && height < ridge - 6) {
        // The road runs on through the gate and away into the dark.
        const fade = Math.max(0, 1 - height / 26);
        const fromMiddle = Math.abs(along - WALL_WAY_AT);
        const onRoad = fromMiddle < 0.45 - height * 0.006;
        material[i] = onRoad ? MATERIAL_STONE : MATERIAL_HEATH;
        albedo[i] = (onRoad ? 0.6 + noise(px, Math.floor(height / 3)) * 0.2 : 0.35 + grain * 0.15) * fade;
        if (fade <= 0) material[i] = MATERIAL_SKY;
        continue;
      }
      if (height < ridge) {
        material[i] = MATERIAL_SKY;
        albedo[i] = 0;
        continue;
      }
      const glow = 1 - (height - ridge) / GLOAMING_DEPTH;
      if (glow <= 0 || height > WALL_HEIGHT + 20) continue;
      material[i] = MATERIAL_SKY;
      albedo[i] = glow * glow;
    }
  }

  // Waystation lanterns, on posts against the wall.
  for (const { wall, at, lit } of look.burners) {
    for (let height = 0; height <= 26; height++) {
      put(wallPoint(wall, at, height), 0.5);
      put(wallPoint(wall, at + 0.03, height), 0.34);
    }
    for (let height = 26; height <= 33; height++) {
      for (let offset = -0.07; offset <= 0.07; offset += 0.028) {
        const edge = Math.abs(offset) > 0.05 || height === 26 || height === 33;
        put(wallPoint(wall, at + offset, height), edge ? 0.62 : lit ? 0.95 : 0.08);
      }
    }
    if (lit) {
      const flame = wallPoint(wall, at, 29);
      addFlame(flame, false);
      warm.push({ ...flame, radius: 125, strength: 0.62 });
    }
  }

  // Wayside shrines: a niche in the drystone with tallow stubs.
  for (const { wall, at } of look.candles) {
    for (let height = 3; height <= 17; height++) {
      for (let offset = -0.2; offset <= 0.2; offset += 0.014) {
        const fromMiddle = Math.abs(offset) * TILE_HALF_WIDTH;
        if (height > 12 + Math.sqrt(Math.max(0, 7.2 * 7.2 - fromMiddle * fromMiddle)) * 0.6) continue;
        put(wallPoint(wall, at + offset, height), Math.abs(offset) > 0.17 ? 0.75 : 0.05);
      }
    }
    for (const offset of [-0.07, 0.07]) {
      for (let height = 4; height <= 7; height++) put(wallPoint(wall, at + offset, height), 0.98);
      addFlame(wallPoint(wall, at + offset, 9), false);
    }
    warm.push({ ...wallPoint(wall, at, 8), radius: 84, strength: 0.52 });
  }

  for (const way of look.ways) {
    if (way.edge === 'frontLeft' || way.edge === 'frontRight') {
      cutFrontWay(way, albedo, material);
      if (way.role !== 'out') continue;
      // The way out is always lit, so the Room always shows where the Party is heading.
      const along = (offset: number): Point => (way.edge === 'frontRight' ? tilePoint(ROOM_TILES + 0.05, FRONT_WAY_AT + offset) : tilePoint(FRONT_WAY_AT + offset, ROOM_TILES + 0.05));
      for (const offset of [-0.62, 0.62]) {
        const foot = along(offset);
        for (let height = 0; height < 18; height++) {
          put({ x: foot.x, y: foot.y - height }, 0.7);
          put({ x: foot.x + 2, y: foot.y - height }, 0.5);
        }
        addFlame({ x: foot.x, y: foot.y - 22 }, true);
      }
      const middle = along(0);
      warm.push({ x: middle.x, y: middle.y - 14, radius: 100, strength: 0.6 });
      continue;
    }
    // Gateposts either side of the gap. Stairs show as a milestone where the road runs on.
    const wall = way.edge;
    const lit = way.role === 'out';
    for (const offset of [-GATE_HALF_WIDTH, GATE_HALF_WIDTH]) {
      const top = lit ? 24 : 26;
      for (let height = 0; height <= top; height++) {
        put(wallPoint(wall, WALL_WAY_AT + offset, height), height > top - 2 ? 0.85 : 0.62);
        put(wallPoint(wall, WALL_WAY_AT + offset + 0.03, height), 0.44);
        put(wallPoint(wall, WALL_WAY_AT + offset - 0.03, height), 0.54);
      }
      if (lit) {
        for (let height = 25; height <= 30; height++) {
          for (let side = -0.05; side <= 0.05; side += 0.025) put(wallPoint(wall, WALL_WAY_AT + offset + side, height), Math.abs(side) > 0.03 ? 0.62 : 0.95);
        }
        addFlame(wallPoint(wall, WALL_WAY_AT + offset, 28), true);
      }
    }
    if (way.kind === 'stairs') {
      const at = WALL_WAY_AT + GATE_HALF_WIDTH + 0.3;
      for (let height = 0; height <= 12; height++) {
        for (let side = -0.1; side <= 0.1; side += 0.02) {
          const round = height > 9 && Math.abs(side) > 0.06;
          if (!round) put(wallPoint(wall, at + side, height), side > 0.05 ? 0.5 : 0.78);
        }
      }
    }
    if (lit) warm.push({ ...wallPoint(wall, WALL_WAY_AT, 20), radius: 100, strength: 0.6 });
  }

  // Waymarkers: stone posts with a violet pane under an iron cap.
  for (const marker of look.waymarkers) {
    const foot = tilePoint(marker.tx, marker.ty);
    const fx = Math.floor(foot.x / UNITS_PER_PIXEL);
    const fy = Math.floor(foot.y / UNITS_PER_PIXEL);
    for (let dx = -2; dx <= 2; dx++) putPixel(fx + dx, fy, 0.3);
    for (let dy = 1; dy <= 11; dy++) {
      putPixel(fx - 1, fy - dy, 0.78);
      putPixel(fx, fy - dy, 0.62);
      putPixel(fx + 1, fy - dy, 0.42);
    }
    for (let dy = 8; dy <= 10; dy++) {
      for (let dx = -1; dx <= 1; dx++) putPixel(fx + dx, fy - dy, marker.lit ? (dx === -1 && dy === 10 ? 0.9 : 0.4) : 0.06, marker.lit ? MATERIAL_WARDGLASS : MATERIAL_STONE);
    }
    for (let dx = -2; dx <= 2; dx++) putPixel(fx + dx, fy - 12, 0.46);
    for (let dx = -1; dx <= 1; dx++) putPixel(fx + dx, fy - 13, 0.36);
    if (marker.lit) cold.push({ x: foot.x, y: foot.y - 18, radius: 130, strength: 1 });
  }

  // A Barrier Lamp stands where a Guardian guards it, in ward-glass.
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
          material[i] = lampLit ? MATERIAL_WARDGLASS : MATERIAL_STONE;
          albedo[i] = lampLit ? noise(px, py) : 0.16;
        }
      }
    }
    if (lampLit) {
      cold.push({ x: SCENE_WIDTH / 2, y: ORIGIN_Y - 37, radius: 230, strength: 1.1 });
      warm.push({ x: SCENE_WIDTH / 2, y: ORIGIN_Y - 37, radius: 120, strength: 0.3 });
    }
  }

  return { albedo, material, flames, coolTint: WARDGLASS_TINT, ...lightMaps(material, warm, cold) };
}
