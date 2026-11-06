import { createBattle, stepBattle, type BattleEvent, type BattleState, type TeamId, type UnitSpec } from './battle';
import { rollPack } from './content/enemies';
import { HERO_IDS, MAX_NAME_LENGTH, OIL_BETWEEN_BATTLES, XP_PER_BATTLE } from './content/party';
import { isSkillId, MAX_SKILL_RANK, SKILLS, type HeroId, type SkillId } from './content/skills';
import { createParty, gainXp, heroStats, heroUnitSpec, unspentPoints, type HeroState } from './heroes';
import { createRng, nextInt, type Rng } from './rng';
import { isLegalOrder, spendRefusal, type SkillRanks, type SpendRefusal } from './skills';

export const TICK_MS = 100;
/** The longest absence that counts: 12 hours. */
export const CATCH_UP_CAP_MS = 43_200_000;
export const SAVE_VERSION = 1;

/** Temporary until Floors arrive: the Party travels this long between Battles. */
const TICKS_BETWEEN_BATTLES = 50;
const SEED_RANGE = 2 ** 32;
/** The Team the Party fights on. */
export const PARTY_TEAM = 'a' satisfies TeamId;
export const ENEMY_TEAM = 'b' satisfies TeamId;

export type BattleOutcome = 'won' | 'lost' | 'draw';

export type GameEvent =
  | BattleEvent
  | { readonly type: 'battleStarted'; readonly enemyNames: readonly string[] }
  | { readonly type: 'battleEnded'; readonly outcome: BattleOutcome }
  | { readonly type: 'levelUp'; readonly heroId: HeroId; readonly heroName: string; readonly level: number };

export type EventSink = (event: GameEvent) => void;

export interface GameSetup {
  readonly seed: number;
  /** Starts part-way through, for tests and the balance script. */
  readonly scenario?: {
    readonly heroLevel?: number;
    readonly skillRanks?: Readonly<Partial<Record<HeroId, SkillRanks>>>;
  };
}

export type PlayerAction =
  | { readonly type: 'renameHero'; readonly heroId: HeroId; readonly name: string }
  | { readonly type: 'spendSkillPoint'; readonly heroId: HeroId; readonly skillId: SkillId }
  | { readonly type: 'setSkillOrder'; readonly heroId: HeroId; readonly order: readonly SkillId[] }
  | { readonly type: 'respec'; readonly heroId: HeroId };

export type ActionRefusal = 'unknownHero' | 'emptyName' | 'nameTooLong' | 'badOrder' | SpendRefusal;
export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly reason: ActionRefusal };

/** A running game. The UI never reads inside it: reads go through the view functions. */
export type Game = { readonly __brand: 'Game' };

/** Everything that carries between Ticks, as plain JSON-safe data. */
interface GameState {
  readonly rng: Rng;
  tick: number;
  /** Elapsed time banked towards the next whole Tick. */
  bankMs: number;
  battle: BattleState | null;
  ticksUntilBattle: number;
  readonly heroes: HeroState[];
}

export const stateOf = (game: Game): GameState => game as unknown as GameState;
const gameOf = (state: GameState): Game => state as unknown as Game;
const ignore: EventSink = () => {};

function startBattle(state: GameState, sink: EventSink): void {
  const pack = rollPack(state.rng);
  // Units take their stats and skills here, so a build change reaches the next Battle.
  const teams = { [PARTY_TEAM]: state.heroes.map(heroUnitSpec), [ENEMY_TEAM]: pack };
  state.battle = createBattle({ seed: nextInt(state.rng, SEED_RANGE), teams });
  sink({ type: 'battleStarted', enemyNames: pack.map((enemy) => enemy.name) });
}

const outcomeOf = (battle: BattleState): BattleOutcome =>
  battle.winner === null ? 'draw' : battle.winner === PARTY_TEAM ? 'won' : 'lost';

/** Oil carries out of the Battle. Effects and cooldowns end with it, and health is restored until Floors arrive. */
function finishBattle(state: GameState, battle: BattleState, sink: EventSink): void {
  const outcome = outcomeOf(battle);
  sink({ type: 'battleEnded', outcome });
  for (const hero of state.heroes) {
    const unit = battle.units.find((candidate) => candidate.spec.id === hero.id);
    if (unit) hero.oil = Math.min(heroStats(hero).maxOil, unit.oil + OIL_BETWEEN_BATTLES);
    if (outcome !== 'won') continue;
    for (const level of gainXp(hero, XP_PER_BATTLE)) sink({ type: 'levelUp', heroId: hero.id, heroName: hero.name, level });
  }
}

/** The one function that moves the game forward. Every rule is reached from here. */
function stepTick(state: GameState, sink: EventSink): void {
  state.tick++;
  if (state.battle) {
    for (const event of stepBattle(state.battle)) sink(event);
    if (state.battle.over) {
      finishBattle(state, state.battle, sink);
      state.battle = null;
      state.ticksUntilBattle = TICKS_BETWEEN_BATTLES;
    }
    return;
  }
  state.ticksUntilBattle--;
  if (state.ticksUntilBattle <= 0) startBattle(state, sink);
}

/** The first Battle starts on the first Tick, so its battleStarted reaches a sink like any other. */
export function createGame(setup: GameSetup): Game {
  const { heroLevel, skillRanks } = setup.scenario ?? {};
  const heroes = createParty((id) => ({ level: heroLevel, ranks: skillRanks?.[id] }));
  return gameOf({ rng: createRng(setup.seed), tick: 0, bankMs: 0, battle: null, ticksUntilBattle: 1, heroes });
}

export const heroesOf = (game: Game): readonly HeroState[] => stateOf(game).heroes;

/** The Heroes as Units, as the next Battle would field them. */
export const partyUnitSpecs = (game: Game): readonly UnitSpec[] => heroesOf(game).map(heroUnitSpec);

const refused = (reason: ActionRefusal): ActionResult => ({ ok: false, reason });
const ACCEPTED: ActionResult = { ok: true };

/** Applies a player's choice at any time. A build change reaches the next Battle. */
export function applyAction(game: Game, action: PlayerAction): ActionResult {
  const hero = stateOf(game).heroes.find((candidate) => candidate.id === action.heroId);
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
  }
}

/** Banks elapsedMs and runs each whole Tick, reporting events to the sink.
 *  Values that aren't finite and positive bank nothing. */
export function advance(game: Game, elapsedMs: number, sink: EventSink = ignore): void {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
  const state = stateOf(game);
  state.bankMs += elapsedMs;
  const ticks = Math.floor(state.bankMs / TICK_MS);
  state.bankMs -= ticks * TICK_MS;
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

const isUnitSpec = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value['id']) &&
  isString(value['name']) &&
  isNumber(value['health']) &&
  isNumber(value['power']) &&
  isNumber(value['actionInterval']) &&
  isRow(value['row']) &&
  (value['reach'] === 'melee' || value['reach'] === 'ranged') &&
  (value['targeting'] === 'frontFirst' || value['targeting'] === 'any') &&
  (value['damageType'] === 'physical' || value['damageType'] === 'poison') &&
  isNumber(value['armour']) &&
  isRecord(value['resistances']) &&
  Object.values(value['resistances']).every(isNumber) &&
  isNumber(value['critChance']) &&
  isOptionalNumber(value['oil']) &&
  isOptionalNumber(value['maxOil']) &&
  isOptionalNumber(value['poisonOnHit']) &&
  (value['skills'] === undefined || (Array.isArray(value['skills']) && value['skills'].every(isLearnedSkill)));

const isBleed = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['perTick']) && isNumber(value['ticksLeft']) && isNumber(value['nextTickAt']);
const isPoisonStack = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['damage']) && isNumber(value['nextTickAt']) && isNumber(value['expiresAt']);
const isWard = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['amount']) && isNumber(value['expiresAt']);
const isSkillTicks = (value: unknown): boolean =>
  isRecord(value) && Object.entries(value).every(([id, tick]) => isSkillId(id) && isNumber(tick));

const isUnitState = (value: unknown): boolean =>
  isRecord(value) &&
  isUnitSpec(value['spec']) &&
  isTeam(value['team']) &&
  isRow(value['row']) &&
  isNumber(value['health']) &&
  isNumber(value['ticksToAction']) &&
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

function isHeroState(value: unknown): boolean {
  if (!isRecord(value) || !HERO_IDS.includes(value['id'] as HeroId)) return false;
  const { ranks, order, level } = value;
  return (
    isString(value['name']) &&
    isNumber(level) &&
    Number.isInteger(level) &&
    level >= 1 &&
    isNumber(value['xp']) &&
    isNumber(value['oil']) &&
    isRanks(ranks) &&
    Array.isArray(order) &&
    isLegalOrder(ranks, order) &&
    new Set(order).size === order.length
  );
}

const isGameState = (value: unknown): boolean =>
  isRecord(value) &&
  isRng(value['rng']) &&
  isNumber(value['tick']) &&
  isNumber(value['bankMs']) &&
  isNumber(value['ticksUntilBattle']) &&
  Array.isArray(value['heroes']) &&
  value['heroes'].length === HERO_IDS.length &&
  value['heroes'].every(isHeroState) &&
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
