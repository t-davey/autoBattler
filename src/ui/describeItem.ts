import type { HeroStats, HeroView, ItemStat, ItemStats, ItemView, Slot } from '../sim';
import { seconds } from './describeHero';

export const SLOT_TEXT: Readonly<Record<Slot, string>> = { weapon: 'Weapon', body: 'Body', trinket: 'Trinket' };

/** Words for what a stat does, as a Stash filter or a stat change names it. */
export const STAT_TEXT: Readonly<Record<ItemStat, string>> = {
  power: 'power',
  maxHealth: 'max health',
  armour: 'armour',
  poisonResistance: 'poison resistance',
  critChance: 'critical chance',
  speed: 'speed',
};

const PERCENT_STATS: ReadonlySet<ItemStat> = new Set(['poisonResistance', 'critChance']);

/** What equipping an item would change one stat by on this Hero, against what the Slot holds now. */
export const statChange = (item: ItemView, hero: HeroView, stat: ItemStat): number => item.stats[stat] - (hero.equipment[item.slot]?.stats[stat] ?? 0);

/** The stats an item would change for any of these Heroes. */
export const changedStats = (item: ItemView, heroes: readonly HeroView[]): readonly ItemStat[] =>
  (Object.keys(STAT_TEXT) as ItemStat[]).filter((stat) => heroes.some((hero) => statChange(item, hero, stat) !== 0));

/** A stat change, such as "+24%" or "-4". */
export function formatChange(stat: ItemStat, change: number): string {
  if (change === 0) return '0';
  return `${change > 0 ? '+' : ''}${change}${PERCENT_STATS.has(stat) ? '%' : ''}`;
}

/** A Hero's stat sheet on one line. */
export function statSheet({ maxHealth, power, armour, actionInterval, critChance, poisonResistance }: HeroStats): string {
  return `Health ${maxHealth} · Power ${power} · Armour ${armour} · Acts every ${seconds(actionInterval)} · Crit ${critChance}% · Poison resistance ${poisonResistance}%`;
}
