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

/** A single art pixel, its top-left corner at (x, y). */
const dot = (x: number, y: number, material: Material, brightness = 0): Part => box(x, y, x + 1, y + 1, material, brightness);

/** A stroke of the given width, for straps, limbs, and poles. */
function line(ax: number, ay: number, bx: number, by: number, width: number, material: Material, brightness = 0): Part {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy || 1;
  return {
    contains: (px, py) => {
      const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
      return (px - ax - k * dx) ** 2 + (py - ay - k * dy) ** 2 <= (width / 2) ** 2;
    },
    x: (ax + bx) / 2,
    y: (ay + by) / 2,
    rx: Math.max(1, Math.abs(dx) / 2 + width / 2),
    ry: Math.max(1, Math.abs(dy) / 2 + width / 2),
    material,
    brightness,
  };
}

/** Figures in art pixels, on the same grid as the Room: feet at 0, facing right. Later parts lie over earlier ones. */
const FIGURES = {
  sinEater: [
    box(-5, -10, -1, 0, 'leather'), box(1, -10, 5, 0, 'leather'), box(-6, -2, -1, 0, 'iron'), box(1, -2, 6, 0, 'iron'),
    polygon([[-11, -21], [-6, -22], [-6, -8], [-8.5, -5], [-11, -8]], 'iron', 1),
    box(-9, -20, -8, -8, 'bone'), box(-10.5, -16, -6.5, -15, 'bone'),
    polygon([[-7, -3], [7, -3], [6, -17], [-6, -17]], 'red'), box(-7, -4, 7, -3, 'red', 1),
    box(-1, -17, 1, -4, 'hood', 1), box(-6, -11, 6, -10, 'leather', 1), dot(0, -11, 'brass', 2),
    ellipse(0, -18, 7.5, 3, 'iron', 1), dot(-5, -19, 'brass', 2), dot(4, -19, 'brass', 2),
    polygon([[-4, -21], [-2, -29], [3, -25], [4, -21]], 'hood'), ellipse(0.5, -23, 4, 4.5, 'hood'), ellipse(2, -22.5, 1.8, 2.4, 'skin'),
    line(5, -12, 6, -10, 1, 'iron', 1), box(5, -10, 9, -4, 'iron'), box(6, -9, 8, -5, 'glow'),
  ],
  huntsman: [
    polygon([[-8, -2], [-1, -2], [0, -21], [-5, -21]], 'green'), box(-8, -3, -1, -2, 'green', 1),
    box(-4, -9, -1, 0, 'leather'), box(1, -9, 4, 0, 'leather'), box(-5, -2, -1, 0, 'hood'), box(1, -2, 5, 0, 'hood'),
    polygon([[-3, -8], [4, -8], [4, -19], [-3, -19]], 'leather'), box(-3, -10, 4, -9, 'hood', 1), dot(2, -10, 'brass', 2),
    line(-2, -14, 3, -18, 1, 'hood', 1), ellipse(-1, -7.5, 1.6, 1.6, 'leather', 1),
    line(2, -18, 4, -13, 2, 'green'), dot(4, -14, 'skin', 1),
    polygon([[-4, -19], [4, -19], [4, -26], [-1, -32], [-4, -26]], 'green'), ellipse(2.2, -23, 1.7, 2.2, 'skin'), dot(3, -24, 'hood'),
    line(-4, -11, -5, -9, 1, 'iron', 1), box(-7, -9, -3, -4, 'iron'), box(-6, -8, -4, -5, 'glow'),
  ],
  lamplighter: [
    polygon([[-7, 0], [6, 0], [4, -19], [-4, -19]], 'robe'), box(-7, -1, 6, 0, 'robe', 1),
    line(-3, -19, 3, -8, 2, 'red', 1), line(-1, -6, -1, -1, 1, 'robe', 1), line(2, -6, 2, -1, 1, 'robe', 1),
    ellipse(0, -20, 5.5, 2.5, 'robe', 1),
    box(7, -40, 8, 0, 'leather'), box(7, -41, 11, -40, 'iron', 1), line(10.5, -40, 10.5, -38, 1, 'iron', 1),
    box(9, -38, 13, -31, 'iron'), box(10, -37, 12, -32, 'glow'), box(8, -38, 14, -37, 'iron', 1), box(9, -31, 13, -30, 'iron', 1),
    line(2, -18, 7, -16, 2, 'robe'), dot(7, -17, 'skin', 1),
    ellipse(0.5, -24, 3, 3.5, 'skin'), dot(2, -25, 'hood'),
    box(-4, -27, 5, -26, 'hood', 1), box(-2.5, -33, 3.5, -27, 'hood'), box(-2.5, -29, 3.5, -28, 'red', 1),
  ],
  thrall: [
    line(-2.5, -9, -3, -0.5, 2, 'bone'), line(2, -9, 3, -0.5, 2, 'bone'),
    polygon([[-5, -12], [5, -12], [5, -7], [3, -5], [2, -7], [0, -4], [-2, -7], [-4, -5], [-5, -7]], 'hood'),
    line(-2, -21, -4, -12, 2, 'bone'),
    polygon([[-4, -12], [4, -12], [5, -21], [-2, -23]], 'rot'),
    box(-1, -20, 4, -19, 'bone', 1), box(-1, -18, 4, -17, 'bone', 1), box(-1, -16, 4, -15, 'bone', 1),
    box(-3, -14, -2, -9, 'green'), box(3, -13, 4, -8, 'green'),
    ellipse(3, -26, 3.5, 3.5, 'bone', 1), box(1, -23, 5, -21, 'bone'), dot(4, -26, 'eye'), dot(2, -22, 'hood'), dot(4, -22, 'hood'),
    box(0, -30, 1, -21, 'green'), box(2, -30, 3, -26, 'green', 1),
  ],
  wight: [
    box(-5, -9, -2, 0, 'wax'), box(2, -9, 5, 0, 'wax'),
    polygon([[-7, -7], [7, -7], [5, -24], [-5, -24]], 'wax'),
    box(-5, -17, 6, -15, 'hood'), dot(2, -17, 'bone', 1),
    box(-4, -13, -3, -6, 'wax', 2), box(1, -14, 2, -9, 'wax', 2), box(5, -12, 6, -6, 'wax', 2), box(-6, -9, -5, -5, 'wax', 2),
    box(-4, -32, -2, -29, 'bone', 1), box(-1, -34, 1, -30, 'bone', 1), box(2, -32, 4, -29, 'bone', 1),
    dot(-3, -33, 'glow'), dot(0, -35, 'glow'), dot(0, -36, 'glow'), dot(3, -33, 'glow'),
    ellipse(1, -26.5, 5, 4, 'wax', 1), box(-4, -27, -3, -23, 'wax', 2), box(5, -27, 6, -24, 'wax', 2),
    dot(3, -27, 'eye'), box(2, -25, 4, -24, 'hood'),
  ],
  chanter: [
    polygon([[-6, 0], [5, 0], [3, -21], [-3, -21]], 'hood'), box(-6, -1, 5, 0, 'hood', 1),
    box(-1, -19, 1, -3, 'bone'), dot(-1, -16, 'hood'), dot(-1, -12, 'hood'), dot(-1, -8, 'hood'),
    box(7, -36, 8, 0, 'bone'), dot(6, -31, 'bone', 1), dot(9, -30, 'bone', 1), line(6.5, -32, 6.5, -31, 1, 'hood'), line(9.5, -32, 9.5, -30, 1, 'hood'),
    ellipse(7.5, -37.5, 2.5, 2.5, 'bone', 2), dot(8, -38, 'eye'),
    polygon([[-4, -20], [4, -20], [3, -31], [-3, -31]], 'hood', 1), ellipse(1, -25, 2.5, 3, 'bone', 1), dot(2, -26, 'eye'), dot(1, -23, 'hood'),
    line(2, -17, 7, -19, 2, 'hood'), dot(7, -20, 'bone', 1),
  ],
  bloat: [
    box(-6, -5, -2, 0, 'rot'), box(2, -5, 6, 0, 'rot'),
    ellipse(0, -12, 10, 9, 'rot'), ellipse(2, -10, 5, 5, 'rot', 1), line(-6, -16, -3, -7, 1, 'green', 1), line(6, -17, 8, -9, 1, 'green', 1),
    ellipse(-5, -19, 4, 2.5, 'fungus', 1), ellipse(5, -21, 5, 3, 'fungus', 1), ellipse(0, -23.5, 3.5, 2, 'fungus'),
    dot(-6, -20, 'bone', 2), dot(4, -23, 'bone', 2), dot(7, -22, 'bone', 2),
    dot(5, -14, 'eye'), box(1, -8, 6, -7, 'fungus'), ellipse(-7, -7, 1.6, 1.6, 'fungus', 1),
  ],
  sporeling: [
    box(-3, -9, 3, 0, 'rot', 1), box(-4, -1, 4, 0, 'rot'),
    box(-7, -11, 7, -9, 'bone'), dot(-5, -10, 'fungus'), dot(-2, -10, 'fungus'), dot(1, -10, 'fungus'), dot(4, -10, 'fungus'),
    ellipse(0, -14, 8.5, 5.5, 'fungus', 1),
    ellipse(-7, -7, 3.5, 2.5, 'fungus'), ellipse(6, -5, 3, 2, 'fungus'),
    dot(-3, -17, 'bone', 2), dot(3, -18, 'bone', 2), dot(0, -15, 'bone', 2), dot(5, -14, 'bone', 2), dot(-6, -14, 'bone', 2),
    dot(1, -6, 'eye'),
  ],
  guardian: [
    box(-9, -14, -4, 0, 'iron'), box(4, -14, 9, 0, 'iron'), box(-12, -2, -3, 0, 'brass', 1), box(3, -2, 12, 0, 'brass', 1),
    ellipse(-6.5, -11, 2.5, 2, 'brass', 1), ellipse(6.5, -11, 2.5, 2, 'brass', 1),
    box(-10, -16, 10, -13, 'iron', 1),
    line(-15, -33, -17, -18, 4, 'iron'), ellipse(-17, -17, 2.5, 2.5, 'brass'),
    polygon([[-13, -14], [13, -14], [15, -36], [-15, -36]], 'brass'),
    box(-7, -32, 7, -18, 'iron'), ellipse(0, -25, 4.5, 4.5, 'glow'), box(-3, -30, -2, -20, 'iron'), box(2, -30, 3, -20, 'iron'),
    dot(-12, -33, 'iron', 2), dot(11, -33, 'iron', 2), dot(-11, -17, 'iron', 2), dot(10, -17, 'iron', 2),
    line(-11, -35, -11, -16, 1.5, 'iron', 1), line(11, -35, 11, -16, 1.5, 'iron', 1),
    ellipse(-15, -35, 4.5, 4, 'brass', 1), ellipse(15, -35, 4.5, 4, 'brass', 1), dot(-15, -36, 'iron', 2), dot(15, -36, 'iron', 2),
    box(-6, -48, -4, -41, 'iron'), box(-6.5, -49, -3.5, -48, 'iron', 1),
    ellipse(0, -41, 6, 5, 'iron', 1), box(-4, -42, 5, -41, 'eye'), box(-1, -47, 1, -45, 'brass', 1),
    ellipse(-8, -7, 2, 2, 'fungus', 1), ellipse(8, -27, 3, 2, 'fungus', 1), ellipse(-11, -31, 2.5, 1.5, 'green', 1),
    dot(9, -29, 'bone', 2), dot(-9, -8, 'bone', 2), dot(-1, -15, 'green', 1), dot(4, -39, 'green', 1),
  ],
} as const satisfies Readonly<Record<string, readonly Part[]>>;

export type Figure = keyof typeof FIGURES;

export interface Weapon {
  /** The hand, in art pixels facing right. */
  readonly x: number;
  readonly y: number;
  /** In art pixels. */
  readonly length: number;
  readonly ramp: Ramp;
  readonly head: 'none' | 'mace' | 'claw';
}

export const WEAPONS: Readonly<Partial<Record<Figure, Weapon>>> = {
  sinEater: { x: 5, y: -15, length: 12, ramp: 'iron', head: 'mace' },
  huntsman: { x: 4, y: -14, length: 9, ramp: 'iron', head: 'none' },
  thrall: { x: 4, y: -19, length: 9, ramp: 'bone', head: 'claw' },
  wight: { x: 5, y: -20, length: 10, ramp: 'wax', head: 'claw' },
  bloat: { x: 9, y: -12, length: 8, ramp: 'rot', head: 'claw' },
  guardian: { x: 15, y: -34, length: 20, ramp: 'iron', head: 'mace' },
};

/** Where each Hero's lantern hangs, in art pixels facing right. */
export const LANTERNS: Readonly<Partial<Record<Figure, { readonly x: number; readonly y: number; readonly reach: number }>>> = {
  sinEater: { x: 7, y: -7, reach: 1 },
  huntsman: { x: -5, y: -6.5, reach: 1 },
  lamplighter: { x: 11, y: -34.5, reach: 1.35 },
};

export interface SpritePixel {
  readonly x: number;
  readonly y: number;
  /** null is the outline. */
  readonly material: Material | null;
  readonly shade: number;
}

const BOX_LEFT = -30;
const BOX_TOP = -60;
const BOX_WIDTH = 60;
const BOX_HEIGHT = 63;
/** The Room's ordered dither, so a figure's shading breaks up at the same grain as the stone behind it. */
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]] as const;
/** How rough each material's surface is. Metal stays smooth, so its banding reads as polish. */
const GRAIN: Readonly<Record<Material, number>> = {
  iron: 0.25, brass: 0.2, red: 0.55, hood: 0.5, leather: 0.6, green: 0.6, robe: 0.45, skin: 0.3,
  bone: 0.45, rot: 0.8, fungus: 0.7, wax: 0.35, glow: 0, eye: 0,
};

const grain = (x: number, y: number): number => {
  const value = Math.sin(x * 91.7 + y * 47.3) * 24634.6345;
  return value - Math.floor(value);
};

interface Cell {
  readonly material: Material;
  readonly shade: number;
  readonly part: number;
}

function bake(parts: readonly Part[]): readonly SpritePixel[] {
  const cells = new Array<Cell | null>(BOX_WIDTH * BOX_HEIGHT).fill(null);
  for (let py = 0; py < BOX_HEIGHT; py++) {
    for (let px = 0; px < BOX_WIDTH; px++) {
      const x = BOX_LEFT + px + 0.5;
      const y = BOX_TOP + py + 0.5;
      parts.forEach((part, index) => {
        if (!part.contains(x, y)) return;
        const facing = -((x - part.x) / part.rx) * 0.45 - ((y - part.y) / part.ry) * 0.75;
        const dither = (BAYER[py % 4]![px % 4]! / 16 - 0.47) * 0.8 + (grain(px, py) - 0.5) * GRAIN[part.material];
        const shade = Math.max(0, Math.min(2, Math.floor(1.5 + facing * 1.3 + dither))) + part.brightness;
        cells[py * BOX_WIDTH + px] = { material: part.material, shade, part: index };
      });
    }
  }
  const at = (px: number, py: number): Cell | null => (px >= 0 && py >= 0 && px < BOX_WIDTH && py < BOX_HEIGHT ? cells[py * BOX_WIDTH + px]! : null);
  const pixels: SpritePixel[] = [];
  for (let py = 0; py < BOX_HEIGHT; py++) {
    for (let px = 0; px < BOX_WIDTH; px++) {
      const cell = at(px, py);
      const position = { x: px + BOX_LEFT, y: py + BOX_TOP };
      const neighbours = [at(px - 1, py), at(px + 1, py), at(px, py - 1), at(px, py + 1)];
      if (cell) {
        // A one-pixel crease where a part in front meets another material, like the Room's mortar lines.
        const behind = cell.material !== 'glow' && cell.material !== 'eye' && neighbours.some((other) => other && other.part > cell.part && other.material !== cell.material);
        pixels.push({ ...position, material: cell.material, shade: behind ? Math.max(0, cell.shade - 1) : cell.shade });
      } else if (neighbours.some(Boolean)) pixels.push({ ...position, material: null, shade: 0 });
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
