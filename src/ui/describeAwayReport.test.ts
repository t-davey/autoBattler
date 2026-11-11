import { describe, expect, it } from 'vitest';
import type { AwayReport, AwaySetback } from '../sim';
import { describeAbsence, describeDuration, groupSetbacks, mergeAwayReports } from './describeAwayReport';

const describeSetbacks = (setbacks: readonly AwaySetback[]): readonly string[] => groupSetbacks(setbacks).map((group) => group.text);

const setback = (changes: Partial<AwaySetback> = {}): AwaySetback => ({
  kind: 'wipe',
  floor: 3,
  enemyName: 'The Mouldering Warden',
  mainDamageType: 'poison',
  mainDamageShare: 0.8,
  ...changes,
});

describe('mergeAwayReports, Guardian attempts', () => {
  it('adds attempts, keeps the lowest health, and keeps the earlier previous best', () => {
    const base = { damageDealt: 0, healed: 0, elapsedMs: 0, appliedMs: 0, capped: false, floorsCleared: 0, deepestFloor: 0, setbacks: [], guardianKills: 0, lampRelit: false, fellBack: false, levels: [], loot: { common: 0, magic: 0, rare: 0, notable: [] }, unspentSkillPoints: 0 };
    const earlier = { ...base, guardianAttempts: { attempts: 2, reachedSecondPhase: 0, bestHealthShare: 0.6, previousBestHealthShare: 0.8 } };
    const later = { ...base, guardianAttempts: { attempts: 1, reachedSecondPhase: 1, bestHealthShare: 0.4, previousBestHealthShare: 0.6 } };
    expect(mergeAwayReports(earlier, later).guardianAttempts).toEqual({ attempts: 3, reachedSecondPhase: 1, bestHealthShare: 0.4, previousBestHealthShare: 0.8 });
    expect(mergeAwayReports(earlier, { ...base, guardianAttempts: null }).guardianAttempts).toEqual(earlier.guardianAttempts);
  });
});

describe('describeSetbacks', () => {
  it('groups Setbacks at one enemy with one main damage type', () => {
    expect(describeSetbacks([setback(), setback({ mainDamageShare: 0.6 })])).toEqual(['2 Wipes at the Mouldering Warden, mostly poison damage']);
  });

  it('says mostly only above half', () => {
    expect(describeSetbacks([setback({ mainDamageShare: 0.5 })])).toEqual(['1 Wipe at the Mouldering Warden']);
  });

  it('keeps draws apart from Wipes, and enemies apart', () => {
    const lines = describeSetbacks([
      setback({ kind: 'draw' }),
      setback({ enemyName: 'Sodden Thrall', mainDamageType: 'physical', mainDamageShare: 1 }),
      setback({ kind: 'draw', mainDamageType: 'physical', mainDamageShare: 0 }),
    ]);
    expect(lines).toEqual([
      '1 draw at the Mouldering Warden, mostly poison damage',
      '1 Wipe at the Sodden Thrall, mostly physical damage',
      '1 draw at the Mouldering Warden',
    ]);
  });
});

describe('mergeAwayReports', () => {
  const report = (changes: Partial<AwayReport>): AwayReport => ({
    elapsedMs: 60_000,
    appliedMs: 60_000,
    capped: false,
    floorsCleared: 1,
    deepestFloor: 1,
    setbacks: [],
    guardianKills: 0,
    guardianAttempts: null,
    damageDealt: 0,
    healed: 0,
    lampRelit: false,
    fellBack: false,
    levels: [],
    loot: { common: 1, magic: 1, rare: 0, notable: [] },
    unspentSkillPoints: 1,
    ...changes,
  });

  it('adds counts and times, keeps the deepest Floor, and takes the latest skill points', () => {
    const merged = mergeAwayReports(
      report({ deepestFloor: 3, setbacks: [setback()], lampRelit: true, unspentSkillPoints: 2 }),
      report({ deepestFloor: 2, setbacks: [setback({ kind: 'draw' })], fellBack: true, guardianKills: 1, unspentSkillPoints: 5 }),
    );
    expect(merged).toMatchObject({ elapsedMs: 120_000, appliedMs: 120_000, floorsCleared: 2, deepestFloor: 3, guardianKills: 1, lampRelit: true, fellBack: true, unspentSkillPoints: 5 });
    expect(merged.setbacks.map((entry) => entry.kind)).toEqual(['wipe', 'draw']);
    expect(merged.loot).toMatchObject({ common: 2, magic: 2, rare: 0 });
  });

  it('runs a Hero\'s levels from the first report to the last', () => {
    const merged = mergeAwayReports(
      report({ levels: [{ heroId: 'huntsman', from: 1, to: 3 }] }),
      report({ levels: [{ heroId: 'huntsman', from: 3, to: 4 }, { heroId: 'lamplighter', from: 2, to: 3 }] }),
    );
    expect(merged.levels).toEqual([{ heroId: 'huntsman', from: 1, to: 4 }, { heroId: 'lamplighter', from: 2, to: 3 }]);
  });
});

describe('describeDuration', () => {
  it.each([
    [45_000, '45 seconds'],
    [60_000, '1 minute'],
    [130_000, '2 minutes'],
    [3_600_000, '1 hour'],
    [3_900_000, '1 hour 5 minutes'],
    [43_200_000, '12 hours'],
  ])('%i ms reads as %s', (ms, text) => {
    expect(describeDuration(ms)).toBe(text);
  });
});

describe('describeAbsence', () => {
  const report = (elapsedMs: number, appliedMs: number, capped: boolean) => ({ elapsedMs, appliedMs, capped }) as AwayReport;

  it('gives the time away', () => {
    expect(describeAbsence(report(120_000, 120_000, false))).toBe('Away 2 minutes.');
  });

  it('notes a cap', () => {
    expect(describeAbsence(report(72_000_000, 43_200_000, true))).toBe('Away 20 hours. Only 12 hours of it counted.');
  });
});
