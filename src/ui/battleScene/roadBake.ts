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
import type { RoomLook, ScenePiece, Way, Waymarker } from './roomLook';
import {
  MATERIAL_HEATH,
  MATERIAL_HEATHER,
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

/** Where a set piece stands in a cell around the Room, in the Room's tiles, so it shows past the walls or below the Room. Cells off to the sides show none. */
const PIECE_SPOTS: Readonly<Record<string, readonly [number, number]>> = {
  '-1,0': [-1.9, 2.4],
  '0,-1': [2.4, -1.9],
  '0,1': [1.6, 8.7],
  '1,0': [8.7, 1.6],
  '-1,-1': [-1.7, -1.7],
};

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
  // The road runs from each way to the middle, and on past each way out of sight.
  const segments: Segment[] = look.ways.flatMap((way) => {
    const [ex, ey, fx, fy] = WAY_TILES[way.edge];
    return [
      { ax: fx, ay: fy, bx: ex, by: ey },
      { ax: ex, ay: ey, bx: MIDDLE, by: MIDDLE },
    ];
  });
  /** Pixels the walls cover, so nothing behind them is drawn over them. */
  const walled = new Uint8Array(PIXELS);
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
        walled[i] = 1;
        continue;
      }

      // The scenery runs on past the stage, fading raggedly into the Dark with distance.
      const outside = Math.max(0, -tx, -ty, tx - ROOM_TILES, ty - ROOM_TILES);
      const ragged = outside > 0 ? (smoothNoise(tx * 1.6, ty * 1.6, 60) - 0.5) * 0.5 + (grain - 0.5) * 0.08 : 0;
      const fade = Math.min(1, Math.max(0, 1 - outside / WORLD_FADE + ragged));
      const light = fade * (outside > 0 ? SCENERY_LIGHT : 1);
      // The edge of the Dark is stippled, as the pixel art's light is.
      if (light > 0.04 + STIPPLE[py % 4]![px % 4]! * 0.16) ground(i, px, py, tx, ty, light * light * (3 - 2 * light));
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
    if (px < 0 || py < 0 || px >= ART_WIDTH || py >= ART_HEIGHT || walled[py * ART_WIDTH + px]) return;
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

  // The scenery cells' set pieces.
  for (const cell of look.surroundings) {
    const spot = PIECE_SPOTS[`${cell.dx},${cell.dy}`];
    if (!spot) continue;
    const foot = tilePoint(spot[0], spot[1]);
    drawPiece(cell.piece, Math.floor(foot.x / UNITS_PER_PIXEL), Math.floor(foot.y / UNITS_PER_PIXEL), SCENERY_LIGHT, putBehind);
    // Night on the moor is never quite black: a set piece catches a little of the Act's violet.
    cold.push({ x: foot.x, y: foot.y - 14, radius: 80, strength: 0.6 });
  }

  // The Room's own Waymarkers.
  for (const marker of look.waymarkers) {
    const foot = drawWaymarker(marker, 0, 0, 1, putPixel);
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

type Draw = (px: number, py: number, value: number, kind?: number) => void;

/** Draws a set piece standing at a foot pixel. */
function drawPiece(piece: ScenePiece, fx: number, fy: number, dim: number, draw: Draw): void {
  const at = (dx: number, dy: number, value: number, kind?: number): void => draw(fx + dx, fy + dy, value * dim, kind);
  switch (piece) {
    case 'stones':
      // Standing stones in a broken arc.
      for (const [ox, tall, wide, lift] of [[-11, 7, 3, 0], [-5, 10, 3, -1], [1, 13, 4, -2], [8, 9, 3, -1], [13, 5, 3, 0]] as const) {
        for (let dy = 0; dy < tall; dy++) {
          for (let dx = 0; dx < wide; dx++) {
            if (dy === tall - 1 && wide > 3 && (dx === 0 || dx === wide - 1)) continue;
            at(ox + dx, lift - dy, dy === tall - 1 ? 0.85 : dx === 0 ? 0.72 : dx === wide - 1 ? 0.38 : 0.56);
          }
        }
      }
      return;
    case 'tarn':
      // A peaty pool, with reeds round its far rim.
      for (let dy = -6; dy <= 6; dy++) {
        for (let dx = -15; dx <= 15; dx++) {
          const d = Math.hypot(dx / 15, dy / 6);
          if (d > 1) continue;
          if (d > 0.84) at(dx, dy, 0.3, MATERIAL_HEATH);
          else at(dx, dy, 0.75, MATERIAL_WATER);
        }
      }
      for (const [rx, tall] of [[-12, 4], [-9, 6], [-6, 5], [8, 5], [11, 7], [13, 4]] as const) {
        for (let dy = 0; dy < tall; dy++) at(rx, -4 - dy, 0.62, MATERIAL_HEATH);
      }
      return;
    case 'waystation':
      // A stone hut under slate, with lamp oil tins stacked by the door.
      for (let dy = 0; dy <= 9; dy++) for (let dx = -8; dx <= 8; dx++) at(dx, -dy, dx < 0 ? 0.66 : 0.48);
      for (let row = 0; row < 4; row++) for (let dx = -10 + row; dx <= 10 - row; dx++) at(dx, -10 - row, row === 0 ? 0.5 : 0.32);
      for (let dy = 14; dy <= 16; dy++) for (let dx = 5; dx <= 6; dx++) at(dx, -dy, 0.4);
      for (let dy = 0; dy <= 5; dy++) for (let dx = -3; dx <= -1; dx++) at(dx, -dy, 0.04);
      for (const [ox, oy] of [[10, 0], [12, 0], [14, 0], [11, -2], [13, -2], [12, -4]] as const) {
        at(ox, oy, 0.95);
        at(ox + 1, oy, 0.7);
        at(ox, oy - 1, 0.8);
        at(ox + 1, oy - 1, 0.6);
      }
      return;
    case 'gibbet':
      // A gibbet at a crossroads: post, arm, and an empty cage on its chain.
      for (let dx = -3; dx <= 3; dx++) at(dx, 0, 0.3);
      for (let dy = 1; dy <= 24; dy++) {
        at(0, -dy, 0.55);
        at(1, -dy, 0.36);
      }
      for (let dx = 0; dx <= 9; dx++) at(dx, -24, 0.55);
      for (let k = 1; k <= 3; k++) at(1 + k, -20 - k, 0.45);
      for (let dy = 21; dy <= 23; dy++) at(8, -dy, 0.4);
      for (let dy = 13; dy <= 20; dy++) {
        for (let dx = 6; dx <= 10; dx++) {
          if (dx === 6 || dx === 10 || dx === 8 || dy === 13 || dy === 20) at(dx, -dy, 0.5);
        }
      }
      return;
    case 'moor':
      // Open moor: a few boulders in the heath.
      for (const [ox, oy, wide, tall] of [[-7, 0, 5, 3], [4, 2, 4, 3], [9, -1, 3, 2]] as const) {
        for (let dy = 0; dy < tall; dy++) {
          for (let dx = 0; dx < wide; dx++) {
            if (dy === tall - 1 && (dx === 0 || dx === wide - 1)) continue;
            at(ox + dx, oy - dy, dy === tall - 1 ? 0.8 : dx === 0 ? 0.62 : 0.42);
          }
        }
      }
      return;
  }
}
