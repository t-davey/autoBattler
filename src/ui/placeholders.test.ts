import { describe, expect, it } from 'vitest';
import { figureOf } from './battleScene/art';
import { describeEvent } from './describeEvent';

describe('placeholders in the UI', () => {
  it('draws placeholder enemies and Guardians as their own flat blocks', () => {
    expect(figureOf({ id: 'enemy-front-0', name: 'Placeholder Brute (Act 1)', placeholder: true })).toBe('placeholder');
    expect(figureOf({ id: 'guardian', name: 'Placeholder Guardian (Act 1, Lamp 1)', placeholder: true })).toBe('placeholderGuardian');
    expect(figureOf({ id: 'guardian', name: 'The Mouldering Warden', placeholder: false })).toBe('guardian');
  });

  it('draws each Undercroft Guardian and enemy as its own figure', () => {
    const names = ['The Iron Sexton', 'The Knell Engine', 'The Reliquary Engine', 'Charnel Brute', 'Knucklebone Flinger', 'Drowned Mourner', 'Silt Lurker', 'Drowned Bellman', 'Shellcap Husk', 'Shroud Weaver'];
    const figures = names.map((name) => figureOf({ id: 'guardian', name }));
    expect(new Set(figures).size).toBe(names.length);
    expect(figures).not.toContain('guardian');
    expect(figures).not.toContain('thrall');
  });

  it('marks a placeholder Act’s introduction on its first Floor only', () => {
    expect(describeEvent({ type: 'floorEntered', floor: 1 })).toBe('Act 1, Floor 1: The Wilderness. [placeholder: this Act’s introduction]');
    expect(describeEvent({ type: 'floorEntered', floor: 2 })).toBe('Act 1, Floor 2: The Wilderness.');
    expect(describeEvent({ type: 'floorEntered', floor: 21 })).toBe('Act 2, Floor 1: The Undercroft.');
  });
});
