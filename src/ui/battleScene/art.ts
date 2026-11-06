import { UNITS_PER_PIXEL } from './iso';

export type Rgb = readonly [number, number, number];

const ramps = {
  iron: [[14, 16, 20], [28, 30, 36], [48, 50, 58], [76, 78, 84], [110, 112, 118], [156, 156, 156]],
  red: [[24, 12, 14], [44, 20, 22], [70, 30, 30], [100, 44, 38], [132, 62, 48], [168, 88, 66]],
  hood: [[16, 14, 18], [28, 24, 30], [44, 38, 44], [64, 56, 60], [88, 76, 76], [118, 100, 94]],
  leather: [[22, 18, 12], [40, 30, 18], [62, 46, 26], [88, 66, 38], [116, 88, 52], [148, 114, 70]],
  green: [[14, 22, 16], [24, 38, 24], [38, 56, 32], [56, 76, 42], [78, 98, 54], [104, 124, 72]],
  robe: [[40, 34, 26], [66, 56, 42], [98, 84, 62], [132, 114, 84], [168, 148, 110], [204, 184, 142]],
  skin: [[40, 26, 22], [76, 50, 40], [116, 80, 62], [156, 112, 86], [192, 146, 112], [224, 182, 146]],
  bone: [[32, 30, 24], [62, 58, 46], [98, 92, 74], [136, 128, 102], [176, 168, 138], [214, 206, 176]],
  rot: [[20, 24, 20], [38, 44, 34], [58, 66, 48], [82, 90, 62], [108, 116, 78], [138, 144, 98]],
  fungus: [[28, 18, 26], [54, 30, 42], [86, 46, 54], [122, 66, 66], [158, 94, 78], [196, 132, 98]],
  wax: [[44, 38, 28], [78, 68, 46], [116, 102, 70], [152, 136, 96], [186, 170, 124], [222, 206, 158]],
  brass: [[34, 24, 12], [62, 44, 20], [96, 70, 30], [136, 102, 44], [176, 138, 62], [214, 180, 96]],
} as const satisfies Readonly<Record<string, readonly Rgb[]>>;

export type Ramp = keyof typeof ramps;
export const RAMPS: Readonly<Record<Ramp, readonly Rgb[]>> = ramps;

export type Material = Ramp | 'glow' | 'eye';

interface Part {
  readonly contains: (x: number, y: number) => boolean;
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly material: Material;
  readonly brightness: number;
}

const ellipse = (x: number, y: number, rx: number, ry: number, material: Material, brightness = 0): Part => ({
  contains: (px, py) => ((px - x) / rx) ** 2 + ((py - y) / ry) ** 2 <= 1,
  x,
  y,
  rx,
  ry,
  material,
  brightness,
});

function polygon(points: readonly (readonly [number, number])[], material: Material, brightness = 0): Part {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    contains: (px, py) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [ax, ay] = points[i]!;
        const [bx, by] = points[j]!;
        if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
      }
      return inside;
    },
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    rx: Math.max(1, (right - left) / 2),
    ry: Math.max(1, (bottom - top) / 2),
    material,
    brightness,
  };
}

const box = (left: number, top: number, right: number, bottom: number, material: Material, brightness = 0): Part =>
  polygon([[left, bottom], [right, bottom], [right, top], [left, top]], material, brightness);

const FIGURES = {
  sinEater: [
    box(-13, -20, -8, 0, 'hood'), box(8, -20, 13, 0, 'hood'),
    polygon([[-13, -4], [13, -4], [11, -27], [-11, -27]], 'red'), ellipse(0, -31, 13, 12, 'red'),
    box(-3, -24, 3, -5, 'hood', 1), ellipse(0, -39, 15, 6, 'iron', 1),
    ellipse(0, -49, 8.5, 9.5, 'hood'), ellipse(3, -48, 4, 5, 'skin'),
    polygon([[-20, -36], [-10, -38], [-10, -12], [-15, -8], [-20, -13]], 'iron', 1),
    box(-16, -32, -14, -13, 'bone'), box(-19, -25, -11, -22, 'bone'),
    ellipse(11, -13, 3.2, 3.6, 'glow'),
  ],
  huntsman: [
    box(-8, -14, -3, 0, 'leather'), box(3, -14, 8, 0, 'leather'),
    polygon([[-12, -5], [9, -5], [8, -36], [-8, -36]], 'green'), ellipse(2, -24, 7, 10, 'leather'),
    polygon([[-8, -37], [8, -37], [6, -48], [-3, -60], [-7, -48]], 'green'), ellipse(3, -44, 3.5, 4, 'skin'),
    ellipse(-7, -11, 2.8, 3.2, 'glow'), box(-9, -16, -5, -14, 'iron'),
  ],
  lamplighter: [
    polygon([[-13, 0], [12, 0], [7, -34], [-7, -34]], 'robe'), box(-2, -30, 2, -3, 'red', 1),
    ellipse(0, -36, 10, 6, 'robe', 1), ellipse(0, -44, 6.5, 7.5, 'skin'), box(-7, -53, 7, -46, 'hood'),
    box(12, -62, 14, 0, 'leather'), box(9, -63, 17, -60, 'iron', 1), ellipse(13, -55, 4.2, 5, 'glow'), box(9, -49, 17, -47, 'iron', 1),
    polygon([[3, -29], [13, -33], [13, -30], [3, -26]], 'robe'),
  ],
  thrall: [
    box(-7, -16, -3, 0, 'bone'), box(3, -16, 7, 0, 'bone'), box(-8, -22, 7, -14, 'hood'),
    polygon([[-7, -22], [6, -22], [8, -38], [-3, -40]], 'rot'),
    box(-2, -34, 6, -32, 'bone'), box(-2, -30, 6, -28, 'bone'), box(-1, -26, 6, -24, 'bone'),
    ellipse(5, -46, 6.5, 7, 'bone', 1), ellipse(7, -46, 1.6, 1.8, 'eye'), box(2, -41, 9, -38, 'bone'),
  ],
  wight: [
    box(-10, -18, -4, 0, 'wax'), box(4, -18, 10, 0, 'wax'), polygon([[-13, -14], [12, -14], [9, -42], [-9, -42]], 'wax'),
    box(-9, -30, 8, -27, 'hood'), ellipse(2, -49, 8, 8.5, 'wax', 1), ellipse(5, -50, 1.8, 2, 'eye'),
    box(-4, -62, -2, -56, 'bone'), ellipse(-3, -64, 1.8, 2.4, 'glow'), box(4, -60, 6, -55, 'bone'), ellipse(5, -62, 1.8, 2.4, 'glow'),
  ],
  chanter: [
    polygon([[-12, 0], [10, 0], [6, -38], [-6, -38]], 'hood'), box(-2, -34, 3, -6, 'bone'), ellipse(0, -44, 7, 7.5, 'bone', 1),
    ellipse(2, -44, 1.6, 1.8, 'eye'), polygon([[-8, -40], [8, -40], [5, -56], [-5, -56]], 'hood'),
    box(12, -60, 14, 0, 'bone'), ellipse(13, -63, 4, 4.5, 'bone', 2), polygon([[3, -30], [13, -34], [13, -31], [3, -27]], 'bone'),
  ],
  bloat: [
    box(-11, -10, -4, 0, 'rot'), box(4, -10, 11, 0, 'rot'), ellipse(0, -24, 19, 18, 'rot'), ellipse(-10, -34, 7, 5, 'fungus', 1),
    ellipse(9, -38, 9, 6, 'fungus', 1), ellipse(0, -44, 7, 5, 'fungus'), ellipse(7, -24, 1.8, 2, 'eye'), ellipse(-5, -18, 3, 2.5, 'fungus'),
  ],
  sporeling: [
    box(-8, -18, 8, 0, 'rot'), ellipse(0, -28, 17, 11, 'fungus', 1), ellipse(-12, -17, 7, 5, 'fungus'), ellipse(11, -14, 6, 4, 'fungus'),
    box(-11, -20, 11, -17, 'bone'), ellipse(-6, -32, 2.6, 2, 'bone', 2), ellipse(5, -35, 2, 1.6, 'bone', 2), ellipse(5, -12, 1.8, 2, 'eye'),
  ],
  guardian: [
    box(-17, -26, -6, 0, 'iron'), box(6, -26, 17, 0, 'iron'), box(-23, -2, -3, 0, 'brass', 1), box(3, -2, 23, 0, 'brass', 1),
    polygon([[-25, -24], [25, -24], [29, -66], [-29, -66]], 'brass'), box(-12, -56, 12, -32, 'iron'), ellipse(0, -44, 8, 8, 'glow'),
    box(-24, -60, -19, -28, 'iron', 1), box(19, -60, 24, -28, 'iron', 1), ellipse(0, -74, 11, 9, 'iron', 1), box(-7, -77, 7, -73, 'eye'),
    ellipse(-27, -66, 8, 7, 'brass', 1), ellipse(27, -66, 8, 7, 'brass', 1), ellipse(-16, -14, 3, 3, 'fungus', 1), ellipse(14, -46, 5, 4, 'fungus', 1),
  ],
} as const satisfies Readonly<Record<string, readonly Part[]>>;

export type Figure = keyof typeof FIGURES;

export interface Weapon {
  /** The hand, in scene units facing right. */
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly ramp: Ramp;
  readonly head: 'none' | 'mace' | 'claw';
}

export const WEAPONS: Readonly<Partial<Record<Figure, Weapon>>> = {
  sinEater: { x: 9, y: -27, length: 24, ramp: 'iron', head: 'mace' },
  huntsman: { x: 7, y: -25, length: 20, ramp: 'bone', head: 'none' },
  thrall: { x: 5, y: -33, length: 18, ramp: 'bone', head: 'claw' },
  wight: { x: 8, y: -36, length: 20, ramp: 'wax', head: 'claw' },
  bloat: { x: 15, y: -24, length: 16, ramp: 'rot', head: 'claw' },
  guardian: { x: 27, y: -62, length: 40, ramp: 'iron', head: 'mace' },
};

/** Where each Hero's lantern hangs, in scene units facing right. */
export const LANTERNS: Readonly<Partial<Record<Figure, { readonly x: number; readonly y: number; readonly reach: number }>>> = {
  sinEater: { x: 12, y: -15, reach: 1 },
  huntsman: { x: -8, y: -13, reach: 1 },
  lamplighter: { x: 15, y: -63, reach: 1.35 },
};

export interface SpritePixel {
  readonly x: number;
  readonly y: number;
  /** null is the outline. */
  readonly material: Material | null;
  readonly level: number;
}

const FIGURE_SCALE = 1.15;
const BOX_LEFT = -60;
const BOX_TOP = -120;
const BOX_WIDTH = 60;
const BOX_HEIGHT = 63;

function bake(parts: readonly Part[]): readonly SpritePixel[] {
  const cells = new Array<{ material: Material; level: number } | null>(BOX_WIDTH * BOX_HEIGHT).fill(null);
  for (let py = 0; py < BOX_HEIGHT; py++) {
    for (let px = 0; px < BOX_WIDTH; px++) {
      const x = (BOX_LEFT + (px + 0.5) * UNITS_PER_PIXEL) / FIGURE_SCALE;
      const y = (BOX_TOP + (py + 0.5) * UNITS_PER_PIXEL) / FIGURE_SCALE;
      for (const part of parts) {
        if (!part.contains(x, y)) continue;
        const facing = -((x - part.x) / part.rx) * 0.45 - ((y - part.y) / part.ry) * 0.75;
        const level = Math.max(0, Math.min(2, Math.round(1 + facing * 1.3))) + part.brightness;
        cells[py * BOX_WIDTH + px] = { material: part.material, level };
      }
    }
  }
  const filled = (px: number, py: number): boolean => px >= 0 && py >= 0 && px < BOX_WIDTH && py < BOX_HEIGHT && cells[py * BOX_WIDTH + px] !== null;
  const pixels: SpritePixel[] = [];
  for (let py = 0; py < BOX_HEIGHT; py++) {
    for (let px = 0; px < BOX_WIDTH; px++) {
      const cell = cells[py * BOX_WIDTH + px];
      const position = { x: px + BOX_LEFT / UNITS_PER_PIXEL, y: py + BOX_TOP / UNITS_PER_PIXEL };
      if (cell) pixels.push({ ...position, material: cell.material, level: cell.level });
      else if (filled(px - 1, py) || filled(px + 1, py) || filled(px, py - 1) || filled(px, py + 1)) pixels.push({ ...position, material: null, level: 0 });
    }
  }
  return pixels;
}

const figureNames = Object.keys(FIGURES) as Figure[];
export const SPRITES = Object.fromEntries(figureNames.map((figure) => [figure, bake(FIGURES[figure])])) as unknown as Readonly<Record<Figure, readonly SpritePixel[]>>;

const FIGURES_BY_ID: Readonly<Record<string, Figure>> = { 'sin-eater': 'sinEater', huntsman: 'huntsman', lamplighter: 'lamplighter', guardian: 'guardian' };
const FIGURES_BY_NAME: Readonly<Record<string, Figure>> = { 'Sodden Thrall': 'thrall', 'Tallow Wight': 'wight', 'Bone Chanter': 'chanter', 'Mire Bloat': 'bloat', Sporeling: 'sporeling' };

/** Art isn't a game rule, so a Unit's figure is decided here rather than in the sim. */
export const figureOf = (unit: { readonly id: string; readonly name: string }): Figure => FIGURES_BY_ID[unit.id] ?? FIGURES_BY_NAME[unit.name] ?? 'thrall';
