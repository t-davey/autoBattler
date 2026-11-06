import { createRng, nextFloat, nextInt, shuffled, type Rng } from './rng';

export type TeamId = 'a' | 'b';
export type Row = 'front' | 'back';
export type Reach = 'melee' | 'ranged';
export type DamageType = 'physical' | 'poison';
/** Which reachable Row a Unit picks from: the front Row while it lives, or either. */
export type Targeting = 'frontFirst' | 'any';

export interface UnitSpec {
  readonly id: string;
  readonly name: string;
  readonly health: number;
  readonly power: number;
  /** Ticks between this Unit's actions. */
  readonly actionInterval: number;
  readonly row: Row;
  readonly reach: Reach;
  readonly targeting: Targeting;
  readonly damageType: DamageType;
  readonly armour: number;
  /** Percentages by damage type. A missing type is 0. */
  readonly resistances: Readonly<Partial<Record<DamageType, number>>>;
  /** A percentage. */
  readonly critChance: number;
}

export interface BattleSetup {
  readonly seed: number;
  readonly teams: Readonly<Record<TeamId, readonly UnitSpec[]>>;
  readonly maxTicks?: number;
}

export type BattleEvent =
  | {
      readonly type: 'attack';
      readonly tick: number;
      readonly attackerId: string;
      readonly attackerName: string;
      readonly targetId: string;
      readonly targetName: string;
      readonly damage: number;
      readonly damageType: DamageType;
      readonly crit: boolean;
    }
  | { readonly type: 'death'; readonly tick: number; readonly unitId: string; readonly unitName: string };

export interface BattleResult {
  /** null when the Battle is a draw. */
  readonly winner: TeamId | null;
  readonly ticks: number;
  readonly log: readonly BattleEvent[];
}

export interface UnitState {
  readonly spec: UnitSpec;
  readonly team: TeamId;
  row: Row;
  health: number;
  cooldown: number;
}

/** A Battle in progress, as plain data. stepBattle mutates it, and JSON carries it whole. */
export interface BattleState {
  readonly rng: Rng;
  readonly units: UnitState[];
  readonly maxTicks: number;
  tick: number;
  over: boolean;
  /** null while the Battle runs, and when it ends in a draw. */
  winner: TeamId | null;
}

const DEFAULT_MAX_TICKS = 1200;
const CRIT_MULTIPLIER = 1.5;
const RESISTANCE_CAP = 75;
const MIN_HIT_DAMAGE = 1;

const isAlive = (unit: UnitState): boolean => unit.health > 0;
const otherTeam = (team: TeamId): TeamId => (team === 'a' ? 'b' : 'a');
const livingOn = (battle: BattleState, team: TeamId): UnitState[] =>
  battle.units.filter((unit) => unit.team === team && isAlive(unit));

function stepForwardIfFrontEmpty(battle: BattleState, team: TeamId): void {
  const living = livingOn(battle, team);
  if (living.some((unit) => unit.row === 'front')) return;
  for (const unit of living) unit.row = 'front';
}

function settleIfOver(battle: BattleState): void {
  const aAlive = livingOn(battle, 'a').length > 0;
  const bAlive = livingOn(battle, 'b').length > 0;
  if (aAlive && bAlive && battle.tick < battle.maxTicks) return;
  battle.over = true;
  battle.winner = aAlive === bAlive ? null : aAlive ? 'a' : 'b';
}

export function createBattle(setup: BattleSetup): BattleState {
  const spawn = (team: TeamId): UnitState[] =>
    setup.teams[team].map((spec) => ({
      spec,
      team,
      row: spec.row,
      health: spec.health,
      cooldown: spec.actionInterval,
    }));
  const battle: BattleState = {
    rng: createRng(setup.seed),
    units: [...spawn('a'), ...spawn('b')],
    maxTicks: setup.maxTicks ?? DEFAULT_MAX_TICKS,
    tick: 0,
    over: false,
    winner: null,
  };
  stepForwardIfFrontEmpty(battle, 'a');
  stepForwardIfFrontEmpty(battle, 'b');
  settleIfOver(battle);
  return battle;
}

function chooseTarget(battle: BattleState, attacker: UnitState): UnitState | undefined {
  const enemies = livingOn(battle, otherTeam(attacker.team));
  const anyRow = attacker.spec.reach === 'ranged' && attacker.spec.targeting === 'any';
  const reachable = anyRow ? enemies : enemies.filter((unit) => unit.row === 'front');
  return reachable[nextInt(battle.rng, reachable.length)];
}

function hitDamage(attacker: UnitSpec, target: UnitSpec, crit: boolean): number {
  const resistance = Math.min(target.resistances[attacker.damageType] ?? 0, RESISTANCE_CAP);
  const armourFactor = attacker.damageType === 'physical' ? 100 / (100 + target.armour) : 1;
  const critFactor = crit ? CRIT_MULTIPLIER : 1;
  return Math.max(MIN_HIT_DAMAGE, attacker.power * armourFactor * (1 - resistance / 100) * critFactor);
}

function act(battle: BattleState, unit: UnitState, events: BattleEvent[]): void {
  unit.cooldown = unit.spec.actionInterval;
  const target = chooseTarget(battle, unit);
  if (!target) return;

  const crit = nextFloat(battle.rng) * 100 < unit.spec.critChance;
  const damage = hitDamage(unit.spec, target.spec, crit);
  target.health = Math.max(0, target.health - damage);
  events.push({
    type: 'attack',
    tick: battle.tick,
    attackerId: unit.spec.id,
    attackerName: unit.spec.name,
    targetId: target.spec.id,
    targetName: target.spec.name,
    damage,
    damageType: unit.spec.damageType,
    crit,
  });
  if (isAlive(target)) return;
  events.push({ type: 'death', tick: battle.tick, unitId: target.spec.id, unitName: target.spec.name });
  stepForwardIfFrontEmpty(battle, target.team);
}

/** Runs one Tick and reports what happened in it. Does nothing once the Battle is over. */
export function stepBattle(battle: BattleState): readonly BattleEvent[] {
  if (battle.over) return [];
  battle.tick++;

  const acting: UnitState[] = [];
  for (const unit of battle.units) {
    if (!isAlive(unit)) continue;
    unit.cooldown--;
    if (unit.cooldown <= 0) acting.push(unit);
  }

  const events: BattleEvent[] = [];
  // Shuffled so neither Team gets a first strike from its position in the setup.
  for (const unit of shuffled(battle.rng, acting)) {
    if (isAlive(unit)) act(battle, unit, events);
  }
  settleIfOver(battle);
  return events;
}

export function simulateBattle(setup: BattleSetup): BattleResult {
  const battle = createBattle(setup);
  const log: BattleEvent[] = [];
  while (!battle.over) log.push(...stepBattle(battle));
  return { winner: battle.winner, ticks: battle.tick, log };
}
