import type { BattleState, Row, TeamId } from './battle';
import { ENEMY_TEAM, PARTY_TEAM, stateOf, type Game } from './game';

export interface UnitView {
  readonly id: string;
  readonly name: string;
  readonly row: Row;
  readonly health: number;
  readonly maxHealth: number;
}

export interface BattleView {
  readonly party: readonly UnitView[];
  readonly enemies: readonly UnitView[];
}

export interface GameView {
  readonly tick: number;
  readonly phase: 'travelling' | 'battle';
  readonly battle: BattleView | null;
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
    }));
}

export function viewGame(game: Game): GameView {
  const { tick, battle } = stateOf(game);
  return {
    tick,
    phase: battle ? 'battle' : 'travelling',
    battle: battle && { party: viewTeam(battle, PARTY_TEAM), enemies: viewTeam(battle, ENEMY_TEAM) },
  };
}
