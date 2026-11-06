import { createBattle, stepBattle, type BattleEvent, type BattleState, type TeamId } from './battle';
import { rollPack } from './content/enemies';
import { PARTY } from './content/party';
import { createRng, nextInt, type Rng } from './rng';

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
  | { readonly type: 'battleEnded'; readonly outcome: BattleOutcome };

export type EventSink = (event: GameEvent) => void;

export interface GameSetup {
  readonly seed: number;
}

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
}

export const stateOf = (game: Game): GameState => game as unknown as GameState;
const gameOf = (state: GameState): Game => state as unknown as Game;
const ignore: EventSink = () => {};

function startBattle(state: GameState, sink: EventSink): void {
  const pack = rollPack(state.rng);
  const teams = { [PARTY_TEAM]: PARTY, [ENEMY_TEAM]: pack };
  state.battle = createBattle({ seed: nextInt(state.rng, SEED_RANGE), teams });
  sink({ type: 'battleStarted', enemyNames: pack.map((enemy) => enemy.name) });
}

const outcomeOf = (battle: BattleState): BattleOutcome =>
  battle.winner === null ? 'draw' : battle.winner === PARTY_TEAM ? 'won' : 'lost';

/** The one function that moves the game forward. Every rule is reached from here. */
function stepTick(state: GameState, sink: EventSink): void {
  state.tick++;
  if (state.battle) {
    for (const event of stepBattle(state.battle)) sink(event);
    if (state.battle.over) {
      sink({ type: 'battleEnded', outcome: outcomeOf(state.battle) });
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
  return gameOf({ rng: createRng(setup.seed), tick: 0, bankMs: 0, battle: null, ticksUntilBattle: 1 });
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
  isNumber(value['critChance']);

const isUnitState = (value: unknown): boolean =>
  isRecord(value) &&
  isUnitSpec(value['spec']) &&
  isTeam(value['team']) &&
  isRow(value['row']) &&
  isNumber(value['health']) &&
  isNumber(value['cooldown']);

const isBattleState = (value: unknown): boolean =>
  isRecord(value) &&
  isRng(value['rng']) &&
  Array.isArray(value['units']) &&
  value['units'].every(isUnitState) &&
  isNumber(value['maxTicks']) &&
  isNumber(value['tick']) &&
  typeof value['over'] === 'boolean' &&
  (value['winner'] === null || isTeam(value['winner']));

const isGameState = (value: unknown): boolean =>
  isRecord(value) &&
  isRng(value['rng']) &&
  isNumber(value['tick']) &&
  isNumber(value['bankMs']) &&
  isNumber(value['ticksUntilBattle']) &&
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
