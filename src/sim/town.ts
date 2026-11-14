// Town's shops and services: gold, respecs, rerolls, the merchant, and the gamble vendor.
import { isNumber } from './guards';
import { SLOTS_FOR, UNIQUES, UNIQUE_IDS, type AffixId, type Slot, type UniqueId } from './content/items';
import { battleWorth, GAMBLE, MERCHANT, RESPEC_GOLD_PER_LEVEL } from './content/town';
import { LAMPS } from './content/world';
import type { HeroState } from './heroes';
import { clampToMaximums } from './heroes';
import { isItem, itemDepth, rerollCost, rerolledAffixes, rollItemSpec, slotsOf, uniqueSpec, type ItemId, type ItemSpec, type ItemState } from './items';
import { nextFloat, shuffled, type Rng } from './rng';
import { spentPoints } from './skills';
import { putInStash, type Stash } from './stash';
import type { WallState } from './wall';

/** The Party's gold, and what the merchant holds until the Party next passes through Town. */
export interface Purse {
  gold: number;
  merchant: ItemSpec[];
}

/** The part of the Game Town's shops read and change. */
export interface TownWorld extends Stash, Purse {
  readonly rng: Rng;
  readonly walls: readonly WallState[];
  readonly heroes: HeroState[];
  nextItemId: number;
}

export type TownRefusal = 'notEnoughGold' | 'notEnoughSalvage' | 'unknownOffer' | 'unknownItem' | 'noSuchAffix' | 'wrongSlot';

const lampsLit = (walls: readonly WallState[]): number => walls.filter((wall) => wall.lampLit).length;

/** Where Town's goods come from: the deepest relit Lamp's Floor, or Floor 1 before any. */
export function shopDepth(walls: readonly WallState[]): number {
  let depth = 1;
  walls.forEach((wall, index) => {
    if (wall.lampLit) depth = Math.max(depth, LAMPS[index]!.depth);
  });
  return depth;
}

/** Gold for a respec: nothing when no point is spent. */
export const respecCost = (hero: HeroState): number => (spentPoints(hero.ranks) > 0 ? RESPEC_GOLD_PER_LEVEL * hero.level : 0);

export function merchantPrice(item: ItemSpec): number {
  const rarity = item.rarity === 'rare' ? 'rare' : 'magic';
  return MERCHANT.price[rarity] * battleWorth(itemDepth(item));
}

export const gamblePrice = (walls: readonly WallState[]): number => GAMBLE.price * battleWorth(shopDepth(walls));

/** Fresh stock, rolled at the shop's depth: one of each Slot kind first, then any. */
export function restockMerchant(world: TownWorld): void {
  const lit = lampsLit(world.walls);
  const count = Math.min(MERCHANT.maxStock, MERCHANT.stock + Math.floor(lit / MERCHANT.lampsPerExtraItem));
  const rareShare = Math.min(MERCHANT.maxRareShare, MERCHANT.rareShare + MERCHANT.rareSharePerLamp * lit);
  const kinds = shuffled(world.rng, Object.keys(SLOTS_FOR) as (keyof typeof SLOTS_FOR)[]);
  const depth = shopDepth(world.walls);
  world.merchant = Array.from({ length: count }, (_, index) => {
    const rarity = nextFloat(world.rng) < rareShare ? 'rare' : 'magic';
    const slot = index < kinds.length ? SLOTS_FOR[kinds[index]!][0] : undefined;
    return rollItemSpec(world.rng, depth, rarity, slot);
  });
}

function pay(world: TownWorld, gold: number): TownRefusal | null {
  if (world.gold < gold) return 'notEnoughGold';
  world.gold -= gold;
  return null;
}

function receive(world: TownWorld, spec: ItemSpec): void {
  putInStash(world, { ...spec, id: world.nextItemId++ });
}

export function buyItem(world: TownWorld, index: number): TownRefusal | null {
  const item = world.merchant[index];
  if (!item) return 'unknownOffer';
  const refusal = pay(world, merchantPrice(item));
  if (refusal) return refusal;
  world.merchant.splice(index, 1);
  receive(world, item);
  return null;
}

/** Uniques the gamble vendor may sell for a Slot: those whose Guardian's Lamp is relit. */
function gambleUniques(walls: readonly WallState[], slot: Slot): UniqueId[] {
  const held = new Set(LAMPS.flatMap((lamp, index) => (walls[index]!.lampLit && lamp.holds ? [lamp.holds] : [])));
  return UNIQUE_IDS.filter((id) => held.has(id) && SLOTS_FOR[UNIQUES[id].kind].includes(slot));
}

/** A hidden item for the Slot, into the Stash. */
export function gamble(world: TownWorld, slot: Slot): TownRefusal | null {
  const kind = (Object.keys(SLOTS_FOR) as (keyof typeof SLOTS_FOR)[]).find((candidate) => SLOTS_FOR[candidate].includes(slot));
  if (!kind) return 'wrongSlot';
  const refusal = pay(world, gamblePrice(world.walls));
  if (refusal) return refusal;
  const depth = shopDepth(world.walls);
  const rareShare = Math.min(GAMBLE.maxRareShare, GAMBLE.rareShare + GAMBLE.rareSharePerLamp * lampsLit(world.walls));
  const roll = nextFloat(world.rng);
  const uniques = gambleUniques(world.walls, slot);
  if (roll < GAMBLE.uniqueShare && uniques.length > 0) {
    receive(world, uniqueSpec(uniques[Math.floor(nextFloat(world.rng) * uniques.length)]!, depth));
    return null;
  }
  // A unique roll with none to sell is a rare.
  const rarity = roll < GAMBLE.uniqueShare + rareShare ? 'rare' : 'magic';
  receive(world, rollItemSpec(world.rng, depth, rarity, slot));
  return null;
}

/** Changes one Affix on an item in the Stash or worn by a Hero into one the item lacks, at the item's depth. */
export function rerollAffix(world: TownWorld, itemId: ItemId, affixId: AffixId): TownRefusal | null {
  const stashIndex = world.stash.findIndex((item) => item.id === itemId);
  const wearer = world.heroes.find((hero) => Object.values(hero.equipped).some((item) => item?.id === itemId));
  const item: ItemState | undefined = stashIndex >= 0 ? world.stash[stashIndex] : Object.values(wearer?.equipped ?? {}).find((worn) => worn?.id === itemId);
  if (!item) return 'unknownItem';
  const cost = rerollCost(item);
  if (cost === null || !item.affixes.some((affix) => affix.id === affixId)) return 'noSuchAffix';
  if (world.salvage < cost) return 'notEnoughSalvage';
  world.salvage -= cost;
  const rerolled: ItemState = { ...item, affixes: rerolledAffixes(world.rng, item, affixId) };
  if (stashIndex >= 0) {
    world.stash[stashIndex] = rerolled;
    world.stashRevision++;
  } else {
    const slot = slotsOf(item).find((candidate) => wearer!.equipped[candidate]?.id === itemId)!;
    wearer!.equipped[slot] = rerolled;
    clampToMaximums(wearer!);
  }
  return null;
}

/** Whether saved gold and stock are sound. */
export const isPurse = (value: Record<string, unknown>): boolean =>
  isNumber(value['gold']) && value['gold'] >= 0 && Array.isArray(value['merchant']) && value['merchant'].every((item) => isItem({ ...item, id: 0 }));
