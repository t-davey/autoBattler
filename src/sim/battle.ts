import { isNumber, isOptionalNumber, isRecord, isString } from './guards';
import { isRank } from './skills';
import { isSkillId } from './content/skills';
import {
  BAR_THE_WAY_BELOW,
  BAR_THE_WAY_DURATION,
  BLEED_INTERVAL,
  BLEED_TICKS,
  LANTERN_WARD_DURATION,
  MEND_BELOW,
  OUT_OF_ROW_FACTOR,
  POISON_DURATION,
  POISON_INTERVAL,
  POISON_STACK_LIMIT,
  BLOOM_FROM,
  FALL_BACK_BELOW,
  PENITENT_BLOW_ABOVE,
  RED_TITHE_ABOVE,
  RED_TITHE_FROM,
  RED_TITHE_HEAL,
  STEP_UP_ABOVE,
  SOW_ROT_REFRESH_BELOW,
  rankValue,
  SKILLS,
  type ActiveSkillId,
  type SkillId,
} from './content/skills';
import { createRng, isRng, nextFloat, nextInt, shuffled, type Rng } from './rng';

export type TeamId = 'a' | 'b';
export type Row = 'front' | 'back';
export type Reach = 'melee' | 'ranged';
export const DAMAGE_TYPES = ['physical', 'fire', 'cold', 'poison', 'holy'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];
/** Which reachable Row a Unit picks from: the front Row while it lives, or either. */
export type Targeting = 'frontFirst' | 'any';
export type DamageEffect = 'bleed' | 'poison' | 'burn';
/** Effects that weaken how a Unit fights rather than dealing damage. */
export type WeakeningEffect = 'slow' | 'curse';

export interface LearnedSkill {
  readonly id: SkillId;
  readonly rank: number;
}

/** A timed move with its own clock and damage, for a Unit with more than one way to act. */
export interface UnitAction {
  readonly name: string;
  /** Ticks between uses. */
  readonly interval: number;
  /** One Unit in the enemy front Row, or every enemy. */
  readonly target: 'oneFront' | 'every';
  /** Direct damage. 0 lands no hit. */
  readonly damage: number;
  readonly damageType: DamageType;
  /** The damage of a Poison stack added to each target. */
  readonly poisonStack?: number;
  /** Fire damage a Burn deals to each target over BURN_TICKS. */
  readonly burn?: number;
  /** A percentage of speed each target loses for SLOW_DURATION. */
  readonly slow?: number;
  /** A percentage less damage each target deals while Cursed, for CURSE_DURATION. */
  readonly curse?: number;
}

/** A later stage of a Unit's Battle. Its actions replace the Unit's, on fresh clocks. */
export interface UnitPhase {
  /** Entered once health is at or below this share of max health. */
  readonly atHealthShare: number;
  readonly actions: readonly UnitAction[];
}

export interface UnitSpec {
  readonly id: string;
  readonly name: string;
  /** Health at the start of the Battle. */
  readonly health: number;
  /** Defaults to health. */
  readonly maxHealth?: number;
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
  /** Oil at the start of the Battle. Defaults to maxOil. */
  readonly oil?: number;
  /** Defaults to 0: a Unit with no lantern. */
  readonly maxOil?: number;
  /** Active skills in the order the Unit tries them. Passives can sit anywhere. */
  readonly skills?: readonly LearnedSkill[];
  /** The damage of a Poison stack added with each attack. */
  readonly poisonOnHit?: number;
  /** A percentage chance that an attack on this Unit misses. Damage over time can't be dodged. */
  readonly dodgeChance?: number;
  /** When set, the Unit uses these instead of power, actionInterval, and damageType. */
  readonly actions?: readonly UnitAction[];
  /** Needs actions. */
  readonly secondPhase?: UnitPhase;
  /** A stand-in for content not yet designed. Battles ignore it; the UI draws it plainly. */
  readonly placeholder?: boolean;
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
      /** Health lost. A Ward's share is in absorbed. */
      readonly damage: number;
      readonly absorbed: number;
      readonly damageType: DamageType;
      readonly crit: boolean;
      /** Set when this is the share of a hit that Shared Burden moved from that Unit. */
      readonly redirectedFromName: string | null;
    }
  | {
      readonly type: 'effectDamage';
      readonly tick: number;
      readonly effect: DamageEffect;
      readonly targetId: string;
      readonly targetName: string;
      readonly damage: number;
      readonly absorbed: number;
      readonly damageType: DamageType;
      readonly redirectedFromName: string | null;
    }
  | {
      readonly type: 'skill';
      readonly tick: number;
      readonly unitId: string;
      readonly unitName: string;
      readonly skillId: SkillId;
      readonly skillName: string;
    }
  | {
      readonly type: 'action';
      readonly tick: number;
      readonly unitId: string;
      readonly unitName: string;
      readonly actionName: string;
    }
  | {
      readonly type: 'heal';
      readonly tick: number;
      readonly targetId: string;
      readonly targetName: string;
      readonly amount: number;
    }
  | {
      readonly type: 'dodge';
      readonly tick: number;
      readonly attackerId: string;
      readonly attackerName: string;
      readonly targetId: string;
      readonly targetName: string;
    }
  | {
      readonly type: 'effect';
      readonly tick: number;
      readonly effect: DamageEffect | WeakeningEffect;
      readonly targetId: string;
      readonly targetName: string;
    }
  | {
      readonly type: 'ward';
      readonly tick: number;
      readonly targetId: string;
      readonly targetName: string;
      readonly amount: number;
    }
  | { readonly type: 'moved'; readonly tick: number; readonly unitId: string; readonly unitName: string; readonly row: Row }
  | { readonly type: 'phaseChanged'; readonly tick: number; readonly unitId: string; readonly unitName: string }
  | { readonly type: 'death'; readonly tick: number; readonly unitId: string; readonly unitName: string };

export interface BattleResult {
  /** null when the Battle is a draw. */
  readonly winner: TeamId | null;
  readonly ticks: number;
  readonly log: readonly BattleEvent[];
}

export interface BleedState {
  perTick: number;
  ticksLeft: number;
  nextTickAt: number;
}

export interface PoisonStack {
  readonly damage: number;
  nextTickAt: number;
  expiresAt: number;
  /** The Unit that added it, for Leech Hex. */
  readonly sourceId?: string;
}

/** A share of something the Unit loses until a Tick. */
export interface TimedShare {
  readonly share: number;
  readonly expiresAt: number;
}

export interface CurseState extends TimedShare {
  /** More damage the Cursed Unit takes from every source, from its caster's Spoiled Blood. */
  readonly amplify?: number;
}

export interface WardState {
  amount: number;
  readonly expiresAt: number;
}

interface UnitState {
  readonly spec: UnitSpec;
  readonly team: TeamId;
  row: Row;
  health: number;
  /** Ticks until this Unit next acts. */
  ticksToAction: number;
  /** Ticks until each of spec.actions is next used. Empty for a Unit without actions. */
  ticksToEachAction: number[];
  /** Set once the Unit enters spec.secondPhase. */
  inSecondPhase?: boolean;
  oil: number;
  /** The Tick each used skill is ready again. */
  skillReadyAt: Partial<Record<SkillId, number>>;
  bleed: BleedState | null;
  poison: PoisonStack[];
  ward: WardState | null;
  /** Fire damage over time, shaped like a Bleed. Missing in saves from before Burns. */
  burn?: BleedState | null;
  /** Speed lost. */
  slow?: TimedShare | null;
  /** Damage this Unit deals is cut by the share. One Curse at a time. */
  curse?: CurseState | null;
  /** Poison stacks this Unit can hold, raised by Ripening. Missing means the usual limit. */
  poisonLimit?: number;
  /** Set by Fall Back while the Unit stands back from its usual Row. */
  fellBack?: boolean;
  /** Fall Back's promise: the next attack on this Unit misses. */
  dodgeNext?: boolean;
  /** Bar the Way holds until this Tick, and its armour bonus as a percentage. */
  barUntil: number;
  barArmour: number;
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
export const BURN_TICKS = 4;
export const BURN_INTERVAL = 10;
export const SLOW_DURATION = 40;
export const CURSE_DURATION = 80;
const RESISTANCE_CAP = 75;
const MIN_HIT_DAMAGE = 1;
const OIL_REGEN_INTERVAL = 5;

const isAlive = (unit: UnitState): boolean => unit.health > 0;
const otherTeam = (team: TeamId): TeamId => (team === 'a' ? 'b' : 'a');
const livingOn = (battle: BattleState, team: TeamId): UnitState[] =>
  battle.units.filter((unit) => unit.team === team && isAlive(unit));
export const maxHealthOf = (unit: UnitState): number => unit.spec.maxHealth ?? unit.spec.health;
const healthShare = (unit: UnitState): number => unit.health / maxHealthOf(unit);

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
      ticksToAction: spec.actionInterval,
      ticksToEachAction: spec.actions?.map((action) => action.interval) ?? [],
      oil: spec.oil ?? spec.maxOil ?? 0,
      skillReadyAt: {},
      bleed: null,
      poison: [],
      ward: null,
      burn: null,
      slow: null,
      curse: null,
      barUntil: 0,
      barArmour: 0,
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

const rankIn = (unit: UnitState, id: SkillId): number =>
  unit.spec.skills?.find((skill) => skill.id === id)?.rank ?? 0;

/** How much of a skill's numeric effects a Unit gets from where it stands. */
function rowFactor(unit: UnitState, id: SkillId): number {
  const { row } = SKILLS[id];
  return row === 'either' || row === unit.row ? 1 : OUT_OF_ROW_FACTOR;
}

/** A skill's value at a rank as a fraction, from where the Unit stands. */
const rankFraction = (unit: UnitState, id: SkillId, rank: number, index = 0): number =>
  (rankValue(id, rank, index) * rowFactor(unit, id)) / 100;

/** A passive's value as a fraction, or 0 if the Unit hasn't learned it. */
function passiveValue(unit: UnitState, id: SkillId): number {
  const rank = rankIn(unit, id);
  return rank > 0 ? rankFraction(unit, id, rank) : 0;
}

function armourOf(battle: BattleState, unit: UnitState): number {
  const bar = battle.tick < unit.barUntil ? unit.barArmour : 0;
  return unit.spec.armour * (1 + passiveValue(unit, 'iron-penance') + bar);
}

/** Reduces damage by what the target has against its type. Damage over time ignores armour. */
function reducedDamage(battle: BattleState, target: UnitState, raw: number, type: DamageType, ignoresArmour: boolean): number {
  const resistance = Math.min(target.spec.resistances[type] ?? 0, RESISTANCE_CAP);
  const armourFactor = type === 'physical' && !ignoresArmour ? 100 / (100 + armourOf(battle, target)) : 1;
  return raw * armourFactor * (1 - resistance / 100);
}

/** Takes damage through any Ward, and reports how it split. */
function loseHealth(battle: BattleState, target: UnitState, amount: number): { damage: number; absorbed: number } {
  let absorbed = 0;
  if (target.ward) {
    if (battle.tick < target.ward.expiresAt) {
      absorbed = Math.min(target.ward.amount, amount);
      target.ward.amount -= absorbed;
    }
    if (target.ward.amount <= 0 || battle.tick >= target.ward.expiresAt) target.ward = null;
  }
  const damage = amount - absorbed;
  target.health = Math.max(0, target.health - damage);
  return { damage, absorbed };
}

function settleDeath(battle: BattleState, unit: UnitState, events: BattleEvent[]): void {
  if (isAlive(unit)) return;
  unit.bleed = null;
  unit.poison = [];
  unit.ward = null;
  unit.burn = null;
  unit.slow = null;
  unit.curse = null;
  events.push({ type: 'death', tick: battle.tick, unitId: unit.spec.id, unitName: unit.spec.name });
  stepForwardIfFrontEmpty(battle, unit.team);
}

/** The living teammate who takes a share of damage to this Unit, and how much. */
function burdenFor(battle: BattleState, target: UnitState): { holder: UnitState; share: number } | null {
  if (target.row !== 'back') return null;
  for (const holder of battle.units) {
    if (holder.team !== target.team || holder === target || !isAlive(holder)) continue;
    const share = passiveValue(holder, 'shared-burden');
    if (share > 0) return { holder, share };
  }
  return null;
}

interface Strike {
  readonly attacker: UnitState;
  readonly target: UnitState;
  /** Damage before anything reduces it, critical hit included. */
  readonly raw: number;
  readonly damageType: DamageType;
  readonly crit: boolean;
  readonly ignoresArmour: boolean;
  readonly hasMinimum: boolean;
  /** White Heat's splash, which doesn't splash or Burn in turn. */
  readonly splash?: boolean;
}

const isActive = (battle: BattleState, effect: TimedShare | null | undefined): effect is TimedShare =>
  effect != null && battle.tick < effect.expiresAt;

/** What a Curse leaves of the damage this Unit deals. */
const curseFactor = (battle: BattleState, unit: UnitState): number => (isActive(battle, unit.curse) ? 1 - unit.curse.share : 1);

/** Rolls only for a Unit that can dodge, so other Battles draw the same numbers as before. */
function rollDodge(battle: BattleState, target: UnitState): boolean {
  if (target.dodgeNext) {
    target.dodgeNext = false;
    return true;
  }
  const chance = (target.spec.dodgeChance ?? 0) + passiveValue(target, 'light-step') * 100;
  return chance > 0 && nextFloat(battle.rng) * 100 < chance;
}

/** Returns what the target took, a Ward's share included, or null if it dodged. */
function landStrike(battle: BattleState, strike: Strike, events: BattleEvent[]): number | null {
  const { attacker, target, damageType, crit, ignoresArmour, hasMinimum } = strike;
  if (rollDodge(battle, target)) {
    events.push({ type: 'dodge', tick: battle.tick, attackerId: attacker.spec.id, attackerName: attacker.spec.name, targetId: target.spec.id, targetName: target.spec.name });
    healUnit(battle, target, maxHealthOf(target) * passiveValue(target, 'bind-the-wound'), events);
    return null;
  }
  const raw = strike.raw * curseFactor(battle, attacker);
  const land = (receiver: UnitState, share: number, redirectedFromName: string | null, minimum: number): number => {
    const reduced = Math.max(minimum, reducedDamage(battle, receiver, raw * share * amplifyOf(battle, receiver), damageType, ignoresArmour));
    const { damage, absorbed } = loseHealth(battle, receiver, reduced);
    const leeched = (): void => leech(battle, attacker, receiver, damage, events);
    events.push({
      type: 'attack',
      tick: battle.tick,
      attackerId: attacker.spec.id,
      attackerName: attacker.spec.name,
      targetId: receiver.spec.id,
      targetName: receiver.spec.name,
      damage,
      absorbed,
      damageType,
      crit,
      redirectedFromName,
    });
    leeched();
    return damage + absorbed;
  };

  const burden = burdenFor(battle, target);
  const dealt = land(target, 1 - (burden?.share ?? 0), null, hasMinimum ? MIN_HIT_DAMAGE : 0);
  if (burden) land(burden.holder, burden.share, target.spec.name, 0);

  // Poison on hit comes from the attacker, so its stacks count towards Leech Hex too.
  const poison = attacker.spec.poisonOnHit;
  if (poison !== undefined && isAlive(target)) addPoisonStack(battle, target, poison * curseFactor(battle, attacker), events, attacker);
  if (damageType === 'fire' && !strike.splash) fireAfterHit(battle, strike, dealt, events);
  settleDeath(battle, target, events);
  if (burden) settleDeath(battle, burden.holder, events);
  return dealt;
}

/** A passive's value at an index as a fraction, or 0 if the Unit hasn't learned it. */
function passiveValueAt(unit: UnitState, id: SkillId, index: number): number {
  const rank = rankIn(unit, id);
  return rank > 0 ? rankFraction(unit, id, rank, index) : 0;
}

/** Kindling's Burn, and White Heat's splash on a critical hit, after a fire hit lands. */
function fireAfterHit(battle: BattleState, strike: Strike, dealt: number, events: BattleEvent[]): void {
  const { attacker, target } = strike;
  const kindling = passiveValue(attacker, 'kindling');
  if (kindling > 0 && isAlive(target)) addBurn(battle, target, dealt * kindling, events);
  const splash = strike.crit ? passiveValueAt(attacker, 'white-heat', 1) : 0;
  if (splash <= 0) return;
  for (const other of livingOn(battle, target.team)) {
    if (other === target || other.row !== target.row) continue;
    landStrike(battle, { ...strike, target: other, raw: dealt * splash, crit: false, ignoresArmour: true, hasMinimum: false, splash: true }, events);
  }
}

/** Extra Poison stacks this Unit lets the enemies it poisons hold, from Ripening. */
const ripeningOf = (unit: UnitState): number => {
  const rank = rankIn(unit, 'ripening');
  return rank > 0 ? Math.round(rankValue('ripening', rank) * rowFactor(unit, 'ripening')) : 0;
};

/** The stacks a target can hold once this source poisons it. */
const poisonLimitFor = (target: UnitState, source: UnitState | null): number =>
  Math.max(target.poisonLimit ?? POISON_STACK_LIMIT, POISON_STACK_LIMIT + (source ? ripeningOf(source) : 0));

/** Adds Poison stacks up to the target's limit, refreshing every stack it holds. One event for the lot. */
function addPoisonStacks(battle: BattleState, target: UnitState, damages: readonly number[], events: BattleEvent[], source: UnitState | null): void {
  const expiresAt = battle.tick + POISON_DURATION;
  const limit = poisonLimitFor(target, source);
  if (limit > POISON_STACK_LIMIT) target.poisonLimit = limit;
  for (const stack of target.poison) stack.expiresAt = expiresAt;
  for (const damage of damages) {
    if (target.poison.length >= limit) break;
    target.poison.push({ damage, nextTickAt: battle.tick + POISON_INTERVAL, expiresAt, ...(source ? { sourceId: source.spec.id } : {}) });
  }
  events.push({ type: 'effect', tick: battle.tick, effect: 'poison', targetId: target.spec.id, targetName: target.spec.name });
}

const addPoisonStack = (battle: BattleState, target: UnitState, damage: number, events: BattleEvent[], source: UnitState | null): void =>
  addPoisonStacks(battle, target, [damage], events, source);

/** How much more damage a Unit takes while Cursed, from its caster's Spoiled Blood. */
const amplifyOf = (battle: BattleState, unit: UnitState): number => (isActive(battle, unit.curse) ? 1 + (unit.curse.amplify ?? 0) : 1);

/** Leech Hex: the source heals for part of the damage it deals to a Cursed Unit. */
function leech(battle: BattleState, source: UnitState | null, target: UnitState, dealt: number, events: BattleEvent[]): void {
  if (!source || !isAlive(source) || dealt <= 0 || !isActive(battle, target.curse)) return;
  const share = passiveValue(source, 'leech-hex');
  if (share > 0) healUnit(battle, source, dealt * share, events);
}

/** Sets a Burn, replacing any the target holds. */
function addBurn(battle: BattleState, target: UnitState, total: number, events: BattleEvent[]): void {
  target.burn = { perTick: total / BURN_TICKS, ticksLeft: BURN_TICKS, nextTickAt: battle.tick + BURN_INTERVAL };
  events.push({ type: 'effect', tick: battle.tick, effect: 'burn', targetId: target.spec.id, targetName: target.spec.name });
}

/** Sets a Slow or Curse, replacing any of that kind the target holds. */
function addWeakening(battle: BattleState, target: UnitState, effect: WeakeningEffect, percent: number, events: BattleEvent[], amplify = 0): void {
  const timed = { share: percent / 100, expiresAt: battle.tick + (effect === 'slow' ? SLOW_DURATION : CURSE_DURATION) };
  if (effect === 'slow') target.slow = timed;
  else target.curse = amplify > 0 ? { ...timed, amplify } : timed;
  events.push({ type: 'effect', tick: battle.tick, effect, targetId: target.spec.id, targetName: target.spec.name });
}

/** Damage over time has no minimum, and only Poison can be shared. */
function tickDamage(battle: BattleState, target: UnitState, effect: DamageEffect, raw: number, damageType: DamageType, events: BattleEvent[], source: UnitState | null = null): void {
  const land = (receiver: UnitState, share: number, redirectedFromName: string | null): void => {
    const reduced = reducedDamage(battle, receiver, raw * share * amplifyOf(battle, receiver), damageType, true);
    const { damage, absorbed } = loseHealth(battle, receiver, reduced);
    const leeched = (): void => leech(battle, source, receiver, damage, events);
    events.push({
      type: 'effectDamage',
      tick: battle.tick,
      effect,
      targetId: receiver.spec.id,
      targetName: receiver.spec.name,
      damage,
      absorbed,
      damageType,
      redirectedFromName,
    });
    leeched();
  };
  const burden = effect === 'poison' ? burdenFor(battle, target) : null;
  land(target, 1 - (burden?.share ?? 0), null);
  if (burden) {
    land(burden.holder, burden.share, target.spec.name);
    settleDeath(battle, burden.holder, events);
  }
  settleDeath(battle, target, events);
}

function runEffects(battle: BattleState, unit: UnitState, events: BattleEvent[]): void {
  const { bleed } = unit;
  if (bleed && battle.tick >= bleed.nextTickAt) {
    bleed.ticksLeft--;
    bleed.nextTickAt += BLEED_INTERVAL;
    const { perTick } = bleed;
    if (bleed.ticksLeft <= 0) unit.bleed = null;
    tickDamage(battle, unit, 'bleed', perTick, 'physical', events);
  }
  const { burn } = unit;
  if (burn && isAlive(unit) && battle.tick >= burn.nextTickAt) {
    burn.ticksLeft--;
    burn.nextTickAt += BURN_INTERVAL;
    const { perTick } = burn;
    if (burn.ticksLeft <= 0) unit.burn = null;
    tickDamage(battle, unit, 'burn', perTick, 'fire', events);
  }
  if (unit.slow && !isActive(battle, unit.slow)) unit.slow = null;
  if (unit.curse && !isActive(battle, unit.curse)) unit.curse = null;
  if (unit.poison.length === 0) return;
  for (const stack of unit.poison) {
    if (!isAlive(unit)) return;
    if (battle.tick < stack.nextTickAt) continue;
    stack.nextTickAt += POISON_INTERVAL;
    const source = stack.sourceId === undefined ? null : (battle.units.find((other) => other.spec.id === stack.sourceId) ?? null);
    tickDamage(battle, unit, 'poison', stack.damage, 'poison', events, source);
  }
  if (unit.poison.some((stack) => battle.tick >= stack.expiresAt)) {
    unit.poison = unit.poison.filter((stack) => battle.tick < stack.expiresAt);
  }
}

function reachableEnemies(battle: BattleState, unit: UnitState): UnitState[] {
  const enemies = livingOn(battle, otherTeam(unit.team));
  const anyRow = unit.spec.reach === 'ranged' && unit.spec.targeting === 'any';
  return anyRow ? enemies : enemies.filter((enemy) => enemy.row === 'front');
}

/** Enemies a skill of this reach can target: melee reaches only the front Row while it stands. */
function enemiesInReach(battle: BattleState, unit: UnitState, reach: 'melee' | 'ranged' | 'spell'): UnitState[] {
  const enemies = livingOn(battle, otherTeam(unit.team));
  return reach === 'melee' ? enemies.filter((enemy) => enemy.row === 'front') : enemies;
}

function pick<T>(battle: BattleState, options: readonly T[]): T | undefined {
  return options[nextInt(battle.rng, options.length)];
}

function chooseTarget(battle: BattleState, attacker: UnitState): UnitState | undefined {
  const barring = livingOn(battle, otherTeam(attacker.team)).filter((enemy) => battle.tick < enemy.barUntil);
  return pick(battle, barring.length > 0 ? barring : reachableEnemies(battle, attacker));
}

/** More damage from this Unit if the target is Bleeding, from Open Veins. */
const openVeinsFactor = (unit: UnitState, target: UnitState): number =>
  target.bleed ? 1 + passiveValue(unit, 'open-veins') : 1;

/** White Heat adds critical chance to fire hits. */
const rollCrit = (battle: BattleState, unit: UnitState, damageType: DamageType = 'physical'): boolean => {
  const bonus = damageType === 'fire' ? passiveValue(unit, 'white-heat') * 100 : 0;
  return nextFloat(battle.rng) * 100 < unit.spec.critChance + bonus;
};

/** Power, with Mortified Flesh's bonus for each whole 10% of health missing. */
function powerOf(unit: UnitState): number {
  const perStep = passiveValue(unit, 'mortified-flesh');
  if (perStep <= 0) return unit.spec.power;
  return unit.spec.power * (1 + perStep * Math.floor((1 - healthShare(unit)) * 10));
}

function basicAttack(battle: BattleState, unit: UnitState, events: BattleEvent[]): void {
  const target = chooseTarget(battle, unit);
  if (!target) return;
  const crit = rollCrit(battle, unit, unit.spec.damageType);
  const raw = powerOf(unit) * openVeinsFactor(unit, target) * (crit ? CRIT_MULTIPLIER : 1);
  landStrike(battle, { attacker: unit, target, raw, damageType: unit.spec.damageType, crit, ignoresArmour: false, hasMinimum: true }, events);
}

/** A skill's strength against the Unit's power, from where it stands. */
const skillAmount = (unit: UnitState, id: SkillId, rank: number, index = 0): number =>
  powerOf(unit) * rankFraction(unit, id, rank, index);

const notBleeding = (battle: BattleState, unit: UnitState): UnitState[] =>
  reachableEnemies(battle, unit).filter((enemy) => !enemy.bleed);
const bleeding = (battle: BattleState, unit: UnitState): UnitState[] =>
  reachableEnemies(battle, unit).filter((enemy) => enemy.bleed);

interface ActiveRule {
  /** The built-in usefulness condition. */
  isUseful(battle: BattleState, unit: UnitState): boolean;
  use(battle: BattleState, unit: UnitState, rank: number, events: BattleEvent[]): void;
}

/** A hit of a skill's first value against power, with a chance to crit. Returns false if dodged. */
function skillHit(battle: BattleState, unit: UnitState, id: SkillId, rank: number, target: UnitState, damageType: DamageType, events: BattleEvent[]): boolean {
  return skillStrike(battle, unit, id, rank, target, damageType, events) !== null;
}

/** As skillHit, returning what the target took, or null if it dodged. */
function skillStrike(battle: BattleState, unit: UnitState, id: SkillId, rank: number, target: UnitState, damageType: DamageType, events: BattleEvent[]): number | null {
  const crit = rollCrit(battle, unit, damageType);
  const raw = skillAmount(unit, id, rank) * (crit ? CRIT_MULTIPLIER : 1);
  return landStrike(battle, { attacker: unit, target, raw, damageType, crit, ignoresArmour: false, hasMinimum: true }, events);
}

function healUnit(battle: BattleState, target: UnitState, amount: number, events: BattleEvent[]): void {
  const healed = Math.min(amount, maxHealthOf(target) - target.health);
  if (healed <= 0) return;
  target.health += healed;
  events.push({ type: 'heal', tick: battle.tick, targetId: target.spec.id, targetName: target.spec.name, amount: healed });
}

/** Enemies Sow Rot would add to: below their stack limit, or with Poison about to run out. */
const rotTargets = (battle: BattleState, unit: UnitState): UnitState[] =>
  enemiesInReach(battle, unit, 'spell').filter((enemy) => {
    if (enemy.poison.length < poisonLimitFor(enemy, unit)) return true;
    return enemy.poison.some((stack) => stack.expiresAt - battle.tick < SOW_ROT_REFRESH_BELOW);
  });

/** The most-poisoned enemy, if it holds enough stacks for Bloom and another enemy lives. */
function bloomSource(battle: BattleState, unit: UnitState): UnitState | undefined {
  const enemies = enemiesInReach(battle, unit, 'spell');
  if (enemies.length < 2) return undefined;
  const most = enemies.reduce((best, enemy) => (enemy.poison.length > best.poison.length ? enemy : best));
  return most.poison.length >= BLOOM_FROM ? most : undefined;
}

const uncursed = (battle: BattleState, unit: UnitState): UnitState[] =>
  enemiesInReach(battle, unit, 'spell').filter((enemy) => !isActive(battle, enemy.curse));

const ACTIVE_RULES: Readonly<Record<ActiveSkillId, ActiveRule>> = {
  'consume-sin': {
    isUseful: (battle, unit) => enemiesInReach(battle, unit, 'melee').length > 0,
    use(battle, unit, rank, events) {
      const target = pick(battle, enemiesInReach(battle, unit, 'melee'));
      if (!target || !skillHit(battle, unit, 'consume-sin', rank, target, 'holy', events)) return;
      healUnit(battle, unit, maxHealthOf(unit) * rankFraction(unit, 'consume-sin', rank, 1), events);
    },
  },
  'tainted-shaft': {
    isUseful: (battle, unit) => enemiesInReach(battle, unit, 'ranged').length > 0,
    use(battle, unit, rank, events) {
      const target = pick(battle, enemiesInReach(battle, unit, 'ranged'));
      if (!target || !skillHit(battle, unit, 'tainted-shaft', rank, target, 'poison', events) || !isAlive(target)) return;
      addPoisonStack(battle, target, skillAmount(unit, 'tainted-shaft', rank, 1) * curseFactor(battle, unit), events, unit);
    },
  },
  'chill-word': {
    isUseful: (battle, unit) => enemiesInReach(battle, unit, 'spell').length > 0,
    use(battle, unit, rank, events) {
      const target = pick(battle, enemiesInReach(battle, unit, 'spell'));
      if (!target || !skillHit(battle, unit, 'chill-word', rank, target, 'cold', events) || !isAlive(target)) return;
      addWeakening(battle, target, 'slow', rankFraction(unit, 'chill-word', rank, 1) * 100, events);
    },
  },
  'sow-rot': {
    isUseful: (battle, unit) => rotTargets(battle, unit).length > 0,
    use(battle, unit, rank, events) {
      const target = pick(battle, rotTargets(battle, unit));
      if (target) addPoisonStack(battle, target, skillAmount(unit, 'sow-rot', rank) * curseFactor(battle, unit), events, unit);
    },
  },
  bloom: {
    isUseful: (battle, unit) => bloomSource(battle, unit) !== undefined,
    use(battle, unit, rank, events) {
      const source = bloomSource(battle, unit);
      if (!source) return;
      const count = Math.ceil(source.poison.length * rankFraction(unit, 'bloom', rank));
      const damages = source.poison.slice(0, count).map((stack) => stack.damage);
      for (const other of enemiesInReach(battle, unit, 'spell')) {
        if (other !== source) addPoisonStacks(battle, other, damages, events, unit);
      }
    },
  },
  'wasting-curse': {
    isUseful: (battle, unit) => uncursed(battle, unit).length > 0,
    use(battle, unit, rank, events) {
      const target = uncursed(battle, unit).reduce<UnitState | undefined>((strongest, enemy) => (!strongest || enemy.spec.power > strongest.spec.power ? enemy : strongest), undefined);
      if (target) addWeakening(battle, target, 'curse', rankFraction(unit, 'wasting-curse', rank) * 100, events, passiveValue(unit, 'spoiled-blood'));
    },
  },
  'penitent-blow': {
    isUseful: (battle, unit) => healthShare(unit) > PENITENT_BLOW_ABOVE && enemiesInReach(battle, unit, 'melee').length > 0,
    use(battle, unit, rank, events) {
      const target = pick(battle, enemiesInReach(battle, unit, 'melee'));
      if (target) skillHit(battle, unit, 'penitent-blow', rank, target, 'physical', events);
    },
  },
  'red-tithe': {
    isUseful: (battle, unit) => healthShare(unit) > RED_TITHE_ABOVE && enemiesInReach(battle, unit, 'melee').length >= RED_TITHE_FROM,
    use(battle, unit, rank, events) {
      let dealt = 0;
      for (const target of enemiesInReach(battle, unit, 'melee')) dealt += skillStrike(battle, unit, 'red-tithe', rank, target, 'physical', events) ?? 0;
      healUnit(battle, unit, dealt * RED_TITHE_HEAL, events);
    },
  },
  'fall-back': {
    isUseful(battle, unit) {
      if (unit.row === 'back') return unit.fellBack === true && healthShare(unit) > STEP_UP_ABOVE;
      const holdsFront = livingOn(battle, unit.team).some((ally) => ally !== unit && ally.row === 'front');
      return holdsFront && healthShare(unit) < FALL_BACK_BELOW;
    },
    use(battle, unit, rank, events) {
      unit.row = unit.row === 'front' ? 'back' : 'front';
      unit.fellBack = unit.row === 'back';
      unit.dodgeNext = true;
      events.push({ type: 'moved', tick: battle.tick, unitId: unit.spec.id, unitName: unit.spec.name, row: unit.row });
      healUnit(battle, unit, maxHealthOf(unit) * rankFraction(unit, 'fall-back', rank), events);
    },
  },
  flare: {
    isUseful: (battle, unit) => enemiesInReach(battle, unit, 'spell').length > 0,
    use(battle, unit, rank, events) {
      const target = pick(battle, enemiesInReach(battle, unit, 'spell'));
      if (target) skillHit(battle, unit, 'flare', rank, target, 'fire', events);
    },
  },
  'votive-spark': {
    isUseful: (battle, unit) => enemiesInReach(battle, unit, 'spell').length > 0,
    use(battle, unit, rank, events) {
      const target = pick(battle, enemiesInReach(battle, unit, 'spell'));
      if (target) skillHit(battle, unit, 'votive-spark', rank, target, 'holy', events);
    },
  },
  'bar-the-way': {
    isUseful: (battle, unit) =>
      livingOn(battle, unit.team).some((ally) => ally !== unit && healthShare(ally) < BAR_THE_WAY_BELOW),
    use(battle, unit, rank) {
      unit.barUntil = battle.tick + BAR_THE_WAY_DURATION;
      unit.barArmour = rankFraction(unit, 'bar-the-way', rank);
    },
  },
  'bleeders-cut': {
    isUseful: (battle, unit) => notBleeding(battle, unit).length > 0,
    use(battle, unit, rank, events) {
      const target = pick(battle, notBleeding(battle, unit));
      if (!target) return;
      const crit = rollCrit(battle, unit);
      const raw = skillAmount(unit, 'bleeders-cut', rank) * (crit ? CRIT_MULTIPLIER : 1);
      const perTick = skillAmount(unit, 'bleeders-cut', rank, 1) / BLEED_TICKS;
      landStrike(battle, { attacker: unit, target, raw, damageType: 'physical', crit, ignoresArmour: false, hasMinimum: true }, events);
      if (!isAlive(target)) return;
      target.bleed = { perTick, ticksLeft: BLEED_TICKS, nextTickAt: battle.tick + BLEED_INTERVAL };
      events.push({ type: 'effect', tick: battle.tick, effect: 'bleed', targetId: target.spec.id, targetName: target.spec.name });
    },
  },
  'the-long-cut': {
    isUseful: (battle, unit) => bleeding(battle, unit).length > 0,
    use(battle, unit, rank, events) {
      const target = pick(battle, bleeding(battle, unit));
      if (!target?.bleed) return;
      const remaining = target.bleed.perTick * target.bleed.ticksLeft;
      const multiplier = rankFraction(unit, 'the-long-cut', rank);
      const raw = remaining * multiplier * openVeinsFactor(unit, target);
      target.bleed = null;
      landStrike(battle, { attacker: unit, target, raw, damageType: 'physical', crit: false, ignoresArmour: true, hasMinimum: false }, events);
    },
  },
  'mend-by-lamplight': {
    isUseful: (battle, unit) => livingOn(battle, unit.team).some((ally) => healthShare(ally) < MEND_BELOW),
    use(battle, unit, rank, events) {
      const allies = livingOn(battle, unit.team);
      const target = allies.reduce((lowest, ally) => (healthShare(ally) < healthShare(lowest) ? ally : lowest));
      const amount = Math.min(skillAmount(unit, 'mend-by-lamplight', rank), maxHealthOf(target) - target.health);
      target.health += amount;
      events.push({ type: 'heal', tick: battle.tick, targetId: target.spec.id, targetName: target.spec.name, amount });
    },
  },
  'lantern-ward': {
    isUseful: (battle, unit) =>
      !livingOn(battle, unit.team).some((ally) => ally.ward && battle.tick < ally.ward.expiresAt),
    use(battle, unit, rank, events) {
      const amount = skillAmount(unit, 'lantern-ward', rank);
      for (const ally of livingOn(battle, unit.team)) {
        ally.ward = { amount, expiresAt: battle.tick + LANTERN_WARD_DURATION };
        events.push({ type: 'ward', tick: battle.tick, targetId: ally.spec.id, targetName: ally.spec.name, amount });
      }
    },
  },
};

function firstAvailableSkill(battle: BattleState, unit: UnitState): LearnedSkill | undefined {
  return unit.spec.skills?.find(({ id }) => {
    const skill = SKILLS[id];
    if (skill.kind !== 'active' || unit.oil < skill.oil) return false;
    if (skill.healthCost !== undefined && unit.health <= (maxHealthOf(unit) * skill.healthCost) / 100) return false;
    if ((unit.skillReadyAt[id] ?? 0) > battle.tick) return false;
    if (skill.reach === 'melee' && unit.spec.reach !== 'melee') return false;
    return ACTIVE_RULES[id as ActiveSkillId].isUseful(battle, unit);
  });
}

function useAction(battle: BattleState, unit: UnitState, action: UnitAction, events: BattleEvent[]): void {
  events.push({ type: 'action', tick: battle.tick, unitId: unit.spec.id, unitName: unit.spec.name, actionName: action.name });
  const single = action.target === 'oneFront' ? chooseTarget(battle, unit) : undefined;
  const targets = action.target === 'every' ? livingOn(battle, otherTeam(unit.team)) : single ? [single] : [];
  for (const target of targets) {
    if (action.damage > 0) {
      landStrike(battle, { attacker: unit, target, raw: action.damage, damageType: action.damageType, crit: false, ignoresArmour: false, hasMinimum: true }, events);
    }
    if (!isAlive(target)) continue;
    const weakened = curseFactor(battle, unit);
    if (action.poisonStack !== undefined) addPoisonStack(battle, target, action.poisonStack * weakened, events, unit);
    if (action.burn !== undefined) addBurn(battle, target, action.burn * weakened, events);
    if (action.slow !== undefined) addWeakening(battle, target, 'slow', action.slow, events);
    if (action.curse !== undefined) addWeakening(battle, target, 'curse', action.curse, events);
  }
}

const actionsOf = (unit: UnitState): readonly UnitAction[] | undefined =>
  unit.inSecondPhase ? unit.spec.secondPhase?.actions : unit.spec.actions;

function enterDuePhase(battle: BattleState, unit: UnitState, events: BattleEvent[]): boolean {
  const phase = unit.spec.secondPhase;
  if (!phase || unit.inSecondPhase || unit.health > maxHealthOf(unit) * phase.atHealthShare) return false;
  unit.inSecondPhase = true;
  unit.ticksToEachAction = phase.actions.map((action) => action.interval);
  events.push({ type: 'phaseChanged', tick: battle.tick, unitId: unit.spec.id, unitName: unit.spec.name });
  return true;
}

function runDueActions(battle: BattleState, unit: UnitState, actions: readonly UnitAction[], events: BattleEvent[]): void {
  actions.forEach((action, index) => {
    if (!isAlive(unit) || unit.ticksToEachAction[index]! > 0) return;
    unit.ticksToEachAction[index] = action.interval;
    useAction(battle, unit, action, events);
  });
}

function act(battle: BattleState, unit: UnitState, events: BattleEvent[]): void {
  const actions = actionsOf(unit);
  if (actions) {
    runDueActions(battle, unit, actions, events);
    return;
  }
  unit.ticksToAction = unit.spec.actionInterval;
  const learned = firstAvailableSkill(battle, unit);
  if (!learned) {
    basicAttack(battle, unit, events);
    return;
  }
  const skill = SKILLS[learned.id];
  unit.oil -= skill.oil;
  if (skill.healthCost !== undefined) unit.health -= (maxHealthOf(unit) * skill.healthCost) / 100;
  if (skill.cooldown > 0) unit.skillReadyAt[skill.id] = battle.tick + skill.cooldown;
  events.push({ type: 'skill', tick: battle.tick, unitId: unit.spec.id, unitName: unit.spec.name, skillId: skill.id, skillName: skill.name });
  ACTIVE_RULES[learned.id as ActiveSkillId].use(battle, unit, learned.rank, events);
}

/** Runs one Tick and reports what happened in it. Does nothing once the Battle is over. */
export function stepBattle(battle: BattleState): readonly BattleEvent[] {
  if (battle.over) return [];
  battle.tick++;
  const events: BattleEvent[] = [];
  const regenerates = battle.tick % OIL_REGEN_INTERVAL === 0;

  for (const unit of battle.units) {
    if (!isAlive(unit)) continue;
    runEffects(battle, unit, events);
    if (regenerates && isAlive(unit)) unit.oil = Math.min(unit.spec.maxOil ?? 0, unit.oil + 1);
  }

  const acting: UnitState[] = [];
  for (const unit of battle.units) {
    if (!isAlive(unit)) continue;
    if (enterDuePhase(battle, unit, events)) continue;
    // A Slow makes each Tick count for less towards the next action.
    const step = isActive(battle, unit.slow) ? 1 - unit.slow.share : 1;
    if (unit.spec.actions) {
      let due = false;
      for (let i = 0; i < unit.ticksToEachAction.length; i++) {
        unit.ticksToEachAction[i]! -= step;
        if (unit.ticksToEachAction[i]! <= 0) due = true;
      }
      if (due) acting.push(unit);
      continue;
    }
    unit.ticksToAction -= step;
    if (unit.ticksToAction <= 0) acting.push(unit);
  }

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

// Save validation.

const isTeam = (value: unknown): boolean => value === 'a' || value === 'b';
const isRow = (value: unknown): boolean => value === 'front' || value === 'back';

const isLearnedSkill = (value: unknown): boolean =>
  isRecord(value) && isSkillId(value['id']) && isRank(value['rank']);

const isDamageType = (value: unknown): boolean => (DAMAGE_TYPES as readonly unknown[]).includes(value);
const isUnitAction = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value['name']) &&
  isNumber(value['interval']) &&
  (value['target'] === 'oneFront' || value['target'] === 'every') &&
  isNumber(value['damage']) &&
  isDamageType(value['damageType']) &&
  isOptionalNumber(value['poisonStack']) &&
  isOptionalNumber(value['burn']) &&
  isOptionalNumber(value['slow']) &&
  isOptionalNumber(value['curse']);

const isUnitSpec = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value['id']) &&
  isString(value['name']) &&
  isNumber(value['health']) &&
  isOptionalNumber(value['maxHealth']) &&
  isNumber(value['power']) &&
  isNumber(value['actionInterval']) &&
  isRow(value['row']) &&
  (value['reach'] === 'melee' || value['reach'] === 'ranged') &&
  (value['targeting'] === 'frontFirst' || value['targeting'] === 'any') &&
  isDamageType(value['damageType']) &&
  isNumber(value['armour']) &&
  isRecord(value['resistances']) &&
  Object.values(value['resistances']).every(isNumber) &&
  isNumber(value['critChance']) &&
  isOptionalNumber(value['oil']) &&
  isOptionalNumber(value['maxOil']) &&
  isOptionalNumber(value['poisonOnHit']) &&
  isOptionalNumber(value['dodgeChance']) &&
  (value['skills'] === undefined || (Array.isArray(value['skills']) && value['skills'].every(isLearnedSkill))) &&
  (value['actions'] === undefined || (Array.isArray(value['actions']) && value['actions'].every(isUnitAction)));

const isBleed = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['perTick']) && isNumber(value['ticksLeft']) && isNumber(value['nextTickAt']);
const isPoisonStack = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['damage']) && isNumber(value['nextTickAt']) && isNumber(value['expiresAt']) &&
  (value['sourceId'] === undefined || typeof value['sourceId'] === 'string');
const isTimedShare = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['share']) && isNumber(value['expiresAt']) && isOptionalNumber(value['amplify']);
/** Absent in saves from before the effect existed. */
const isOptional = (value: unknown, guard: (value: unknown) => boolean): boolean => value === undefined || value === null || guard(value);
const isWard = (value: unknown): boolean =>
  isRecord(value) && isNumber(value['amount']) && isNumber(value['expiresAt']);
const isSkillTicks = (value: unknown): boolean =>
  isRecord(value) && Object.entries(value).every(([id, tick]) => isSkillId(id) && isNumber(tick));

/** A clock for each of the Unit's actions, or an action would silently never come. */
const hasActionClocks = (spec: Record<string, unknown>, clocks: unknown, inSecondPhase: unknown): boolean => {
  const phase = spec['secondPhase'];
  if (inSecondPhase !== undefined && typeof inSecondPhase !== 'boolean') return false;
  // A second Phase needs one to be in.
  if (inSecondPhase === true && !isRecord(phase)) return false;
  const actions = inSecondPhase === true ? (phase as Record<string, unknown>)['actions'] : spec['actions'];
  return Array.isArray(clocks) && clocks.every(isNumber) && clocks.length === (Array.isArray(actions) ? actions.length : 0);
};

const isUnitState = (value: unknown): boolean =>
  isRecord(value) &&
  isUnitSpec(value['spec']) &&
  isTeam(value['team']) &&
  isRow(value['row']) &&
  isNumber(value['health']) &&
  isNumber(value['ticksToAction']) &&
  hasActionClocks(value['spec'] as Record<string, unknown>, value['ticksToEachAction'], value['inSecondPhase']) &&
  isNumber(value['oil']) &&
  isSkillTicks(value['skillReadyAt']) &&
  (value['bleed'] === null || isBleed(value['bleed'])) &&
  Array.isArray(value['poison']) &&
  value['poison'].every(isPoisonStack) &&
  (value['ward'] === null || isWard(value['ward'])) &&
  isOptional(value['burn'], isBleed) &&
  isOptional(value['slow'], isTimedShare) &&
  isOptional(value['curse'], isTimedShare) &&
  isOptionalNumber(value['poisonLimit']) &&
  (value['fellBack'] === undefined || typeof value['fellBack'] === 'boolean') &&
  (value['dodgeNext'] === undefined || typeof value['dodgeNext'] === 'boolean') &&
  isNumber(value['barUntil']) &&
  isNumber(value['barArmour']);

export const isBattleState = (value: unknown): boolean =>
  isRecord(value) &&
  isRng(value['rng']) &&
  Array.isArray(value['units']) &&
  value['units'].every(isUnitState) &&
  isNumber(value['maxTicks']) &&
  isNumber(value['tick']) &&
  typeof value['over'] === 'boolean' &&
  (value['winner'] === null || isTeam(value['winner']));
