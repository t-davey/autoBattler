import { describe, expect, it } from 'vitest';
import type { FloorMapView } from '../../sim';
import { drawScene } from './draw';
import { ART_HEIGHT, ART_WIDTH, FRAMING, ROOM_TILES, viewAround, type View } from './iso';
import { MATERIAL_HILLS, MATERIAL_SKY, bakeRoom, type BakedRoom } from './roomBake';
import { roomLookOf } from './roomLook';

const corridor: FloorMapView = {
  width: 3,
  height: 1,
  rooms: [
    { x: 0, y: 0, kind: 'battle', state: 'cleared' },
    { x: 1, y: 0, kind: 'battle', state: 'current' },
    { x: 2, y: 0, kind: 'guardian', state: 'ahead' },
  ],
};
const ROAD = 2;
const CRYPT = 22;
const WIDE = viewAround(480, 191);

/** What a bake holds at one of the framing's art pixels. */
const at = (room: BakedRoom, px: number, py: number): [number, number] => {
  const i = (py - room.view.top) * room.view.width + (px - room.view.left);
  return [room.material[i]!, room.albedo[i]!];
};

function framingMatches(floor: number, view: View): boolean {
  const look = roomLookOf(corridor, floor, 1);
  const framed = bakeRoom(look, false);
  const wide = bakeRoom(look, false, view);
  for (let py = 0; py < ART_HEIGHT; py++) {
    for (let px = 0; px < ART_WIDTH; px++) {
      const [material, albedo] = at(framed, px, py);
      const [wideMaterial, wideAlbedo] = at(wide, px, py);
      if (material !== wideMaterial || Math.abs(albedo - wideAlbedo) > 1e-6) return false;
    }
  }
  return true;
}

describe('a view of the world wider than the framing', () => {
  it('centres on the framing', () => {
    expect(viewAround(480, 191)).toEqual({ width: 480, height: 191, left: -80, top: -10 });
    expect(viewAround(ART_WIDTH, ART_HEIGHT)).toEqual(FRAMING);
  });

  it('shows the same Room in the framing, whatever the view', () => {
    expect(framingMatches(CRYPT, WIDE)).toBe(true);
    expect(framingMatches(ROAD, WIDE)).toBe(true);
  });

  it('draws more of the moor past the framing on the road', () => {
    const wide = bakeRoom(roomLookOf(corridor, ROAD, 1), false, WIDE);
    const [material] = at(wide, -40, 100);
    expect(material).not.toBe(0);
  });

  it('fills every pixel of a view-sized buffer', () => {
    const look = roomLookOf(corridor, ROAD, 1);
    const frame = { time: 1, look, lampLit: false, chestOpen: false, units: [], particles: [], numbers: [], rings: [], flashes: [], bullets: [], shake: 0, fade: 0 };
    const buffer = new Uint8ClampedArray(WIDE.width * WIDE.height * 4);
    drawScene(buffer, bakeRoom(look, false, WIDE), frame);
    for (let o = 3; o < buffer.length; o += 4) expect(buffer[o]).toBe(255);
  });
});

describe('the night sky over the lamp road', () => {
  const tall = viewAround(480, 260);
  const road = bakeRoom(roomLookOf(corridor, ROAD, 1), false, tall);

  it('rises behind the moor, past a ridge and far hills', () => {
    const sky = road.material.filter((material) => material === MATERIAL_SKY).length;
    const hills = road.material.filter((material) => material === MATERIAL_HILLS).length;
    expect(sky).toBeGreaterThan(0);
    expect(hills).toBeGreaterThan(0);
    expect(road.haze?.some((k) => k > 0)).toBe(true);
  });

  it('never covers the stage', () => {
    for (let ty = 0; ty < ROOM_TILES; ty += 0.25) {
      for (let tx = 0; tx < ROOM_TILES; tx += 0.25) {
        const px = Math.floor(ART_WIDTH / 2 + (tx - ty) * 18);
        const py = Math.floor(39 + (tx + ty) * 9);
        expect([MATERIAL_SKY, MATERIAL_HILLS]).not.toContain(at(road, px, py)[0]);
      }
    }
  });

  it('is only over the road, not the Undercroft', () => {
    const crypt = bakeRoom(roomLookOf(corridor, CRYPT, 1), false, tall);
    expect(crypt.material.some((material) => material === MATERIAL_SKY || material === MATERIAL_HILLS)).toBe(false);
  });
});
