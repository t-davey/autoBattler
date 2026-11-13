import { describe, expect, it } from 'vitest';
import { advance, applyAction, createGame, deserializeGame, isPartyChoice, serializeGame, viewGame, type ClassId } from './index';

const heroesOf = (party: readonly ClassId[], seed = 1) => viewGame(createGame({ seed, party })).heroes;

describe('choosing the Party', () => {
  it('fields the 3 Classes the player picks, in order', () => {
    expect(heroesOf(['hexer', 'sin-eater', 'warrener']).map((hero) => [hero.id, hero.classId, hero.className])).toEqual([
      ['hexer', 'hexer', 'Hexer'],
      ['sin-eater', 'sin-eater', 'Sin-Eater'],
      ['warrener', 'warrener', 'Warrener'],
    ]);
  });

  it('allows a Class more than once, numbering those Heroes', () => {
    const heroes = heroesOf(['lamplighter', 'warrener', 'lamplighter']);
    expect(heroes.map((hero) => hero.id)).toEqual(['lamplighter-1', 'warrener', 'lamplighter-2']);
    expect(heroesOf(['hexer', 'hexer', 'hexer']).map((hero) => hero.id)).toEqual(['hexer-1', 'hexer-2', 'hexer-3']);
  });

  it('gives each Hero a different generated name, the same for the same Seed', () => {
    const names = heroesOf(['warrener', 'warrener', 'warrener']).map((hero) => hero.name);
    expect(new Set(names).size).toBe(3);
    expect(names.every((name) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(name))).toBe(true);
    expect(heroesOf(['warrener', 'warrener', 'warrener']).map((hero) => hero.name)).toEqual(names);
    expect(heroesOf(['warrener', 'warrener', 'warrener'], 2).map((hero) => hero.name)).not.toEqual(names);
  });

  it('builds each Hero of a repeated Class apart', () => {
    const game = createGame({ seed: 1, party: ['sin-eater', 'sin-eater', 'lamplighter'], scenario: { heroLevel: 3 } });
    expect(applyAction(game, { type: 'spendSkillPoint', heroId: 'sin-eater-2', skillId: 'penitent-blow' })).toEqual({ ok: true });
    const [first, second] = viewGame(game).heroes;
    expect(first!.skills.find((skill) => skill.id === 'penitent-blow')!.rank).toBe(0);
    expect(second!.skills.find((skill) => skill.id === 'penitent-blow')!.rank).toBe(1);
  });

  it('plays, saves, and loads with a repeated Class', () => {
    const game = createGame({ seed: 3, party: ['hexer', 'hexer', 'sin-eater'] });
    advance(game, 600_000);
    const loaded = deserializeGame(serializeGame(game))!;
    expect(viewGame(loaded)).toEqual(viewGame(game));
  });

  it('refuses a save whose Hero ids don\'t match their Classes, or repeat', () => {
    const saved = JSON.parse(serializeGame(createGame({ seed: 1, party: ['hexer', 'hexer', 'sin-eater'] }))) as { game: { heroes: { id: string }[] } };
    const withIds = (ids: readonly string[]) =>
      JSON.stringify({ ...saved, game: { ...saved.game, heroes: saved.game.heroes.map((hero, index) => ({ ...hero, id: ids[index] })) } });
    expect(deserializeGame(withIds(['hexer-1', 'hexer-2', 'sin-eater']))).not.toBeNull();
    expect(deserializeGame(withIds(['hexer-1', 'hexer-1', 'sin-eater']))).toBeNull();
    expect(deserializeGame(withIds(['hexer-1', 'warrener', 'sin-eater']))).toBeNull();
  });

  it('wipes saves from before Heroes carried their Class', () => {
    const saved = JSON.parse(serializeGame(createGame({ seed: 1 }))) as { version: number };
    expect(deserializeGame(JSON.stringify({ ...saved, version: 6 }))).toBeNull();
  });

  it('takes only 3 known Classes as a Party', () => {
    expect(isPartyChoice(['hexer', 'hexer', 'hexer'])).toBe(true);
    expect(isPartyChoice(['hexer', 'hexer'])).toBe(false);
    expect(isPartyChoice(['hexer', 'hexer', 'huntsman'])).toBe(false);
  });
});
