import { maxHealthOf, type BattleState, type Reach, type Row, type TeamId } from './battle';
import type { Slot } from './content/items';
import { GRID_HEIGHT, GRID_WIDTH, LAST_FLOOR, type Depth, type RoomKind } from './floors';
import { CLASSES, xpToNextLevel } from './content/party';
import { MAX_SKILL_RANK, rankValue, SKILL_IDS, SKILLS, type HeroId, type SkillId, type SkillKind, type SkillReach } from './content/skills';
import { heroesOf, stateOf, type Game } from './game';
import { heroReach, heroStats, unspentPoints, type HeroState, type HeroStats } from './heroes';
import { viewItem, type ItemView } from './items';
import { ENEMY_TEAM, PARTY_TEAM, type Phase, type RunState } from './run';
import { pointsToOpen, spendRefusal, spentPoints, type SpendRefusal } from './skills';
import { SETBACKS_TO_FALL_BACK } from './wall';

export interface UnitView {
  readonly id: string;
  readonly name: string;
  readonly row: Row;
  readonly reach: Reach;
  readonly health: number;
  readonly maxHealth: number;
  readonly oil: number;
  /** 0 for a Unit with no lantern. */
  readonly maxOil: number;
  readonly bleeding: boolean;
  readonly poisonStacks: number;
  readonly wardAmount: number;
}

export interface BattleView {
  readonly party: readonly UnitView[];
  readonly enemies: readonly UnitView[];
}

export interface SkillValueView {
  readonly label: string;
  /** Percentages. Current is null until the skill is learned, next is null at the top rank. */
  readonly current: number | null;
  readonly next: number | null;
}

export interface SkillView {
  readonly id: SkillId;
  readonly name: string;
  readonly branch: string;
  readonly step: number;
  readonly kind: SkillKind;
  readonly row: Row | 'either';
  readonly reach: SkillReach | null;
  readonly oil: number;
  readonly cooldown: number;
  readonly summary: string;
  readonly rank: number;
  readonly maxRank: number;
  readonly pointsToOpen: number;
  readonly values: readonly SkillValueView[];
  /** Why a point can't go here now, or null if it can. */
  readonly refusal: SpendRefusal | null;
  /** A melee skill can't fire while the Hero holds a ranged weapon. */
  readonly blockedByWeapon: boolean;
}

export interface HeroView {
  readonly id: HeroId;
  readonly name: string;
  /** Where the Hero stands when a Battle starts. */
  readonly row: Row;
  readonly reach: Reach;
  readonly level: number;
  readonly xp: number;
  readonly xpToNext: number;
  readonly stats: HeroStats;
  readonly health: number;
  readonly oil: number;
  readonly pointsSpent: number;
  readonly unspentPoints: number;
  readonly skills: readonly SkillView[];
  readonly order: readonly SkillId[];
  readonly equipment: Readonly<Record<Slot, ItemView | null>>;
}

export interface RoomView {
  readonly x: number;
  readonly y: number;
  readonly kind: RoomKind;
  /** Current is the Room the Party is in or travelling to. */
  readonly state: 'cleared' | 'current' | 'ahead';
}

export interface FloorMapView {
  readonly width: number;
  readonly height: number;
  /** In the order the Party visits them. */
  readonly rooms: readonly RoomView[];
}

export interface WallView {
  readonly lampLit: boolean;
  readonly setbacksTowardsFallback: number;
  /** The count at which the Party falls back. */
  readonly setbacksToFallBack: number;
  readonly fallenBack: boolean;
}

export interface GameView {
  readonly tick: number;
  readonly phase: Phase;
  readonly battle: BattleView | null;
  readonly map: FloorMapView | null;
  readonly floor: Depth | null;
  /** The Floor whose Guardian guards the Lamp. */
  readonly lampFloor: Depth;
  /** The countdown until the Party leaves Town. */
  readonly townTicksLeft: number | null;
  readonly wall: WallView;
  readonly heroes: readonly HeroView[];
  /** Changes whenever the Stash does, so a reader can call viewStash only then. */
  readonly stashRevision: number;
}

function viewTeam(battle: BattleState, team: TeamId): readonly UnitView[] {
  return battle.units
    .filter((unit) => unit.team === team)
    .map((unit) => ({
      id: unit.spec.id,
      name: unit.spec.name,
      row: unit.row,
      reach: unit.spec.reach,
      health: unit.health,
      maxHealth: maxHealthOf(unit),
      oil: unit.oil,
      maxOil: unit.spec.maxOil ?? 0,
      bleeding: unit.bleed !== null,
      poisonStacks: unit.poison.length,
      wardAmount: unit.ward && battle.tick < unit.ward.expiresAt ? unit.ward.amount : 0,
    }));
}

/** A melee skill can't fire without a melee weapon. */
const weaponBlocksSkill = (weaponReach: Reach, skillReach: SkillReach | null): boolean => skillReach === 'melee' && weaponReach !== 'melee';

function viewSkill(hero: HeroState, id: SkillId): SkillView {
  const skill = SKILLS[id];
  const rank = hero.ranks[id] ?? 0;
  return {
    id,
    name: skill.name,
    branch: skill.branch,
    step: skill.step,
    kind: skill.kind,
    row: skill.row,
    reach: skill.reach,
    oil: skill.oil,
    cooldown: skill.cooldown,
    summary: skill.summary,
    rank,
    maxRank: MAX_SKILL_RANK,
    pointsToOpen: pointsToOpen(id),
    values: skill.values.map(({ label }, index) => ({
      label,
      current: rank > 0 ? rankValue(id, rank, index) : null,
      next: rank < MAX_SKILL_RANK ? rankValue(id, rank + 1, index) : null,
    })),
    refusal: spendRefusal(hero.id, hero.ranks, unspentPoints(hero), id),
    blockedByWeapon: weaponBlocksSkill(heroReach(hero), skill.reach),
  };
}

/** Whether equipping this item would stop a skill the Hero has learned. */
export const itemBlocksLearnedSkill = (item: ItemView, hero: HeroView): boolean =>
  item.reach !== null && hero.skills.some((skill) => skill.rank > 0 && weaponBlocksSkill(item.reach!, skill.reach));

function viewEquipped(hero: HeroState, slot: Slot): ItemView | null {
  const item = hero.equipped[slot];
  return item ? viewItem(item) : null;
}

function viewHero(hero: HeroState): HeroView {
  return {
    id: hero.id,
    name: hero.name,
    row: CLASSES[hero.id].row,
    reach: heroReach(hero),
    level: hero.level,
    xp: Math.floor(hero.xp),
    xpToNext: xpToNextLevel(hero.level),
    stats: heroStats(hero),
    health: hero.health,
    oil: hero.oil,
    pointsSpent: spentPoints(hero.ranks),
    unspentPoints: unspentPoints(hero),
    skills: SKILL_IDS.filter((id) => SKILLS[id].heroId === hero.id).map((id) => viewSkill(hero, id)),
    order: [...hero.order],
    equipment: {
      weapon: viewEquipped(hero, 'weapon'),
      body: viewEquipped(hero, 'body'),
      trinket: viewEquipped(hero, 'trinket'),
    },
  };
}

function viewMap({ layout, room }: RunState): FloorMapView | null {
  if (!layout) return null;
  return {
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    rooms: layout.rooms.map((cell, index) => ({
      x: cell.x,
      y: cell.y,
      kind: cell.kind,
      state: index < room ? 'cleared' : index === room ? 'current' : 'ahead',
    })),
  };
}

export function viewGame(game: Game): GameView {
  const { tick, battle, run, wall, stashRevision } = stateOf(game);
  return {
    tick,
    phase: run.phase,
    map: viewMap(run),
    floor: run.floor,
    lampFloor: LAST_FLOOR,
    townTicksLeft: run.phase === 'town' ? run.ticksLeft : null,
    wall: { lampLit: wall.lampLit, setbacksTowardsFallback: wall.setbacks, setbacksToFallBack: SETBACKS_TO_FALL_BACK, fallenBack: wall.fallenBack },
    battle: battle && { party: viewTeam(battle, PARTY_TEAM), enemies: viewTeam(battle, ENEMY_TEAM) },
    heroes: heroesOf(game).map(viewHero),
    stashRevision,
  };
}

/** The Stash, in the order items arrived in it. */
export const viewStash = (game: Game): readonly ItemView[] => stateOf(game).stash.map(viewItem);
