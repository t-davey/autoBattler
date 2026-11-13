import { describe, expect, it } from 'vitest';
import { createGame, createWall, deserializeGame, recordGrowth, serializeGame, recordGuardianKill, recordSetback, SETBACKS_TO_FALL_BACK, turnsBackBeforeGuardian, type WallEvent } from './index';

function collector(): { events: WallEvent['type'][]; sink: (event: WallEvent) => void } {
  const events: WallEvent['type'][] = [];
  return { events, sink: (event) => events.push(event.type) };
}

describe('the Wall', () => {
  it('falls back on the last Setback, and only once', () => {
    const wall = createWall({ setbacks: SETBACKS_TO_FALL_BACK - 1 });
    const { events, sink } = collector();
    expect(turnsBackBeforeGuardian(wall)).toBe(false);
    recordSetback(wall, sink);
    recordSetback(wall, sink);
    expect(events).toEqual(['fellBack']);
    expect(wall.setbacks).toBe(SETBACKS_TO_FALL_BACK);
    expect(turnsBackBeforeGuardian(wall)).toBe(true);
  });

  it('ends a fallback on growth, clearing the count', () => {
    const wall = createWall({ setbacks: SETBACKS_TO_FALL_BACK });
    const { events, sink } = collector();
    recordGrowth(wall, sink);
    recordGrowth(wall, sink);
    expect(events).toEqual(['retryingGuardian']);
    expect(wall).toEqual(createWall());
  });

  it('keeps the count when growth comes before a fallback', () => {
    const wall = createWall({ setbacks: 1 });
    const { events, sink } = collector();
    recordGrowth(wall, sink);
    expect(events).toEqual([]);
    expect(wall.setbacks).toBe(1);
  });

  it('relights the Lamp on the first Guardian kill only', () => {
    const wall = createWall({ setbacks: SETBACKS_TO_FALL_BACK });
    const { events, sink } = collector();
    expect(recordGuardianKill(wall, sink)).toBe(true);
    expect(recordGuardianKill(wall, sink)).toBe(false);
    expect(events).toEqual(['guardianFell', 'lampRelit', 'guardianFell']);
    expect(wall).toEqual(createWall({ lampLit: true }));
  });

  it('a save loads only if every Wall has fallen back exactly at its Setback limit', () => {
    const saved = JSON.parse(serializeGame(createGame({ seed: 1, scenario: { setbacks: SETBACKS_TO_FALL_BACK } }))) as { game: { walls: unknown[] } };
    const withFirstWall = (wall: unknown): string => JSON.stringify({ ...saved, game: { ...saved.game, walls: [wall, ...saved.game.walls.slice(1)] } });
    expect(deserializeGame(withFirstWall(saved.game.walls[0]))).not.toBeNull();
    expect(deserializeGame(withFirstWall({ lampLit: false, setbacks: SETBACKS_TO_FALL_BACK, fallenBack: false }))).toBeNull();
    expect(deserializeGame(withFirstWall({ lampLit: false, setbacks: 1, fallenBack: true }))).toBeNull();
    expect(deserializeGame(withFirstWall({ lampLit: false, setbacks: SETBACKS_TO_FALL_BACK + 1, fallenBack: true }))).toBeNull();
    expect(deserializeGame(withFirstWall(null))).toBeNull();
  });
});
