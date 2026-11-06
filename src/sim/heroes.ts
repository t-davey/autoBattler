import type { UnitSpec } from './battle';
import { actionIntervalFor, CLASSES, HERO_IDS, LEVEL_CAP, xpToNextLevel } from './content/party';
import { SKILLS, type HeroId, type SkillId } from './content/skills';
import { learnedActives, spentPoints, type SkillRanks } from './skills';

/** A Hero between Battles, as plain JSON-safe data. */
export interface HeroState {
  readonly id: HeroId;
  name: string;
  level: number;
  /** XP towards the next level. */
  xp: number;
  oil: number;
  ranks: Partial<Record<SkillId, number>>; // Mutable, unlike SkillRanks.
  /** The learned active skills, first choice first. */
  order: SkillId[];
}

export interface HeroSetup {
  readonly level?: number | undefined;
  readonly ranks?: SkillRanks | undefined;
}

export function createHero(id: HeroId, setup: HeroSetup = {}): HeroState {
  const ranks = { ...setup.ranks };
  return { id, name: CLASSES[id].className, level: setup.level ?? 1, xp: 0, oil: CLASSES[id].maxOil, ranks, order: learnedActives(ranks) };
}

export const createParty = (setupFor: (id: HeroId) => HeroSetup = () => ({})): HeroState[] =>
  HERO_IDS.map((id) => createHero(id, setupFor(id)));

/** Each level past the first grants a point. */
export const unspentPoints = (hero: HeroState): number =>
  Math.max(0, hero.level - 1 - spentPoints(hero.ranks));

export interface HeroStats {
  readonly maxHealth: number;
  readonly power: number;
  readonly armour: number;
  readonly actionInterval: number;
  readonly critChance: number;
  readonly maxOil: number;
}

export function heroStats(hero: HeroState): HeroStats {
  const stats = CLASSES[hero.id];
  const levels = hero.level - 1;
  return {
    maxHealth: stats.health + stats.healthPerLevel * levels,
    power: stats.power + stats.powerPerLevel * levels + stats.starterWeaponPower,
    armour: stats.armour + stats.armourPerLevel * levels,
    actionInterval: actionIntervalFor(stats.speed),
    critChance: stats.critChance,
    maxOil: stats.maxOil,
  };
}

/** The Hero as a Unit, as the next Battle would field them. Actives come first, in order. */
export function heroUnitSpec(hero: HeroState): UnitSpec {
  const { row, reach } = CLASSES[hero.id];
  const { maxHealth, power, armour, actionInterval, critChance, maxOil } = heroStats(hero);
  const passives = (Object.keys(hero.ranks) as SkillId[]).filter((id) => SKILLS[id].kind === 'passive');
  return {
    id: hero.id,
    name: hero.name,
    health: maxHealth,
    power,
    actionInterval,
    row,
    reach,
    targeting: 'any',
    damageType: 'physical',
    armour,
    resistances: {},
    critChance,
    oil: Math.min(hero.oil, maxOil),
    maxOil,
    skills: [...hero.order, ...passives].map((id) => ({ id, rank: hero.ranks[id] ?? 0 })),
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
