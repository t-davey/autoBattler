import type { AwayPickRecord, AwayReport, AwaySetback } from '../sim';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

/** A length of time to the minute, such as "1 hour 5 minutes". Under a minute, in seconds. */
export function describeDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1_000);
  if (totalSeconds < 60) return plural(totalSeconds, 'second');
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [...(hours > 0 ? [plural(hours, 'hour')] : []), ...(minutes > 0 ? [plural(minutes, 'minute')] : [])];
  return parts.join(' ');
}

const MOSTLY_ABOVE = 0.5;

/** The Damage type that did over half the damage, if one did. */
export const mainDamageOf = ({ mainDamageType, mainDamageShare }: AwaySetback): string | null => (mainDamageShare > MOSTLY_ABOVE ? mainDamageType : null);

/** "The Mouldering Warden" and "Sodden Thrall" both read as "the ..." mid-sentence. */
const enemyPhrase = (name: string): string => `the ${name.replace(/^The /, '')}`;

export interface SetbackGroup {
  readonly setback: AwaySetback;
  readonly count: number;
  /** Such as "2 Wipes at the Mouldering Warden, mostly poison damage". */
  readonly text: string;
}

/** One group for each kind of Setback at each enemy, in the order they first happened. */
export function groupSetbacks(setbacks: readonly AwaySetback[]): readonly SetbackGroup[] {
  const groups = new Map<string, { setback: AwaySetback; count: number }>();
  for (const setback of setbacks) {
    const key = JSON.stringify([setback.kind, setback.enemyName, mainDamageOf(setback)]);
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { setback, count: 1 });
  }
  return [...groups.values()].map(({ setback, count }) => {
    const main = mainDamageOf(setback);
    const kind = plural(count, setback.kind === 'wipe' ? 'Wipe' : 'draw');
    return { setback, count, text: `${kind} at ${enemyPhrase(setback.enemyName)}${main ? `, mostly ${main} damage` : ''}` };
  });
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
      notable: [...earlier.loot.notable, ...later.loot.notable],
    },
    unspentSkillPoints: later.unspentSkillPoints,
  };
}

/** How long the Party was left, and how much of it counted. */
export function describeAbsence({ elapsedMs, appliedMs, capped }: AwayReport): string {
  return capped ? `Away ${describeDuration(elapsedMs)}. Only ${describeDuration(appliedMs)} of it counted.` : `Away ${describeDuration(elapsedMs)}.`;
}
