import { describe, expect, it } from 'vitest';
import { mergeAwayReports, type AwayReport, type AwaySetback } from './index';

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
    const base = { damageDealt: 0, healed: 0, elapsedMs: 0, appliedMs: 0, capped: false, floorsCleared: 0, deepestFloor: 0, setbacks: [], guardianKills: 0, lampRelit: false, fellBack: false, guardianPicks: [], levels: [], loot: { common: 0, magic: 0, rare: 0, unique: 0, notable: [] }, unspentSkillPoints: 0 };
    const earlier = { ...base, guardianAttempts: { attempts: 2, reachedSecondPhase: 0, bestHealthShare: 0.6, previousBestHealthShare: 0.8 } };
    const later = { ...base, guardianAttempts: { attempts: 1, reachedSecondPhase: 1, bestHealthShare: 0.4, previousBestHealthShare: 0.6 } };
    expect(mergeAwayReports(earlier, later).guardianAttempts).toEqual({ attempts: 3, reachedSecondPhase: 1, bestHealthShare: 0.4, previousBestHealthShare: 0.8 });
    expect(mergeAwayReports(earlier, { ...base, guardianAttempts: null }).guardianAttempts).toEqual(earlier.guardianAttempts);
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
    guardianPicks: [],
    levels: [],
    loot: { common: 1, magic: 1, rare: 0, unique: 0, notable: [] },
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
      report({ levels: [{ heroId: 'warrener', from: 1, to: 3 }] }),
      report({ levels: [{ heroId: 'warrener', from: 3, to: 4 }, { heroId: 'lamplighter', from: 2, to: 3 }] }),
    );
    expect(merged.levels).toEqual([{ heroId: 'warrener', from: 1, to: 4 }, { heroId: 'lamplighter', from: 2, to: 3 }]);
  });
});
