import type { DamageType } from './battle';
import { CLASS_IDS } from './content/party';
import type { HeroId } from './content/skills';
import { bankElapsed, CATCH_UP_CAP_MS, heroesOf, stateOf, stepTick, usableElapsed, type Game } from './game';
import { isHeroIdOf, unspentPoints } from './heroes';
import type { ItemView } from './items';
import { viewPick, type PickView } from './picks';
import { frontierWall, type EventSink, type GameEvent } from './run';

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

/** How Guardian fights went with a Pick held. */
export interface AwayPickRecord {
  readonly pick: PickView;
  readonly fights: number;
  readonly kills: number;
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
  /** Each Pick held in a Guardian fight, most kills first. */
  readonly guardianPicks: readonly AwayPickRecord[];
  readonly levels: readonly AwayLevelGain[];
  readonly loot: {
    readonly common: number;
    readonly magic: number;
    readonly rare: number;
    readonly unique: number;
    /** The rares and uniques. */
    readonly notable: readonly ItemView[];
  };
  readonly unspentSkillPoints: number;
  /** Damage the Heroes dealt, Bleed included. */
  readonly damageDealt: number;
  /** Health the Heroes restored with skills. */
  readonly healed: number;
}

function mergeAttempts(earlier: AwayReport['guardianAttempts'], later: AwayReport['guardianAttempts']): AwayReport['guardianAttempts'] {
  if (!earlier || !later) return earlier ?? later;
  return {
    attempts: earlier.attempts + later.attempts,
    reachedSecondPhase: earlier.reachedSecondPhase + later.reachedSecondPhase,
    bestHealthShare: Math.min(earlier.bestHealthShare, later.bestHealthShare),
    previousBestHealthShare: earlier.previousBestHealthShare,
  };
}

function mergePicks(earlier: readonly AwayPickRecord[], later: readonly AwayPickRecord[]): AwayPickRecord[] {
  const merged = [...earlier];
  for (const record of later) {
    const index = merged.findIndex((entry) => entry.pick.id === record.pick.id);
    const soFar = merged[index];
    if (soFar) merged[index] = { pick: record.pick, fights: soFar.fights + record.fights, kills: soFar.kills + record.kills };
    else merged.push(record);
  }
  return merged.sort((a, b) => b.kills - a.kills || b.fights - a.fights);
}

/** One report for two absences in a row, so an unread one isn't lost. */
export function mergeAwayReports(earlier: AwayReport, later: AwayReport): AwayReport {
  const levels = [...earlier.levels];
  for (const gain of later.levels) {
    const index = levels.findIndex((entry) => entry.heroId === gain.heroId);
    if (index === -1) levels.push(gain);
    else levels[index] = { ...gain, from: levels[index]!.from };
  }
  return {
    elapsedMs: earlier.elapsedMs + later.elapsedMs,
    appliedMs: earlier.appliedMs + later.appliedMs,
    capped: earlier.capped || later.capped,
    floorsCleared: earlier.floorsCleared + later.floorsCleared,
    deepestFloor: Math.max(earlier.deepestFloor, later.deepestFloor),
    setbacks: [...earlier.setbacks, ...later.setbacks],
    guardianKills: earlier.guardianKills + later.guardianKills,
    damageDealt: earlier.damageDealt + later.damageDealt,
    healed: earlier.healed + later.healed,
    guardianAttempts: mergeAttempts(earlier.guardianAttempts, later.guardianAttempts),
    lampRelit: earlier.lampRelit || later.lampRelit,
    fellBack: earlier.fellBack || later.fellBack,
    guardianPicks: mergePicks(earlier.guardianPicks, later.guardianPicks),
    levels,
    loot: {
      common: earlier.loot.common + later.loot.common,
      magic: earlier.loot.magic + later.loot.magic,
      rare: earlier.loot.rare + later.loot.rare,
      unique: earlier.loot.unique + later.loot.unique,
      notable: [...earlier.loot.notable, ...later.loot.notable],
    },
    unspentSkillPoints: later.unspentSkillPoints,
  };
}

interface Tally {
  floorsCleared: number;
  deepestFloor: number;
  setbacks: AwaySetback[];
  guardianKills: number;
  damageDealt: number;
  healed: number;
  guardianAttempts: GuardianAttempts | null;
  /** Whether the current Battle's Guardian has entered its second Phase. */
  inSecondPhase: boolean;
  previousBest: number | null;
  lampRelit: boolean;
  fellBack: boolean;
  guardianPicks: AwayPickRecord[];
  /** The Picks the current Run holds. */
  runPicks: PickView[];
  levels: AwayLevelGain[];
  loot: { common: number; magic: number; rare: number; unique: number; notable: ItemView[] };
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

const isHero = (id: string): boolean => CLASS_IDS.some((classId) => isHeroIdOf(id, classId));

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

/** Counts a Guardian fight for every Pick the Run holds. */
function addGuardianFight(tally: Tally, killed: boolean): void {
  for (const pick of tally.runPicks) {
    const index = tally.guardianPicks.findIndex((record) => record.pick.id === pick.id);
    const soFar = tally.guardianPicks[index] ?? { pick, fights: 0, kills: 0 };
    const record = { pick, fights: soFar.fights + 1, kills: soFar.kills + (killed ? 1 : 0) };
    if (index === -1) tally.guardianPicks.push(record);
    else tally.guardianPicks[index] = record;
  }
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
      else tally.damageDealt += event.damage;
      return;
    case 'heal':
      tally.healed += event.amount;
      return;
    case 'floorEntered':
      // Each Run starts at Floor 1, so reaching a later Floor means the one above was cleared.
      if (event.floor > 1) tally.floorsCleared++;
      tally.deepestFloor = Math.max(tally.deepestFloor, event.floor);
      return;
    case 'wipe':
    case 'draw':
      tally.setbacks.push({ kind: event.type, floor: event.floor, enemyName: event.enemyName, ...mainDamage(tally.battleDamage) });
      if (event.guardianHealthShare !== null) {
        addAttempt(tally, event.guardianHealthShare);
        addGuardianFight(tally, false);
      }
      return;
    case 'pickTaken':
      tally.runPicks.push(event.taken);
      return;
    case 'returnedToTown':
      tally.runPicks = [];
      return;
    case 'fellBack':
      tally.fellBack = true;
      return;
    case 'guardianFell':
      // The Guardian's Floor has no stairs: its fall clears the Floor.
      tally.floorsCleared++;
      tally.guardianKills++;
      addGuardianFight(tally, true);
      return;
    case 'lampRelit':
      tally.lampRelit = true;
      return;
    case 'levelUp':
      addLevel(tally.levels, event.heroId, event.level);
      return;
    case 'itemFound':
      tally.loot[event.item.rarity]++;
      if (event.item.rarity === 'rare' || event.item.rarity === 'unique') tally.loot.notable.push(event.item);
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
      damageDealt: 0,
      healed: 0,
      guardianAttempts: null,
      // A Battle already under way may have its Guardian in the second Phase.
      inSecondPhase: state.battle?.units.some((unit) => unit.inSecondPhase === true) ?? false,
      previousBest: frontierWall(state.walls).bestAttempt ?? null,
      lampRelit: false,
      fellBack: false,
      guardianPicks: [],
      runPicks: state.run.picks.map(viewPick),
      levels: [],
      loot: { common: 0, magic: 0, rare: 0, unique: 0, notable: [] },
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

  const { battleDamage: _battleDamage, inSecondPhase: _inSecondPhase, previousBest: _previousBest, runPicks: _runPicks, ...tally } = catchUp.tally;
  return {
    ...tally,
    guardianPicks: [...tally.guardianPicks].sort((a, b) => b.kills - a.kills || b.fights - a.fights),
    elapsedMs: catchUp.elapsedMs,
    appliedMs: catchUp.appliedMs,
    capped: catchUp.elapsedMs > catchUp.appliedMs,
    unspentSkillPoints: heroesOf(game).reduce((total, hero) => total + unspentPoints(hero), 0),
  };
}
