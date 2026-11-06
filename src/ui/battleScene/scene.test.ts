import { describe, expect, it } from 'vitest';
import { advance, createGame, viewGame, type Game, type GameEvent, type GameView } from '../../sim';
import { ART_HEIGHT, ART_WIDTH, wayPoint } from './iso';
import { drawScene, sceneDisplayWidth, snappedDisplayWidth, uiScale } from './draw';
import { roomLookOf } from './roomLook';
import { bakeRoom } from './roomBake';
import { createScene, type SceneFrame, type Scene, type UnitFrame } from './scene';

const TICK_MS = 100;
const sceneOf = (): Scene => createScene({ random: () => 0.5 });

/** Advances the Game a Tick at a time until the test says stop, returning that Tick's events. */
function runUntil(game: Game, stop: (events: readonly GameEvent[], view: GameView) => boolean, limit = 20_000): { events: readonly GameEvent[]; view: GameView } {
  for (let i = 0; i < limit; i++) {
    const events: GameEvent[] = [];
    advance(game, TICK_MS, (event) => events.push(event));
    const view = viewGame(game);
    if (stop(events, view)) return { events, view };
  }
  throw new Error('It never happened');
}

const unitIn = (frame: SceneFrame, id: string): UnitFrame => {
  const unit = frame.units.find((candidate) => candidate.id === id);
  if (!unit) throw new Error(`No Unit ${id}`);
  return unit;
};

const settle = (scene: Scene, seconds: number): void => {
  for (let t = 0; t < seconds; t += 0.05) scene.advance(0.05);
};

function brightness(view: GameView, oil: number): number {
  const scene = sceneOf();
  scene.sync({ ...view, heroes: view.heroes.map((hero) => ({ ...hero, oil: hero.stats.maxOil * oil })) });
  settle(scene, 8);
  const frame = scene.frame();
  const buffer = new Uint8ClampedArray(ART_WIDTH * ART_HEIGHT * 4);
  drawScene(buffer, bakeRoom(frame.look!, frame.lampLit), frame);
  let total = 0;
  for (let i = 0; i < buffer.length; i += 4) total += buffer[i]! + buffer[i + 1]! + buffer[i + 2]!;
  return total;
}

describe('the Battle scene', () => {
  it('sends a melee attacker to its target, then back', () => {
    const game = createGame({ seed: 8 });
    const { events, view } = runUntil(game, (tickEvents) => tickEvents.some((event) => event.type === 'attack' && event.attackerId === 'sin-eater'));
    const attack = events.find((event) => event.type === 'attack' && event.attackerId === 'sin-eater');
    if (attack?.type !== 'attack') throw new Error('No attack');

    const scene = sceneOf();
    scene.sync(view);
    settle(scene, 8);
    const before = unitIn(scene.frame(), 'sin-eater').x;
    scene.play({ events, ticks: 1 }, view);
    settle(scene, 0.28);
    const during = scene.frame();
    expect(unitIn(during, 'sin-eater').x).toBeGreaterThan(before + 20);
    expect(during.numbers.length).toBeGreaterThan(0);
    settle(scene, 2);
    expect(unitIn(scene.frame(), 'sin-eater').x).toBeCloseTo(before, 0);
  });

  it('holds a target’s health bar until the blow lands', () => {
    const game = createGame({ seed: 8 });
    const { events, view } = runUntil(game, (tickEvents) => tickEvents.some((event) => event.type === 'attack' && event.attackerId === 'sin-eater' && event.damage > 0));
    const attack = events.find((event) => event.type === 'attack' && event.attackerId === 'sin-eater');
    if (attack?.type !== 'attack') throw new Error('No attack');
    const scene = sceneOf();
    scene.sync(view);
    scene.play({ events, ticks: 1 }, view);
    const shown = unitIn(scene.frame(), attack.targetId).health;
    const actual = view.battle!.enemies.find((unit) => unit.id === attack.targetId)!.health;
    expect(shown).toBeCloseTo(actual + attack.damage, 5);
    settle(scene, 1);
    scene.sync(view);
    expect(unitIn(scene.frame(), attack.targetId).health).toBeCloseTo(actual, 5);
  });

  it('jumps to the current state instead of replaying a long batch', () => {
    const game = createGame({ seed: 8 });
    const { events, view } = runUntil(game, (tickEvents) => tickEvents.some((event) => event.type === 'attack'));
    const scene = sceneOf();
    scene.sync(view);
    scene.play({ events, ticks: 600 }, view);
    const frame = scene.frame();
    expect(frame.numbers).toEqual([]);
    expect(frame.fade).toBe(0);
    settle(scene, 0.05);
    expect(scene.frame().numbers).toEqual([]);

    scene.play({ events, ticks: null }, view);
    expect(scene.frame().numbers).toEqual([]);
  });

  it('crumbles a killed enemy once the killing blow lands', () => {
    const game = createGame({ seed: 8 });
    let before = viewGame(game);
    const { events, view } = runUntil(game, (tickEvents, current) => {
      const found = tickEvents.some((event) => event.type === 'death' && event.unitId.startsWith('enemy'));
      if (!found) before = current;
      return found;
    });
    const death = events.find((event) => event.type === 'death');
    if (death?.type !== 'death') throw new Error('No death');
    const scene = sceneOf();
    scene.sync(before);
    settle(scene, 1);
    scene.play({ events, ticks: 1 }, view);
    scene.sync(view);
    expect(unitIn(scene.frame(), death.unitId).dissolve).toBe(0);
    settle(scene, 0.5);
    expect(unitIn(scene.frame(), death.unitId).dissolve).toBeGreaterThan(0);
    settle(scene, 2);
    expect(scene.frame().units.some((unit) => unit.id === death.unitId)).toBe(false);
  });

  it('walks the Party in through the way in when it reaches a new Room', () => {
    const game = createGame({ seed: 8 });
    const start = runUntil(game, (_, view) => view.phase === 'travelling' && view.map !== null).view;
    const firstRoom = roomLookOf(start.map!, start.floor!, start.map!.rooms.findIndex((room) => room.state === 'current'));
    const scene = sceneOf();
    scene.sync(start);
    const wayIn = wayPoint(firstRoom.ways.find((way) => way.role === 'in')!.edge);
    const arrived = unitIn(scene.frame(), 'huntsman');
    expect(arrived.x).toBeCloseTo(wayIn.x, 0);
    expect(arrived.y).toBeCloseTo(wayIn.y, 0);
    settle(scene, 8);
    expect(Math.hypot(unitIn(scene.frame(), 'huntsman').x - wayIn.x, unitIn(scene.frame(), 'huntsman').y - wayIn.y)).toBeGreaterThan(40);
  });

  it('leaves through the way out, then changes Room', () => {
    const game = createGame({ seed: 8 });
    const first = runUntil(game, (_, view) => view.phase === 'travelling' && view.map !== null).view;
    const scene = sceneOf();
    scene.sync(first);
    settle(scene, 8);
    const firstKey = scene.frame().look!.key;
    const next = runUntil(game, (_, view) => view.map!.rooms.findIndex((room) => room.state === 'current') === 1).view;
    scene.sync(next);
    expect(scene.frame().look!.key).toBe(firstKey);
    settle(scene, 1.2);
    scene.sync(next);
    expect(scene.frame().look!.key).not.toBe(firstKey);
    expect(scene.frame().fade).toBe(0);
  });

  it('clears every fallen enemy, however the blows overlapped', () => {
    const game = createGame({ seed: 2 });
    const scene = sceneOf();
    let lingering = 0;
    for (let step = 0; step < 12_000; step++) {
      const events: GameEvent[] = [];
      advance(game, TICK_MS, (event) => events.push(event));
      const view = viewGame(game);
      if (view.phase === 'town') continue;
      scene.play({ events, ticks: 1 }, view);
      scene.advance(0.1);
      scene.sync(view);
      const inBattle = new Set(view.battle?.enemies.map((unit) => unit.id));
      const stray = scene.frame().units.some((unit) => unit.team === 'enemy' && !inBattle.has(unit.id));
      lingering = stray ? lingering + 1 : 0;
      expect(lingering).toBeLessThan(30);
    }
  });

  it('lands a blow that a new move cuts off', () => {
    const game = createGame({ seed: 8 });
    const { events, view } = runUntil(game, (tickEvents) => tickEvents.some((event) => event.type === 'attack' && event.attackerId === 'sin-eater' && event.damage > 0));
    const attack = events.find((event) => event.type === 'attack' && event.attackerId === 'sin-eater');
    if (attack?.type !== 'attack') throw new Error('No attack');
    const scene = sceneOf();
    scene.sync(view);
    scene.play({ events: [attack], ticks: 1 }, view);
    const held = unitIn(scene.frame(), attack.targetId).health;
    scene.play({ events: [{ ...attack, tick: attack.tick + 1, damage: 0, absorbed: 0 }], ticks: 1 }, view);
    expect(unitIn(scene.frame(), attack.targetId).health).toBeLessThan(held);
  });

  it('stays in place through a frame with no time in it', () => {
    const game = createGame({ seed: 8 });
    const { view } = runUntil(game, (_, current) => current.phase === 'travelling' && current.map !== null);
    const scene = sceneOf();
    scene.sync(view);
    settle(scene, 8);
    const before = unitIn(scene.frame(), 'huntsman').x;
    scene.advance(0);
    expect(unitIn(scene.frame(), 'huntsman').x).toBe(before);
  });

  it('dims with the Party’s Oil', () => {
    const game = createGame({ seed: 8 });
    const { view } = runUntil(game, (_, current) => current.phase === 'travelling' && current.map !== null);
    expect(brightness(view, 0)).toBeLessThan(brightness(view, 1) * 0.97);
  });

  it('lights the way out, whatever lights the Room', () => {
    const game = createGame({ seed: 8 });
    const { view } = runUntil(game, (_, current) => current.phase === 'travelling' && current.map !== null);
    const look = roomLookOf(view.map!, view.floor!, 0);
    const lit = bakeRoom(look, false);
    const without = bakeRoom({ ...look, ways: look.ways.filter((way) => way.role !== 'out') }, false);
    expect(lit.flames.length).toBeGreaterThan(without.flames.length);
  });
});

describe('the scene’s display size', () => {
  it('scales the UI with the scene, in step with whole device pixels', () => {
    expect(uiScale(1280, 720, 1)).toBe(1);
    expect(uiScale(1920, 1080, 1)).toBe(1.5);
    expect(uiScale(2560, 1440, 1)).toBe(2);
    expect(uiScale(2048, 1152, 1.25)).toBe(1.6);
  });

  it('waits for the next whole scale, whichever side of the window limits it', () => {
    expect(uiScale(1366, 768, 1)).toBe(1);
    expect(uiScale(2560, 1000, 1)).toBe(1.25);
    expect(uiScale(1500, 1440, 1)).toBe(1);
  });

  it('keeps the scene in step with the UI just short of the next size', () => {
    expect(uiScale(1920, 1079, 1)).toBe(1.25);
    expect(sceneDisplayWidth(1920, 1029, 1920, 1079, 1)).toBe(1600);
    expect(sceneDisplayWidth(1920, 1020, 1920, 1080, 1)).toBe(1920);
  });

  it('never scales the UI below its base size', () => {
    expect(uiScale(900, 600, 1)).toBe(1);
  });

  it('keeps each art pixel a whole number of device pixels', () => {
    for (const ratio of [1, 1.25, 1.5, 2]) {
      for (const available of [400, 640, 700, 1000]) {
        const devicePixels = snappedDisplayWidth(available, ratio) * ratio;
        expect(devicePixels % ART_WIDTH).toBeCloseTo(0, 5);
        expect(snappedDisplayWidth(available, ratio)).toBeLessThanOrEqual(Math.max(available, ART_WIDTH / ratio));
      }
    }
  });
});
