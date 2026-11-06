import { describe, expect, it } from 'vitest';
import { advance, createGame, viewGame, type Game, type GameEvent, type GameView } from '../../sim';
import { ART_HEIGHT, ART_WIDTH, wayPoint } from './iso';
import { drawScene, snappedDisplayWidth } from './draw';
import { roomLookOf } from './roomLook';
import { bakeRoom } from './roomBake';
import { createStage, type SceneFrame, type Stage, type UnitFrame } from './stage';

const TICK_MS = 100;
const stageOf = (): Stage => createStage({ random: () => 0.5 });

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

const settle = (stage: Stage, seconds: number): void => {
  for (let t = 0; t < seconds; t += 0.05) stage.advance(0.05);
};

function brightness(view: GameView, oil: number): number {
  const stage = stageOf();
  stage.sync({ ...view, heroes: view.heroes.map((hero) => ({ ...hero, oil: hero.stats.maxOil * oil })) });
  settle(stage, 8);
  const frame = stage.frame();
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

    const stage = stageOf();
    stage.sync(view);
    settle(stage, 8);
    const before = unitIn(stage.frame(), 'sin-eater').x;
    stage.play({ events, ticks: 1 }, view);
    settle(stage, 0.28);
    const during = stage.frame();
    expect(unitIn(during, 'sin-eater').x).toBeGreaterThan(before + 20);
    expect(during.numbers.length).toBeGreaterThan(0);
    settle(stage, 2);
    expect(unitIn(stage.frame(), 'sin-eater').x).toBeCloseTo(before, 0);
  });

  it('holds a target’s health bar until the blow lands', () => {
    const game = createGame({ seed: 8 });
    const { events, view } = runUntil(game, (tickEvents) => tickEvents.some((event) => event.type === 'attack' && event.attackerId === 'sin-eater' && event.damage > 0));
    const attack = events.find((event) => event.type === 'attack' && event.attackerId === 'sin-eater');
    if (attack?.type !== 'attack') throw new Error('No attack');
    const stage = stageOf();
    stage.sync(view);
    stage.play({ events, ticks: 1 }, view);
    const shown = unitIn(stage.frame(), attack.targetId).health;
    const actual = view.battle!.enemies.find((unit) => unit.id === attack.targetId)!.health;
    expect(shown).toBeCloseTo(actual + attack.damage, 5);
    settle(stage, 1);
    stage.sync(view);
    expect(unitIn(stage.frame(), attack.targetId).health).toBeCloseTo(actual, 5);
  });

  it('jumps to the current state instead of replaying a long batch', () => {
    const game = createGame({ seed: 8 });
    const { events, view } = runUntil(game, (tickEvents) => tickEvents.some((event) => event.type === 'attack'));
    const stage = stageOf();
    stage.sync(view);
    stage.play({ events, ticks: 600 }, view);
    const frame = stage.frame();
    expect(frame.numbers).toEqual([]);
    expect(frame.fade).toBe(0);
    settle(stage, 0.05);
    expect(stage.frame().numbers).toEqual([]);

    stage.play({ events, ticks: null }, view);
    expect(stage.frame().numbers).toEqual([]);
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
    const stage = stageOf();
    stage.sync(before);
    settle(stage, 1);
    stage.play({ events, ticks: 1 }, view);
    stage.sync(view);
    expect(unitIn(stage.frame(), death.unitId).dissolve).toBe(0);
    settle(stage, 0.5);
    expect(unitIn(stage.frame(), death.unitId).dissolve).toBeGreaterThan(0);
    settle(stage, 2);
    expect(stage.frame().units.some((unit) => unit.id === death.unitId)).toBe(false);
  });

  it('walks the Party in through the way in when it reaches a new Room', () => {
    const game = createGame({ seed: 8 });
    const start = runUntil(game, (_, view) => view.phase === 'travelling' && view.map !== null).view;
    const firstRoom = roomLookOf(start.map!, start.floor!, start.map!.rooms.findIndex((room) => room.state === 'current'));
    const stage = stageOf();
    stage.sync(start);
    const wayIn = wayPoint(firstRoom.ways.find((way) => way.role === 'in')!.edge);
    const arrived = unitIn(stage.frame(), 'huntsman');
    expect(arrived.x).toBeCloseTo(wayIn.x, 0);
    expect(arrived.y).toBeCloseTo(wayIn.y, 0);
    settle(stage, 8);
    expect(Math.hypot(unitIn(stage.frame(), 'huntsman').x - wayIn.x, unitIn(stage.frame(), 'huntsman').y - wayIn.y)).toBeGreaterThan(40);
  });

  it('leaves through the way out, then changes Room', () => {
    const game = createGame({ seed: 8 });
    const first = runUntil(game, (_, view) => view.phase === 'travelling' && view.map !== null).view;
    const stage = stageOf();
    stage.sync(first);
    settle(stage, 8);
    const firstKey = stage.frame().look!.key;
    const next = runUntil(game, (_, view) => view.map!.rooms.findIndex((room) => room.state === 'current') === 1).view;
    stage.sync(next);
    expect(stage.frame().look!.key).toBe(firstKey);
    settle(stage, 1.2);
    stage.sync(next);
    expect(stage.frame().look!.key).not.toBe(firstKey);
    expect(stage.frame().fade).toBe(0);
  });

  it('stays in place through a frame with no time in it', () => {
    const game = createGame({ seed: 8 });
    const { view } = runUntil(game, (_, current) => current.phase === 'travelling' && current.map !== null);
    const stage = stageOf();
    stage.sync(view);
    settle(stage, 8);
    const before = unitIn(stage.frame(), 'huntsman').x;
    stage.advance(0);
    expect(unitIn(stage.frame(), 'huntsman').x).toBe(before);
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
