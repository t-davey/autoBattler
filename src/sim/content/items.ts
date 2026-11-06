import type { Reach } from '../battle';
import type { FloorNumber } from '../floors';

export type Slot = 'weapon' | 'body' | 'trinket';
export type Rarity = 'common' | 'magic' | 'rare';
export type BaseId = 'iron-cudgel' | 'flensing-knife' | 'bone-sling' | 'rust-mail' | 'waxed-shroud' | 'saints-knuckle';
export type AffixId = 'keen' | 'hale' | 'iron-bound' | 'sallow' | 'cruel' | 'swift';

/** What an item adds to a Hero. poisonResistance and critChance are percentages. */
export interface ItemStats {
  readonly power: number;
  readonly maxHealth: number;
  readonly armour: number;
  readonly poisonResistance: number;
  readonly critChance: number;
  readonly speed: number;
}
export type ItemStat = keyof ItemStats;

export interface ItemBase {
  readonly name: string;
  readonly slot: Slot;
  /** Set on weapons only. */
  readonly reach: Reach | null;
  readonly builtIn: Readonly<Partial<ItemStats>>;
}

export const SLOTS: readonly Slot[] = ['weapon', 'body', 'trinket'];
export const RARITIES: readonly Rarity[] = ['common', 'magic', 'rare'];

export const ITEM_BASES: Readonly<Record<BaseId, ItemBase>> = {
  'iron-cudgel': { name: 'Iron Cudgel', slot: 'weapon', reach: 'melee', builtIn: { power: 4 } },
  'flensing-knife': { name: 'Flensing Knife', slot: 'weapon', reach: 'melee', builtIn: { power: 3, critChance: 2 } },
  'bone-sling': { name: 'Bone Sling', slot: 'weapon', reach: 'ranged', builtIn: { power: 3 } },
  'rust-mail': { name: 'Rust Mail', slot: 'body', reach: null, builtIn: { armour: 8 } },
  'waxed-shroud': { name: 'Waxed Shroud', slot: 'body', reach: null, builtIn: { armour: 4, poisonResistance: 8 } },
  'saints-knuckle': { name: "Saint's Knuckle", slot: 'trinket', reach: null, builtIn: {} },
};

export const BASE_IDS = Object.keys(ITEM_BASES) as readonly BaseId[];

/** A common has no Affixes, so a base with nothing built in would do nothing. */
export const COMMON_BASE_IDS = BASE_IDS.filter((id) => Object.keys(ITEM_BASES[id].builtIn).length > 0);

export interface AffixDefinition {
  readonly id: AffixId;
  readonly name: string;
  readonly stat: ItemStat;
  readonly min: number;
  readonly max: number;
}

/** In the order an item's name lists them. */
export const AFFIXES: readonly AffixDefinition[] = [
  { id: 'keen', name: 'Keen', stat: 'power', min: 1, max: 4 },
  { id: 'hale', name: 'Hale', stat: 'maxHealth', min: 10, max: 30 },
  { id: 'iron-bound', name: 'Iron-bound', stat: 'armour', min: 4, max: 12 },
  { id: 'sallow', name: 'Sallow', stat: 'poisonResistance', min: 6, max: 15 },
  { id: 'cruel', name: 'Cruel', stat: 'critChance', min: 2, max: 6 },
  { id: 'swift', name: 'Swift', stat: 'speed', min: 3, max: 8 },
];

/** Percentages of common and magic. The rest is rare. */
export const RARITY_ODDS: Readonly<Record<FloorNumber, { readonly common: number; readonly magic: number }>> = {
  1: { common: 78, magic: 19 },
  2: { common: 70, magic: 23 },
  3: { common: 60, magic: 28 },
};

export const AFFIX_COUNTS: Readonly<Record<Rarity, { readonly min: number; readonly max: number }>> = {
  common: { min: 0, max: 0 },
  magic: { min: 1, max: 2 },
  rare: { min: 3, max: 4 },
};

export const AFFIX_SCALE: Readonly<Record<FloorNumber, number>> = { 1: 1, 2: 1.2, 3: 1.4 };
export const LEVEL_REQUIREMENT: Readonly<Record<FloorNumber, number>> = { 1: 1, 2: 3, 3: 4 };
export const RARE_LEVEL_BONUS = 1;

export const CHEST_DROP_CHANCE = 0.6;
export const BATTLE_DROP_CHANCE = 0.1;
