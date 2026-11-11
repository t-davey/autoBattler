import { createBattle, maxHealthOf, stepBattle, type BattleEvent, type BattleState, type TeamId } from './battle';
import { CHEST_LINES } from './content/chests';
import { rollPack } from './content/enemies';
import { MOULDERING_WARDEN } from './content/guardian';
import { OIL_BETWEEN_ROOMS } from './content/party';
import type { Rarity } from './content/items';
import { BATTLE_DROP_CHANCE, CHEST_DROP_CHANCE } from './content/items';
import { rankValue, type HeroId } from './content/skills';
import { depthTuning } from './depth';
import { generateFloor, xpShare, type FloorLayout, type FloorNumber, type RoomKind, type RoomLayout } from './floors';
import { clampToMaximums, gainXp, heroStats, heroUnitSpec, type HeroState } from './heroes';
import { rollItemSpec, viewItem, type ItemState, type ItemView } from './items';
import { nextFloat, nextInt, type Rng } from './rng';
import { recordGrowth, recordGuardianKill, recordBestAttempt, recordSetback, turnsBackBeforeGuardian, type WallEvent, type WallState } from './wall';

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
  | { readonly type: 'itemFound'; readonly item: ItemView }
  // A Setback. battleEnded comes first and says how the Battle went; only these two count towards falling back.
  | { readonly type: 'wipe' | 'draw'; readonly floor: FloorNumber; readonly enemyName: string; readonly guardianHealthShare: number | null }
  | { readonly type: 'returnedToTown'; readonly reason: TownReason }
  | { readonly type: 'partySent' }
  | WallEvent;

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

/** The part of the Game that Runs read and change. */
export interface RunWorld {
  readonly rng: Rng;
  readonly heroes: HeroState[];
  battle: BattleState | null;
  readonly run: RunState;
  readonly wall: WallState;
  /** Unequipped items, in the order they arrived here. */
  readonly stash: ItemState[];
  /** The id the next item takes. */
  nextItemId: number;
  /** Counts changes to the Stash. */
  stashRevision: number;
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
  if (next?.kind === 'guardian' && turnsBackBeforeGuardian(wall)) returnToTown(world, 'turnedBack', sink);
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
  const enemies = kind === 'guardian' ? [MOULDERING_WARDEN] : rollPack(world.rng, depthTuning(floor).enemyScale);
  // Units take their stats and skills here, so a build change reaches the next Battle.
  const teams = { [PARTY_TEAM]: world.heroes.map(heroUnitSpec), [ENEMY_TEAM]: enemies };
  const limit = world.battleTicks === null ? {} : { maxTicks: world.battleTicks };
  world.battle = createBattle({ seed: nextInt(world.rng, SEED_RANGE), teams, ...limit });
  sink({ type: 'battleStarted', enemyNames: enemies.map((enemy) => enemy.name) });
}

/** Rolls an item for the Party's Floor, straight into the Stash. */
function dropItem(world: RunWorld, sink: EventSink, rarity?: Rarity): void {
  const item: ItemState = { ...rollItemSpec(world.rng, world.run.floor!, rarity), id: world.nextItemId++ };
  world.stash.push(item);
  world.stashRevision++;
  sink({ type: 'itemFound', item: viewItem(item) });
}

const maybeDropItem = (world: RunWorld, chance: number, sink: EventSink): void => {
  if (nextFloat(world.rng) < chance) dropItem(world, sink);
};

function finishChest(world: RunWorld, sink: EventSink): void {
  sink({ type: 'chestOpened', line: CHEST_LINES[nextInt(world.rng, CHEST_LINES.length)]! });
  maybeDropItem(world, CHEST_DROP_CHANCE, sink);
  leaveRoom(world, sink);
}

/** Every Hero dead is a Wipe, even if the last enemy fell on the same Tick. */
function outcomeOf(battle: BattleState): BattleOutcome {
  if (battle.winner === PARTY_TEAM) return 'won';
  return battle.units.some((unit) => unit.team === PARTY_TEAM && unit.health > 0) ? 'draw' : 'lost';
}

function setback(world: RunWorld, type: 'wipe' | 'draw', battle: BattleState, sink: EventSink): void {
  const firstEnemy = battle.units.find((unit) => unit.team === ENEMY_TEAM);
  const guardianHealthShare = firstEnemy && currentRoom(world.run).kind === 'guardian' ? Math.max(0, firstEnemy.health) / maxHealthOf(firstEnemy) : null;
  if (guardianHealthShare !== null) recordBestAttempt(world.wall, guardianHealthShare);
  sink({ type, floor: world.run.floor!, enemyName: firstEnemy?.spec.name ?? '', guardianHealthShare });
  recordSetback(world.wall, sink);
  returnToTown(world, 'setback', sink);
}

function reward(world: RunWorld, xp: number, sink: EventSink): void {
  for (const hero of world.heroes) {
    const levels = gainXp(hero, xp * xpShare(hero.level, world.run.floor!));
    for (const level of levels) sink({ type: 'levelUp', heroId: hero.id, heroName: hero.name, level });
    if (levels.length > 0) recordGrowth(world.wall, sink);
  }
}

function guardianFell(world: RunWorld, sink: EventSink): void {
  const relit = recordGuardianKill(world.wall, sink);
  // The Lamp is lit from the first kill on, so the guaranteed rare comes once.
  dropItem(world, sink, relit ? 'rare' : undefined);
  returnToTown(world, relit ? 'lampRelit' : 'guardianFell', sink);
}

/** Health and Oil carry out of the Battle, and a Hero who fell in a win rises. Effects and cooldowns end with it. */
function carryOut(world: RunWorld, battle: BattleState, won: boolean, sink: EventSink): void {
  for (const hero of world.heroes) {
    const unit = battle.units.find((candidate) => candidate.spec.id === hero.id);
    if (!unit) continue;
    hero.oil = unit.oil;
    hero.health = unit.health;
    // Gear changed mid-Battle reaches the next one, but its new maximums apply now.
    clampToMaximums(hero);
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
  reward(world, isGuardian ? GUARDIAN_XP : depthTuning(run.floor!).battleXp, sink);
  if (isGuardian) {
    guardianFell(world, sink);
    return;
  }
  maybeDropItem(world, BATTLE_DROP_CHANCE, sink);
  leaveRoom(world, sink);
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
