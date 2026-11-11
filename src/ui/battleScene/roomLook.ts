import type { FloorMapView, Depth, RoomKind } from '../../sim';
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

export interface RoomLook {
  /** The same Room always gets the same key and look. */
  readonly key: string;
  readonly kind: RoomKind;
  readonly ways: readonly Way[];
  /** Empty when this Room has no spigot burners. */
  readonly burners: readonly Burner[];
  /** The burial niches holding tallow candles. */
  readonly candles: readonly Niche[];
  /** Which foxfire patches grow here. */
  readonly foxfire: readonly number[];
}

const WALLS: readonly BackWall[] = ['backLeft', 'backRight'];
const BURNER_SPOTS = [2, WALL_WAY_AT, 6];
const NICHE_SPOTS = [1, 3, 5];
export const FOXFIRE_PATCHES = 6;
const CHANCE_OFF = 0.3;
/** A lone source has to light the Room by itself. */
const MINIMUM_ALONE = 4;
const MINIMUM_TOGETHER = 2;

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

/** Decides a Room's ways through and light sources from its Floor layout alone. */
export function roomLookOf(map: FloorMapView, floor: Depth, index: number): RoomLook {
  const room = map.rooms[index]!;
  const layoutSeed = map.rooms.reduce<number>((seed, { x, y }) => mix(mix(seed, x), y), floor);
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
  const patches = Array.from({ length: FOXFIRE_PATCHES }, (_, patch) => patch);
  const foxfire = sources.foxfire ? keep(patches, minimum, (patch) => roll(seed, 4, patch)) : [];

  return { key: `${floor}:${index}:${seed}`, kind: room.kind, ways, burners, candles, foxfire };
}
