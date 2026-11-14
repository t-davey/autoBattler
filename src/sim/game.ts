import type { UnitSpec } from './battle';
import { equipItem, renameHero, respec, setSkillOrder, spendSkillPoint, unequipItem, type BuildRefusal } from './build';
import type { AutoSalvageRule, ItemStat, Slot } from './content/items';
import { lockItems, salvageItems, setAutoSalvage, type Stash, type StashRefusal } from './stash';
import { buyItem, gamble, rerollAffix, respecCost, restockMerchant, type TownRefusal, type TownWorld } from './town';
import type { AffixId } from './content/items';
import { CLASS_IDS, CLASSES, DEFAULT_PARTY, PARTY_SIZE } from './content/party';
import type { ClassId, HeroId, SkillId } from './content/skills';
import { GIVEN_NAMES, SURNAMES } from './content/names';
import { createHero, heroUnitSpec, partyIds, type HeroState } from './heroes';
import { starterItem, type ItemId, type ItemSpec, type ItemState } from './items';
import { DEFAULT_PICK_PRIORITY, type PickTag } from './content/picks';
import { isPickPriority } from './picks';
import { createRng, nextInt, type Rng } from './rng';
import { createRun, frontierWall, sendParty, stepRun, type EventSink, type RunWorld, type StartAt } from './run';
import type { SkillRanks } from './skills';
import { LAMPS } from './content/world';
import { createWall, recordGrowth, type WallState } from './wall';

export const TICK_MS = 100;
/** The longest absence that counts: 12 hours. */
export const CATCH_UP_CAP_MS = 43_200_000;

export interface GameSetup {
  readonly seed: number;
  /** The player's 3 Classes, duplicates allowed. Defaults to Sin-Eater, Warrener, and Lamplighter. */
  readonly party?: readonly ClassId[];
  /** Starts part-way through, for tests and the balance script. */
  readonly scenario?: {
    readonly heroLevel?: number;
    readonly skillRanks?: Readonly<Partial<Record<HeroId, SkillRanks>>>;
    readonly startAt?: StartAt;
    /** Lights the first Lamp. */
    readonly lampLit?: boolean;
    /** Lights this many Lamps from the first, in place of lampLit. */
    readonly lampsLit?: number;
    /** Setbacks already counted towards falling back at the frontier Lamp. 3 starts the Game fallen back. */
    readonly setbacks?: number;
    /** Battles draw after this many Ticks, instead of the usual limit. */
    readonly battleTicks?: number;
    /** Gear each Hero starts with, on top of the starter weapon. Each item takes the first empty Slot it fits. */
    readonly equipped?: Readonly<Partial<Record<HeroId, readonly ItemSpec[]>>>;
    /** Items already in the Stash. */
    readonly stash?: readonly ItemSpec[];
    readonly gold?: number;
    readonly salvage?: number;
  };
}

export type PlayerAction =
  | { readonly type: 'sendParty' }
  | { readonly type: 'setPickPriority'; readonly priority: readonly PickTag[] }
  | { readonly type: 'renameHero'; readonly heroId: HeroId; readonly name: string }
  | { readonly type: 'spendSkillPoint'; readonly heroId: HeroId; readonly skillId: SkillId }
  | { readonly type: 'setSkillOrder'; readonly heroId: HeroId; readonly order: readonly SkillId[] }
  | { readonly type: 'respec'; readonly heroId: HeroId }
  | { readonly type: 'equipItem'; readonly heroId: HeroId; readonly itemId: ItemId; readonly slot?: Slot }
  | { readonly type: 'unequipItem'; readonly heroId: HeroId; readonly slot: Slot }
  | { readonly type: 'lockItems'; readonly itemIds: readonly ItemId[]; readonly locked: boolean }
  | { readonly type: 'salvageItems'; readonly itemIds: readonly ItemId[] }
  | { readonly type: 'setAutoSalvage'; readonly rule: AutoSalvageRule; readonly keepStat: ItemStat | null }
  | { readonly type: 'buyItem'; readonly index: number }
  | { readonly type: 'gamble'; readonly slot: Slot }
  | { readonly type: 'rerollAffix'; readonly itemId: ItemId; readonly affixId: AffixId };

export type ActionRefusal = 'notInTown' | 'unknownHero' | 'badPickPriority' | BuildRefusal | StashRefusal | TownRefusal;
export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly reason: ActionRefusal };

/** A running game. The UI never reads inside it: reads go through the view functions. */
export type Game = { readonly __brand: 'Game' };

/** Everything that carries between Ticks, as plain JSON-safe data. */
export interface GameState extends RunWorld {
  tick: number;
  /** Elapsed time banked towards the next whole Tick. */
  bankMs: number;
}

export const stateOf = (game: Game): GameState => game as unknown as GameState;
export const gameOf = (state: GameState): Game => state as unknown as Game;
const ignore: EventSink = () => {};

/** One Wall per Lamp: the first `lit` relit, and the frontier with `setbacks` already counted. */
function createWalls(lit: number, setbacks: number | undefined): WallState[] {
  return LAMPS.map((_, index) => createWall({ lampLit: index < lit, setbacks: index === lit ? setbacks : 0 }));
}

export function createGame(setup: GameSetup): Game {
  const { heroLevel, skillRanks, startAt, lampLit, lampsLit, gold, salvage, setbacks, battleTicks, equipped, stash } = setup.scenario ?? {};
  const classes = setup.party ?? DEFAULT_PARTY;
  // Its own stream, so names never shift the rolls that follow.
  const names = heroNames(createRng(setup.seed ^ 0x3c6ef372), classes.length);
  let nextItemId = 1;
  const withId = (spec: ItemSpec): ItemState => ({ ...spec, id: nextItemId++ });
  const heroes = partyIds(classes).map((id, index) => {
    const classId = classes[index]!;
    return createHero(id, classId, {
      name: names[index],
      level: heroLevel,
      ranks: skillRanks?.[id],
      gear: [starterItem(CLASSES[classId].starterWeapon), ...(equipped?.[id] ?? [])].map(withId),
    });
  });
  const stashed = (stash ?? []).map(withId);
  const rng = createRng(setup.seed);
  // A fixed offset keeps the Pick stream apart from the main one.
  const pickRng = createRng(setup.seed ^ 0x5bd1e995);
  const state: GameState = {
    rng,
    pickRng,
    pickPriority: [...DEFAULT_PICK_PRIORITY],
    tick: 0,
    bankMs: 0,
    battle: null,
    run: createRun(rng, startAt),
    walls: createWalls(lampsLit ?? (lampLit ? 1 : 0), setbacks),
    battleTicks: battleTicks ?? null,
    heroes,
    stash: stashed,
    nextItemId,
    stashRevision: 0,
    salvage: salvage ?? 0,
    autoSalvage: 'keepEverything',
    keepStat: null,
    gold: gold ?? 0,
    merchant: [],
  };
  // The first stock comes from its own stream, so it never shifts the Seed's Floors and loot.
  const firstStock = { ...state, rng: createRng(setup.seed ^ 0x27d4eb2f) };
  restockMerchant(firstStock);
  state.merchant = firstStock.merchant;
  return gameOf(state);
}

/** Different names for each Hero, from the provisional pool. */
function heroNames(rng: Rng, count: number): string[] {
  const names: string[] = [];
  while (names.length < count) {
    const name = `${GIVEN_NAMES[nextInt(rng, GIVEN_NAMES.length)]} ${SURNAMES[nextInt(rng, SURNAMES.length)]}`;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** Whether a setup's Party is 3 known Classes. */
export const isPartyChoice = (classes: readonly unknown[]): classes is readonly ClassId[] =>
  classes.length === PARTY_SIZE && classes.every((classId) => CLASS_IDS.includes(classId as ClassId));

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
  // Any time: it applies from the next Pick.
  if (action.type === 'setPickPriority') {
    if (!isPickPriority(action.priority)) return refused('badPickPriority');
    state.pickPriority = [...action.priority];
    return ACCEPTED;
  }
  // The Stash's own actions: any time, since loot lands during Runs.
  if (action.type === 'lockItems' || action.type === 'salvageItems' || action.type === 'setAutoSalvage') {
    const outcome = stashAction(state, action, sink);
    return outcome ? refused(outcome) : ACCEPTED;
  }
  // Town's shops: Town is a menu, open whether or not the Party is there.
  if (action.type === 'buyItem' || action.type === 'gamble' || action.type === 'rerollAffix') {
    const outcome = townAction(state, action);
    return outcome ? refused(outcome) : ACCEPTED;
  }
  const hero = state.heroes.find((candidate) => candidate.id === action.heroId);
  if (!hero) return refused('unknownHero');
  if (action.type === 'respec') {
    const cost = respecCost(hero);
    if (state.gold < cost) return refused('notEnoughGold');
    state.gold -= cost;
  }
  const outcome = buildAction(hero, state, action);
  if (outcome) return refused(outcome);
  // A stronger build may be the answer to the frontier Wall.
  if (action.type === 'spendSkillPoint' || action.type === 'equipItem') recordGrowth(frontierWall(state.walls), sink);
  return ACCEPTED;
}

type StashAction = Extract<PlayerAction, { readonly type: 'lockItems' | 'salvageItems' | 'setAutoSalvage' }>;

function stashAction(stash: Stash, action: StashAction, sink: EventSink): StashRefusal | null {
  switch (action.type) {
    case 'lockItems':
      return lockItems(stash, action.itemIds, action.locked);
    case 'salvageItems':
      return salvageItems(stash, action.itemIds, sink);
    case 'setAutoSalvage':
      return setAutoSalvage(stash, action.rule, action.keepStat);
  }
}

type TownAction = Extract<PlayerAction, { readonly type: 'buyItem' | 'gamble' | 'rerollAffix' }>;

function townAction(world: TownWorld, action: TownAction): TownRefusal | null {
  switch (action.type) {
    case 'buyItem':
      return buyItem(world, action.index);
    case 'gamble':
      return gamble(world, action.slot);
    case 'rerollAffix':
      return rerollAffix(world, action.itemId, action.affixId);
  }
}

function buildAction(hero: HeroState, stash: Stash, action: Exclude<PlayerAction, { readonly type: 'sendParty' | 'setPickPriority' } | StashAction | TownAction>): BuildRefusal | null {
  switch (action.type) {
    case 'renameHero':
      return renameHero(hero, action.name);
    case 'spendSkillPoint':
      return spendSkillPoint(hero, action.skillId);
    case 'setSkillOrder':
      return setSkillOrder(hero, action.order);
    case 'respec':
      respec(hero);
      return null;
    case 'equipItem':
      return equipItem(hero, stash, action.itemId, action.slot);
    case 'unequipItem':
      return unequipItem(hero, stash, action.slot);
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
