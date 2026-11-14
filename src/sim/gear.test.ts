import { describe, expect, it } from 'vitest';
import {
  advance,
  applyAction,
  createGame,
  deserializeGame,
  depthTuning,
  partyUnitSpecs,
  rollItem,
  serializeGame,
  simulateBattle,
  TICK_MS,
  viewGame,
  viewStash,
  type BattleEvent,
  type Game,
  type GameEvent,
  type GameSetup,
  type ItemSpec,
  type ItemView,
  type LearnedSkill,
  type UnitSpec,
} from './index';

type Scenario = NonNullable<GameSetup['scenario']>;
const game = (scenario: Scenario = {}, party?: GameSetup['party']): Game => createGame({ seed: 1, scenario, ...(party ? { party } : {}) });
const spec = (baseId: ItemSpec['baseId'], overrides: Partial<ItemSpec> = {}): ItemSpec => ({ baseId, rarity: 'common', affixes: [], levelRequirement: 1, ...overrides });
const unique = (baseId: ItemSpec['baseId']): ItemSpec => ({ baseId, rarity: 'unique', affixes: [], levelRequirement: 1, scale: 1 });
const stashItem = (from: Game, name: string): ItemView => viewStash(from).find((item) => item.name === name)!;

const unit = (id: string, overrides: Partial<UnitSpec> = {}): UnitSpec => ({
  id,
  name: id,
  health: 1_000,
  power: 0,
  actionInterval: 100_000,
  row: 'front',
  reach: 'melee',
  targeting: 'frontFirst',
  damageType: 'physical',
  armour: 0,
  resistances: {},
  critChance: 0,
  ...overrides,
});

/** A Hero stand-in that uses one free skill, with or without its unique, against these enemies. */
function castOnce(skill: LearnedSkill, row: UnitSpec['row'], enemies: UnitSpec[], allies: UnitSpec[] = []): readonly BattleEvent[] {
  const reach = skill.id === 'consume-sin' ? 'melee' : 'ranged';
  const caster = unit('caster', { power: 100, actionInterval: 30, row, reach, maxOil: 100, skills: [skill] });
  return simulateBattle({ seed: 3, maxTicks: 31, teams: { a: [caster, ...allies], b: enemies } }).log;
}
const hitsOn = (log: readonly BattleEvent[]): string[] => log.flatMap((event) => (event.type === 'attack' ? [event.targetId] : []));

describe('6 Slots', () => {
  it('rolls each Slot about as often, so trinkets drop twice as often as any other kind', () => {
    const counts = new Map<string, number>();
    const total = 12_000;
    for (let seed = 0; seed < total; seed++) {
      const { baseId } = rollItem(seed, 30);
      const kind = { 'iron-cudgel': 'weapon', 'flensing-knife': 'weapon', 'bone-sling': 'weapon', 'coffin-lid-buckler': 'offHand', 'bone-censer': 'offHand', 'spare-lantern': 'offHand', 'iron-skullcap': 'helm', 'mourners-hood': 'helm', 'mould-mask': 'helm', 'rust-mail': 'body', 'waxed-shroud': 'body', 'saints-knuckle': 'trinket', 'bone-dice': 'trinket', 'spigot-key': 'trinket' }[baseId as string]!;
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    for (const kind of ['weapon', 'offHand', 'helm', 'body']) expect(counts.get(kind)! / total).toBeCloseTo(1 / 6, 1);
    expect(counts.get('trinket')! / total).toBeCloseTo(2 / 6, 1);
  });

  it('fills both trinket Slots, and equips into the Slot named', () => {
    const played = game({ stash: [spec('bone-dice'), spec('spigot-key'), spec('bone-dice', { rarity: 'magic', affixes: [{ id: 'keen', value: 3 }] })] });
    applyAction(played, { type: 'equipItem', heroId: 'warrener', itemId: stashItem(played, 'Bone Dice').id });
    applyAction(played, { type: 'equipItem', heroId: 'warrener', itemId: stashItem(played, 'Spigot Key').id });
    const hero = () => viewGame(played).heroes.find((candidate) => candidate.id === 'warrener')!;
    expect([hero().equipment.trinket?.name, hero().equipment.secondTrinket?.name]).toEqual(['Bone Dice', 'Spigot Key']);
    expect(applyAction(played, { type: 'equipItem', heroId: 'warrener', itemId: stashItem(played, 'Keen Bone Dice').id, slot: 'helm' })).toEqual({ ok: false, reason: 'wrongSlot' });
    applyAction(played, { type: 'equipItem', heroId: 'warrener', itemId: stashItem(played, 'Keen Bone Dice').id, slot: 'secondTrinket' });
    expect([hero().equipment.trinket?.name, hero().equipment.secondTrinket?.name]).toEqual(['Bone Dice', 'Keen Bone Dice']);
    expect(viewStash(played).map((item) => item.name)).toEqual(['Spigot Key']);
  });

  it('a Spare Lantern raises the lantern’s Oil', () => {
    const plain = viewGame(game()).heroes[0]!.stats.maxOil;
    const lit = viewGame(game({ equipped: { 'sin-eater': [spec('spare-lantern')] } })).heroes[0]!;
    expect(lit.stats.maxOil).toBe(plain + 15);
    expect(lit.equipment.offHand?.name).toBe('Spare Lantern');
  });
});

describe('uniques', () => {
  it('only their own Class may wear them', () => {
    const played = game({ stash: [unique('wake-platter')] });
    const platter = viewStash(played)[0]!;
    expect(platter.unique).toMatchObject({ classId: 'sin-eater', className: 'Sin-Eater' });
    expect(applyAction(played, { type: 'equipItem', heroId: 'warrener', itemId: platter.id })).toEqual({ ok: false, reason: 'classOnlyItem' });
    expect(applyAction(played, { type: 'equipItem', heroId: 'sin-eater', itemId: platter.id })).toEqual({ ok: true });
    expect(viewGame(played).heroes[0]!.equipment.offHand?.rarity).toBe('unique');
  });

  it('scale their stats with the Floor they dropped on', () => {
    const played = game({ stash: [{ ...unique('wake-platter'), scale: depthTuning(30).affixScale }] });
    expect(viewStash(played)[0]!.stats).toMatchObject({ armour: Math.round(6 * depthTuning(30).affixScale), maxHealth: Math.round(20 * depthTuning(30).affixScale) });
  });

  it('mark the free skill they change on the Hero’s Unit', () => {
    const worn = partyUnitSpecs(game({ equipped: { 'sin-eater': [unique('wake-platter')] } }));
    expect(worn[0]!.skills!.find((skill) => skill.id === 'consume-sin')).toMatchObject({ unique: true });
    expect(worn[1]!.skills!.find((skill) => skill.id === 'tainted-shaft')?.unique).toBeUndefined();
  });

  it('the Wake Platter turns Consume Sin on the whole front Row, healing for each hit', () => {
    const enemies = [unit('e1'), unit('e2'), unit('e3', { row: 'back' })];
    const plain = castOnce({ id: 'consume-sin', rank: 1 }, 'front', enemies);
    const platter = castOnce({ id: 'consume-sin', rank: 1, unique: true }, 'front', enemies);
    expect(hitsOn(plain)).toHaveLength(1);
    expect(new Set(hitsOn(platter))).toEqual(new Set(['e1', 'e2']));
    const damage = platter.flatMap((event) => (event.type === 'attack' ? [event.damage] : []));
    expect(damage).toEqual([90, 90]);
  });

  it('the Ratter’s Quiver looses 2 shafts at 2 different enemies, or both at a lone one', () => {
    const quiver = { id: 'tainted-shaft', rank: 1, unique: true } as const;
    expect(new Set(hitsOn(castOnce(quiver, 'back', [unit('e1'), unit('e2', { row: 'back' })])))).toEqual(new Set(['e1', 'e2']));
    expect(hitsOn(castOnce(quiver, 'back', [unit('e1')]))).toEqual(['e1', 'e1']);
    expect(hitsOn(castOnce({ id: 'tainted-shaft', rank: 1 }, 'back', [unit('e1'), unit('e2')]))).toHaveLength(1);
  });

  it('the Layer-Out’s Coif Slows the target’s whole Row harder, which takes half the hit', () => {
    const log = castOnce({ id: 'chill-word', rank: 1, unique: true }, 'back', [unit('e1'), unit('e2'), unit('e3'), unit('e4', { row: 'back' })]);
    const attacks = log.flatMap((event) => (event.type === 'attack' ? [event] : []));
    const struck = attacks.map((event) => event.targetId);
    expect(new Set(struck)).toEqual(new Set(['e1', 'e2', 'e3']));
    const [main, ...splash] = attacks.map((event) => event.damage);
    expect(splash).toEqual([main! / 2, main! / 2]);
    const slows = log.flatMap((event) => (event.type === 'effect' && event.effect === 'slow' ? [event] : []));
    expect(slows.map((event) => event.targetId).sort()).toEqual([...struck].sort());
  });

  it('the Dusk Taper’s Votive Spark heals the most wounded Hero for 60% of the hit', () => {
    const wounded = unit('wounded', { health: 100, maxHealth: 1_000 });
    const log = castOnce({ id: 'votive-spark', rank: 1, unique: true }, 'back', [unit('e1')], [wounded]);
    const hit = log.find((event) => event.type === 'attack');
    const heal = log.find((event) => event.type === 'heal');
    if (hit?.type !== 'attack' || heal?.type !== 'heal') throw new Error('Votive Spark neither hit nor healed');
    expect([heal.targetId, heal.amount]).toEqual(['wounded', hit.damage * 0.6]);
    expect(castOnce({ id: 'votive-spark', rank: 1 }, 'back', [unit('e1')], [wounded]).some((event) => event.type === 'heal')).toBe(false);
  });

  // Enough to beat any Undercroft Guardian, so every Seed counts.
  const MIGHTY = spec('rust-mail', { rarity: 'rare', affixes: [{ id: 'keen', value: 300 }, { id: 'hale', value: 5_000 }] });

  it('each Undercroft Guardian drops its own unique on about 10% of kills after the first', () => {
    /** The item each Seed's Guardian drops at this depth, its Lamp long lit. Seeds whose Party falls drop nothing. */
    const drops = (floor: number, seeds: number): ItemView[] =>
      Array.from({ length: seeds }, (_, seed) => {
        const played = createGame({ seed, scenario: { heroLevel: 60, lampsLit: 8, startAt: { floor, room: 'guardian' }, equipped: { 'sin-eater': [MIGHTY], warrener: [MIGHTY], lamplighter: [MIGHTY] } } });
        let fell = false;
        let over = false;
        let found: ItemView | null = null;
        for (let i = 0; i < 20_000 && !over; i++) {
          advance(played, TICK_MS * 50, (event: GameEvent) => {
            if (event.type === 'guardianFell') fell = true;
            else if (event.type === 'itemFound' && fell && !over) [found, over] = [event.item, true];
            else if (event.type === 'wipe' || event.type === 'draw') over = true;
          });
        }
        return found ? [found] : [];
      }).flat();
    const warden = drops(25, 200);
    expect(warden.length).toBeGreaterThan(150);
    const uniques = warden.filter((item) => item.rarity === 'unique');
    expect(warden.some((item) => item.rarity === 'rare' && item.affixes.length === 0)).toBe(false);
    expect(uniques.length / warden.length).toBeGreaterThan(0.04);
    expect(uniques.length / warden.length).toBeLessThan(0.17);
    expect(new Set(uniques.map((item) => item.name))).toEqual(new Set(["The Layer-Out's Coif"]));
    expect(uniques[0]!.levelRequirement).toBe(depthTuning(25).levelRequirement);
    const held = [30, 35, 40].map((floor) => drops(floor, 150).find((item) => item.rarity === 'unique')?.name);
    expect(held).toEqual(['The Wake Platter', "The Ratter's Quiver", 'The Dusk Taper']);
  });
});

describe('saves', () => {
  it('round-trip uniques and the new Slots, and still load version 7', () => {
    const played = game({ equipped: { 'sin-eater': [unique('wake-platter'), spec('iron-skullcap'), spec('bone-dice'), spec('spigot-key')] } });
    const text = serializeGame(played);
    expect(serializeGame(deserializeGame(text)!)).toBe(text);
    const old = JSON.parse(text);
    old.version = 7;
    expect(deserializeGame(JSON.stringify(old))).not.toBeNull();
  });

  it('refuse a unique worn by another Class, or a unique without its scale', () => {
    const wrongClass = JSON.parse(serializeGame(game({ equipped: { 'sin-eater': [unique('wake-platter')] } })));
    wrongClass.game.heroes[1].equipped.offHand = wrongClass.game.heroes[0].equipped.offHand;
    delete wrongClass.game.heroes[0].equipped.offHand;
    expect(deserializeGame(JSON.stringify(wrongClass))).toBeNull();
    const unscaled = JSON.parse(serializeGame(game({ stash: [unique('dusk-taper')] })));
    delete unscaled.game.stash[0].scale;
    expect(deserializeGame(JSON.stringify(unscaled))).toBeNull();
  });
});
