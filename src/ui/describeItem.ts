import type { HeroStats, HeroView, ItemStat, ItemStats, ItemView, Slot } from '../sim';
import { seconds } from './describeHero';

export const SLOT_TEXT: Readonly<Record<Slot, string>> = {
  weapon: 'Weapon',
  offHand: 'Off-hand',
  helm: 'Helm',
  body: 'Body',
  trinket: 'Trinket',
  secondTrinket: 'Second trinket',
};

/** Words for what a stat does, as a Stash filter or a stat change names it. */
export const STAT_TEXT: Readonly<Record<ItemStat, string>> = {
  power: 'power',
  maxHealth: 'max health',
  armour: 'armour',
  poisonResistance: 'poison resistance',
  critChance: 'critical chance',
  speed: 'speed',
  maxOil: 'max Oil',
};

const PERCENT_STATS: ReadonlySet<ItemStat> = new Set(['poisonResistance', 'critChance']);

/** An item's stats, such as "+8 armour, +12% poison resistance". */
export function itemStatsText(stats: ItemStats): string {
  const parts = (Object.keys(STAT_TEXT) as ItemStat[])
    .filter((stat) => stats[stat] !== 0)
    .map((stat) => `+${stats[stat]}${PERCENT_STATS.has(stat) ? '%' : ''} ${STAT_TEXT[stat]}`);
  return parts.length > 0 ? parts.join(', ') : 'No stats';
}

/** The Slot an item would go to on this Hero: the picked one if it fits, else the first empty one it fits, else its first. */
export function targetSlot(item: ItemView, hero: HeroView, picked?: Slot): Slot {
  if (picked && item.slots.includes(picked)) return picked;
  return item.slots.find((slot) => !hero.equipment[slot]) ?? item.slot;
}

/** What equipping an item would change one stat by on this Hero, against what the Slot holds now. */
export const statChange = (item: ItemView, hero: HeroView, stat: ItemStat, slot = targetSlot(item, hero)): number =>
  item.stats[stat] - (hero.equipment[slot]?.stats[stat] ?? 0);

/** The stats an item would change for any of these Heroes. */
export const changedStats = (item: ItemView, heroes: readonly HeroView[], picked?: Slot): readonly ItemStat[] =>
  (Object.keys(STAT_TEXT) as ItemStat[]).filter((stat) => heroes.some((hero) => statChange(item, hero, stat, targetSlot(item, hero, picked)) !== 0));

/** A stat change, such as "+24%" or "-4". */
export function formatChange(stat: ItemStat, change: number): string {
  if (change === 0) return '0';
  return `${change > 0 ? '+' : ''}${change}${PERCENT_STATS.has(stat) ? '%' : ''}`;
}

/** A Hero's stat sheet on one line. */
export function statSheet({ maxHealth, power, armour, actionInterval, critChance, poisonResistance }: HeroStats): string {
  return `Health ${maxHealth} · Power ${power} · Armour ${armour} · Acts every ${seconds(actionInterval)} · Crit ${critChance}% · Poison resistance ${poisonResistance}%`;
}
