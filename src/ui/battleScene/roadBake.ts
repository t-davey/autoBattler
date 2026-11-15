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
/** The walls fall to rubble before they reach the Room's side corners. */
const WALL_END = 6.1;
const WALL_RUBBLE = 0.8;
/** How far the gloaming reaches above the horizon before the Dark takes it. */
const GLOAMING_DEPTH = 34;
/** The road's flagstones, then a stone-lined drainage channel either side. */
const ROAD_HALF_WIDTH = 0.7;
const CHANNEL_OUTER = 0.92;
const KERB = 0.05;
const GATE_HALF_WIDTH = 0.95;
/** How far past the Room the heath runs before the Dark takes it, in tiles: further behind the walls than in front. */
const FADE_FRONT = 1.5;
const FADE_BACK = 2.2;
const LAMP_TOP = ORIGIN_Y - 48;
const LAMP_GLASS_TOP = ORIGIN_Y - 44;
const LAMP_GLASS_BOTTOM = ORIGIN_Y - 30;

/** Where each way meets its edge, and a point well past it, so the road runs on out of sight. */
const WAY_TILES: Readonly<Record<Edge, readonly [number, number, number, number]>> = {
  backLeft: [0, WALL_WAY_AT, -3, WALL_WAY_AT],
  backRight: [WALL_WAY_AT, 0, WALL_WAY_AT, -3],
  frontLeft: [FRONT_WAY_AT, ROOM_TILES, FRONT_WAY_AT, ROOM_TILES + 3],
  frontRight: [ROOM_TILES, FRONT_WAY_AT, ROOM_TILES + 3, FRONT_WAY_AT],
};
const MIDDLE = ROOM_TILES / 2;

interface Segment {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
}

/** Value noise that varies smoothly between whole points, for edges that shouldn't step. */
function smoothNoise(u: number, v: number, salt: number): number {
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  const fu = u - iu;
  const fv = v - iv;
  const su = fu * fu * (3 - 2 * fu);
  const sv = fv * fv * (3 - 2 * fv);
  const top = noise(iu, iv + salt) * (1 - su) + noise(iu + 1, iv + salt) * su;
  const bottom = noise(iu, iv + 1 + salt) * (1 - su) + noise(iu + 1, iv + 1 + salt) * su;
  return top * (1 - sv) + bottom * sv;
}

/** How far a tile point is from a segment, in tiles. */
function fromSegment({ ax, ay, bx, by }: Segment, tx: number, ty: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((tx - ax) * dx + (ty - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(ax + dx * t - tx, ay + dy * t - ty);
}

/** The far moor's skyline, level across the screen rather than along the Room's edges. In scene units from the top. */
const horizonAt = (x: number): number => 34 + 7 * Math.sin(x * 0.011 + 1.3) + 4 * Math.sin(x * 0.029 + 0.4) + 1.5 * Math.sin(x * 0.083);

/** How tall the drystone stands at a point along its edge: whole near the far corner, rubble towards the side corners. */
function wallTop(wall: BackWall, along: number): number {
  const end = WALL_END + noise(wall === 'backLeft' ? 1 : 2, 9) * 0.4;
  const coping = DRYSTONE_HEIGHT + (noise(Math.floor(along * 6), 3) > 0.5 ? 2 : 0);
  if (along < end - WALL_RUBBLE) return coping;
  const left = Math.max(0, (end - along) / WALL_RUBBLE);
  return coping * left * (0.6 + noise(Math.floor(along * 9), 17) * 0.4);
}

/** Bakes a Room on the lamp road: flagstones from way to way across heath, low drystone walls, and the moor beyond. */
export function bakeRoad(look: RoomLook, lampLit: boolean): BakedRoom {
  const albedo = new Float32Array(PIXELS);
  const material = new Uint8Array(PIXELS);
  const flames: Flame[] = [];
  const warm: Light[] = [];
  const cold: Light[] = [];
  const segments: Segment[] = look.ways.flatMap((way) => {
    const [ex, ey, fx, fy] = WAY_TILES[way.edge];
    return [
      { ax: fx, ay: fy, bx: ex, by: ey },
      { ax: ex, ay: ey, bx: MIDDLE, by: MIDDLE },
    ];
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

  /** The ground at a tile point, inside the Room or past it: road, channel, or heath. */
  const ground = (i: number, px: number, py: number, tx: number, ty: number, fade: number): void => {
    const grain = noise(px, py);
    const distance = segments.reduce((nearest, segment) => Math.min(nearest, fromSegment(segment, tx, ty)), Infinity);
    if (distance < ROAD_HALF_WIDTH) {
      const u = tx * 2.4;
      const v = ty * 2.4 + (Math.floor(u) % 2) * 0.5;
      const fu = u - Math.floor(u);
      const fv = v - Math.floor(v);
      if (fu < 0.1 || fv < 0.1) {
        // Grass grows up between the flags.
        material[i] = MATERIAL_HEATH;
        albedo[i] = (0.35 + grain * 0.2) * fade;
        return;
      }
      let value = 0.6 + noise(Math.floor(u), Math.floor(v) + 7) * 0.3 + (grain - 0.5) * 0.12;
      if (fu < 0.18 || fv < 0.18) value *= 1.1;
      // The crown sheds rain to the channels, so the flags darken towards the edges.
      value *= 1 - (distance / ROAD_HALF_WIDTH) * 0.18;
      material[i] = MATERIAL_STONE;
      albedo[i] = value * fade;
      return;
    }
    if (distance < CHANNEL_OUTER) {
      // A drainage channel: dressed kerbstones either side, running water between.
      const across = distance - ROAD_HALF_WIDTH;
      const kerb = across < KERB || across > CHANNEL_OUTER - ROAD_HALF_WIDTH - KERB;
      material[i] = kerb ? MATERIAL_STONE : MATERIAL_WATER;
      albedo[i] = (kerb ? 0.78 + grain * 0.12 : 0.7 + grain * 0.12) * fade;
      return;
    }
    // Heath: peat grass in tufts, heather in clumps.
    const clump = noise(Math.floor(tx * 1.6 + 20), Math.floor(ty * 1.6) + 90);
    if (clump > 0.45 && grain > 0.7 - (clump - 0.45) * 0.6) {
      material[i] = MATERIAL_HEATHER;
      albedo[i] = (0.6 + noise(px + 3, py) * 0.4) * fade;
      return;
    }
    const tuft = noise(Math.floor(px / 2), py);
    material[i] = MATERIAL_HEATH;
    albedo[i] = (0.5 + tuft * 0.3 + (grain - 0.5) * 0.15 - (py % 2 ? 0 : 0.04)) * fade;
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

      // A drystone wall along each back edge, broken by its gate and falling to rubble at its end.
      const along = Math.abs(a);
      const wall: BackWall = a < 0 ? 'backLeft' : 'backRight';
      const height = ORIGIN_Y + along * TILE_HALF_HEIGHT - y;
      const inGap = gapOn(wall) !== undefined && Math.abs(along - WALL_WAY_AT) < GATE_HALF_WIDTH;
      const top = along < ROOM_TILES ? wallTop(wall, along) : 0;
      if (height > 0 && !inGap && height < top) {
        // Uneven courses of field stone, no mortar.
        const shade = a < 0 ? 1 : 0.8;
        const course = Math.floor(height / 5);
        const width = 9 + noise(course, 5) * 5;
        const run = along * TILE_HALF_WIDTH + course * 7 + noise(course, 11) * 6;
        let value = (0.42 + noise(Math.floor(run / width), course) * 0.34 + (grain - 0.5) * 0.1) * shade;
        if (height % 5 < 1.2 || run % width < 1.3) value = 0.12;
        if (height > top - 3) value = (0.7 + noise(Math.floor(along * 6), 4) * 0.2) * shade;
        if (along < 0.08) value = 0.25;
        material[i] = MATERIAL_STONE;
        albedo[i] = value;
        continue;
      }

      // The far moor: a skyline against the last of the light. Nothing on the ground stands above it.
      const above = horizonAt(x) - y;
      if (above > 0) {
        if (above < GLOAMING_DEPTH) {
          const glow = 1 - above / GLOAMING_DEPTH;
          material[i] = MATERIAL_SKY;
          albedo[i] = glow * glow;
        }
        continue;
      }

      // The heath runs on past the Room's edges and fades raggedly into the Dark.
      const behind = Math.max(0, -tx, -ty);
      const beyond = Math.max(0, tx - ROOM_TILES, ty - ROOM_TILES);
      const ragged = behind + beyond > 0 ? (smoothNoise(tx * 2.2, ty * 2.2, 60) - 0.5) * 0.8 + (grain - 0.5) * 0.12 : 0;
      const fade = Math.min(1, Math.max(0, 1 - behind / FADE_BACK - beyond / FADE_FRONT + ragged));
      if (fade > 0.06) ground(i, px, py, tx, ty, fade * fade * (3 - 2 * fade));
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
  for (const { wall, at: spot } of look.candles) {
    // A shrine beside a gate steps aside, clear of its gatepost.
    const besideGate = gapOn(wall) !== undefined && Math.abs(spot - WALL_WAY_AT) < GATE_HALF_WIDTH + 0.3;
    const at = besideGate ? spot + Math.sign(spot - WALL_WAY_AT) * 0.35 : spot;
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
      if (way.role !== 'out') continue;
      // The way out is always lit, so the Room always shows where the Party is heading.
      const along = (offset: number): Point => (way.edge === 'frontRight' ? tilePoint(ROOM_TILES + 0.05, FRONT_WAY_AT + offset) : tilePoint(FRONT_WAY_AT + offset, ROOM_TILES + 0.05));
      if (way.kind === 'stairs') {
        // A milestone beside the road where it runs on.
        const stone = along(1.45);
        for (let height = 0; height <= 12; height++) {
          for (let side = -3; side <= 3; side++) {
            if (height > 9 && Math.abs(side) > 1) continue;
            put({ x: stone.x + side * 2, y: stone.y - height }, side > 1 ? 0.5 : 0.78);
          }
        }
      }
      for (const offset of [-1.1, 1.1]) {
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
