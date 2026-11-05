import { createRng } from './rng';

export type TeamId = 'a' | 'b';

export interface UnitSpec {
  readonly id: string;
  readonly hp: number;
  readonly attack: number;
  /** Ticks between this Unit's attacks. */
  readonly attackInterval: number;
}

export interface BattleSetup {
  readonly seed: number;
  readonly teams: Readonly<Record<TeamId, readonly UnitSpec[]>>;
  readonly maxTicks?: number;
}

export type BattleEvent =
  | { readonly type: 'attack'; readonly tick: number; readonly attackerId: string; readonly targetId: string; readonly damage: number }
  | { readonly type: 'death'; readonly tick: number; readonly unitId: string };

export interface BattleResult {
  /** null when the Battle is a draw. */
  readonly winner: TeamId | null;
  readonly ticks: number;
  readonly log: readonly BattleEvent[];
}

const DEFAULT_MAX_TICKS = 1000;

interface UnitState {
  readonly spec: UnitSpec;
  readonly team: TeamId;
  hp: number;
  cooldown: number;
}

export function simulateBattle(setup: BattleSetup): BattleResult {
  const rng = createRng(setup.seed);
  const maxTicks = setup.maxTicks ?? DEFAULT_MAX_TICKS;
  const log: BattleEvent[] = [];

  const spawn = (team: TeamId): UnitState[] =>
    setup.teams[team].map((spec) => ({ spec, team, hp: spec.hp, cooldown: spec.attackInterval }));
  const units = [...spawn('a'), ...spawn('b')];

  const livingOn = (team: TeamId) => units.filter((u) => u.team === team && u.hp > 0);
  const isOver = () => livingOn('a').length === 0 || livingOn('b').length === 0;

  let tick = 0;
  while (!isOver() && tick < maxTicks) {
    tick++;
    // Shuffled so neither Team gets a first-strike advantage from its position in the setup.
    for (const unit of rng.shuffle(units)) {
      if (unit.hp <= 0) continue;
      unit.cooldown--;
      if (unit.cooldown > 0) continue;
      unit.cooldown = unit.spec.attackInterval;

      const enemies = livingOn(unit.team === 'a' ? 'b' : 'a');
      const target = enemies[rng.int(enemies.length)];
      if (!target) break;

      target.hp -= unit.spec.attack;
      log.push({ type: 'attack', tick, attackerId: unit.spec.id, targetId: target.spec.id, damage: unit.spec.attack });
      if (target.hp <= 0) log.push({ type: 'death', tick, unitId: target.spec.id });
    }
  }

  const aAlive = livingOn('a').length > 0;
  const bAlive = livingOn('b').length > 0;
  const winner = aAlive === bAlive ? null : aAlive ? 'a' : 'b';
  return { winner, ticks: tick, log };
}
