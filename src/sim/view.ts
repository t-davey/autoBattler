import type { BattleState, Row, TeamId } from './battle';
import { xpToNextLevel } from './content/party';
import { MAX_SKILL_RANK, rankValue, SKILL_IDS, SKILLS, type HeroId, type SkillId, type SkillKind, type SkillReach } from './content/skills';
import { ENEMY_TEAM, heroesOf, PARTY_TEAM, stateOf, type Game } from './game';
import { heroStats, unspentPoints, type HeroState, type HeroStats } from './heroes';
import { pointsToOpen, spendRefusal, spentPoints, type SpendRefusal } from './skills';

export interface UnitView {
  readonly id: string;
  readonly name: string;
  readonly row: Row;
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
}

export interface HeroView {
  readonly id: HeroId;
  readonly name: string;
  readonly level: number;
  readonly xp: number;
  readonly xpToNext: number;
  readonly stats: HeroStats;
  readonly oil: number;
  readonly pointsSpent: number;
  readonly unspentPoints: number;
  readonly skills: readonly SkillView[];
  readonly order: readonly SkillId[];
}

export interface GameView {
  readonly tick: number;
  readonly phase: 'travelling' | 'battle';
  readonly battle: BattleView | null;
  readonly heroes: readonly HeroView[];
}

function viewTeam(battle: BattleState, team: TeamId): readonly UnitView[] {
  return battle.units
    .filter((unit) => unit.team === team)
    .map((unit) => ({
      id: unit.spec.id,
      name: unit.spec.name,
      row: unit.row,
      health: unit.health,
      maxHealth: unit.spec.health,
      oil: unit.oil,
      maxOil: unit.spec.maxOil ?? 0,
      bleeding: unit.bleed !== null,
      poisonStacks: unit.poison.length,
      wardAmount: unit.ward && battle.tick < unit.ward.expiresAt ? unit.ward.amount : 0,
    }));
}

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
  };
}

function viewHero(hero: HeroState): HeroView {
  return {
    id: hero.id,
    name: hero.name,
    level: hero.level,
    xp: hero.xp,
    xpToNext: xpToNextLevel(hero.level),
    stats: heroStats(hero),
    oil: hero.oil,
    pointsSpent: spentPoints(hero.ranks),
    unspentPoints: unspentPoints(hero),
    skills: SKILL_IDS.filter((id) => SKILLS[id].heroId === hero.id).map((id) => viewSkill(hero, id)),
    order: [...hero.order],
  };
}

export function viewGame(game: Game): GameView {
  const { tick, battle } = stateOf(game);
  return {
    tick,
    phase: battle ? 'battle' : 'travelling',
    battle: battle && { party: viewTeam(battle, PARTY_TEAM), enemies: viewTeam(battle, ENEMY_TEAM) },
    heroes: heroesOf(game).map(viewHero),
  };
}
