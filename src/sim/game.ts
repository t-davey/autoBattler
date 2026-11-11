import type { UnitSpec } from './battle';
import { AFFIXES, ITEM_BASES, RARITIES, SLOTS, type Rarity, type Slot } from './content/items';
import { CLASSES, HERO_IDS, MAX_NAME_LENGTH } from './content/party';
import { isSkillId, MAX_SKILL_RANK, SKILLS, type HeroId, type SkillId } from './content/skills';
import { isDepth, ROOM_KINDS } from './floors';
import { clampToMaximums, createParty, heroUnitSpec, unspentPoints, type HeroState } from './heroes';
import { slotOf, starterItem, type ItemId, type ItemSpec, type ItemState } from './items';
import { PICKS } from './content/picks';
import { createRng, type Rng } from './rng';
import { createRun, frontierWall, sendParty, stepRun, type EventSink, type RunState, type RunWorld, type StartAt } from './run';
import { isLegalOrder, spendRefusal, type SkillRanks, type SpendRefusal } from './skills';
import { LAMPS } from './content/world';
import { createWall, isWallState, recordGrowth, type WallState } from './wall';

export const TICK_MS = 100;
/** The longest absence that counts: 12 hours. */
export const CATCH_UP_CAP_MS = 43_200_000;
export const SAVE_VERSION = 4;

export interface GameSetup {
  readonly seed: number;
  /** Starts part-way through, for tests and the balance script. */
  readonly scenario?: {
    readonly heroLevel?: number;
    readonly skillRanks?: Readonly<Partial<Record<HeroId, SkillRanks>>>;
    readonly startAt?: StartAt;
    /** Lights the first Lamp. */
    readonly lampLit?: boolean;
    /** Setbacks already counted towards falling back at the frontier Lamp. 3 starts the Game fallen back. */
    readonly setbacks?: number;
    /** Battles draw after this many Ticks, instead of the usual limit. */
    readonly battleTicks?: number;
    /** Gear each Hero starts with, on top of the starter weapon. An item takes the Slot it names. */
    readonly equipped?: Readonly<Partial<Record<HeroId, readonly ItemSpec[]>>>;
    /** Items already in the Stash. */
    readonly stash?: readonly ItemSpec[];
  };
}

export type PlayerAction =
  | { readonly type: 'sendParty' }
  | { readonly type: 'renameHero'; readonly heroId: HeroId; readonly name: string }
  | { readonly type: 'spendSkillPoint'; readonly heroId: HeroId; readonly skillId: SkillId }
  | { readonly type: 'setSkillOrder'; readonly heroId: HeroId; readonly order: readonly SkillId[] }
  | { readonly type: 'respec'; readonly heroId: HeroId }
  | { readonly type: 'equipItem'; readonly heroId: HeroId; readonly itemId: ItemId }
  | { readonly type: 'unequipItem'; readonly heroId: HeroId; readonly slot: Slot };

export type ActionRefusal = 'notInTown' | 'unknownHero' | 'emptyName' | 'nameTooLong' | 'badOrder' | 'unknownItem' | 'belowLevelRequirement' | 'emptySlot' | SpendRefusal;
export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly reason: ActionRefusal };

/** A running game. The UI never reads inside it: reads go through the view functions. */
export type Game = { readonly __brand: 'Game' };

/** Everything that carries between Ticks, as plain JSON-safe data. */
interface GameState extends RunWorld {
  tick: number;
  /** Elapsed time banked towards the next whole Tick. */
  bankMs: number;
}

export const stateOf = (game: Game): GameState => game as unknown as GameState;
const gameOf = (state: GameState): Game => state as unknown as Game;
const ignore: EventSink = () => {};

/** One Wall per Lamp: the first `lit` relit, and the frontier with `setbacks` already counted. */
function createWalls(lit: number, setbacks: number | undefined): WallState[] {
  return LAMPS.map((_, index) => createWall({ lampLit: index < lit, setbacks: index === lit ? setbacks : 0 }));
}

export function createGame(setup: GameSetup): Game {
  const { heroLevel, skillRanks, startAt, lampLit, setbacks, battleTicks, equipped, stash } = setup.scenario ?? {};
  let nextItemId = 1;
  const withId = (spec: ItemSpec): ItemState => ({ ...spec, id: nextItemId++ });
  const heroes = createParty((id) => ({
    level: heroLevel,
    ranks: skillRanks?.[id],
    gear: [starterItem(CLASSES[id].starterWeapon), ...(equipped?.[id] ?? [])].map(withId),
  }));
  const stashed = (stash ?? []).map(withId);
  const rng = createRng(setup.seed);
  // A fixed offset keeps the Pick stream apart from the main one.
  const pickRng = createRng(setup.seed ^ 0x5bd1e995);
  return gameOf({ rng, pickRng, tick: 0, bankMs: 0, battle: null, run: createRun(rng, startAt), walls: createWalls(lampLit ? 1 : 0, setbacks), battleTicks: battleTicks ?? null, heroes, stash: stashed, nextItemId, stashRevision: 0 });
}

export const heroesOf = (game: Game): readonly HeroState[] => stateOf(game).heroes;

/** The Heroes as Units, as the next Battle would field them. */
export const partyUnitSpecs = (game: Game): readonly UnitSpec[] => heroesOf(game).map(heroUnitSpec);

const refused = (reason: ActionRefusal): ActionResult => ({ ok: false, reason });
const ACCEPTED: ActionResult = { ok: true };

/** Applies a player's choice at any time. A build change reaches the next Battle. */
export function applyAction(game: Game, action: PlayerAction, sink: EventSink = ignore): ActionResult {
  const state = stateOf(game);
  if (action.type === 'sendParty') {
    if (state.run.phase !== 'town') return refused('notInTown');
    sendParty(state, sink);
    return ACCEPTED;
  }
  const hero = state.heroes.find((candidate) => candidate.id === action.heroId);
  if (!hero) return refused('unknownHero');
  switch (action.type) {
    case 'renameHero': {
      const name = action.name.trim();
      if (name.length === 0) return refused('emptyName');
      if (name.length > MAX_NAME_LENGTH) return refused('nameTooLong');
      hero.name = name;
      return ACCEPTED;
    }
    case 'spendSkillPoint': {
      const reason = spendRefusal(hero.id, hero.ranks, unspentPoints(hero), action.skillId);
      if (reason) return refused(reason);
      const { skillId } = action;
      const rank = hero.ranks[skillId] ?? 0;
      hero.ranks[skillId] = rank + 1;
      if (rank === 0 && SKILLS[skillId].kind === 'active') hero.order.push(skillId);
      recordGrowth(frontierWall(state.walls), sink);
      return ACCEPTED;
    }
    case 'setSkillOrder':
      if (!isLegalOrder(hero.ranks, action.order)) return refused('badOrder');
      hero.order = [...action.order];
      return ACCEPTED;
    case 'respec':
      hero.ranks = {};
      hero.order = [];
      return ACCEPTED;
    case 'equipItem': {
      const index = state.stash.findIndex((item) => item.id === action.itemId);
      const item = state.stash[index];
      if (!item) return refused('unknownItem');
      if (hero.level < item.levelRequirement) return refused('belowLevelRequirement');
      const slot = slotOf(item);
      const old = hero.equipped[slot];
      state.stash.splice(index, 1);
      if (old) state.stash.push(old);
      hero.equipped[slot] = item;
      state.stashRevision++;
      clampToMaximums(hero);
      recordGrowth(frontierWall(state.walls), sink);
      return ACCEPTED;
    }
    case 'unequipItem': {
      const old = hero.equipped[action.slot];
      if (!old) return refused('emptySlot');
      delete hero.equipped[action.slot];
      state.stash.push(old);
      state.stashRevision++;
      clampToMaximums(hero);
      return ACCEPTED;
    }
  }
}

/** Values that aren't finite and positive count as no time at all. */
export const usableElapsed = (elapsedMs: number): number => (Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0);

/** Adds elapsedMs to the bank and removes the whole Ticks it now holds. */
export function bankElapsed(state: GameState, elapsedMs: number): number {
  state.bankMs += usableElapsed(elapsedMs);
  const ticks = Math.floor(state.bankMs / TICK_MS);
  state.bankMs -= ticks * TICK_MS;
  return ticks;
}

/** One Tick. The only way the Game moves, so live play and catch-up run the same rules. */
export function stepTick(state: GameState, sink: EventSink): void {
  state.tick++;
  stepRun(state, sink);
}

/** Banks elapsedMs and runs each whole Tick, reporting events to the sink. */
export function advance(game: Game, elapsedMs: number, sink: EventSink = ignore): void {
  const state = stateOf(game);
  const ticks = bankElapsed(state, elapsedMs);
  for (let i = 0; i < ticks; i++) stepTick(state, sink);
}

export function serializeGame(game: Game): string {
  return JSON.stringify({ version: SAVE_VERSION, game: stateOf(game) });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isRng = (value: unknown): boolean => isRecord(value) && isNumber(value['state']);

const isTeam = (value: unknown): boolean => value === 'a' || value === 'b';
const isRow = (value: unknown): boolean => value === 'front' || value === 'back';
const isString = (value: unknown): boolean => typeof value === 'string';

const isOptionalNumber = (value: unknown): boolean => value === undefined || isNumber(value);
const isRank = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value) && value >= 1 && value <= MAX_SKILL_RANK;
const isLearnedSkill = (value: unknown): boolean =>
  isRecord(value) && isSkillId(value['id']) && isRank(value['rank']);

const isDamageType = (value: unknown): boolean => value === 'physical' || value === 'poison';
const isUnitAction = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value['name']) &&
  isNumber(value['interval']) &&
  (value['target'] === 'oneFront' || value['target'] === 'every') &&
  isNumber(value['damage']) &&
  isDamageType(value['damageType']) &&
  isOptionalNumber(value['poisonStack']);

const isUnitSpec = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value['id']) &&
  isString(value['name']) &&
  isNumber(value['health']) &&
  isOptionalNumber(value['maxHealth']) &&
  isNumber(value['power']) &&
  isNumber(value['actionInterval']) &&
  isRow(value['row']) &&
  (value['reach'] === 'melee' || value['reach'] === 'ranged') &&
  (value['targeting'] === 'frontFirst' || value['targeting'] === 'any') &&
  isDamageType(value['damageType']) &&
  isNumber(value['armour']) &&
  isRecord(value['resistances']) &&
  Object.values(value['resistances']).every(isNumber) &&
  isNumber(value['critChance']) &&
  isOptionalNumber(value['oil']) &&
  isOptionalNumber(value['maxOil']) &&
  isOptionalNumber(value['poisonOnHit']) &&
  (value['skills'] === undefined || (Array.isArray(value['skills']) && value['skills'].every(isLearnedSkill))) &&
  (value['actions'] === undefined || (Array.isArray(value['actions']) && value['actions'].every(isUnitAction)));

const isBleed = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['perTick']) && isNumber(value['ticksLeft']) && isNumber(value['nextTickAt']);
const isPoisonStack = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['damage']) && isNumber(value['nextTickAt']) && isNumber(value['expiresAt']);
const isWard = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['amount']) && isNumber(value['expiresAt']);
const isSkillTicks = (value: unknown): boolean =>
  isRecord(value) && Object.entries(value).every(([id, tick]) => isSkillId(id) && isNumber(tick));

/** A clock for each of the Unit's actions, or an action would silently never come. */
const hasActionClocks = (spec: Record<string, unknown>, clocks: unknown, inSecondPhase: unknown): boolean => {
  const phase = spec['secondPhase'];
  if (inSecondPhase !== undefined && typeof inSecondPhase !== 'boolean') return false;
  // A second Phase needs one to be in.
  if (inSecondPhase === true && !isRecord(phase)) return false;
  const actions = inSecondPhase === true ? (phase as Record<string, unknown>)['actions'] : spec['actions'];
  return Array.isArray(clocks) && clocks.every(isNumber) && clocks.length === (Array.isArray(actions) ? actions.length : 0);
};

const isUnitState = (value: unknown): boolean =>
  isRecord(value) &&
  isUnitSpec(value['spec']) &&
  isTeam(value['team']) &&
  isRow(value['row']) &&
  isNumber(value['health']) &&
  isNumber(value['ticksToAction']) &&
  hasActionClocks(value['spec'] as Record<string, unknown>, value['ticksToEachAction'], value['inSecondPhase']) &&
  isNumber(value['oil']) &&
  isSkillTicks(value['skillReadyAt']) &&
  (value['bleed'] === null || isBleed(value['bleed'])) &&
  Array.isArray(value['poison']) &&
  value['poison'].every(isPoisonStack) &&
  (value['ward'] === null || isWard(value['ward'])) &&
  isNumber(value['barUntil']) &&
  isNumber(value['barArmour']);

const isBattleState = (value: unknown): boolean =>
  isRecord(value) &&
  isRng(value['rng']) &&
  Array.isArray(value['units']) &&
  value['units'].every(isUnitState) &&
  isNumber(value['maxTicks']) &&
  isNumber(value['tick']) &&
  typeof value['over'] === 'boolean' &&
  (value['winner'] === null || isTeam(value['winner']));

const isRanks = (value: unknown): value is SkillRanks =>
  isRecord(value) && Object.entries(value).every(([id, rank]) => isSkillId(id) && isRank(rank));

const isAffix = (value: unknown): boolean =>
  isRecord(value) && AFFIXES.some((affix) => affix.id === value['id']) && isNumber(value['value']);

function isItem(value: unknown): value is ItemState {
  if (!isRecord(value) || !Object.hasOwn(ITEM_BASES, value['baseId'] as string)) return false;
  const { id, rarity, affixes, levelRequirement } = value;
  return (
    isNumber(id) &&
    Number.isInteger(id) &&
    RARITIES.includes(rarity as Rarity) &&
    Array.isArray(affixes) &&
    affixes.every(isAffix) &&
    isNumber(levelRequirement)
  );
}

const isEquipped = (value: unknown): boolean =>
  isRecord(value) &&
  Object.entries(value).every(([slot, item]) => (SLOTS as readonly string[]).includes(slot) && isItem(item) && slotOf(item) === slot);

function isHeroState(value: unknown): boolean {
  if (!isRecord(value) || !HERO_IDS.includes(value['id'] as HeroId)) return false;
  const { ranks, order, level } = value;
  return (
    isString(value['name']) &&
    isNumber(level) &&
    Number.isInteger(level) &&
    level >= 1 &&
    isNumber(value['xp']) &&
    isNumber(value['health']) &&
    value['health'] > 0 &&
    isNumber(value['oil']) &&
    isRanks(ranks) &&
    Array.isArray(order) &&
    isLegalOrder(ranks, order) &&
    new Set(order).size === order.length &&
    isEquipped(value['equipped'])
  );
}

const isRoomKind = (value: unknown): boolean => (ROOM_KINDS as readonly unknown[]).includes(value);
const isRoom = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['x']) && isNumber(value['y']) && isRoomKind(value['kind']);

function isRunState(value: unknown): value is RunState {
  if (!isRecord(value) || !isNumber(value['ticksLeft']) || !isNumber(value['room'])) return false;
  const { phase, floor, layout, room, startFloor, picks } = value;
  if (!Array.isArray(picks) || !picks.every((id) => typeof id === 'string' && id in PICKS)) return false;
  if (phase === 'town') return floor === null && layout === null && startFloor === null && picks.length === 0;
  if (!isDepth(startFloor)) return false;
  if (phase !== 'travelling' && phase !== 'battle' && phase !== 'chest') return false;
  if (!isDepth(floor) || !isRecord(layout) || !Array.isArray(layout['rooms']) || !layout['rooms'].every(isRoom)) return false;
  return Number.isInteger(room) && (room as number) >= 0 && (room as number) < layout['rooms'].length;
}

/** Every item in the Game, or null if any is malformed. */
function allItems(game: Record<string, unknown>): readonly ItemState[] | null {
  const { heroes, stash } = game;
  if (!Array.isArray(stash) || !stash.every(isItem)) return null;
  const worn = (heroes as HeroState[]).flatMap((hero) => Object.values(hero.equipped));
  return [...stash, ...worn];
}

/** Ids tell items apart and date them, so each is unique and already handed out. */
function hasSoundItems(game: Record<string, unknown>): boolean {
  const items = allItems(game);
  if (!items || !isNumber(game['nextItemId']) || !isNumber(game['stashRevision'])) return false;
  const nextItemId = game['nextItemId'];
  return new Set(items.map((item) => item.id)).size === items.length && items.every((item) => item.id < nextItemId);
}

const isGameState = (value: unknown): boolean =>
  isRecord(value) &&
  isRng(value['rng']) &&
  isRng(value['pickRng']) &&
  isNumber(value['tick']) &&
  isNumber(value['bankMs']) &&
  isRunState(value['run']) &&
  Array.isArray(value['walls']) &&
  value['walls'].length === LAMPS.length &&
  value['walls'].every(isWallState) &&
  (value['battleTicks'] === null || isNumber(value['battleTicks'])) &&
  (value['run'].phase === 'battle') === (value['battle'] !== null) &&
  Array.isArray(value['heroes']) &&
  value['heroes'].length === HERO_IDS.length &&
  value['heroes'].every(isHeroState) &&
  hasSoundItems(value) &&
  (value['battle'] === null || isBattleState(value['battle']));

/** Returns null for bad data or another SAVE_VERSION. */
export function deserializeGame(text: string): Game | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed['version'] !== SAVE_VERSION || !isGameState(parsed['game'])) return null;
  return gameOf(parsed['game'] as GameState);
}
