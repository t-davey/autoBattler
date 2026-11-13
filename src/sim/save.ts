// The save format. Each state type's validator lives beside it; this checks how they fit together.
import { CLASS_IDS, PARTY_SIZE } from './content/party';
import { LAMPS } from './content/world';
import { gameOf, stateOf, type Game, type GameState } from './game';
import { isNumber, isRecord } from './guards';
import { isBattleState } from './battle';
import { isHeroState, type HeroState } from './heroes';
import { isItem, type ItemState } from './items';
import { freeSkillOf, MAX_ORDERED_SKILLS } from './skills';
import type { HeroId } from './content/skills';
import { isPickPriority } from './picks';
import { isRng } from './rng';
import { isRunState } from './run';
import { isWallState } from './wall';

export const SAVE_VERSION = 6;

/**
 * Version 5 saves come from before every Hero had a free Class skill in its order.
 * Each gets it at the end, if its order has room.
 */
function migrateFrom5(game: unknown): void {
  if (!isRecord(game) || !Array.isArray(game['heroes'])) return;
  for (const hero of game['heroes'] as unknown[]) {
    if (!isRecord(hero) || !CLASS_IDS.includes(hero['id'] as HeroId) || !Array.isArray(hero['order'])) continue;
    const free = freeSkillOf(hero['id'] as HeroId);
    if (!hero['order'].includes(free) && hero['order'].length < MAX_ORDERED_SKILLS) hero['order'].push(free);
  }
}

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

/** Returns null for bad data or a SAVE_VERSION it can't read: this one, or 5, which it migrates. */
export function deserializeGame(text: string): Game | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed['version'] === 5) migrateFrom5(parsed['game']);
  else if (parsed['version'] !== SAVE_VERSION) return null;
  if (!isGameState(parsed['game'])) return null;
  return gameOf(parsed['game'] as GameState);
}
