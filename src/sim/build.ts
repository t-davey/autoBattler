import type { Slot } from './content/items';
import { MAX_NAME_LENGTH } from './content/party';
import type { SkillId } from './content/skills';
import { clampToMaximums, unspentPoints, type HeroState } from './heroes';
import { slotOf, type ItemId, type ItemState } from './items';
import { isLegalOrder, orderFor, spendRefusal, type SpendRefusal } from './skills';

/** The Party's unequipped items, and a count of their changes. */
export interface Stash {
  /** In the order they arrived. */
  readonly stash: ItemState[];
  stashRevision: number;
}

export type BuildRefusal = 'emptyName' | 'nameTooLong' | 'badOrder' | 'unknownItem' | 'belowLevelRequirement' | 'emptySlot' | SpendRefusal;

/** Every change to the Stash comes through here, so its revision always moves. */
export function putInStash(stash: Stash, item: ItemState): void {
  stash.stash.push(item);
  stash.stashRevision++;
}

function takeFromStash(stash: Stash, itemId: ItemId): ItemState | undefined {
  const index = stash.stash.findIndex((item) => item.id === itemId);
  if (index === -1) return undefined;
  stash.stashRevision++;
  return stash.stash.splice(index, 1)[0];
}

export function renameHero(hero: HeroState, name: string): BuildRefusal | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'emptyName';
  if (trimmed.length > MAX_NAME_LENGTH) return 'nameTooLong';
  hero.name = trimmed;
  return null;
}

export function spendSkillPoint(hero: HeroState, skillId: SkillId): BuildRefusal | null {
  const reason = spendRefusal(hero.id, hero.ranks, unspentPoints(hero), skillId);
  if (reason) return reason;
  hero.ranks[skillId] = (hero.ranks[skillId] ?? 0) + 1;
  hero.order = orderFor(hero.ranks, hero.order);
  return null;
}

export function setSkillOrder(hero: HeroState, order: readonly SkillId[]): BuildRefusal | null {
  if (!isLegalOrder(hero.ranks, order)) return 'badOrder';
  hero.order = [...order];
  return null;
}

export function respec(hero: HeroState): void {
  hero.ranks = {};
  hero.order = orderFor(hero.ranks, hero.order);
}

/** Moves the item from the Stash to the Hero, and whatever it replaces back. */
export function equipItem(hero: HeroState, stash: Stash, itemId: ItemId): BuildRefusal | null {
  const item = stash.stash.find((candidate) => candidate.id === itemId);
  if (!item) return 'unknownItem';
  if (hero.level < item.levelRequirement) return 'belowLevelRequirement';
  takeFromStash(stash, itemId);
  const slot = slotOf(item);
  const old = hero.equipped[slot];
  if (old) putInStash(stash, old);
  hero.equipped[slot] = item;
  clampToMaximums(hero);
  return null;
}

export function unequipItem(hero: HeroState, stash: Stash, slot: Slot): BuildRefusal | null {
  const old = hero.equipped[slot];
  if (!old) return 'emptySlot';
  delete hero.equipped[slot];
  putInStash(stash, old);
  clampToMaximums(hero);
  return null;
}
