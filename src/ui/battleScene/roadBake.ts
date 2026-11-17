import {
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
  type View,
} from './iso';
import type { RoomLook, SceneDetail, Way, Waymarker } from './roomLook';
import { hazeAt, skylineAt } from './sky';
import {
  MATERIAL_HEATH,
  MATERIAL_HEATHER,
  MATERIAL_STONE,
  MATERIAL_WARDGLASS,
  MATERIAL_WATER,
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
/** The road's flagstones, then a stone-lined drainage channel either side. */
const ROAD_HALF_WIDTH = 0.7;
const CHANNEL_OUTER = 0.92;
const KERB = 0.05;
const GATE_HALF_WIDTH = 0.95;
/** How far past the Room the world runs before the Dark takes it all, in tiles. */
const WORLD_FADE = 5.5;
/** The scenery around the stage is a little dimmer than the stage. */
const SCENERY_LIGHT = 0.8;
/** Ordered thresholds for stippling the Dark's edge. */
const STIPPLE = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((row) => row.map((value) => value / 16));
const LAMP_TOP = ORIGIN_Y - 48;
const LAMP_GLASS_TOP = ORIGIN_Y - 44;
const LAMP_GLASS_BOTTOM = ORIGIN_Y - 30;

/** Details keep clear of the road and its channels by this much, in tiles. */
const DETAIL_ROAD_CLEARANCE = 0.45;
/** The dark rim round each detail, so it reads against the heath. */
const DETAIL_RIM = 0.03;

/** Where each way meets its edge, and the way into the Room from there, in tiles. */
const WAY_TILES: Readonly<Record<Edge, readonly [number, number]>> = {
  backLeft: [0, WALL_WAY_AT],
  backRight: [WALL_WAY_AT, 0],
  frontLeft: [FRONT_WAY_AT, ROOM_TILES],
  frontRight: [ROOM_TILES, FRONT_WAY_AT],
};
const INWARD: Readonly<Record<Edge, readonly [number, number]>> = { backLeft: [1, 0], backRight: [0, 1], frontLeft: [0, -1], frontRight: [-1, 0] };
const MIDDLE = ROOM_TILES / 2;
/** Past each way the road runs straight on, well beyond the frame. */
const ROAD_REACH = 24;
/** How far each way's heading carries into the Room before the road bends, so it turns in a sweep a cart could take. */
const TURN_REACH = 2.8;
const TURN_STEPS = 32;
/** The road keeps some light as it runs on into the Dark, so it reads as carrying on past the frame. */
const ROAD_LIGHT = 0.55;
const ROAD_FADE = 14;

/** The road through a Room: straight on past each way, and a smooth curve between the way in and the way out. */
function roadThrough(ways: readonly Way[]): Segment[] {
  const segments: Segment[] = ways.map((way) => {
    const [ex, ey] = WAY_TILES[way.edge];
    const [ix, iy] = INWARD[way.edge];
    return { ax: ex - ix * ROAD_REACH, ay: ey - iy * ROAD_REACH, bx: ex, by: ey };
  });
  const [first, second] = ways;
  if (!first) return segments;
  const [ax, ay] = WAY_TILES[first.edge];
  if (!second) return [...segments, { ax, ay, bx: MIDDLE, by: MIDDLE }];
  const [dx, dy] = WAY_TILES[second.edge];
  const [aix, aiy] = INWARD[first.edge];
  const [dix, diy] = INWARD[second.edge];
  const bx = ax + aix * TURN_REACH;
  const by = ay + aiy * TURN_REACH;
  const cx = dx + dix * TURN_REACH;
  const cy = dy + diy * TURN_REACH;
  const point = (t: number): readonly [number, number] => {
    const u = 1 - t;
    return [u * u * u * ax + 3 * u * u * t * bx + 3 * u * t * t * cx + t * t * t * dx, u * u * u * ay + 3 * u * u * t * by + 3 * u * t * t * cy + t * t * t * dy];
  };
  for (let step = 0; step < TURN_STEPS; step++) {
    const [px, py] = point(step / TURN_STEPS);
    const [qx, qy] = point((step + 1) / TURN_STEPS);
    segments.push({ ax: px, ay: py, bx: qx, by: qy });
  }
  return segments;
}

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

/** How tall the drystone stands at a point along its edge: whole near the far corner, rubble towards the side corners. */
function wallTop(wall: BackWall, along: number): number {
  const end = WALL_END + noise(wall === 'backLeft' ? 1 : 2, 9) * 0.4;
  const coping = DRYSTONE_HEIGHT + (noise(Math.floor(along * 6), 3) > 0.5 ? 2 : 0);
  if (along < end - WALL_RUBBLE) return coping;
  const left = Math.max(0, (end - along) / WALL_RUBBLE);
  return coping * left * (0.6 + noise(Math.floor(along * 9), 17) * 0.4);
}

/** Bakes a Room on the lamp road: flagstones from way to way across heath, low drystone walls, and the moor beyond. */
export function bakeRoad(look: RoomLook, lampLit: boolean, view: View): BakedRoom {
  const albedo = new Float32Array(view.width * view.height);
  const material = new Uint8Array(view.width * view.height);
  const flames: Flame[] = [];
  const warm: Light[] = [];
  const cold: Light[] = [];
  const segments = roadThrough(look.ways);
  const fromRoad = (tx: number, ty: number): number => segments.reduce((nearest, segment) => Math.min(nearest, fromSegment(segment, tx, ty)), Infinity);
  /** Pixels the walls cover, so nothing behind them is drawn over them. */
  const walled = new Uint8Array(view.width * view.height);
  const haze = new Float32Array(view.width * view.height);
  const gapOn = (wall: BackWall): Way | undefined => look.ways.find((way) => way.edge === wall);

  const put = (point: Point, value: number, kind: number = MATERIAL_STONE): void => {
    const vx = Math.floor(point.x / UNITS_PER_PIXEL) - view.left;
    const vy = Math.floor(point.y / UNITS_PER_PIXEL) - view.top;
    if (vx < 0 || vy < 0 || vx >= view.width || vy >= view.height) return;
    const i = vy * view.width + vx;
    material[i] = kind;
    albedo[i] = value;
  };
  const putPixel = (px: number, py: number, value: number, kind: number = MATERIAL_STONE): void => {
    const vx = px - view.left;
    const vy = py - view.top;
    if (vx < 0 || vy < 0 || vx >= view.width || vy >= view.height) return;
    const i = vy * view.width + vx;
    material[i] = kind;
    albedo[i] = value;
  };
  const addFlame = (point: Point, big: boolean): void => {
    flames.push({ x: Math.floor(point.x / UNITS_PER_PIXEL), y: Math.floor(point.y / UNITS_PER_PIXEL), big });
  };

  /** The ground at a tile point, inside the Room or past it: road, channel, or heath. */
  const ground = (i: number, px: number, py: number, tx: number, ty: number, fade: number, distance: number): void => {
    const grain = noise(px, py);
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

  for (let vy = 0; vy < view.height; vy++) {
    const py = vy + view.top;
    for (let vx = 0; vx < view.width; vx++) {
      const px = vx + view.left;
      const i = vy * view.width + vx;
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
        walled[i] = 1;
        continue;
      }

      // The scenery runs on past the stage, fading raggedly into the Dark with distance.
      const outside = Math.max(0, -tx, -ty, tx - ROOM_TILES, ty - ROOM_TILES);
      // Far out, the land rises to a ridge against the night sky.
      const skyline = skylineAt(px, py, outside);
      if (skyline) {
        material[i] = skyline.material;
        albedo[i] = skyline.value;
        continue;
      }
      haze[i] = hazeAt(px, py, outside);
      const ragged = outside > 0 ? (smoothNoise(tx * 1.6, ty * 1.6, 60) - 0.5) * 0.5 + (grain - 0.5) * 0.08 : 0;
      const fade = Math.min(1, Math.max(0, 1 - outside / WORLD_FADE + ragged));
      const distance = fromRoad(tx, ty);
      const onRoad = distance < CHANNEL_OUTER ? ROAD_LIGHT * Math.max(0, 1 - outside / ROAD_FADE) : 0;
      const light = Math.max(onRoad, fade * (outside > 0 ? SCENERY_LIGHT : 1));
      // The edge of the Dark is stippled, as the pixel art's light is.
      if (light > 0.04 + STIPPLE[((py % 4) + 4) % 4]![((px % 4) + 4) % 4]! * 0.16) ground(i, px, py, tx, ty, light * light * (3 - 2 * light), distance);
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

  /** Draws a pixel of the world around the Room, unless a wall stands in front of it. */
  const putBehind = (px: number, py: number, value: number, kind: number = MATERIAL_STONE): void => {
    const vx = px - view.left;
    const vy = py - view.top;
    if (vx < 0 || vy < 0 || vx >= view.width || vy >= view.height || walled[vy * view.width + vx]) return;
    putPixel(px, py, value, kind);
  };

  /** A stone post with a violet pane under an iron cap. Dim scales the stone, not the pane's own light. */
  const drawWaymarker = (marker: Waymarker, ox: number, oy: number, dim: number, draw: Draw): Point => {
    const foot = tilePoint(marker.tx + ox, marker.ty + oy);
    const fx = Math.floor(foot.x / UNITS_PER_PIXEL);
    const fy = Math.floor(foot.y / UNITS_PER_PIXEL);
    for (let dx = -2; dx <= 2; dx++) draw(fx + dx, fy, 0.3 * dim);
    for (let dy = 1; dy <= 11; dy++) {
      draw(fx - 1, fy - dy, 0.78 * dim);
      draw(fx, fy - dy, 0.62 * dim);
      draw(fx + 1, fy - dy, 0.42 * dim);
    }
    for (let dy = 8; dy <= 10; dy++) {
      for (let dx = -1; dx <= 1; dx++) draw(fx + dx, fy - dy, marker.lit ? (dx === -1 && dy === 10 ? 0.9 : 0.4) : 0.06, marker.lit ? MATERIAL_WARDGLASS : MATERIAL_STONE);
    }
    for (let dx = -2; dx <= 2; dx++) draw(fx + dx, fy - 12, 0.46 * dim);
    for (let dx = -1; dx <= 1; dx++) draw(fx + dx, fy - 13, 0.36 * dim);
    return foot;
  };

  // The scenery's ground detail, back to front so nearer detail overlaps farther.
  const details = look.surroundings.flatMap((cell) => cell.details).sort((p, q) => p.tx + p.ty - (q.tx + q.ty));
  for (const [index, detail] of details.entries()) {
    if (fromRoad(detail.tx, detail.ty) < CHANNEL_OUTER + DETAIL_ROAD_CLEARANCE) continue;
    const outside = Math.max(0, -detail.tx, -detail.ty, detail.tx - ROOM_TILES, detail.ty - ROOM_TILES);
    const fade = Math.max(0, 1 - outside / WORLD_FADE);
    const foot = tilePoint(detail.tx, detail.ty);
    drawDetail(detail.kind, Math.floor(foot.x / UNITS_PER_PIXEL), Math.floor(foot.y / UNITS_PER_PIXEL), SCENERY_LIGHT * (0.6 + 0.4 * fade), index, putBehind);
    // Night on the moor is never quite black: the detail catches a little of the Act's violet.
    cold.push({ x: foot.x, y: foot.y - 10, radius: 80, strength: 0.6 + 0.5 * fade });
  }

  // The Room's own Waymarkers.
  for (const marker of look.waymarkers) {
    const foot = drawWaymarker(marker, 0, 0, 1, putPixel);
    if (marker.lit) cold.push({ x: foot.x, y: foot.y - 18, radius: 130, strength: 1 });
  }

  // A Barrier Lamp stands where a Guardian guards it, in ward-glass.
  if (look.kind === 'guardian') {
    for (let vy = 0; vy < view.height; vy++) {
      const py = vy + view.top;
      for (let vx = 0; vx < view.width; vx++) {
        const px = vx + view.left;
        const fromCorner = Math.abs(sceneX(px) - SCENE_WIDTH / 2);
        const y = sceneY(py);
        const i = vy * view.width + vx;
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

  return { albedo, material, flames, coolTint: WARDGLASS_TINT, view, haze, ...lightMaps(view, material, warm, cold) };
}

type Draw = (px: number, py: number, value: number, kind?: number) => void;

/** Draws a piece of ground detail standing at a foot pixel, at the stage's own scale. Salt varies its shape. */
function drawDetail(kind: SceneDetail, fx: number, fy: number, dim: number, salt: number, draw: Draw): void {
  // Drawn into a sketch first, so the detail can take a dark rim, as the figures do.
  const sketch = new Map<string, readonly [number, number, number, number | undefined]>();
  const at = (dx: number, dy: number, value: number, material?: number): void => {
    sketch.set(`${dx},${dy}`, [dx, dy, value, material]);
  };
  const vary = (n: number): number => noise(salt * 7 + n, 31);
  sketchDetail(kind, fx, fy, salt, at, vary);
  for (const [dx, dy] of sketch.values()) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1]] as const) {
      if (!sketch.has(`${dx + ox},${dy + oy}`)) draw(fx + dx + ox, fy + dy + oy, DETAIL_RIM);
    }
  }
  for (const [dx, dy, value, material] of sketch.values()) draw(fx + dx, fy + dy, Math.min(1, value * dim), material);
}

function sketchDetail(kind: SceneDetail, fx: number, fy: number, salt: number, at: (dx: number, dy: number, value: number, material?: number) => void, vary: (n: number) => number): void {
  switch (kind) {
    case 'boulder': {
      // A weathered lump of moor stone, lit from the left, half sunk in the heath.
      const half = 4 + Math.floor(vary(1) * 4);
      const tall = 4 + Math.floor(vary(2) * 4);
      for (let dx = -half - 1; dx <= half + 1; dx++) at(dx, 1, 0.22, MATERIAL_HEATH);
      for (let dx = -half; dx <= half; dx++) {
        const across = dx / half;
        const top = Math.round(tall * Math.sqrt(Math.max(0, 1 - across * across)) * (0.85 + noise(dx + salt, 5) * 0.25));
        for (let dy = 0; dy <= top; dy++) {
          const value = dy >= top - 1 ? 0.82 : across < -0.35 ? 0.68 : across > 0.45 ? 0.36 : 0.52;
          at(dx, -dy, value + (noise(dx + fx, dy + fy) - 0.5) * 0.1);
        }
      }
      // A crack and a lichen fleck.
      const crack = Math.floor((vary(3) - 0.5) * half);
      for (let dy = 0; dy < tall - 2; dy++) at(crack + (dy % 3 === 0 ? 1 : 0), -dy, 0.2);
      at(-Math.floor(half / 2), -tall + 2, 0.6, MATERIAL_HEATH);
      return;
    }
    case 'heather': {
      // A raised mound of heather, darker at its foot.
      const half = 6 + Math.floor(vary(1) * 5);
      const tall = 3 + Math.floor(vary(2) * 3);
      for (let dx = -half; dx <= half; dx++) {
        const across = dx / half;
        const top = Math.round(tall * Math.sqrt(Math.max(0, 1 - across * across)));
        for (let dy = 0; dy <= top; dy++) {
          const speck = noise(dx + fx, dy + fy);
          if (dy === top && speck < 0.35) continue;
          at(dx, -dy, dy === 0 ? 0.35 : 0.55 + speck * 0.4, speck > 0.3 || dy === 0 ? MATERIAL_HEATHER : MATERIAL_HEATH);
        }
      }
      return;
    }
    case 'rubble': {
      // A run of drystone, long fallen, lying along the grain of the land.
      const length = 4 + Math.floor(vary(1) * 4);
      const slope = vary(2) > 0.5 ? 1 : -1;
      for (let stone = 0; stone < length; stone++) {
        const sx = stone * 4 - length * 2;
        const sy = Math.round((stone * 2 - length) * slope);
        const wide = 3 + Math.floor(noise(stone, salt) * 2);
        const tall = 2 + Math.floor(noise(stone, salt + 9) * 3);
        for (let dx = 0; dx < wide; dx++) {
          at(sx + dx, sy + 1, 0.2, MATERIAL_HEATH);
          for (let dy = 0; dy < tall; dy++) at(sx + dx, sy - dy, dy === tall - 1 ? 0.8 : dx === 0 ? 0.64 : dx === wide - 1 ? 0.34 : 0.5);
        }
      }
      return;
    }
    case 'thorn': {
      // A hawthorn bent by the wind, its crown streaming one way.
      const tall = 22 + Math.floor(vary(1) * 10);
      const lean = vary(2) > 0.5 ? 1 : -1;
      for (let dx = -3; dx <= 3; dx++) at(dx, 0, 0.25, MATERIAL_HEATH);
      for (let dy = 0; dy <= tall; dy++) {
        const x = Math.round(lean * (dy / tall) ** 2 * 7);
        at(x, -dy, 0.34);
        if (dy < tall * 0.6) at(x + 1, -dy, 0.2);
      }
      for (const [from, reach] of [[0.45, 6], [0.65, 8], [0.8, 5]] as const) {
        const ry = Math.round(tall * from);
        const rx = Math.round(lean * from * from * 7);
        for (let k = 1; k <= reach; k++) at(rx - lean * Math.round(k * 0.6), -ry - Math.round(k * 0.5), 0.3);
        for (let k = 1; k <= reach + 2; k++) at(rx + lean * k, -ry - Math.round(k * 0.4), 0.3);
      }
      // The crown: tangled twigs with leaf in knots.
      const crownX = Math.round(lean * 7);
      for (let dy = -6; dy <= 4; dy++) {
        for (let dx = -10; dx <= 12; dx++) {
          const d = ((dx - lean * 2) / 11) ** 2 + (dy / 5) ** 2;
          if (d > 1) continue;
          const leaf = noise(dx + fx * 3, dy + salt);
          if (leaf > 0.62) at(crownX + lean * dx, -tall + dy, 0.4 + leaf * 0.35, MATERIAL_HEATH);
          else if (leaf < 0.12) at(crownX + lean * dx, -tall + dy, 0.28);
        }
      }
      return;
    }
  }
}
