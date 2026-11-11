import { LANTERNS, RAMPS, SPRITES, WEAPONS, type Rgb } from './art';
import { ART_HEIGHT, ART_WIDTH, ORIGIN_Y, UNITS_PER_PIXEL, formationPoint } from './iso';
import { MATERIAL_FOXFIRE, MATERIAL_LAMP, MATERIAL_VOID, MATERIAL_WATER, noise, type BakedRoom } from './roomBake';
import { NUMBER_SECONDS, type SceneFrame, type UnitFrame } from './scene';

const STONE: readonly Rgb[] = [[14, 15, 24], [25, 26, 38], [38, 37, 50], [54, 48, 58], [74, 60, 60], [98, 76, 64], [128, 96, 72], [160, 122, 86], [194, 154, 106]];
const WATER: readonly Rgb[] = [[10, 18, 28], [14, 28, 40], [20, 40, 50], [28, 54, 60], [44, 70, 68], [76, 88, 72], [128, 110, 76], [204, 158, 92], [250, 210, 130]];
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]] as const;
const OUTLINE: Rgb = [10, 10, 16];
const BLACK: Rgb = [5, 5, 8];
const WARD_EDGE: Rgb = [255, 206, 110];
const BRACE_EDGE: Rgb = [176, 180, 190];
const BLADE: Rgb = [230, 236, 240];
const BLOW: Rgb = [220, 214, 196];
const AMBIENT = 0.2;
/** The window this game is laid out for: the scene at 1280 x 680, under a 40 px header. */
const BASE_WINDOW_WIDTH = 1280;
const BASE_WINDOW_HEIGHT = 720;

/** How much larger than the base window the scene can be drawn, so the UI over it can grow with it.
 *  Never below 1, because text overlaid on a smaller scene would be too small to read. */
export function uiScale(windowWidth: number, windowHeight: number, devicePixelRatio: number): number {
  const available = Math.min(windowWidth, (windowHeight * BASE_WINDOW_WIDTH) / BASE_WINDOW_HEIGHT);
  return Math.max(1, snappedDisplayWidth(available, devicePixelRatio) / BASE_WINDOW_WIDTH);
}

/** The scene's width in its holder, never ahead of the UI scale, or a window just short of the next size would mix the two. */
export function sceneDisplayWidth(holderWidth: number, holderHeight: number, windowWidth: number, windowHeight: number, devicePixelRatio: number): number {
  const fits = snappedDisplayWidth(Math.min(holderWidth, (holderHeight * ART_WIDTH) / ART_HEIGHT), devicePixelRatio);
  return Math.min(fits, uiScale(windowWidth, windowHeight, devicePixelRatio) * BASE_WINDOW_WIDTH);
}

/** A Unit is never darker than this, however far it stands from a flame. */
const UNIT_MINIMUM_LIGHT = 0.32;
const LANTERN_BASE_RADIUS = 65;
const LANTERN_OIL_RADIUS = 70;
const LANTERN_BASE_STRENGTH = 0.5;
const LANTERN_OIL_STRENGTH = 0.45;
const LANTERN_DARK: Rgb = [40, 24, 20];
const DIGITS: Readonly<Record<string, string>> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001001010010',
  '8': '111101111101111',
  '9': '111101111001111',
  '+': '000010111010000',
};

interface SceneLight {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly strength: number;
}

const flipOf = (unit: UnitFrame): number => (unit.team === 'party' ? 1 : -1);
const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
const mixRgb = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

function lanternLights(frame: SceneFrame): SceneLight[] {
  const lights: SceneLight[] = [];
  for (const unit of frame.units) {
    const spot = LANTERNS[unit.figure];
    if (unit.lantern === null || !spot) continue;
    const flicker = 0.06 * Math.sin(frame.time * 9 + unit.x);
    lights.push({
      x: unit.x + flipOf(unit) * spot.x * UNITS_PER_PIXEL,
      y: unit.y + spot.y * UNITS_PER_PIXEL,
      radius: (LANTERN_BASE_RADIUS + LANTERN_OIL_RADIUS * unit.lantern) * spot.reach + unit.lanternFlare * 90,
      strength: LANTERN_BASE_STRENGTH + LANTERN_OIL_STRENGTH * unit.lantern + flicker + unit.lanternFlare * 0.5,
    });
  }
  return lights;
}

/** Paints one frame into an RGBA buffer of the scene's art size. */
export function drawScene(buffer: Uint8ClampedArray, room: BakedRoom, frame: SceneFrame): void {
  const { time } = frame;
  const put = (x: number, y: number, colour: Rgb): void => {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || py < 0 || px >= ART_WIDTH || py >= ART_HEIGHT) return;
    const i = (py * ART_WIDTH + px) * 4;
    buffer[i] = colour[0];
    buffer[i + 1] = colour[1];
    buffer[i + 2] = colour[2];
    buffer[i + 3] = 255;
  };

  const lanterns = lanternLights(frame);
  const lights: SceneLight[] = [...lanterns];
  for (const light of frame.flashes) lights.push({ x: light.x, y: light.y, radius: light.radius, strength: light.strength * (1 - (time - light.bornAt) / light.duration) });
  for (const bullet of frame.bullets) lights.push({ x: bullet.x, y: bullet.y, radius: 40, strength: 0.25 });
  const flicker = 1 + 0.05 * Math.sin(time * 6.5) + 0.03 * Math.sin(time * 13.7);
  const pulse = 0.85 + 0.15 * Math.sin(time * 1.1);
  const lightAt = (x: number, y: number): number => {
    let total = 0;
    for (const light of lights) {
      const dx = x - light.x;
      const dy = (y - light.y) * 1.45;
      const squared = dx * dx + dy * dy;
      if (squared >= light.radius * light.radius) continue;
      const falloff = 1 - Math.sqrt(squared) / light.radius;
      total += falloff * falloff * light.strength;
    }
    return total;
  };

  for (let py = 0; py < ART_HEIGHT; py++) {
    for (let px = 0; px < ART_WIDTH; px++) {
      const i = py * ART_WIDTH + px;
      const o = i * 4;
      const material = room.material[i]!;
      buffer[o + 3] = 255;
      if (material === MATERIAL_VOID) {
        buffer[o] = BLACK[0];
        buffer[o + 1] = BLACK[1];
        buffer[o + 2] = BLACK[2];
        continue;
      }
      const x = (px + 0.5) * UNITS_PER_PIXEL;
      const y = (py + 0.5) * UNITS_PER_PIXEL;
      if (material === MATERIAL_LAMP) {
        const colour: Rgb = y > ORIGIN_Y - 36 + (Math.sin(time * 11) * 0.5 + 0.5) * 3 ? [255, 226, 150] : [255, 176, 84];
        buffer[o] = colour[0];
        buffer[o + 1] = colour[1];
        buffer[o + 2] = colour[2];
        continue;
      }
      const albedo = room.albedo[i]!;
      if (material === MATERIAL_FOXFIRE) {
        const colour: Rgb = albedo > 0.55 ? [150, 236, 204] : [74, 176, 164];
        buffer[o] = colour[0] * pulse;
        buffer[o + 1] = colour[1] * pulse;
        buffer[o + 2] = colour[2] * pulse;
        continue;
      }
      const light = Math.min(1, AMBIENT + room.warm[i]! * flicker + lightAt(x, y));
      const dither = BAYER[py % 4]![px % 4]! / 16 - 0.47;
      const cold = room.cool[i]! * pulse;
      if (material === MATERIAL_WATER) {
        const ripple = Math.sin(x * 0.09 + y * 0.32 + time * 1.6) * 0.5 + Math.sin(x * 0.04 - y * 0.2 - time) * 0.5;
        const colour = WATER[clamp(Math.floor(light * albedo * 8.6 + ripple * 0.55 + dither * 0.7), 0, 8)]!;
        const coldShare = albedo * 1.3;
        buffer[o] = colour[0] + cold * 18 * coldShare;
        buffer[o + 1] = colour[1] + cold * 78 * coldShare;
        buffer[o + 2] = colour[2] + cold * 84 * coldShare;
        continue;
      }
      const colour = STONE[clamp(Math.floor(light * albedo * 10.5 + dither * 0.8), 0, 8)]!;
      buffer[o] = colour[0] + cold * 16 * albedo;
      buffer[o + 1] = colour[1] + cold * 66 * albedo;
      buffer[o + 2] = colour[2] + cold * 68 * albedo;
    }
  }

  room.flames.forEach((flame, index) => {
    const tall = Math.sin(time * (9 + index % 5) + index * 2) > 0;
    put(flame.x, flame.y, [255, 226, 150]);
    put(flame.x, flame.y - 1, [255, 176, 84]);
    if (tall) put(flame.x, flame.y - 2, [255, 140, 60]);
    if (flame.big) {
      put(flame.x, flame.y + 1, [255, 246, 200]);
      put(flame.x + 1, flame.y, [255, 176, 84]);
      put(flame.x - 1, flame.y, [255, 176, 84]);
      if (tall) put(flame.x, flame.y - 3, [230, 110, 50]);
    }
  });

  for (const ring of frame.rings) {
    const age = (time - ring.bornAt) / ring.duration;
    const k = 1 - (1 - age) * (1 - age);
    const radius = (ring.radius * k) / UNITS_PER_PIXEL;
    const steps = Math.max(16, radius * 5);
    for (let a = 0; a < steps; a++) {
      if (a % 2 && k > 0.5) continue;
      const angle = (a / steps) * Math.PI * 2;
      const x = ring.x / UNITS_PER_PIXEL + Math.cos(angle) * radius;
      const y = ring.y / UNITS_PER_PIXEL + (Math.sin(angle) * radius) / 2;
      const i = Math.floor(y) * ART_WIDTH + Math.floor(x);
      if (room.material[i]) put(x, y, ring.colour);
    }
  }

  if (frame.look?.kind === 'chest') drawChest(put, frame.chestOpen);

  const litShade = (x: number, y: number): { step: number; cold: number } => {
    const px = clamp(Math.floor(x / UNITS_PER_PIXEL), 0, ART_WIDTH - 1);
    const py = clamp(Math.floor((y - 26) / UNITS_PER_PIXEL), 0, ART_HEIGHT - 1);
    const i = py * ART_WIDTH + px;
    let light = AMBIENT * 0.7 + (room.warm[i] ?? 0);
    for (const source of lights) {
      const dx = x - source.x;
      const dy = (y - 26 - source.y) * 1.2;
      const distance = Math.sqrt(dx * dx + dy * dy) / source.radius;
      if (distance < 1) light += (1 - distance) * (1 - distance) * source.strength;
    }
    light = Math.max(light, UNIT_MINIMUM_LIGHT);
    return { step: Math.floor(Math.min(1, light * 1.3) * 3.4), cold: (room.cool[i] ?? 0) * pulse };
  };

  const ordered = [...frame.units].sort((a, b) => a.y - b.y);
  for (const unit of ordered) {
    if (unit.dissolve >= 1) continue;
    const cx = Math.round(unit.x / UNITS_PER_PIXEL);
    const cy = Math.round(unit.y / UNITS_PER_PIXEL);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        if ((dx / 8) ** 2 + (dy / 3) ** 2 > 1) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= ART_WIDTH || y >= ART_HEIGHT) continue;
        const o = (y * ART_WIDTH + x) * 4;
        buffer[o] = buffer[o]! * 0.42;
        buffer[o + 1] = buffer[o + 1]! * 0.42;
        buffer[o + 2] = buffer[o + 2]! * 0.42;
      }
    }
    const { step, cold } = litShade(unit.x, unit.y);
    const flip = flipOf(unit);
    const hop = unit.hop ? -1 : 0;
    const lean = unit.lean / UNITS_PER_PIXEL;
    const wardFrame = Math.floor(time * 11);
    const braceFrame = Math.floor(time * 6);
    let top = 0;
    for (const pixel of SPRITES[unit.figure]) {
      if (unit.dissolve > 0 && noise(pixel.x + unit.x, pixel.y) < unit.dissolve) continue;
      const spriteY = Math.round(pixel.y * unit.squash);
      const x = cx + flip * pixel.x + Math.round((lean * -pixel.y) / 30);
      const y = cy + spriteY + hop;
      if (spriteY < top) top = spriteY;
      if (pixel.material === null) {
        if (unit.warded && (x + y + wardFrame) % 4 < 2) put(x, y, WARD_EDGE);
        else if (unit.braced && (x + y + braceFrame) % 6 < 1) put(x, y, BRACE_EDGE);
        else put(x, y, OUTLINE);
      } else if (pixel.material === 'glow') {
        const full = unit.lantern ?? 1;
        const bright: Rgb = unit.lanternFlare > 0.3 ? [255, 250, 210] : pixel.shade > 1 ? [255, 232, 160] : [255, 186, 90];
        put(x, y, mixRgb(LANTERN_DARK, bright, 0.35 + 0.65 * full));
      } else if (pixel.material === 'eye') {
        put(x, y, unit.team === 'enemy' ? [255, 96, 64] : [255, 190, 90]);
      } else if (unit.flash) {
        put(x, y, unit.flash);
      } else {
        const colour = RAMPS[pixel.material][clamp(pixel.shade + step, 0, 5)]!;
        put(x, y, [colour[0] + cold * 10, colour[1] + cold * 36, colour[2] + cold * 40]);
      }
    }
    drawWeapon(put, unit, cx, cy + hop, step);
    if (unit.health > 0) drawBar(put, unit, cx, cy + top - 4);
  }

  for (const bullet of frame.bullets) {
    const x = bullet.x / UNITS_PER_PIXEL;
    const y = bullet.y / UNITS_PER_PIXEL;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(x + dx, y + dy, bullet.colour);
    put(x, y, [230, 240, 170]);
  }
  for (const particle of frame.particles) put(particle.x / UNITS_PER_PIXEL, particle.y / UNITS_PER_PIXEL, particle.colour);
  for (const number of frame.numbers) {
    const age = clamp((time - number.bornAt) / NUMBER_SECONDS, 0, 1);
    const rise = 1 - (1 - Math.min(1, age * 1.4)) ** 2;
    drawText(put, number.x / UNITS_PER_PIXEL, Math.round(number.y / UNITS_PER_PIXEL - rise * 14), number.text, number.colour);
  }

  if (frame.fade > 0) {
    const keep = 1 - frame.fade;
    for (let o = 0; o < buffer.length; o += 4) {
      buffer[o] = buffer[o]! * keep;
      buffer[o + 1] = buffer[o + 1]! * keep;
      buffer[o + 2] = buffer[o + 2]! * keep;
    }
  }
}

type Put = (x: number, y: number, colour: Rgb) => void;

function drawChest(put: Put, open: boolean): void {
  const spot = formationPoint(1.2, 0);
  const cx = Math.round(spot.x / UNITS_PER_PIXEL);
  const cy = Math.round(spot.y / UNITS_PER_PIXEL);
  const wood = RAMPS.leather;
  for (let x = -9; x <= 9; x++) {
    for (let y = -9; y <= 0; y++) {
      const edge = x === -9 || x === 9 || y === 0;
      put(cx + x, cy + y, edge ? OUTLINE : y === -5 ? RAMPS.iron[3]! : wood[3]!);
    }
  }
  for (let x = -9; x <= 9; x++) {
    for (let y = -4; y <= 0; y++) {
      const edge = x === -9 || x === 9 || y === -4;
      put(cx + x, cy - (open ? 14 : 10) + y, edge ? OUTLINE : wood[4]!);
    }
  }
  if (open) for (let x = -7; x <= 7; x++) put(cx + x, cy - 10, [255, 206, 110]);
}

function drawWeapon(put: Put, unit: UnitFrame, cx: number, cy: number, step: number): void {
  const weapon = WEAPONS[unit.figure];
  if (!weapon || unit.dissolve > 0) return;
  const flip = flipOf(unit);
  const lean = unit.lean / UNITS_PER_PIXEL;
  const handX = cx + flip * weapon.x + Math.round((lean * -weapon.y) / 30);
  const handY = cy + weapon.y;
  const { length } = weapon;
  const ramp = RAMPS[weapon.ramp];
  const body = unit.flash ?? ramp[clamp(2 + step, 0, 5)]!;
  const tip = unit.flash ?? ramp[clamp(3 + step, 0, 5)]!;
  if (unit.smear) {
    const [from, to] = unit.smear;
    const colour = weapon.head === 'none' ? BLADE : BLOW;
    for (let i = 0; i <= 14; i++) {
      const angle = from + ((to - from) * i) / 14;
      for (let r = length * 0.55; r <= length + 1; r++) {
        const x = Math.round(handX + flip * Math.cos(angle) * r);
        const y = Math.round(handY + Math.sin(angle) * r);
        if ((x + y) % 2 === 0 || i > 8) put(x, y, colour);
      }
    }
  }
  const pointAt = (r: number): { x: number; y: number } => ({ x: handX + flip * Math.cos(unit.angle) * r, y: handY + Math.sin(unit.angle) * r });
  for (let r = 0; r <= length; r += 0.5) {
    const { x, y } = pointAt(r);
    put(x, y + 1, OUTLINE);
  }
  for (let r = 0; r <= length; r += 0.5) {
    const { x, y } = pointAt(r);
    put(x, y, r > length * 0.7 ? tip : body);
  }
  const end = pointAt(length);
  if (weapon.head === 'mace') {
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const distance = Math.abs(i) + Math.abs(j);
        if (distance <= 2) put(end.x + i, end.y + j, distance === 2 ? OUTLINE : tip);
      }
    }
  } else if (weapon.head === 'claw') {
    for (const [i, j] of [[-1, -2], [1, -2], [2, 0]] as const) put(end.x + flip * i, end.y + j, tip);
  }
}

function drawBar(put: Put, unit: UnitFrame, cx: number, y: number): void {
  const width = 15;
  const left = cx - 7;
  for (let i = -1; i <= width; i++) for (let j = -1; j <= 1; j++) put(left + i, y + j, OUTLINE);
  const fill = Math.max(1, Math.round((width * unit.health) / unit.maxHealth));
  const colour: Rgb = unit.team === 'party' ? [176, 62, 50] : [204, 160, 76];
  for (let i = 0; i < fill; i++) put(left + i, y, colour);
  if (unit.warded) for (let i = 0; i < width; i++) put(left + i, y - 1, WARD_EDGE);
}

function drawText(put: Put, x: number, y: number, text: string, colour: Rgb): void {
  let cursor = Math.round(x - text.length * 2);
  for (const character of text) {
    const glyph = DIGITS[character];
    if (!glyph) continue;
    for (let j = 0; j < 5; j++) {
      for (let i = 0; i < 3; i++) {
        if (glyph[j * 3 + i] !== '1') continue;
        put(cursor + i - 1, y + j, OUTLINE);
        put(cursor + i + 1, y + j, OUTLINE);
        put(cursor + i, y + j - 1, OUTLINE);
        put(cursor + i, y + j + 1, OUTLINE);
      }
    }
    for (let j = 0; j < 5; j++) {
      for (let i = 0; i < 3; i++) {
        if (glyph[j * 3 + i] === '1') put(cursor + i, y + j, colour);
      }
    }
    cursor += 4;
  }
}

/** The largest display width that keeps every art pixel a whole number of device pixels. */
export function snappedDisplayWidth(availableCssWidth: number, devicePixelRatio: number): number {
  const scale = Math.max(1, Math.floor((availableCssWidth * devicePixelRatio) / ART_WIDTH));
  return (scale * ART_WIDTH) / devicePixelRatio;
}
