// The save format. Each state type's validator lives beside it; this checks how they fit together.
import { PARTY_SIZE } from './content/party';
import { LAMPS } from './content/world';
import { gameOf, stateOf, type Game, type GameState } from './game';
import { isNumber, isRecord } from './guards';
import { isBattleState } from './battle';
import { isHeroState, type HeroState } from './heroes';
import { isItem, type ItemState } from './items';
import { isPickPriority } from './picks';
import { isRng } from './rng';
import { isRunState } from './run';
import { isWallState } from './wall';

/**
 * 8: 6 Slots and uniques. A version 7 save is a version 8 save already: its trinket sits in the first trinket Slot.
 * 7: Heroes carry their Class apart from their id. Older saves don't load: the human chose a wipe on 2026-11-13.
 */
export const SAVE_VERSION = 8;
const LOADS_AS_IS: readonly number[] = [7, SAVE_VERSION];

export function serializeGame(game: Game): string {
  return JSON.stringify({ version: SAVE_VERSION, game: stateOf(game) });
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
  isPickPriority(value['pickPriority']) &&
  isNumber(value['tick']) &&
  isNumber(value['bankMs']) &&
  isRunState(value['run']) &&
  Array.isArray(value['walls']) &&
  value['walls'].length === LAMPS.length &&
  value['walls'].every(isWallState) &&
  (value['battleTicks'] === null || isNumber(value['battleTicks'])) &&
  (value['run'].phase === 'battle') === (value['battle'] !== null) &&
  Array.isArray(value['heroes']) &&
  value['heroes'].length === PARTY_SIZE &&
  new Set(value['heroes'].map((hero: unknown) => (isRecord(hero) ? hero['id'] : null))).size === PARTY_SIZE &&
  value['heroes'].every(isHeroState) &&
  hasSoundItems(value) &&
  (value['battle'] === null || isBattleState(value['battle']));

/** Returns null for bad data or a version it can't load. */
export function deserializeGame(text: string): Game | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !LOADS_AS_IS.includes(parsed['version'] as number) || !isGameState(parsed['game'])) return null;
  return gameOf(parsed['game'] as GameState);
}
