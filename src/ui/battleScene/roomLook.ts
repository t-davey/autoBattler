import { FLOORS_PER_ACT, floorAt, type FloorMapView, type Depth, type RoomKind } from '../../sim';
import { WALL_WAY_AT, type BackWall, type Edge } from './iso';

export interface Way {
  readonly edge: Edge;
  /** In is where the Party came from, out is where it goes next. */
  readonly role: 'in' | 'out';
  readonly kind: 'door' | 'stairs';
}

export interface Burner {
  readonly wall: BackWall;
  readonly at: number;
  readonly lit: boolean;
}

export interface Niche {
  readonly wall: BackWall;
  readonly at: number;
}

/** A stone post on the lamp road, standing in a Room at a tile, with violet ward-glass that may be lit. */
export interface Waymarker {
  readonly tx: number;
  readonly ty: number;
  readonly lit: boolean;
}

/** Where a Room is: the Undercroft's crypts, or Act 1's lamp road. Act 3 borrows the crypts until it has a look. */
export type Setting = 'crypt' | 'road';

/** Set pieces for the moor's empty cells around the lamp road. */
export type ScenePiece = 'moor' | 'stones' | 'tarn' | 'waystation' | 'gibbet';

/** One of the 8 cells of scenery around a Room's stage: extra canvas for the world, not another Room. */
export interface Surrounding {
  readonly dx: number;
  readonly dy: number;
  readonly piece: ScenePiece;
}

export interface RoomLook {
  /** The same Room always gets the same key and look. */
  readonly key: string;
  readonly setting: Setting;
  readonly kind: RoomKind;
  readonly ways: readonly Way[];
  /** Empty when this Room has no spigot burners. */
  readonly burners: readonly Burner[];
  /** The burial niches holding tallow candles. */
  readonly candles: readonly Niche[];
  /** Which foxfire patches grow here. Empty on the road. */
  readonly foxfire: readonly number[];
  /** The road's Waymarkers. Empty in the crypts. */
  readonly waymarkers: readonly Waymarker[];
  /** The scenery cells around the Room's stage. Empty in the crypts until they draw it. */
  readonly surroundings: readonly Surrounding[];
}

const WALLS: readonly BackWall[] = ['backLeft', 'backRight'];
const BURNER_SPOTS = [2, WALL_WAY_AT, 6];
const NICHE_SPOTS = [1, 3, 5];
export const FOXFIRE_PATCHES = 6;
const CHANCE_OFF = 0.3;
/** Near the back edges, clear of the ways through at 4 and the Party's path. */
const WAYMARKER_SPOTS = [[0.5, 1.6], [0.5, 6.1], [1.6, 0.5], [6.1, 0.5], [0.5, 2.7], [2.7, 0.5]] as const;
/** The chance a Waymarker is lit on an Act's first Floor and on its last: fewer burn the further the road runs from Town. */
const WAYMARKER_LIT_FIRST = 0.9;
const WAYMARKER_LIT_LAST = 0.2;
/** A lone source has to light the Room by itself. */
const MINIMUM_ALONE = 4;
const MINIMUM_TOGETHER = 2;
/** How often each set piece fills an empty cell: open moor most. */
const PIECES: readonly (readonly [ScenePiece, number])[] = [['moor', 0.35], ['waystation', 0.2], ['stones', 0.15], ['tarn', 0.15], ['gibbet', 0.15]];

const SOURCE_MIXES = [
  { burners: true, candles: false, foxfire: false },
  { burners: false, candles: true, foxfire: false },
  { burners: false, candles: false, foxfire: true },
  { burners: true, candles: true, foxfire: false },
  { burners: true, candles: false, foxfire: true },
  { burners: false, candles: true, foxfire: true },
  { burners: true, candles: true, foxfire: true },
] as const;

const mix = (a: number, b: number): number => {
  let hash = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
};

/** Independent of the sim's RNG: looks draw nothing from the Seed's sequence. */
const roll = (seed: number, ...parts: readonly number[]): number => parts.reduce(mix, seed) / 2 ** 32;

/** Keeps each spot on a fair roll, and always keeps at least the minimum. */
function keep<T>(spots: readonly T[], minimum: number, rollOf: (spot: T) => number): T[] {
  const ranked = spots.map((spot) => ({ spot, value: rollOf(spot) })).sort((a, b) => b.value - a.value);
  return ranked.filter(({ value }, rank) => rank < minimum || value >= CHANCE_OFF).map(({ spot }) => spot);
}

function edgeTowards(from: { x: number; y: number }, to: { x: number; y: number }): Edge {
  if (to.x < from.x) return 'backLeft';
  if (to.x > from.x) return 'frontRight';
  return to.y < from.y ? 'backRight' : 'frontLeft';
}

const OPPOSITE: Readonly<Record<Edge, Edge>> = { backLeft: 'frontRight', frontRight: 'backLeft', backRight: 'frontLeft', frontLeft: 'backRight' };

function waysOf(map: FloorMapView, index: number): Way[] {
  const room = map.rooms[index]!;
  const before = map.rooms[index - 1];
  const after = map.rooms[index + 1];
  const edgeIn = before ? edgeTowards(room, before) : null;
  const edgeOut = after ? edgeTowards(room, after) : null;
  const ways: Way[] = [];
  // A Floor's first Room is reached by stairs, set opposite the way out.
  if (edgeIn) ways.push({ edge: edgeIn, role: 'in', kind: before?.kind === 'stairs' ? 'stairs' : 'door' });
  else if (edgeOut) ways.push({ edge: OPPOSITE[edgeOut], role: 'in', kind: 'stairs' });
  if (edgeOut) ways.push({ edge: edgeOut, role: 'out', kind: room.kind === 'stairs' ? 'stairs' : 'door' });
  else if (room.kind === 'stairs' && edgeIn) ways.push({ edge: OPPOSITE[edgeIn], role: 'out', kind: 'stairs' });
  return ways;
}

/** The chance each Waymarker is lit on this Floor of its Act. */
export function waymarkerLitChance(floorInAct: number): number {
  const deepness = (floorInAct - 1) / (FLOORS_PER_ACT - 1);
  return WAYMARKER_LIT_FIRST + (WAYMARKER_LIT_LAST - WAYMARKER_LIT_FIRST) * deepness;
}

/** Decides a Room's ways through, light sources, and the scenery around it from its Floor layout alone. */
export function roomLookOf(map: FloorMapView, floor: Depth, index: number): RoomLook {
  const layoutSeed = map.rooms.reduce<number>((seed, { x, y }) => mix(mix(seed, x), y), floor);
  const own = ownLookOf(map, floor, index, layoutSeed);
  if (own.setting !== 'road') return own;
  return { ...own, surroundings: surroundingsOf(mix(layoutSeed, index)) };
}

/** The 8 cells around a Room's stage, each with its own set piece. */
function surroundingsOf(seed: number): Surrounding[] {
  const cells: Surrounding[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let pick = roll(seed, 6, dx + 2, dy + 2);
      const piece = PIECES.find(([, weight]) => (pick -= weight) < 0)?.[0] ?? 'moor';
      cells.push({ dx, dy, piece });
    }
  }
  return cells;
}

function ownLookOf(map: FloorMapView, floor: Depth, index: number, layoutSeed: number): RoomLook {
  const room = map.rooms[index]!;
  const seed = mix(layoutSeed, index);
  const ways = waysOf(map, index);
  const sources = SOURCE_MIXES[Math.floor(roll(seed, 1) * SOURCE_MIXES.length)]!;
  const count = Number(sources.burners) + Number(sources.candles) + Number(sources.foxfire);
  const minimum = count === 1 ? MINIMUM_ALONE : MINIMUM_TOGETHER;

  const onWalls = (spots: readonly number[]): { wall: BackWall; at: number }[] => WALLS.flatMap((wall) => spots.map((at) => ({ wall, at })));
  const spotKey = ({ wall, at }: { wall: BackWall; at: number }): number => (wall === 'backLeft' ? 10 : 20) + at;
  const clearOfWays = onWalls(BURNER_SPOTS).filter(({ wall, at }) => !(at === WALL_WAY_AT && ways.some((way) => way.edge === wall)));
  const litBurners = keep(clearOfWays, minimum, (spot) => roll(seed, 2, spotKey(spot)));
  const burners = sources.burners ? clearOfWays.map((spot) => ({ ...spot, lit: litBurners.includes(spot) })) : [];
  const candles = sources.candles ? keep(onWalls(NICHE_SPOTS), minimum, (spot) => roll(seed, 3, spotKey(spot))) : [];
  const position = floorAt(floor);
  const setting: Setting = position.act === 1 ? 'road' : 'crypt';
  // On the road, the cold light is the Waymarkers' rather than Foxfire's.
  const patches = Array.from({ length: FOXFIRE_PATCHES }, (_, patch) => patch);
  const foxfire = sources.foxfire && setting === 'crypt' ? keep(patches, minimum, (patch) => roll(seed, 4, patch)) : [];
  const waymarkers = sources.foxfire && setting === 'road' ? waymarkersOf(seed, waymarkerLitChance(position.floor), minimum) : [];

  return { key: `${floor}:${index}:${seed}`, setting, kind: room.kind, ways, burners, candles, foxfire, waymarkers, surroundings: [] };
}

/** Every spot holds a post. Each is lit on its own roll, and the brightest rolls light the minimum however deep the Floor. */
function waymarkersOf(seed: number, litChance: number, minimum: number): Waymarker[] {
  const rolls = WAYMARKER_SPOTS.map((_, spot) => roll(seed, 5, spot));
  const ranked = rolls.map((value, spot) => ({ value, spot })).sort((a, b) => a.value - b.value);
  const forced = new Set(ranked.slice(0, minimum).map(({ spot }) => spot));
  return WAYMARKER_SPOTS.map(([tx, ty], spot) => ({ tx, ty, lit: forced.has(spot) || rolls[spot]! < litChance }));
}
