import type { Row } from '../battle';
import type { BaseId } from './items';
import type { HeroId } from './skills';

export interface ClassStats {
  readonly className: string;
  readonly row: Row;
  readonly health: number;
  readonly healthPerLevel: number;
  readonly power: number;
  readonly powerPerLevel: number;
  /** A common of this base, equipped when the Hero is created. */
  readonly starterWeapon: BaseId;
  readonly armour: number;
  readonly armourPerLevel: number;
  readonly speed: number;
  /** A percentage. */
  readonly critChance: number;
  readonly maxOil: number;
}

export const HERO_IDS: readonly HeroId[] = ['sin-eater', 'warrener', 'lamplighter'];

export const CLASSES: Readonly<Record<HeroId, ClassStats>> = {
  'sin-eater': { className: 'Sin-Eater', row: 'front', health: 160, healthPerLevel: 16, power: 10, powerPerLevel: 1, starterWeapon: 'iron-cudgel', armour: 20, armourPerLevel: 3, speed: 95, critChance: 3, maxOil: 100 },
  warrener: { className: 'Warrener', row: 'front', health: 110, healthPerLevel: 10, power: 14, powerPerLevel: 2, starterWeapon: 'flensing-knife', armour: 8, armourPerLevel: 1, speed: 110, critChance: 8, maxOil: 100 },
  lamplighter: { className: 'Lamplighter', row: 'back', health: 95, healthPerLevel: 9, power: 11, powerPerLevel: 1, starterWeapon: 'bone-sling', armour: 5, armourPerLevel: 1, speed: 100, critChance: 5, maxOil: 100 },
};

export const LEVEL_CAP = 60;
export const OIL_BETWEEN_ROOMS = 30;
export const MAX_NAME_LENGTH = 24;

/** XP from a level to the next. */
export const xpToNextLevel = (level: number): number => 15 * level * level + 45 * level;

/** Ticks between actions at a speed. */
export const actionIntervalFor = (speed: number): number => Math.round((30 * 100) / speed);
