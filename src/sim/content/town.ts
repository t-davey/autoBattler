// Town's prices: starting values from docs/first-playable-town.md, for step 10 to tune.

/** A Battle's worth of gold at a depth, the unit every gold amount and price counts in. */
export const battleWorth = (depth: number): number => 5 + depth;

/** Gold from each source, in Battles' worth at the Floor's depth. */
export const GOLD_FROM = { battle: 1, chest: 3, guardian: 10 } as const;

/** A respec costs this much gold for each Hero level. */
export const RESPEC_GOLD_PER_LEVEL = 10;

/** Salvage to reroll one Affix. Commons and uniques have no Affixes to reroll. */
export const REROLL_SALVAGE = { magic: 5, rare: 15 } as const;

export const MERCHANT = {
  /** Items in stock with no Lamp relit. */
  stock: 4,
  /** One more item for every this many Lamps relit. */
  lampsPerExtraItem: 2,
  maxStock: 10,
  rareShare: 0.2,
  rareSharePerLamp: 0.05,
  maxRareShare: 0.6,
  /** Prices in Battles' worth at the item's depth. */
  price: { magic: 30, rare: 80 },
} as const;

export const GAMBLE = {
  /** In Battles' worth at the depth items roll at. */
  price: 25,
  uniqueShare: 0.02,
  rareShare: 0.28,
  rareSharePerLamp: 0.02,
  maxRareShare: 0.5,
} as const;
