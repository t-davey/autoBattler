import { maxHealthOf, type BattleState, type Reach, type Row, type TeamId } from './battle';
import type { Slot } from './content/items';
import { FLOORS_PER_LAMP } from './content/world';
import { GRID_HEIGHT, GRID_WIDTH, lampIndexOf, type Depth, type RoomKind } from './floors';
import { CLASSES, xpToNextLevel } from './content/party';
import { MAX_SKILL_RANK, rankValue, SKILL_IDS, SKILLS, type HeroId, type SkillId, type SkillKind, type SkillReach } from './content/skills';
import { heroesOf, stateOf, type Game } from './game';
import { heroReach, heroStats, skillRank, unspentPoints, type HeroState, type HeroStats } from './heroes';
import { viewItem, type ItemView } from './items';
import { ENEMY_TEAM, PARTY_TEAM, type Phase, type RunState } from './run';
import { pointsToOpen, spendRefusal, spentPoints, type SpendRefusal } from './skills';
import { viewPick, type PickView } from './picks';
import type { PickTag } from './content/picks';
import { frontierIndex, runStretch, SETBACKS_TO_FALL_BACK } from './wall';

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
  /** A stand-in for content not yet designed. */
  readonly placeholder: boolean;
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
  /** A plain count rather than a percentage. */
  readonly count: boolean;
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
  /** A percentage of max health paid instead of Oil, or null. */
  readonly healthCost: number | null;
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
  /** The free Class skill: always learned, at a fixed strength. */
  readonly free: boolean;
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
  /** Whether the Lamp at the end of the Party's stretch is lit: the one ahead on a Floor, or next Run's from Town. */
  readonly lampLit: boolean;
  /** Lamps relit so far, of 12. */
  readonly lampsLit: number;
  /** The rest count the frontier Lamp, the first dark one. */
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
  /** The Floor whose Guardian guards the Lamp at the end of the Party's stretch. */
  readonly lampFloor: Depth;
  /** The countdown until the Party leaves Town. */
  readonly townTicksLeft: number | null;
  readonly wall: WallView;
  readonly heroes: readonly HeroView[];
  /** Picks taken this Run, in order. Empty in Town. */
  readonly picks: readonly PickView[];
  /** The player's Pick rule: every tag once, earlier tags win. */
  readonly pickPriority: readonly PickTag[];
  /** Changes whenever the Stash does, so a reader can call viewStash only then. */
  readonly stashRevision: number;
}

function viewTeam(battle: BattleState, team: TeamId): readonly UnitView[] {
  return battle.units
    .filter((unit) => unit.team === team)
    .map((unit) => ({
      id: unit.spec.id,
      name: unit.spec.name,
      placeholder: unit.spec.placeholder === true,
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
  const rank = skillRank(hero, id);
  const free = skill.free === true;
  const maxRank = free ? rank : MAX_SKILL_RANK;
  return {
    id,
    name: skill.name,
    branch: skill.branch,
    step: skill.step,
    kind: skill.kind,
    row: skill.row,
    reach: skill.reach,
    oil: skill.oil,
    healthCost: skill.healthCost ?? null,
    cooldown: skill.cooldown,
    summary: skill.summary,
    rank,
    maxRank,
    pointsToOpen: pointsToOpen(id),
    values: skill.values.map(({ label, count }, index) => ({
      label,
      count: count === true,
      current: rank > 0 ? rankValue(id, rank, index) : null,
      next: rank < maxRank ? rankValue(id, rank + 1, index) : null,
    })),
    refusal: spendRefusal(hero.id, hero.ranks, unspentPoints(hero), id),
    blockedByWeapon: weaponBlocksSkill(heroReach(hero), skill.reach),
    free,
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
  const { tick, battle, run, walls, stashRevision } = stateOf(game);
  const ahead = run.floor === null ? runStretch(walls) : lampIndexOf(run.floor);
  const frontier = walls[frontierIndex(walls)]!;
  return {
    tick,
    phase: run.phase,
    map: viewMap(run),
    floor: run.floor,
    lampFloor: (ahead + 1) * FLOORS_PER_LAMP,
    townTicksLeft: run.phase === 'town' ? run.ticksLeft : null,
    wall: {
      lampLit: walls[ahead]!.lampLit,
      lampsLit: walls.filter((wall) => wall.lampLit).length,
      setbacksTowardsFallback: frontier.setbacks,
      setbacksToFallBack: SETBACKS_TO_FALL_BACK,
      fallenBack: frontier.fallenBack,
    },
    battle: battle && { party: viewTeam(battle, PARTY_TEAM), enemies: viewTeam(battle, ENEMY_TEAM) },
    heroes: heroesOf(game).map(viewHero),
    picks: run.picks.map(viewPick),
    pickPriority: stateOf(game).pickPriority,
    stashRevision,
  };
}

/** The Stash, in the order items arrived in it. */
export const viewStash = (game: Game): readonly ItemView[] => stateOf(game).stash.map(viewItem);
