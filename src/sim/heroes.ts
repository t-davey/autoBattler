import { isNumber, isRecord, isString } from './guards';
import type { Reach, UnitSpec } from './battle';
import { ITEM_BASES, type Slot } from './content/items';
import { actionIntervalFor, CLASSES, HERO_IDS, LEVEL_CAP, xpToNextLevel } from './content/party';
import { FREE_SKILL_RANK, SKILLS, type HeroId, type SkillId } from './content/skills';
import { gearStats, isEquipped, slotOf, type ItemState } from './items';
import { isFreeSkill, isPartialOrder, isRanks, orderFor, spentPoints, type SkillRanks } from './skills';

/** A Hero between Battles, as plain JSON-safe data. */
export interface HeroState {
  readonly id: HeroId;
  name: string;
  level: number;
  /** XP towards the next level. */
  xp: number;
  /** Carries between Rooms. */
  health: number;
  oil: number;
  ranks: Partial<Record<SkillId, number>>; // Mutable, unlike SkillRanks.
  /** The learned active skills, first choice first. */
  order: SkillId[];
  equipped: Partial<Record<Slot, ItemState>>;
}

export interface HeroSetup {
  readonly level?: number | undefined;
  readonly ranks?: SkillRanks | undefined;
  /** In order: a later item takes the Slot of an earlier one. */
  readonly gear?: readonly ItemState[] | undefined;
}

export function createHero(id: HeroId, setup: HeroSetup = {}): HeroState {
  const ranks = { ...setup.ranks };
  const hero: HeroState = { id, name: CLASSES[id].className, level: setup.level ?? 1, xp: 0, health: 0, oil: CLASSES[id].maxOil, ranks, order: orderFor(id, ranks), equipped: {} };
  for (const item of setup.gear ?? []) hero.equipped[slotOf(item)] = item;
  hero.health = heroStats(hero).maxHealth;
  return hero;
}

export const createParty = (setupFor: (id: HeroId) => HeroSetup = () => ({})): HeroState[] =>
  HERO_IDS.map((id) => createHero(id, setupFor(id)));

/** Each level past the first grants a point. */
/** A skill's rank for this Hero: fixed for the free Class skill, 0 if unlearned. */
export const skillRank = (hero: HeroState, id: SkillId): number => (isFreeSkill(id) ? FREE_SKILL_RANK : (hero.ranks[id] ?? 0));

export const unspentPoints = (hero: HeroState): number =>
  Math.max(0, hero.level - 1 - spentPoints(hero.ranks));

export interface HeroStats {
  readonly maxHealth: number;
  readonly power: number;
  readonly armour: number;
  readonly actionInterval: number;
  readonly critChance: number;
  readonly maxOil: number;
  /** A percentage. */
  readonly poisonResistance: number;
}

export function heroStats(hero: HeroState): HeroStats {
  const stats = CLASSES[hero.id];
  const gear = gearStats(Object.values(hero.equipped));
  const levels = hero.level - 1;
  return {
    maxHealth: stats.health + stats.healthPerLevel * levels + gear.maxHealth,
    power: stats.power + stats.powerPerLevel * levels + gear.power,
    armour: stats.armour + stats.armourPerLevel * levels + gear.armour,
    actionInterval: actionIntervalFor(stats.speed + gear.speed),
    critChance: stats.critChance + gear.critChance,
    maxOil: stats.maxOil,
    poisonResistance: gear.poisonResistance,
  };
}

/** Set by the weapon. A Hero with none fights in melee. */
export function heroReach(hero: HeroState): Reach {
  const weapon = hero.equipped.weapon;
  return (weapon && ITEM_BASES[weapon.baseId].reach) ?? 'melee';
}

/** Applies a new maximum to what the Hero carries. */
export function clampToMaximums(hero: HeroState): void {
  const { maxHealth, maxOil } = heroStats(hero);
  hero.health = Math.min(hero.health, maxHealth);
  hero.oil = Math.min(hero.oil, maxOil);
}

/** The Hero as a Unit, as the next Battle would field them. Actives come first, in order. */
export function heroUnitSpec(hero: HeroState): UnitSpec {
  const { row } = CLASSES[hero.id];
  const { maxHealth, power, armour, actionInterval, critChance, maxOil, poisonResistance } = heroStats(hero);
  const passives = (Object.keys(hero.ranks) as SkillId[]).filter((id) => SKILLS[id].kind === 'passive');
  return {
    id: hero.id,
    name: hero.name,
    health: Math.min(hero.health, maxHealth),
    maxHealth,
    power,
    actionInterval,
    row,
    reach: heroReach(hero),
    targeting: 'any',
    damageType: 'physical',
    armour,
    resistances: { poison: poisonResistance },
    critChance,
    oil: Math.min(hero.oil, maxOil),
    maxOil,
    skills: [...hero.order, ...passives].map((id) => ({ id, rank: skillRank(hero, id) })),
  };
}

/** Adds XP and returns the levels gained, in order. */
export function gainXp(hero: HeroState, xp: number): number[] {
  if (hero.level >= LEVEL_CAP) return [];
  const gained: number[] = [];
  hero.xp += xp;
  while (hero.level < LEVEL_CAP && hero.xp >= xpToNextLevel(hero.level)) {
    hero.xp -= xpToNextLevel(hero.level);
    hero.level++;
    gained.push(hero.level);
  }
  if (hero.level >= LEVEL_CAP) hero.xp = 0;
  return gained;
}

/** Whether saved data is a Hero this module could have made. */
export function isHeroState(value: unknown): boolean {
  if (!isRecord(value) || !HERO_IDS.includes(value['id'] as HeroId)) return false;
  const { ranks, order, level } = value;
  return (
    isString(value['name']) &&
    isNumber(level) &&
    Number.isInteger(level) &&
    level >= 1 &&
    isNumber(value['xp']) &&
    isNumber(value['health']) &&
    value['health'] > 0 &&
    isNumber(value['oil']) &&
    isRanks(ranks) &&
    Array.isArray(order) &&
    // Saves from before free Class skills lack them; loading completes the order.
    isPartialOrder(value['id'] as HeroId, ranks, order) &&
    isEquipped(value['equipped'])
  );
}
