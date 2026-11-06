import { describe, expect, it } from 'vitest';
import { createGame, itemBlocksLearnedSkill, viewGame, type AwayReport, type AwaySetback, type GameView, type HeroView } from '../sim';
import { describeFindings } from './describeFindings';
import { changedStats, formatChange, statChange } from './describeItem';

const setback = (changes: Partial<AwaySetback> = {}): AwaySetback => ({
  kind: 'wipe',
  floor: 3,
  enemyName: 'The Mouldering Warden',
  mainDamageType: 'poison',
  mainDamageShare: 0.8,
  ...changes,
});

const report = (changes: Partial<AwayReport> = {}): AwayReport => ({
  elapsedMs: 3_600_000,
  appliedMs: 3_600_000,
  capped: false,
  floorsCleared: 0,
  deepestFloor: 1,
  setbacks: [],
  guardianKills: 0,
  lampRelit: false,
  fellBack: false,
  levels: [],
  loot: { common: 0, magic: 0, rare: 0, notable: [] },
  unspentSkillPoints: 0,
  ...changes,
});

const newView = (): GameView => viewGame(createGame({ seed: 1 }));

const withHeroes = (view: GameView, change: (hero: HeroView) => HeroView): GameView => ({ ...view, heroes: view.heroes.map(change) });

describe('describeFindings', () => {
  it('has no Findings when nothing happened', () => {
    expect(describeFindings(report(), newView())).toEqual([]);
  });

  it('leads with the most frequent Setback, and names the rest', () => {
    const [finding] = describeFindings(report({ setbacks: [setback({ enemyName: 'Mire Bloat' }), setback(), setback()] }), newView());
    expect(finding?.title).toBe('2 Wipes at the Mouldering Warden, mostly poison damage');
    expect(finding?.details[0]).toBe('1 Wipe at the Mire Bloat, mostly poison damage');
  });

  it('points poison Setbacks at poison resistance, as each Hero now stands', () => {
    const view = newView();
    const first = describeFindings(report({ setbacks: [setback()] }), view)[0];
    expect(first?.stat).toBe('poisonResistance');

    const raised = withHeroes(view, (hero) => ({ ...hero, stats: { ...hero.stats, poisonResistance: 24 } }));
    const line = describeFindings(report({ setbacks: [setback()] }), raised)[0]?.details[0];
    expect(line).toBe(`Poison resistance: ${view.heroes.map((hero) => `${hero.name} 24%`).join(', ')}`);
  });

  it('points physical Setbacks at armour', () => {
    const finding = describeFindings(report({ setbacks: [setback({ mainDamageType: 'physical' })] }), newView())[0];
    expect(finding?.stat).toBe('armour');
    expect(finding?.details[0]).toMatch(/^Armour: /);
  });

  it('names no stat when no damage type led', () => {
    const finding = describeFindings(report({ setbacks: [setback({ mainDamageShare: 0.5 })] }), newView())[0];
    expect(finding?.stat).toBeNull();
    expect(finding?.details).toEqual([]);
  });

  it('says whether the Party still turns back, from the fallback as it stands now', () => {
    const view = newView();
    const fellBack = report({ setbacks: [setback({ mainDamageShare: 0 })], fellBack: true });
    const fallenBack = { ...view, wall: { ...view.wall, fallenBack: true } };
    expect(describeFindings(fellBack, fallenBack)[0]?.details).toEqual(['The Party fell back, and turns back before the Guardian']);
    expect(describeFindings(fellBack, { ...view, wall: { ...view.wall, fallenBack: false } })[0]?.details).toEqual(['The Party will challenge the Guardian again']);
  });

  it('counts unspent skill points as they stand now, and says when none are left', () => {
    const view = newView();
    const reported = report({ unspentSkillPoints: 3 });
    const withPoints = (points: number) => withHeroes(view, (hero) => ({ ...hero, unspentPoints: points }));
    expect(describeFindings(reported, withPoints(1))[0]?.title).toBe(`${view.heroes.length} skill points to spend`);
    expect(describeFindings(reported, withPoints(0))[0]?.title).toBe('All skill points spent');
  });

  it('keeps level gains on show when no skill points were left unspent', () => {
    const view = newView();
    const hero = view.heroes[0]!;
    const levels = [{ heroId: hero.id, from: 1, to: 2 }];
    const [finding] = describeFindings(report({ levels }), withHeroes(view, (each) => ({ ...each, unspentPoints: 0 })));
    expect(finding?.title).toBe('No skill points to spend');
    expect(finding?.details).toEqual([`${hero.name}: level 1 to 2`]);
  });

  it('keeps the loot Finding the same whatever the player does', () => {
    const loot = { common: 2, magic: 1, rare: 0, notable: [] };
    const [finding] = describeFindings(report({ loot }), newView());
    expect(finding?.title).toBe('Loot: 2 common, 1 magic, 0 rare');
  });
});

describe('item comparison', () => {
  const stats = { power: 4, maxHealth: 0, armour: 18, poisonResistance: 24, critChance: 0, speed: 0 };
  const shroud = { id: 1, name: 'Waxed Shroud', slot: 'body', rarity: 'rare', reach: null, levelRequirement: 1, affixes: [], stats } as const;
  const hero = newView().heroes[0]!;

  it('compares with an empty Slot as the item alone', () => {
    const bare = { ...hero, equipment: { ...hero.equipment, body: null } };
    expect(statChange(shroud, bare, 'armour')).toBe(18);
    expect(changedStats(shroud, [bare])).toEqual(['power', 'armour', 'poisonResistance']);
  });

  it('shows what the player would lose from the item worn', () => {
    const worn = { ...hero, equipment: { ...hero.equipment, body: { ...shroud, stats: { ...stats, armour: 30 } } } };
    expect(statChange(shroud, worn, 'armour')).toBe(-12);
    expect(formatChange('armour', -12)).toBe('-12');
    expect(formatChange('poisonResistance', 24)).toBe('+24%');
    expect(formatChange('armour', 0)).toBe('0');
  });

  it('warns only about a ranged weapon on a Hero with a learned melee skill', () => {
    const bow = { ...shroud, slot: 'weapon', reach: 'ranged' } as const;
    const melee = hero.skills[0]!;
    const learned = { ...hero, skills: [{ ...melee, reach: 'melee', rank: 1 }] } as const;
    const unlearned = { ...hero, skills: [{ ...melee, reach: 'melee', rank: 0 }] } as const;
    expect(itemBlocksLearnedSkill(bow, learned)).toBe(true);
    expect(itemBlocksLearnedSkill(bow, unlearned)).toBe(false);
    expect(itemBlocksLearnedSkill(shroud, learned)).toBe(false);
  });
});
