import type { DamageType } from './battle';
import { HERO_IDS } from './content/party';
import type { HeroId } from './content/skills';
import { bankElapsed, CATCH_UP_CAP_MS, heroesOf, stateOf, stepTick, usableElapsed, type Game } from './game';
import { unspentPoints } from './heroes';
import type { ItemView } from './items';
import type { EventSink, GameEvent } from './run';

export interface AwaySetback {
  readonly kind: 'wipe' | 'draw';
  readonly floor: number;
  /** The Guardian, or the Pack's leading enemy. */
  readonly enemyName: string;
  readonly mainDamageType: DamageType;
  /** 0-1 of the damage the Party took in that Battle, a Ward's share included. */
  readonly mainDamageShare: number;
}

export interface AwayLevelGain {
  readonly heroId: HeroId;
  readonly from: number;
  readonly to: number;
}

/** How the Party fared against a Guardian in this report's Setbacks. */
export interface GuardianAttempts {
  /** Setbacks at the Guardian. */
  readonly attempts: number;
  readonly reachedSecondPhase: number;
  /** The lowest share of its health the Guardian was left on. */
  readonly bestHealthShare: number;
  /** The same, across all play before this report. Null if there was none. */
  readonly previousBestHealthShare: number | null;
}

export interface AwayReport {
  readonly elapsedMs: number;
  readonly appliedMs: number;
  readonly capped: boolean;
  readonly floorsCleared: number;
  /** The deepest Floor the Party stood on during the absence. 0 if it never left Town. */
  readonly deepestFloor: number;
  readonly setbacks: readonly AwaySetback[];
  readonly guardianKills: number;
  /** Null if no Setback came at a Guardian. */
  readonly guardianAttempts: GuardianAttempts | null;
  readonly lampRelit: boolean;
  readonly fellBack: boolean;
  readonly levels: readonly AwayLevelGain[];
  readonly loot: {
    readonly common: number;
    readonly magic: number;
    readonly rare: number;
    /** The rares. */
    readonly notable: readonly ItemView[];
  };
  readonly unspentSkillPoints: number;
}

interface Tally {
  floorsCleared: number;
  deepestFloor: number;
  setbacks: AwaySetback[];
  guardianKills: number;
  guardianAttempts: GuardianAttempts | null;
  /** Whether the current Battle's Guardian has entered its second Phase. */
  inSecondPhase: boolean;
  previousBest: number | null;
  lampRelit: boolean;
  fellBack: boolean;
  levels: AwayLevelGain[];
  loot: { common: number; magic: number; rare: number; notable: ItemView[] };
  /** Damage the Party has taken in the current Battle. */
  battleDamage: Partial<Record<DamageType, number>>;
}

/** A catch-up under way, as plain data. continueCatchUp mutates it. */
export interface CatchUp {
  ticksLeft: number;
  readonly ticksTotal: number;
  readonly elapsedMs: number;
  readonly appliedMs: number;
  readonly tally: Tally;
}

const isHero = (id: string): boolean => (HERO_IDS as readonly string[]).includes(id);

/** A Battle already under way when catch-up began shows only the damage since then. */
function mainDamage(battleDamage: Tally['battleDamage']): Pick<AwaySetback, 'mainDamageType' | 'mainDamageShare'> {
  let mainDamageType: DamageType = 'physical';
  let largest = 0;
  let total = 0;
  for (const [type, damage] of Object.entries(battleDamage) as [DamageType, number][]) {
    total += damage;
    if (damage > largest || (damage === largest && type === 'physical')) {
      mainDamageType = type;
      largest = damage;
    }
  }
  return { mainDamageType, mainDamageShare: total === 0 ? 0 : largest / total };
}

function addLevel(levels: AwayLevelGain[], heroId: HeroId, level: number): void {
  const index = levels.findIndex((entry) => entry.heroId === heroId);
  const from = levels[index]?.from ?? level - 1;
  const entry = { heroId, from, to: level };
  if (index === -1) levels.push(entry);
  else levels[index] = entry;
}

function addAttempt(tally: Tally, healthShare: number): void {
  const soFar = tally.guardianAttempts;
  tally.guardianAttempts = {
    attempts: (soFar?.attempts ?? 0) + 1,
    reachedSecondPhase: (soFar?.reachedSecondPhase ?? 0) + (tally.inSecondPhase ? 1 : 0),
    bestHealthShare: Math.min(soFar?.bestHealthShare ?? 1, healthShare),
    previousBestHealthShare: tally.previousBest,
  };
}

function fold(tally: Tally, event: GameEvent): void {
  switch (event.type) {
    case 'battleStarted':
      tally.battleDamage = {};
      tally.inSecondPhase = false;
      return;
    case 'phaseChanged':
      tally.inSecondPhase = true;
      return;
    case 'attack':
    case 'effectDamage':
      if (isHero(event.targetId)) tally.battleDamage[event.damageType] = (tally.battleDamage[event.damageType] ?? 0) + event.damage + event.absorbed;
      return;
    case 'floorEntered':
      // Each Run starts at Floor 1, so reaching a later Floor means the one above was cleared.
      if (event.floor > 1) tally.floorsCleared++;
      tally.deepestFloor = Math.max(tally.deepestFloor, event.floor);
      return;
    case 'wipe':
    case 'draw':
      tally.setbacks.push({ kind: event.type, floor: event.floor, enemyName: event.enemyName, ...mainDamage(tally.battleDamage) });
      if (event.guardianHealthShare !== null) addAttempt(tally, event.guardianHealthShare);
      return;
    case 'fellBack':
      tally.fellBack = true;
      return;
    case 'guardianFell':
      // The Guardian's Floor has no stairs: its fall clears the Floor.
      tally.floorsCleared++;
      tally.guardianKills++;
      return;
    case 'lampRelit':
      tally.lampRelit = true;
      return;
    case 'levelUp':
      addLevel(tally.levels, event.heroId, event.level);
      return;
    case 'itemFound':
      tally.loot[event.item.rarity]++;
      if (event.item.rarity === 'rare') tally.loot.notable.push(event.item);
      return;
    default:
      return;
  }
}

/** Caps elapsedMs at CATCH_UP_CAP_MS and banks it. Runs nothing yet. */
export function beginCatchUp(game: Game, elapsedMs: number): CatchUp {
  const elapsed = usableElapsed(elapsedMs);
  const appliedMs = Math.min(elapsed, CATCH_UP_CAP_MS);
  const state = stateOf(game);
  const ticks = bankElapsed(state, appliedMs);
  return {
    ticksLeft: ticks,
    ticksTotal: ticks,
    elapsedMs: elapsed,
    appliedMs,
    tally: {
      floorsCleared: 0,
      deepestFloor: state.run.floor ?? 0,
      setbacks: [],
      guardianKills: 0,
      guardianAttempts: null,
      inSecondPhase: false,
      previousBest: state.wall.bestAttempt ?? null,
      lampRelit: false,
      fellBack: false,
      levels: [],
      loot: { common: 0, magic: 0, rare: 0, notable: [] },
      battleDamage: {},
    },
  };
}

/** Runs up to maxTicks. Returns the Away Report once ticksLeft reaches 0, else null. */
export function continueCatchUp(game: Game, catchUp: CatchUp, maxTicks: number): AwayReport | null {
  const state = stateOf(game);
  const sink: EventSink = (event) => fold(catchUp.tally, event);
  const ticks = Math.max(0, Math.min(Math.floor(maxTicks), catchUp.ticksLeft));
  for (let i = 0; i < ticks; i++) stepTick(state, sink);
  catchUp.ticksLeft -= ticks;
  if (catchUp.ticksLeft > 0) return null;

  const { battleDamage: _battleDamage, inSecondPhase: _inSecondPhase, previousBest: _previousBest, ...tally } = catchUp.tally;
  return {
    ...tally,
    elapsedMs: catchUp.elapsedMs,
    appliedMs: catchUp.appliedMs,
    capped: catchUp.elapsedMs > catchUp.appliedMs,
    unspentSkillPoints: heroesOf(game).reduce((total, hero) => total + unspentPoints(hero), 0),
  };
}
