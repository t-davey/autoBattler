import { describe, expect, it } from 'vitest';
import type { FloorMapView } from '../../sim';
import { ART_WIDTH, ORIGIN_Y, SCENE_WIDTH, UNITS_PER_PIXEL } from './iso';
import { MATERIAL_FOXFIRE, MATERIAL_HEATH, MATERIAL_WARDGLASS, bakeRoom } from './roomBake';
import { roomLookOf } from './roomLook';

const guardianFloor: FloorMapView = {
  width: 2,
  height: 1,
  rooms: [
    { x: 0, y: 0, kind: 'stairs', state: 'cleared' },
    { x: 1, y: 0, kind: 'guardian', state: 'current' },
  ],
};
const count = (material: Uint8Array, kind: number): number => material.reduce((total, value) => total + Number(value === kind), 0);
const lampPixel = Math.floor((ORIGIN_Y - 37) / UNITS_PER_PIXEL) * ART_WIDTH + Math.floor(SCENE_WIDTH / 2 / UNITS_PER_PIXEL);

describe('a Room on the lamp road', () => {
  it('has heath where the Undercroft has bare stone', () => {
    const road = bakeRoom(roomLookOf(guardianFloor, 5, 1), false);
    const crypt = bakeRoom(roomLookOf(guardianFloor, 25, 1), false);
    expect(count(road.material, MATERIAL_HEATH)).toBeGreaterThan(1000);
    expect(count(crypt.material, MATERIAL_HEATH)).toBe(0);
  });

  it('floods violet from its Barrier Lamp once the Lamp is relit', () => {
    const look = roomLookOf(guardianFloor, 5, 1);
    const dark = bakeRoom({ ...look, waymarkers: [] }, false);
    const relit = bakeRoom({ ...look, waymarkers: [] }, true);
    expect(relit.material[lampPixel]).toBe(MATERIAL_WARDGLASS);
    expect(dark.material[lampPixel]).not.toBe(MATERIAL_WARDGLASS);
    expect(relit.cool[lampPixel + ART_WIDTH * 20]!).toBeGreaterThan(dark.cool[lampPixel + ART_WIDTH * 20]! + 0.3);
    expect(relit.coolTint.stone[2]).toBeGreaterThan(relit.coolTint.stone[1]);
  });

  it('shows a lit Waymarker’s ward-glass, and none of Foxfire', () => {
    const look = roomLookOf(guardianFloor, 5, 1);
    const lit = bakeRoom({ ...look, foxfire: [], waymarkers: [{ tx: 0.5, ty: 1.6, lit: true }] }, false);
    const out = bakeRoom({ ...look, foxfire: [], waymarkers: [{ tx: 0.5, ty: 1.6, lit: false }] }, false);
    expect(count(lit.material, MATERIAL_WARDGLASS)).toBeGreaterThan(0);
    expect(count(out.material, MATERIAL_WARDGLASS)).toBe(0);
    expect(count(lit.material, MATERIAL_FOXFIRE)).toBe(0);
  });
});
