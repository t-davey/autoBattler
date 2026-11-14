import type { AwayReport, GameView, HeroView, ItemStat } from '../sim';
import { groupSetbacks, mainDamageOf } from './describeAwayReport';
import { STAT_TEXT } from './describeItem';
import { TAG_TEXT } from './describePicks';

export type FindingKind = 'setbacks' | 'picks' | 'loot' | 'points';

/** One entry in the check-in. Its text states facts, and never judges whether a change was enough. */
export interface Finding {
  readonly kind: FindingKind;
  readonly title: string;
  readonly details: readonly string[];
  /** The stat that answers these Setbacks, for the Stash to filter by. */
  readonly stat: ItemStat | null;
}

type AnsweringStat = 'armour' | 'poisonResistance';

/** The Hero stat that answers each Damage type the game deals so far. */
const ANSWERING_STAT: Partial<Record<string, AnsweringStat>> = { physical: 'armour', poison: 'poisonResistance' };

const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function answeringStatLine(stat: AnsweringStat, heroes: readonly HeroView[]): string {
  const unit = stat === 'poisonResistance' ? '%' : '';
  const values = heroes.map((hero) => `${hero.name} ${Math.round(hero.stats[stat])}${unit}`);
  return `${capitalized(STAT_TEXT[stat])}: ${values.join(', ')}`;
}

function fallbackLine(report: AwayReport, view: GameView): string | null {
  if (!report.fellBack) return null;
  return view.wall.fallenBack ? 'The Party fell back, and turns back before the Guardian' : 'The Party will challenge the Guardian again';
}

const percentOf = (share: number): string => `${Math.round(share * 100)}%`;

/** Progress on a Guardian still standing, since a kill makes it moot. */
function attemptsLine({ guardianAttempts, guardianKills }: AwayReport): string | null {
  if (!guardianAttempts || guardianKills > 0) return null;
  const { attempts, reachedSecondPhase, bestHealthShare, previousBestHealthShare } = guardianAttempts;
  const reached = reachedSecondPhase > 0 ? `Reached Phase 2 in ${reachedSecondPhase} of ${attempts} attempt${attempts === 1 ? '' : 's'}. ` : '';
  const was = previousBestHealthShare === null ? '' : `, was ${percentOf(previousBestHealthShare)}`;
  return `${reached}Best attempt at the Guardian: ${percentOf(bestHealthShare)} of its health left${was}`;
}

function setbackFinding(report: AwayReport, view: GameView): Finding | null {
  // Most frequent first, so the title names what stopped the Party most often.
  const [top, ...rest] = [...groupSetbacks(report.setbacks)].sort((a, b) => b.count - a.count);
  if (!top) return null;
  const main = mainDamageOf(top.setback);
  const stat = main ? (ANSWERING_STAT[main] ?? null) : null;
  const fallback = fallbackLine(report, view);
  const attempts = attemptsLine(report);
  return {
    kind: 'setbacks',
    title: top.text,
    details: [
      ...(attempts ? [attempts] : []),
      ...(rest.length > 0 ? [rest.map((group) => group.text).join(' · ')] : []),
      ...(stat ? [answeringStatLine(stat, view.heroes)] : []),
      ...(fallback ? [fallback] : []),
    ],
    stat,
  };
}

/** Which Picks the Runs held when they fought a Guardian, and how those fights went. */
function picksFinding({ guardianPicks }: AwayReport, view: GameView): Finding | null {
  if (guardianPicks.length === 0) return null;
  const kills = (count: number) => `${count} kill${count === 1 ? '' : 's'}`;
  const [top] = guardianPicks;
  const records = guardianPicks.map(({ pick, fights, kills: killed }) => `${pick.name}: ${kills(killed)} in ${fights} fight${fights === 1 ? '' : 's'}`);
  return {
    kind: 'picks',
    title: top!.kills > 0 ? `Guardian kills held ${top!.pick.name} most` : 'Picks held at the Guardian',
    details: [records.join(' · '), `Pick rule: ${view.pickPriority.map((tag) => TAG_TEXT[tag]).join(', ')}`],
    stat: null,
  };
}

function lootFinding({ loot }: AwayReport): Finding | null {
  if (loot.common + loot.magic + loot.rare + loot.unique === 0) return null;
  const notable = loot.notable.map((item) => item.name);
  const salvaged = loot.salvaged > 0 ? `. ${loot.salvaged} salvaged for ${loot.salvageGained} Salvage` : '';
  const lost = loot.lostToFullStash.length > 0 ? [`Lost to a full Stash: ${loot.lostToFullStash.map((item) => item.name).join(', ')}`] : [];
  return {
    kind: 'loot',
    title: `Loot: ${loot.common} common, ${loot.magic} magic, ${loot.rare} rare${loot.unique > 0 ? `, ${loot.unique} unique` : ''}${salvaged}`,
    details: [...(notable.length > 0 ? [notable.join(', ')] : []), ...lost],
    stat: null,
  };
}

function pointsFinding(report: AwayReport, heroes: readonly HeroView[]): Finding | null {
  if (report.unspentSkillPoints === 0 && report.levels.length === 0) return null;
  const unspent = heroes.reduce((total, hero) => total + hero.unspentPoints, 0);
  const nameOf = (id: string): string => heroes.find((hero) => hero.id === id)?.name ?? id;
  const title = unspent === 0 ? (report.unspentSkillPoints === 0 ? 'No skill points to spend' : 'All skill points spent') : `${unspent} skill point${unspent === 1 ? '' : 's'} to spend`;
  const levels = report.levels.map(({ heroId, from, to }) => `${nameOf(heroId)}: level ${from} to ${to}`);
  return { kind: 'points', title, details: levels.length > 0 ? [levels.join(' · ')] : [], stat: null };
}

/** The Findings of a report, as the Party stands now, so they update during the check-in. */
export function describeFindings(report: AwayReport, view: GameView): readonly Finding[] {
  return [setbackFinding(report, view), picksFinding(report, view), lootFinding(report), pointsFinding(report, view.heroes)].filter((finding) => finding !== null);
}
