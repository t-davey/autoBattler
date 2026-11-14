import type { Reach } from '../battle';
import type { ClassId, SkillId } from './skills';

/** A place on a Hero an item goes. A trinket fits either trinket Slot. */
export type Slot = 'weapon' | 'offHand' | 'helm' | 'body' | 'trinket' | 'secondTrinket';
/** Which Slots an item fits. */
export type ItemKind = 'weapon' | 'offHand' | 'helm' | 'body' | 'trinket';
export type Rarity = 'common' | 'magic' | 'rare' | 'unique';
export type BaseId =
  | 'iron-cudgel'
  | 'flensing-knife'
  | 'bone-sling'
  | 'coffin-lid-buckler'
  | 'bone-censer'
  | 'spare-lantern'
  | 'iron-skullcap'
  | 'mourners-hood'
  | 'mould-mask'
  | 'rust-mail'
  | 'waxed-shroud'
  | 'saints-knuckle'
  | 'bone-dice'
  | 'spigot-key';
export type UniqueId = 'wake-platter' | 'ratters-quiver' | 'layer-outs-coif' | 'dusk-taper';
export type AffixId = 'keen' | 'hale' | 'iron-bound' | 'sallow' | 'cruel' | 'swift';

/** What an item adds to a Hero. poisonResistance and critChance are percentages. */
export interface ItemStats {
  readonly power: number;
  readonly maxHealth: number;
  readonly armour: number;
  readonly poisonResistance: number;
  readonly critChance: number;
  readonly speed: number;
  readonly maxOil: number;
}
export type ItemStat = keyof ItemStats;

export interface ItemBase {
  readonly name: string;
  readonly kind: ItemKind;
  /** Set on weapons only. */
  readonly reach: Reach | null;
  readonly builtIn: Readonly<Partial<ItemStats>>;
}

export const SLOTS: readonly Slot[] = ['weapon', 'offHand', 'helm', 'body', 'trinket', 'secondTrinket'];
export const SLOTS_FOR: Readonly<Record<ItemKind, readonly Slot[]>> = {
  weapon: ['weapon'],
  offHand: ['offHand'],
  helm: ['helm'],
  body: ['body'],
  trinket: ['trinket', 'secondTrinket'],
};
export const RARITIES: readonly Rarity[] = ['common', 'magic', 'rare', 'unique'];

export const ITEM_BASES: Readonly<Record<BaseId, ItemBase>> = {
  'iron-cudgel': { name: 'Iron Cudgel', kind: 'weapon', reach: 'melee', builtIn: { power: 4 } },
  'flensing-knife': { name: 'Flensing Knife', kind: 'weapon', reach: 'melee', builtIn: { power: 3, critChance: 2 } },
  'bone-sling': { name: 'Bone Sling', kind: 'weapon', reach: 'ranged', builtIn: { power: 3 } },
  'coffin-lid-buckler': { name: 'Coffin-Lid Buckler', kind: 'offHand', reach: null, builtIn: { armour: 5 } },
  'bone-censer': { name: 'Bone Censer', kind: 'offHand', reach: null, builtIn: { power: 2 } },
  'spare-lantern': { name: 'Spare Lantern', kind: 'offHand', reach: null, builtIn: { maxOil: 15 } },
  'iron-skullcap': { name: 'Iron Skullcap', kind: 'helm', reach: null, builtIn: { armour: 5 } },
  'mourners-hood': { name: "Mourner's Hood", kind: 'helm', reach: null, builtIn: { maxHealth: 15 } },
  'mould-mask': { name: 'Mould Mask', kind: 'helm', reach: null, builtIn: { armour: 2, poisonResistance: 6 } },
  'rust-mail': { name: 'Rust Mail', kind: 'body', reach: null, builtIn: { armour: 8 } },
  'waxed-shroud': { name: 'Waxed Shroud', kind: 'body', reach: null, builtIn: { armour: 4, poisonResistance: 8 } },
  'saints-knuckle': { name: "Saint's Knuckle", kind: 'trinket', reach: null, builtIn: {} },
  'bone-dice': { name: 'Bone Dice', kind: 'trinket', reach: null, builtIn: { critChance: 2 } },
  'spigot-key': { name: 'Spigot Key', kind: 'trinket', reach: null, builtIn: { speed: 3 } },
};

/** A hand-authored item only one Class can equip. It changes that Class's free skill. */
export interface UniqueDefinition extends ItemBase {
  readonly classId: ClassId;
  readonly skillId: SkillId;
  /** What the unique does to the skill, as the item shows it. */
  readonly change: string;
  /** Provisional until the human picks the words. */
  readonly line: string;
}

export const UNIQUES: Readonly<Record<UniqueId, UniqueDefinition>> = {
  'wake-platter': {
    name: 'The Wake Platter', kind: 'offHand', reach: null, builtIn: { armour: 6, maxHealth: 20 },
    classId: 'sin-eater', skillId: 'consume-sin',
    change: 'Consume Sin strikes every enemy in the front Row for 90% of power each, healing 3% of max health for each enemy hit.',
    line: 'Worn bright where the bread sat on the chest of the dead. Whatever it took up, it wasn’t only crumbs.',
  },
  'ratters-quiver': {
    name: "The Ratter's Quiver", kind: 'offHand', reach: null, builtIn: { power: 2, speed: 4 },
    classId: 'warrener', skillId: 'tainted-shaft',
    change: 'Tainted Shaft looses 2 shafts, at 2 different enemies when 2 live.',
    line: 'Stitched from cellar-rat hide. The shafts come out smelling of the warren, which is the point.',
  },
  'layer-outs-coif': {
    name: "The Layer-Out's Coif", kind: 'helm', reach: null, builtIn: { maxHealth: 15, power: 2 },
    classId: 'hexer', skillId: 'chill-word',
    change: 'Chill Word Slows by 25% and reaches every enemy in the target’s Row, which take 50% of its damage.',
    line: 'Linen stiff with grave-salt. A layer-out wore it to keep the dead from spoiling before they were collected.',
  },
  'dusk-taper': {
    name: 'The Dusk Taper', kind: 'trinket', reach: null, builtIn: { power: 2, critChance: 3 },
    classId: 'lamplighter', skillId: 'votive-spark',
    change: 'Votive Spark also heals the Hero with the lowest health share for 60% of the damage it dealt.',
    line: 'The taper that lights Town’s lamps at dusk. It burns cleanest on the evening supply.',
  },
};

export const UNIQUE_IDS = Object.keys(UNIQUES) as readonly UniqueId[];

/** The Wake Platter's Consume Sin: each front-Row hit's share of power, and the heal for each. */
export const WAKE_PLATTER_HIT = 0.9;
/** The Ratter's Quiver's Tainted Shaft looses this many shafts. */
export const QUIVER_SHAFTS = 2;
/** The Layer-Out's Coif's Chill Word: its Slow, and the share of damage the target's Row takes. */
export const COIF_SLOW = 25;
export const COIF_SPLASH = 0.5;
/** The Dusk Taper's Votive Spark heals this share of what it dealt. */
export const TAPER_HEAL = 0.6;

/** After the first kill, a Guardian's chance to drop its unique in place of an ordinary item. */
export const UNIQUE_DROP_CHANCE = 0.1;

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

export const AFFIX_COUNTS: Readonly<Record<Rarity, { readonly min: number; readonly max: number }>> = {
  common: { min: 0, max: 0 },
  magic: { min: 1, max: 2 },
  rare: { min: 3, max: 4 },
  unique: { min: 0, max: 0 },
};

export const RARE_LEVEL_BONUS = 1;

export const CHEST_DROP_CHANCE = 0.6;
/** Tripled from the demo's 0.1 for the weekend pace on 2026-11-11. */
export const BATTLE_DROP_CHANCE = 0.3;
