import { createBattle, stepBattle, type BattleEvent, type BattleState, type TeamId } from './battle';
import { CHEST_LINES } from './content/chests';
import { rollPack } from './content/enemies';
import { MOULDERING_WARDEN } from './content/guardian';
import { OIL_BETWEEN_ROOMS } from './content/party';
import { rankValue, type HeroId } from './content/skills';
import { BATTLE_XP, FLOOR_SCALE, generateFloor, type FloorLayout, type FloorNumber, type RoomKind, type RoomLayout } from './floors';
import { gainXp, heroStats, heroUnitSpec, type HeroState } from './heroes';
import { nextInt, type Rng } from './rng';

/** The Team the Party fights on. */
export const PARTY_TEAM = 'a' satisfies TeamId;
export const ENEMY_TEAM = 'b' satisfies TeamId;

const SEED_RANGE = 2 ** 32;
const TRAVEL_TICKS = 50;
const CHEST_TICKS = 200;
const TOWN_TICKS = 100;
const GUARDIAN_XP = 100;
const RECOVERY_SHARE = 0.15;
const RISE_SHARE = 0.2;
export const SETBACKS_TO_FALL_BACK = 3;

export type BattleOutcome = 'won' | 'lost' | 'draw';
export type TownReason = 'setback' | 'turnedBack' | 'lampRelit' | 'guardianFell';

export type RunEvent =
  | { readonly type: 'battleStarted'; readonly enemyNames: readonly string[] }
  | { readonly type: 'battleEnded'; readonly outcome: BattleOutcome }
  | { readonly type: 'levelUp'; readonly heroId: HeroId; readonly heroName: string; readonly level: number }
  | { readonly type: 'heroRose'; readonly heroId: HeroId; readonly heroName: string; readonly health: number }
  | { readonly type: 'floorEntered'; readonly floor: FloorNumber }
  | { readonly type: 'roomEntered'; readonly floor: FloorNumber; readonly room: number; readonly kind: RoomKind }
  | { readonly type: 'chestOpened'; readonly line: string }
  // A Setback. battleEnded comes first and says how the Battle went; only these two count towards falling back.
  | { readonly type: 'wipe' | 'draw'; readonly floor: FloorNumber; readonly enemyName: string }
  | { readonly type: 'returnedToTown'; readonly reason: TownReason }
  | { readonly type: 'partySent' }
  | { readonly type: 'fellBack' }
  | { readonly type: 'retryingGuardian' }
  | { readonly type: 'guardianFell' }
  | { readonly type: 'lampRelit' };

export type GameEvent = BattleEvent | RunEvent;
export type EventSink = (event: GameEvent) => void;

export type Phase = 'town' | 'travelling' | 'battle' | 'chest';

/** Where the Party is. floor and layout are null only in Town. */
export interface RunState {
  phase: Phase;
  /** Ticks left of travel, a chest search, or waiting in Town. */
  ticksLeft: number;
  floor: FloorNumber | null;
  layout: FloorLayout | null;
  /** The Room the Party is in, or travelling to. */
  room: number;
}

export interface WallState {
  lampLit: boolean;
  /** Setbacks since the count last cleared. Stops at SETBACKS_TO_FALL_BACK. */
  setbacks: number;
  fallenBack: boolean;
}

/** The part of the Game that Runs read and change. */
export interface RunWorld {
  readonly rng: Rng;
  readonly heroes: HeroState[];
  battle: BattleState | null;
  readonly run: RunState;
  readonly wall: WallState;
  /** Set by tests to draw Battles early. Null uses the usual limit. */
  readonly battleTicks: number | null;
}

export interface StartAt {
  readonly floor: FloorNumber;
  readonly room: number | 'guardian';
}

const currentRoom = (run: RunState): RoomLayout => run.layout!.rooms[run.room]!;

function travelTo(run: RunState, room: number): void {
  run.phase = 'travelling';
  run.ticksLeft = TRAVEL_TICKS;
  run.room = room;
}

/** Each visit to a Floor draws a new layout. */
function enterFloor(world: RunWorld, floor: FloorNumber): void {
  world.run.floor = floor;
  world.run.layout = generateFloor(nextInt(world.rng, SEED_RANGE), floor);
  travelTo(world.run, 0);
}

/** Where a new Game's Party starts: on its way to Floor 1, or wherever a scenario puts it. */
export function createRun(rng: Rng, startAt: StartAt = { floor: 1, room: 0 }): RunState {
  const layout = generateFloor(nextInt(rng, SEED_RANGE), startAt.floor);
  const last = layout.rooms.length - 1;
  if (startAt.room === 'guardian' && layout.rooms[last]?.kind !== 'guardian') throw new Error(`Floor ${startAt.floor} has no Guardian Room`);
  const room = startAt.room === 'guardian' ? last : Math.min(startAt.room, last);
  return { phase: 'travelling', ticksLeft: TRAVEL_TICKS, floor: startAt.floor, layout, room };
}

function returnToTown(world: RunWorld, reason: TownReason, sink: EventSink): void {
  const { run } = world;
  run.phase = 'town';
  run.ticksLeft = TOWN_TICKS;
  run.floor = null;
  run.layout = null;
  run.room = 0;
  for (const hero of world.heroes) {
    const { maxHealth, maxOil } = heroStats(hero);
    hero.health = maxHealth;
    hero.oil = maxOil;
  }
  sink({ type: 'returnedToTown', reason });
}

/** Sends the Party out from Town. Every Run starts at Floor 1. */
export function sendParty(world: RunWorld, sink: EventSink): void {
  sink({ type: 'partySent' });
  enterFloor(world, 1);
}

/** Ends a fallback, if there is one, giving 3 fresh attempts at the Guardian. */
export function endFallback(wall: WallState, sink: EventSink): void {
  if (!wall.fallenBack) return;
  wall.fallenBack = false;
  wall.setbacks = 0;
  sink({ type: 'retryingGuardian' });
}

function recoveryShare(heroes: readonly HeroState[]): number {
  const rank = heroes.find((hero) => hero.id === 'lamplighter')?.ranks['warm-hands'] ?? 0;
  return RECOVERY_SHARE * (rank > 0 ? 1 + rankValue('warm-hands', rank) / 100 : 1);
}

function leaveRoom(world: RunWorld, sink: EventSink): void {
  const { run, heroes, wall } = world;
  const share = recoveryShare(heroes);
  for (const hero of heroes) {
    const { maxHealth, maxOil } = heroStats(hero);
    hero.health = Math.min(maxHealth, hero.health + maxHealth * share);
    hero.oil = Math.min(maxOil, hero.oil + OIL_BETWEEN_ROOMS);
  }

  const next = run.layout!.rooms[run.room + 1];
  if (next?.kind === 'guardian' && wall.fallenBack) returnToTown(world, 'turnedBack', sink);
  else if (next) travelTo(run, run.room + 1);
  else enterFloor(world, (run.floor! + 1) as FloorNumber);
}

function enterRoom(world: RunWorld, sink: EventSink): void {
  const { run } = world;
  const floor = run.floor!;
  const { kind } = currentRoom(run);
  if (run.room === 0) sink({ type: 'floorEntered', floor });
  sink({ type: 'roomEntered', floor, room: run.room, kind });
  if (kind === 'chest') {
    run.phase = 'chest';
    run.ticksLeft = CHEST_TICKS;
    return;
  }
  run.phase = 'battle';
  const enemies = kind === 'guardian' ? [MOULDERING_WARDEN] : rollPack(world.rng, FLOOR_SCALE[floor]);
  // Units take their stats and skills here, so a build change reaches the next Battle.
  const teams = { [PARTY_TEAM]: world.heroes.map(heroUnitSpec), [ENEMY_TEAM]: enemies };
  const limit = world.battleTicks === null ? {} : { maxTicks: world.battleTicks };
  world.battle = createBattle({ seed: nextInt(world.rng, SEED_RANGE), teams, ...limit });
  sink({ type: 'battleStarted', enemyNames: enemies.map((enemy) => enemy.name) });
}

function finishChest(world: RunWorld, sink: EventSink): void {
  sink({ type: 'chestOpened', line: CHEST_LINES[nextInt(world.rng, CHEST_LINES.length)]! });
  leaveRoom(world, sink);
}

/** Every Hero dead is a Wipe, even if the last enemy fell on the same Tick. */
function outcomeOf(battle: BattleState): BattleOutcome {
  if (battle.winner === PARTY_TEAM) return 'won';
  return battle.units.some((unit) => unit.team === PARTY_TEAM && unit.health > 0) ? 'draw' : 'lost';
}

function setback(world: RunWorld, type: 'wipe' | 'draw', battle: BattleState, sink: EventSink): void {
  const { wall } = world;
  const firstEnemy = battle.units.find((unit) => unit.team === ENEMY_TEAM);
  sink({ type, floor: world.run.floor!, enemyName: firstEnemy?.spec.name ?? '' });
  if (!wall.fallenBack) {
    wall.setbacks++;
    if (wall.setbacks >= SETBACKS_TO_FALL_BACK) {
      wall.fallenBack = true;
      sink({ type: 'fellBack' });
    }
  }
  returnToTown(world, 'setback', sink);
}

function reward(world: RunWorld, xp: number, sink: EventSink): void {
  for (const hero of world.heroes) {
    const levels = gainXp(hero, xp);
    for (const level of levels) sink({ type: 'levelUp', heroId: hero.id, heroName: hero.name, level });
    if (levels.length > 0) endFallback(world.wall, sink);
  }
}

function guardianFell(world: RunWorld, sink: EventSink): void {
  const { wall } = world;
  sink({ type: 'guardianFell' });
  wall.setbacks = 0;
  wall.fallenBack = false;
  const relit = !wall.lampLit;
  wall.lampLit = true;
  if (relit) sink({ type: 'lampRelit' });
  returnToTown(world, relit ? 'lampRelit' : 'guardianFell', sink);
}

/** Health and Oil carry out of the Battle, and a Hero who fell in a win rises. Effects and cooldowns end with it. */
function carryOut(world: RunWorld, battle: BattleState, won: boolean, sink: EventSink): void {
  for (const hero of world.heroes) {
    const unit = battle.units.find((candidate) => candidate.spec.id === hero.id);
    if (!unit) continue;
    hero.oil = unit.oil;
    hero.health = unit.health;
    if (won && unit.health <= 0) {
      hero.health = heroStats(hero).maxHealth * RISE_SHARE;
      sink({ type: 'heroRose', heroId: hero.id, heroName: hero.name, health: hero.health });
    }
  }
}

function finishBattle(world: RunWorld, battle: BattleState, sink: EventSink): void {
  const outcome = outcomeOf(battle);
  world.battle = null;
  sink({ type: 'battleEnded', outcome });
  carryOut(world, battle, outcome === 'won', sink);
  if (outcome !== 'won') {
    setback(world, outcome === 'lost' ? 'wipe' : 'draw', battle, sink);
    return;
  }
  const { run } = world;
  const isGuardian = currentRoom(run).kind === 'guardian';
  reward(world, isGuardian ? GUARDIAN_XP : BATTLE_XP[run.floor!], sink);
  if (isGuardian) guardianFell(world, sink);
  else leaveRoom(world, sink);
}

/** One Tick of the Party's Run. */
export function stepRun(world: RunWorld, sink: EventSink): void {
  const { run } = world;
  switch (run.phase) {
    case 'battle': {
      const battle = world.battle!;
      for (const event of stepBattle(battle)) sink(event);
      if (battle.over) finishBattle(world, battle, sink);
      return;
    }
    case 'travelling':
      if (--run.ticksLeft <= 0) enterRoom(world, sink);
      return;
    case 'chest':
      if (--run.ticksLeft <= 0) finishChest(world, sink);
      return;
    case 'town':
      if (--run.ticksLeft <= 0) sendParty(world, sink);
      return;
  }
}
