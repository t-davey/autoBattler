import type { Reach, Row } from '../battle';
import type { HeroId } from './skills';

export interface ClassStats {
  readonly className: string;
  readonly row: Row;
  readonly reach: Reach;
  readonly health: number;
  readonly healthPerLevel: number;
  readonly power: number;
  readonly powerPerLevel: number;
  /** Until items arrive, the starter weapon is a constant on the Hero. */
  readonly starterWeaponPower: number;
  readonly armour: number;
  readonly armourPerLevel: number;
  readonly speed: number;
  /** A percentage. */
  readonly critChance: number;
  readonly maxOil: number;
}

export const HERO_IDS: readonly HeroId[] = ['sin-eater', 'huntsman', 'lamplighter'];

export const CLASSES: Readonly<Record<HeroId, ClassStats>> = {
  'sin-eater': { className: 'Sin-Eater', row: 'front', reach: 'melee', health: 160, healthPerLevel: 16, power: 10, powerPerLevel: 1, starterWeaponPower: 4, armour: 20, armourPerLevel: 3, speed: 95, critChance: 3, maxOil: 100 },
  huntsman: { className: 'Huntsman', row: 'front', reach: 'melee', health: 110, healthPerLevel: 10, power: 14, powerPerLevel: 2, starterWeaponPower: 3, armour: 8, armourPerLevel: 1, speed: 110, critChance: 8, maxOil: 100 },
  lamplighter: { className: 'Lamplighter', row: 'back', reach: 'ranged', health: 95, healthPerLevel: 9, power: 11, powerPerLevel: 1, starterWeaponPower: 3, armour: 5, armourPerLevel: 1, speed: 100, critChance: 5, maxOil: 100 },
};

export const LEVEL_CAP = 60;
/** Temporary until Floors set XP by Floor. */
export const XP_PER_BATTLE = 15;
export const OIL_BETWEEN_BATTLES = 30;
export const MAX_NAME_LENGTH = 24;

/** XP from a level to the next. */
export const xpToNextLevel = (level: number): number => 15 * level * level + 45 * level;

/** Ticks between actions at a speed. */
export const actionIntervalFor = (speed: number): number => Math.round((30 * 100) / speed);
