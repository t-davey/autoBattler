import { isNumber, isRecord } from './guards';
import { createBattle, maxHealthOf, stepBattle, type BattleEvent, type BattleState, type TeamId } from './battle';
import { CHEST_LINES_BY_ACT } from './content/chests';
import { rollPack } from './content/enemies';
import { guardianFor } from './content/guardian';
import { OIL_BETWEEN_ROOMS } from './content/party';
import type { Rarity } from './content/items';
import { BATTLE_DROP_CHANCE, CHEST_DROP_CHANCE, UNIQUE_DROP_CHANCE } from './content/items';
import { rankValue, type HeroId } from './content/skills';
import { depthTuning } from './depth';
import { generateFloor, isDepth, lampIndexOf, ROOM_KINDS, xpShare, type FloorLayout, type Depth, type RoomKind, type RoomLayout } from './floors';
import { clampToMaximums, gainXp, heroStats, heroUnitSpec, type HeroState } from './heroes';
import { putInStash } from './build';
import { rollItemSpec, uniqueSpec, viewItem, type ItemSpec, type ItemState, type ItemView } from './items';
import { nextFloat, nextInt, type Rng } from './rng';
import { PICKS, type PickId, type PickMoment, type PickTag } from './content/picks';
import { applyPicks, rollPick, viewPick, type PickView } from './picks';
import { floorAt, FLOORS_PER_LAMP, LAMPS } from './content/world';
import { frontierIndex, recordGrowth, recordGuardianKill, recordBestAttempt, recordSetback, runStretch, turnsBackBeforeGuardian, type WallEvent, type WallState } from './wall';

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
  | { readonly type: 'floorEntered'; readonly floor: Depth }
  | { readonly type: 'roomEntered'; readonly floor: Depth; readonly room: number; readonly kind: RoomKind }
  | { readonly type: 'chestOpened'; readonly line: string }
  | { readonly type: 'itemFound'; readonly item: ItemView }
  // A Setback. battleEnded comes first and says how the Battle went; only these two count towards falling back.
  | { readonly type: 'wipe' | 'draw'; readonly floor: Depth; readonly enemyName: string; readonly guardianHealthShare: number | null }
  | { readonly type: 'returnedToTown'; readonly reason: TownReason }
  | { readonly type: 'partySent' }
  | { readonly type: 'pickTaken'; readonly moment: PickMoment; readonly offers: readonly PickView[]; readonly taken: PickView }
  | WallEvent;

export type GameEvent = BattleEvent | RunEvent;
export type EventSink = (event: GameEvent) => void;

export type Phase = 'town' | 'travelling' | 'battle' | 'chest';

/** Where the Party is. floor and layout are null only in Town. */
export interface RunState {
  phase: Phase;
  /** Ticks left of travel, a chest search, or waiting in Town. */
  ticksLeft: number;
  floor: Depth | null;
  layout: FloorLayout | null;
  /** The Room the Party is in, or travelling to. */
  room: number;
  /** The Floor this Run set out to. Null in Town. */
  startFloor: Depth | null;
  /** Taken this Run, in order. They end with it. */
  picks: PickId[];
}

/** The part of the Game that Runs read and change. */
export interface RunWorld {
  readonly rng: Rng;
  /** Its own stream, so offers don't shift the rest of the Run's rolls. */
  readonly pickRng: Rng;
  /** The player's Pick rule: every tag once, earlier tags win. */
  pickPriority: readonly PickTag[];
  readonly heroes: HeroState[];
  battle: BattleState | null;
  readonly run: RunState;
  /** One per Lamp, in order. */
  readonly walls: readonly WallState[];
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
  readonly floor: Depth;
  readonly room: number | 'guardian';
}

const currentRoom = (run: RunState): RoomLayout => run.layout!.rooms[run.room]!;

function travelTo(run: RunState, room: number): void {
  run.phase = 'travelling';
  run.ticksLeft = TRAVEL_TICKS;
  run.room = room;
}

/** Each visit to a Floor draws a new layout. */
function enterFloor(world: RunWorld, floor: Depth): void {
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
  return { phase: 'travelling', ticksLeft: TRAVEL_TICKS, floor: startAt.floor, layout, room, startFloor: startAt.floor, picks: [] };
}

function returnToTown(world: RunWorld, reason: TownReason, sink: EventSink): void {
  const { run } = world;
  run.phase = 'town';
  run.ticksLeft = TOWN_TICKS;
  run.floor = null;
  run.layout = null;
  run.room = 0;
  run.startFloor = null;
  run.picks = [];
  for (const hero of world.heroes) {
    const { maxHealth, maxOil } = heroStats(hero);
    hero.health = maxHealth;
    hero.oil = maxOil;
  }
  sink({ type: 'returnedToTown', reason });
}

/** The Wall the Party is working on, which counts Setbacks and growth. */
export const frontierWall = (walls: readonly WallState[]): WallState => walls[frontierIndex(walls)]!;

/** Sends the Party out from Town, to the Floor after the Lamp it works from: the last lit one, or one earlier after falling back. */
export function sendParty(world: RunWorld, sink: EventSink): void {
  sink({ type: 'partySent' });
  const floor = runStretch(world.walls) * FLOORS_PER_LAMP + 1;
  enterFloor(world, floor);
  world.run.startFloor = floor;
}

/** Offers a Pick and takes one by the rule. */
function takePick(world: RunWorld, moment: PickMoment, sink: EventSink): void {
  const { offers, taken } = rollPick(world.pickRng, moment, world.pickPriority);
  world.run.picks.push(taken);
  sink({ type: 'pickTaken', moment, offers: offers.map(viewPick), taken: viewPick(taken) });
}

/** Only the best Warm Hands in the Party counts. */
function recoveryShare(heroes: readonly HeroState[]): number {
  const rank = Math.max(0, ...heroes.map((hero) => hero.ranks['warm-hands'] ?? 0));
  return RECOVERY_SHARE * (rank > 0 ? 1 + rankValue('warm-hands', rank) / 100 : 1);
}

function leaveRoom(world: RunWorld, sink: EventSink): void {
  const { run, heroes, walls } = world;
  const share = recoveryShare(heroes);
  for (const hero of heroes) {
    const { maxHealth, maxOil } = heroStats(hero);
    hero.health = Math.min(maxHealth, hero.health + maxHealth * share);
    hero.oil = Math.min(maxOil, hero.oil + OIL_BETWEEN_ROOMS);
  }

  const next = run.layout!.rooms[run.room + 1];
  if (next?.kind === 'guardian' && turnsBackBeforeGuardian(walls[lampIndexOf(run.floor!)]!)) returnToTown(world, 'turnedBack', sink);
  else if (next) travelTo(run, run.room + 1);
  else enterFloor(world, run.floor! + 1);
}

function enterRoom(world: RunWorld, sink: EventSink): void {
  const { run } = world;
  const floor = run.floor!;
  const { kind } = currentRoom(run);
  if (run.room === 0) sink({ type: 'floorEntered', floor });
  sink({ type: 'roomEntered', floor, room: run.room, kind });
  // The Run's first Room, so a new Game's first Run gets its Pick too.
  if (run.room === 0 && floor === run.startFloor && run.picks.length === 0) takePick(world, 'setOut', sink);
  if (kind === 'chest') {
    run.phase = 'chest';
    run.ticksLeft = CHEST_TICKS;
    return;
  }
  run.phase = 'battle';
  if (kind === 'guardian') takePick(world, 'guardian', sink);
  const enemies = kind === 'guardian' ? [guardianFor(LAMPS[lampIndexOf(floor)]!)] : rollPack(world.rng, floorAt(floor).act, floorAt(floor).floor, depthTuning(floor).enemyScale);
  // Units take their stats and skills here, so a build change reaches the next Battle.
  const context = { floorsCleared: floor - (run.startFloor ?? floor), guardian: kind === 'guardian' };
  const teams = { [PARTY_TEAM]: world.heroes.map((hero) => applyPicks(heroUnitSpec(hero), run.picks, context)), [ENEMY_TEAM]: enemies };
  const limit = world.battleTicks === null ? {} : { maxTicks: world.battleTicks };
  world.battle = createBattle({ seed: nextInt(world.rng, SEED_RANGE), teams, ...limit });
  sink({ type: 'battleStarted', enemyNames: enemies.map((enemy) => enemy.name) });
}

/** Rolls an item for the Party's Floor, straight into the Stash. */
function dropItem(world: RunWorld, sink: EventSink, rarity?: Exclude<Rarity, 'unique'>, spec: ItemSpec = rollItemSpec(world.rng, world.run.floor!, rarity)): void {
  const item: ItemState = { ...spec, id: world.nextItemId++ };
  putInStash(world, item);
  sink({ type: 'itemFound', item: viewItem(item) });
}

const maybeDropItem = (world: RunWorld, chance: number, sink: EventSink): void => {
  if (nextFloat(world.rng) < chance) dropItem(world, sink);
};

function finishChest(world: RunWorld, sink: EventSink): void {
  const lines = CHEST_LINES_BY_ACT[floorAt(world.run.floor!).act];
  sink({ type: 'chestOpened', line: lines[nextInt(world.rng, lines.length)]! });
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
  if (guardianHealthShare !== null) recordBestAttempt(world.walls[lampIndexOf(world.run.floor!)]!, guardianHealthShare);
  sink({ type, floor: world.run.floor!, enemyName: firstEnemy?.spec.name ?? '', guardianHealthShare });
  recordSetback(frontierWall(world.walls), sink);
  returnToTown(world, 'setback', sink);
}

function reward(world: RunWorld, xp: number, sink: EventSink): void {
  for (const hero of world.heroes) {
    const levels = gainXp(hero, xp * xpShare(hero.level, world.run.floor!));
    for (const level of levels) sink({ type: 'levelUp', heroId: hero.id, heroName: hero.name, level });
    if (levels.length > 0) recordGrowth(frontierWall(world.walls), sink);
  }
}

function guardianFell(world: RunWorld, sink: EventSink): void {
  const relit = recordGuardianKill(world.walls[lampIndexOf(world.run.floor!)]!, sink);
  // The Lamp is lit from the first kill on, so the guaranteed rare comes once. Later kills may drop the Guardian's unique.
  const holds = LAMPS[lampIndexOf(world.run.floor!)]!.holds;
  if (relit) dropItem(world, sink, 'rare');
  else if (holds && nextFloat(world.rng) < UNIQUE_DROP_CHANCE) dropItem(world, sink, undefined, uniqueSpec(holds, world.run.floor!));
  else dropItem(world, sink);
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

// Save validation.

const isRoomKind = (value: unknown): boolean => (ROOM_KINDS as readonly unknown[]).includes(value);
const isRoom = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['x']) && isNumber(value['y']) && isRoomKind(value['kind']);

export function isRunState(value: unknown): value is RunState {
  if (!isRecord(value) || !isNumber(value['ticksLeft']) || !isNumber(value['room'])) return false;
  const { phase, floor, layout, room, startFloor, picks } = value;
  if (!Array.isArray(picks) || !picks.every((id) => typeof id === 'string' && id in PICKS)) return false;
  if (phase === 'town') return floor === null && layout === null && startFloor === null && picks.length === 0;
  if (!isDepth(startFloor)) return false;
  if (phase !== 'travelling' && phase !== 'battle' && phase !== 'chest') return false;
  if (!isDepth(floor) || !isRecord(layout) || !Array.isArray(layout['rooms']) || !layout['rooms'].every(isRoom)) return false;
  return Number.isInteger(room) && (room as number) >= 0 && (room as number) < layout['rooms'].length;
}
