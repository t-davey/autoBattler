import { describe, expect, it } from 'vitest';
import { PICK_TAGS } from '../sim';
import { describeTag } from './describePicks';

describe('describeTag', () => {
  it('says what each Pick with the tag does, and when it can be offered', () => {
    expect(describeTag('guardian')).toEqual(['Guardian prep: +25% power against Guardians, offered before a Guardian']);
    expect(describeTag('stacking')).toEqual(['Stacking power: +4% power for each Floor cleared this Run, offered when setting out']);
    expect(describeTag('armour')).toEqual(['Armour boon: +10 armour, offered when setting out or before a Guardian']);
  });

  it('gives every tag at least one Pick', () => {
    for (const tag of PICK_TAGS) expect(describeTag(tag).length).toBeGreaterThan(0);
  });
});
