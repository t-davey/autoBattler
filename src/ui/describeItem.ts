import type { HeroStats, ItemStat, ItemStats, ItemView, Slot } from '../sim';
import { seconds } from './describeHero';

export const SLOT_TEXT: Readonly<Record<Slot, string>> = { weapon: 'Weapon', body: 'Body', trinket: 'Trinket' };

/** Words for what a stat does, as a Stash filter or an item row names it. */
export const STAT_TEXT: Readonly<Record<ItemStat, string>> = {
  power: 'power',
  maxHealth: 'max health',
  armour: 'armour',
  poisonResistance: 'poison resistance',
  critChance: 'critical chance',
  speed: 'speed',
};

const PERCENT_STATS: ReadonlySet<ItemStat> = new Set(['poisonResistance', 'critChance']);

/** An item's stats, such as "+8 armour, +12% poison resistance". */
export function itemStatsText(stats: ItemStats): string {
  const parts = (Object.keys(STAT_TEXT) as ItemStat[])
    .filter((stat) => stats[stat] !== 0)
    .map((stat) => `+${stats[stat]}${PERCENT_STATS.has(stat) ? '%' : ''} ${STAT_TEXT[stat]}`);
  return parts.length > 0 ? parts.join(', ') : 'No stats';
}

/** An item's fixed facts: its Slot, its Reach if it is a weapon, and its level requirement. */
export function itemFacts(item: ItemView): string {
  const slot = item.reach ? `${SLOT_TEXT[item.slot]} (${item.reach})` : SLOT_TEXT[item.slot];
  return `${slot} · Level ${item.levelRequirement}`;
}

/** A Hero's stat sheet on one line. */
export function statSheet({ maxHealth, power, armour, actionInterval, critChance, poisonResistance }: HeroStats): string {
  return `Health ${maxHealth} · Power ${power} · Armour ${armour} · Acts every ${seconds(actionInterval)} · Crit ${critChance}% · Poison resistance ${poisonResistance}%`;
}
