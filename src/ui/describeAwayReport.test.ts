import { describe, expect, it } from 'vitest';
import type { AwayReport, AwaySetback } from '../sim';
import { describeAbsence, describeDuration, describeSetbacks } from './describeAwayReport';

const setback = (changes: Partial<AwaySetback> = {}): AwaySetback => ({
  kind: 'wipe',
  floor: 3,
  enemyName: 'The Mouldering Warden',
  mainDamageType: 'poison',
  mainDamageShare: 0.8,
  ...changes,
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
