/* Pixel-art painters for the UI mockups, at the Battle scene's density and from its ramps. */
import { RAMPS, type Ramp } from '../src/ui/battleScene/art';

const css = (ramp: Ramp) => RAMPS[ramp].map(([r, g, b]) => `rgb(${r} ${g} ${b})`);
const IRON = css('iron');
const BRASS = css('brass');
const WAX = css('wax');
const LEATHER = css('leather');
const K = 'rgb(10 10 16)';
const SOOT = '#100d0c';
const CHAR = '#1b1613';
const CHAR_RAISED = '#2a221c';
const RUST = '#5a3220';

/** How each Act weathers the same materials. Town never changes; a Run's chrome takes its Act. Flame and text never do. */
interface Weather {
  readonly ground: string;
  readonly raised: string;
  readonly soot: string;
  /** Specks in the iron: rust in Town, lichen, verdigris, or embers. */
  readonly speck: string;
  readonly speckRate: number;
  /** Brass pixels gone to patina or scorch. */
  readonly patina: string | null;
  readonly patinaRate: number;
  readonly foxing: string;
  readonly paperEdge: string | null;
}
export const WEATHER: Record<'town' | '1' | '2' | '3', Weather> = {
  town: { ground: '#1b1613', raised: '#2a221c', soot: '#100d0c', speck: RUST, speckRate: 0.01, patina: null, patinaRate: 0, foxing: 'rgb(150 112 60 / 0.45)', paperEdge: null },
  // The wilderness: cold damp, lichen on the iron, grey-green mildew.
  '1': { ground: '#151715', raised: '#20241f', soot: '#0c0e0c', speck: '#6c7a52', speckRate: 0.03, patina: '#5f6a48', patinaRate: 0.05, foxing: 'rgb(96 112 80 / 0.45)', paperEdge: null },
  // The Undercroft: Foxfire's verdigris on the brass, mould in the paper.
  '2': { ground: '#121513', raised: '#1b211d', soot: '#0b0d0c', speck: '#4f8f7c', speckRate: 0.035, patina: '#5aa08a', patinaRate: 0.12, foxing: 'rgb(80 130 100 / 0.5)', paperEdge: null },
  // The Ember Works: soot-blackened, live embers in the iron, scorched brass and paper.
  '3': { ground: '#1a110d', raised: '#2a1810', soot: '#0e0806', speck: '#e0702c', speckRate: 0.02, patina: '#3e2a14', patinaRate: 0.1, foxing: 'rgb(60 36 20 / 0.5)', paperEdge: '#4a2c18' },
};
let act: keyof typeof WEATHER = 'town';
let W: Weather = WEATHER.town;

/** Patina gathers in patches, thickest along an edge, rather than scattering evenly. */
const patchy = (x: number, y: number, seed: number) => noise(x >> 2, y >> 1, seed) < W.patinaRate * 2.2 && noise(x, y, seed + 1) < 0.65;
const INK = '#2a1a14';
const STAMP_INK = '#7a2a22';
const PENCIL = 'rgb(62 50 38 / 0.75)';
const FLAME = { core: '#ffe2a0', flame: '#f4b24a', oil: '#e39a36', oilMid: '#b46f1d', oilDeep: '#6a3d10', halo: 'rgb(244 178 74 / 0.22)' };
const BLOOD = { bright: '#d9604c', mid: '#b03e32', deep: '#6e1f1a' };
const VERDIGRIS = '#7cc4ab';
/* Paper sits between the wax ramp's top two steps, so ink reads on it. */
const PAPER = '#cdbb8a';
const PAPER_MID = '#c4b080';
const PAPER_LIGHT = '#dccb9c';
const PAPER_DARK = '#a8946a';

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;
export const dither = (x: number, y: number, t: number) => BAYER[y & 3]![x & 3]! < t * 16;

export function noise(x: number, y: number, seed = 0): number {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

export class Art {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly w: number,
    readonly h: number,
  ) {}
  px(x: number, y: number, c: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(x, y, 1, 1);
  }
  hole(x: number, y: number): void {
    this.ctx.clearRect(x, y, 1, 1);
  }
  /** Rows of characters, one per pixel, looked up in a palette. `wear` knocks pixels out, like worn paint or a dry stamp. */
  grid(x: number, y: number, rows: readonly string[], pal: Record<string, string>, { flip = false, wear = 0, seed = 0 } = {}): void {
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        const c = pal[ch];
        if (!c || noise(i, j, seed) < wear) return;
        this.px(flip ? x + row.length - 1 - i : x + i, y + j, c);
      }),
    );
  }
  /** A filled shape with a dark outline wherever it meets the outside. */
  shape(w: number, h: number, inside: (x: number, y: number) => boolean, color: (x: number, y: number) => string, at: (x: number, y: number) => readonly [number, number]): void {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        const [px, py] = at(x, y);
        this.px(px, py, edge ? K : color(x, y));
      }
  }
  /** Lamplight as a dithered halo, the way the scene lights a Room. */
  halo(cx: number, cy: number, r: number): void {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dy);
        if (d < r && dither(cx + dx, cy + dy, (1 - d / r) * 0.7)) this.px(cx + dx, cy + dy, FLAME.halo);
      }
  }
}

let frame = 0;

/* ---------- The Council plate: riveted iron, cast brass corner brackets, a seep of oil from the top band. ---------- */

function bracketInside(x: number, y: number): boolean {
  if (x < 0 || y < 0) return false;
  const boss = x <= 9 && y <= 9 && x + y <= 14;
  const top = y >= 1 && y <= 4 && x <= 17 && !(x === 17 && (y === 1 || y === 4));
  const left = x >= 1 && x <= 4 && y <= 17 && !(y === 17 && (x === 1 || x === 4));
  return boss || top || left;
}

function bracketColor(x: number, y: number): string {
  if (x > 9 || y > 9) {
    const across = x > 9 ? y : x;
    return BRASS[[0, 5, 4, 3, 1][across] ?? 3]!;
  }
  const c = BRASS[Math.max(2, 5 - Math.floor((x + y) / 4))]!;
  if (W.patina && patchy(x, y, 17)) return W.patina;
  return noise(x, y, 7) < 0.1 ? BRASS[2]! : c;
}

export function rivet(a: Art, x: number, y: number): void {
  a.px(x, y, IRON[5]!);
  a.px(x + 1, y, IRON[3]!);
  a.px(x, y + 1, IRON[2]!);
  a.px(x + 1, y + 1, K);
}

function spaced(length: number): number[] {
  const start = 22;
  const end = length - 24;
  if (end <= start) return [];
  const count = Math.max(1, Math.round((end - start) / 18));
  return Array.from({ length: count + 1 }, (_, i) => Math.round(start + ((end - start) * i) / count));
}

function paintPlate(a: Art): void {
  const { w, h } = a;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const light = Math.max(0, 1 - y / (h * 0.6)) * 0.55;
      const n = noise(x, y, 1);
      a.px(x, y, n < 0.02 ? W.soot : n > 0.993 ? '#3a2e24' : dither(x, y, light) ? W.raised : W.ground);
    }
  // Oil seeping from the top band, the plate's one stain.
  const seepFrom = spaced(h).at(-1) ?? Math.floor(h / 2);
  const seepLength = Math.min(16, h - 9 - seepFrom);
  for (let i = 0; i < seepLength; i++) {
    const y = seepFrom + 1 + i;
    const fade = i / seepLength;
    a.px(6, y, dither(6, y, 1 - fade * 0.6) ? '#2e1c0c' : '#22160c');
    if (i < 9 && dither(7, y, 0.7 - fade)) a.px(7, y, '#26170b');
  }
  a.px(6, seepFrom + 1 + seepLength, FLAME.oilDeep);
  a.px(7, seepFrom + 1 + seepLength, '#3a220e');
  a.px(6, seepFrom + 2 + seepLength, '#3a220e');

  const T = 6;
  const lit = [K, IRON[4]!, IRON[3]!, IRON[2]!, IRON[1]!, K];
  const shaded = [K, IRON[3]!, IRON[2]!, IRON[1]!, IRON[0]!, K];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const near = Math.min(y, x);
      const far = Math.min(h - 1 - y, w - 1 - x);
      const d = Math.min(near, far);
      if (d >= T) continue;
      const ring = far < near ? shaded : lit;
      let c = ring[d]!;
      const n = noise(x, y, 2);
      if (d >= 1 && d <= 4) {
        if (n < 0.1) c = ring[Math.min(4, d + 1)]!;
        else if (n > 1 - W.speckRate) c = W.speck;
      }
      a.px(x, y, c);
    }
  for (const x of spaced(w)) {
    rivet(a, x, 2);
    rivet(a, x, h - 4);
  }
  for (const y of spaced(h)) {
    rivet(a, 2, y);
    rivet(a, w - 4, y);
  }
  for (const [mx, my] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
    const at = (x: number, y: number) => [mx ? w - 1 - x : x, my ? h - 1 - y : y] as const;
    a.shape(18, 18, bracketInside, bracketColor, at);
    const screw: [number, number, string][] = [[4, 4, K], [5, 4, BRASS[1]!], [4, 5, BRASS[1]!], [5, 5, BRASS[5]!]];
    for (const [x, y, c] of screw) a.px(...at(x, y), c);
  }
}

/* ---------- The nameplate: a struck brass bar, hung between two lit lanterns on wrought brackets. ---------- */

const LANTERN_TOP = ['....k....', '...k.k...', '..kkkkk..', '.kdeeedk.', '.kccccck.'];
const LANTERN_FLAMES = [
  ['.3GwwOw3.', '.3GwOYw3.', '.3wOYYO3.', '.3wOYYO3.', '.3wwOOw3.'],
  ['.3GwOww3.', '.3GOYOw3.', '.3wOYYO3.', '.3wOYYO3.', '.3wwOOw3.'],
  ['.3Gwwww3.', '.3GwOww3.', '.3wOYOw3.', '.3wOYYO3.', '.3wwOOw3.'],
];
const LANTERN_FOOT = ['.kccccck.', '..kdddk..', '...kbk...', '....k....'];
const LANTERN_PAL = {
  k: K, '3': IRON[3]!, b: BRASS[1]!, c: BRASS[3]!, d: BRASS[4]!, e: BRASS[5]!,
  G: '#c8bc98', w: '#5a3a1c', O: FLAME.flame, Y: FLAME.core,
};

export function lantern(a: Art, x: number, y: number, f: number): void {
  a.grid(x, y, [...LANTERN_TOP, ...LANTERN_FLAMES[f % 3]!, ...LANTERN_FOOT], LANTERN_PAL);
}

function bracketArm(a: Art, from: number, to: number, y: number, curlAt: number, dir: 1 | -1): void {
  for (let x = from; x <= to; x++) {
    a.px(x, y - 1, K);
    a.px(x, y, IRON[4]!);
    a.px(x, y + 1, IRON[2]!);
    a.px(x, y + 2, K);
  }
  // A scroll curling up from the arm's end.
  const scroll: [number, number][] = [[0, -2], [0, -3], [dir, -4], [2 * dir, -4], [3 * dir, -3], [2 * dir, -2]];
  for (const [dx, dy] of scroll) a.px(curlAt + dx, y + dy, IRON[3]!);
}

function screw(a: Art, x: number, y: number): void {
  a.grid(x, y, ['abc', 'kkk', 'cde'], { a: BRASS[5]!, b: BRASS[4]!, c: BRASS[3]!, d: BRASS[2]!, e: BRASS[1]!, k: K });
}

function paintNameplate(a: Art): void {
  const { w } = a;
  const left = 13;
  const right = w - 14;
  const top = 8;
  a.halo(6, 21, 9 + (frame % 2));
  a.halo(w - 7, 21, 9 + ((frame + 1) % 2));
  const rows = [K, BRASS[5]!, BRASS[4]!, BRASS[3]!, BRASS[3]!, BRASS[3]!, BRASS[3]!, BRASS[3]!, BRASS[2]!, BRASS[2]!, BRASS[1]!, K];
  for (let ry = 0; ry < rows.length; ry++)
    for (let x = left; x <= right; x++) {
      if ((x === left || x === right) && (ry === 0 || ry === rows.length - 1)) continue;
      let c = x === left || x === right ? K : rows[ry]!;
      if (ry >= 2 && ry <= 9 && x > left && x < right && noise(x, ry, 3) < 0.06) c = BRASS[2]!;
      if (W.patina && ry >= 1 && ry <= 10 && x > left && x < right && patchy(x, ry, 13)) c = W.patina;
      // A struck border line inside the bar.
      if ((ry === 2 || ry === 9) && x > left + 6 && x < right - 6) c = ry === 2 ? BRASS[2]! : BRASS[4]!;
      a.px(x, top + ry, c);
    }
  screw(a, left + 2, top + 4);
  screw(a, right - 4, top + 4);
  bracketArm(a, 3, left - 1, 10, 3, -1);
  bracketArm(a, right + 1, w - 4, 10, w - 4, 1);
  a.px(6, 12, K);
  a.px(w - 7, 12, K);
  lantern(a, 2, 13, frame);
  lantern(a, w - 11, 13, frame + 1);
}

/* ---------- Paper: Council notices and Pick tickets. ---------- */

type Mask = (x: number, y: number) => boolean;

export function paper(a: Art, mask: Mask, seed: number): void {
  const { w, h } = a;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask(x, y)) continue;
      const edge = !mask(x - 1, y) || !mask(x + 1, y) || !mask(x, y - 1) || !mask(x, y + 1);
      const inset = Math.min(x, y, w - 1 - x, h - 1 - y);
      const n = noise(x, y, seed);
      let c = n < 0.025 ? PAPER_LIGHT : n > 0.975 ? PAPER_DARK : dither(x, y, 0.5 * noise(x >> 3, y >> 3, seed + 2)) ? PAPER_MID : PAPER;
      if (inset < 3 && dither(x, y, (3 - inset) / 6)) c = PAPER_DARK;
      if (edge) c = WAX[2]!;
      if (W.paperEdge && (edge || (inset < 3 && dither(x, y, (3 - inset) / 4)))) c = W.paperEdge;
      a.px(x, y, c);
    }
  // Foxing: the brown spots of old paper.
  for (let i = 0; i < Math.round((w * h) / 900); i++) {
    const cx = 6 + Math.floor(noise(i, 1, seed) * (w - 12));
    const cy = 6 + Math.floor(noise(i, 2, seed) * (h - 12));
    const r = 1 + noise(i, 3, seed) * 2.5;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++)
        if (Math.hypot(dx, dy) < r && mask(cx + dx, cy + dy) && dither(cx + dx, cy + dy, 0.4)) a.px(cx + dx, cy + dy, W.foxing);
  }
}

function raggedTorn(w: number, h: number, seed: number): Mask {
  return (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const inset = Math.min(x, y, w - 1 - x, h - 1 - y);
    if (inset === 0 && noise(x, y, seed + 1) < 0.35) return false;
    const tx = w - 1 - x;
    const ty = h - 1 - y;
    const cut = 10 + Math.floor(noise(Math.floor((tx - ty) / 2), 0, seed + 5) * 3);
    return tx + ty >= cut;
  };
}

const CREST = [
  'iiiiiiiiiii',
  'i.........i',
  'i....i....i',
  'i...iii...i',
  'i...iii...i',
  'i....i....i',
  'i..iiiii..i',
  'i..i...i..i',
  'i..i...i..i',
  'i..iiiii..i',
  '.i.......i.',
  '..i.....i..',
  '...iiiii...',
];

const TACK = ['.kkk.', 'k542k', 'k431k', 'k321k', '.kkk.'];

function paintNotice(a: Art): void {
  const { w, h } = a;
  const mask = raggedTorn(w, h, 11);
  paper(a, mask, 11);
  // A fold across the middle.
  const fy = Math.floor(h * 0.52);
  for (let x = 1; x < w - 1; x++) {
    if (mask(x, fy)) a.px(x, fy, 'rgb(120 100 60 / 0.35)');
    if (mask(x, fy + 1)) a.px(x, fy + 1, 'rgb(240 225 180 / 0.45)');
  }
  // The torn corner's fibres.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (mask(x, y) && (!mask(x + 1, y) || !mask(x, y + 1)) && w - 1 - x + (h - 1 - y) < 16) a.px(x, y, PAPER_LIGHT);
  // The Council's stamp, dry and uneven.
  a.grid(w - 17, 5, CREST, { i: STAMP_INK }, { wear: 0.28, seed: 4 });
  // A clerk's tally in pencil, each group struck through.
  const ty = h - 12;
  for (let g = 0; g < 4; g++) {
    const gx = 7 + g * 12;
    const strokes = g < 3 ? 4 : 2;
    for (let s = 0; s < strokes; s++) for (let y = 0; y < 6; y++) a.px(gx + s * 2 + (y > 3 && s % 2 ? 1 : 0), ty + y, PENCIL);
    if (g < 3) for (let i = 0; i < 9; i++) a.px(gx - 1 + i, ty + 4 - Math.round(i * 0.4), PENCIL);
  }
  // The brass tack, with its shadow.
  const tx = Math.floor(w / 2) - 2;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (TACK[y]![x] !== '.') a.px(tx + x + 1, 2 + y + 1, 'rgb(40 26 10 / 0.45)');
  a.grid(tx, 2, TACK, { k: K, '5': BRASS[5]!, '4': BRASS[4]!, '3': BRASS[3]!, '2': BRASS[2]!, '1': BRASS[1]! });
}

export const ICONS: Record<string, readonly string[]> = {
  flame: ['.....k.....', '.....kk....', '....kfk....', '....kffk...', '...kffyfk..', '...kfyyfk..', '..kfyyyfk..', '..kfyyyfk..', '...kfyfk...', '....kkk....', '...........'],
  tins: ['...........', '...kkkkk...', '...keeek...', '...kdddk...', '..kkkkkkk..', '..keeeeek..', '..kdddddk..', '.kkkkkkkkk.', '.keeeeeeek.', '.kdddddddk.', '.kkkkkkkkk.'],
  vial: ['....kkk....', '....kek....', '....kek....', '...kkekk...', '..ke...ek..', '.ke.....ek.', '.kvvvvvvvk.', '.kvvvvvvvk.', '..kvvvvvk..', '...kkkkk...', '...........'],
  lantern: ['....kkk....', '....k.k....', '..kkkkkkk..', '..kdddddk..', '..ke.y.ek..', '..keyfyek..', '..keyfyek..', '..ke.f.ek..', '..kdddddk..', '...kkkkk...', '...........'],
  scales: ['.....e.....', '.eeeeeeeee.', '.e...e...e.', 'e.e..e..e.e', 'e.e..e..e.e', 'eee..e..eee', '.d...e...d.', '.....e.....', '....ddd....', '...eeeee...', '...........'],
  die: ['...........', '.kkkkkkkkk.', '.keeeeeeek.', '.kekeeeeek.', '.keeeeeeek.', '.keeekeeek.', '.keeeeeeek.', '.keeeeekek.', '.keeeeeeek.', '.kkkkkkkkk.', '...........'],
};

/** A cog for Guardian prep: the automata's own part. */
function cog(): string[] {
  return Array.from({ length: 11 }, (_, y) =>
    Array.from({ length: 11 }, (_, x) => {
      const dx = x - 5;
      const dy = y - 5;
      const r = Math.hypot(dx, dy);
      const tooth = ((Math.atan2(dy, dx) + Math.PI) % (Math.PI / 4)) < Math.PI / 8;
      if (r < 1.6) return '.';
      if (r <= 3.6) return dx + dy < 0 ? 'e' : 'd';
      if (r <= 5.4 && tooth) return 'k';
      if (r <= 4.3) return 'k';
      return '.';
    }).join(''),
  );
}
ICONS.cog = cog();

function paintTicket(a: Art, el: HTMLElement): void {
  const { w, h } = a;
  const stub = 22;
  const taken = el.dataset.taken === 'true';
  const punch = ICONS.flame!;
  const px0 = w - 16;
  const py0 = 3;
  const mask: Mask = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    if (Math.min(x, w - 1 - x) + Math.min(y, h - 1 - y) < 2) return false;
    if (Math.hypot(x - stub, y) < 2.6 || Math.hypot(x - stub, y - (h - 1)) < 2.6) return false;
    if (x === stub && y % 3 === 1) return false;
    if (Math.hypot(x - 11, y - 5) < 1.8) return false;
    if (taken) {
      const row = punch[y - py0];
      if (row && row[x - px0] !== undefined && row[x - px0] !== '.') return false;
    }
    return true;
  };
  paper(a, mask, Number(el.dataset.seed ?? 3));
  for (let y = 0; y < h; y++) for (let x = 0; x < stub; x++) if (mask(x, y) && dither(x, y, 0.25)) a.px(x, y, PAPER_MID);
  // A printed double rule round the ticket's face.
  for (let x = stub + 3; x < w - 3; x++)
    for (const y of [3, 5, h - 4, h - 6]) if (mask(x, y) && !(y === 5 || y === h - 6 ? x < stub + 5 || x > w - 6 : false)) a.px(x, y, 'rgb(122 42 34 / 0.55)');
  for (let y = 3; y < h - 3; y++)
    for (const x of [stub + 3, w - 4]) if (mask(x, y)) a.px(x, y, 'rgb(122 42 34 / 0.55)');
  const icon = ICONS[el.dataset.icon ?? 'flame'] ?? ICONS.flame!;
  a.grid(Math.floor(stub / 2) - 5, Math.floor(h / 2) - 3, icon, {
    k: INK, f: FLAME.flame, y: FLAME.core, e: IRON[4]!, d: IRON[2]!, v: VERDIGRIS,
  });
}

/* ---------- Town's hanging signs. ---------- */

function paintSign(a: Art, el: HTMLElement): void {
  const { w, h } = a;
  // The wall plate the bracket is bolted to.
  for (let y = 0; y < 12; y++) for (let x = 0; x < 4; x++) a.px(x, y, x === 0 || y === 0 || y === 11 ? K : x === 1 ? IRON[3]! : IRON[2]!);
  rivet(a, 1, 2);
  rivet(a, 1, 8);
  // The arm, its brace, and a scroll at the end.
  for (let x = 4; x < w - 3; x++) {
    a.px(x, 2, K);
    a.px(x, 3, IRON[4]!);
    a.px(x, 4, IRON[2]!);
    a.px(x, 5, K);
  }
  for (let i = 0; i < 10; i++) {
    a.px(4 + i, 10 - Math.floor(i * 0.6), IRON[3]!);
    a.px(4 + i, 11 - Math.floor(i * 0.6), K);
  }
  for (const [dx, dy] of [[0, -1], [1, -2], [2, -2], [3, -1], [3, 0], [2, 1]] as const) a.px(w - 4 + dx - 2, 2 + dy, IRON[3]!);
  // The board, hung on two chains.
  const bx0 = 6;
  const bx1 = w - 3;
  const by0 = 12;
  const by1 = h - 2;
  for (const cx of [bx0 + 5, bx1 - 5])
    for (let y = 6; y < by0; y++) {
      const link = y % 3;
      if (link === 1) {
        a.px(cx - 1, y, K);
        a.px(cx, y, IRON[4]!);
        a.px(cx + 1, y, K);
      } else a.px(cx, y, link === 0 ? IRON[3]! : IRON[2]!);
    }
  for (let y = by0; y <= by1; y++)
    for (let x = bx0; x <= bx1; x++) {
      const edge = x === bx0 || x === bx1 || y === by0 || y === by1;
      const plank = (y - by0 - 1) % 6;
      const grain = noise(Math.floor(x / 4), y, 21) < 0.25;
      let c = plank === 0 ? LEATHER[4]! : plank === 5 ? LEATHER[1]! : grain ? LEATHER[2]! : LEATHER[3]!;
      if (x === bx0 + 1 || x === bx1 - 1) c = LEATHER[1]!;
      if (noise(x, y, 22) < 0.008) c = LEATHER[0]!;
      a.px(x, y, edge ? K : c);
    }
  // Iron straps at the board's ends, with nail heads.
  for (const sx of [bx0 + 2, bx1 - 4])
    for (let y = by0 + 1; y < by1; y++) {
      a.px(sx, y, IRON[3]!);
      a.px(sx + 1, y, IRON[1]!);
      if ((y - by0) % 8 === 3) a.px(sx, y, IRON[5]!);
    }
  const icon = ICONS[el.dataset.icon ?? 'lantern'] ?? ICONS.lantern!;
  a.grid(bx0 + 6, Math.floor((by0 + by1) / 2) - 5, icon, { k: '#1c140c', e: '#e6d6a8', d: '#b8a478', f: FLAME.flame, y: FLAME.core }, { wear: 0.12, seed: 5 });
}

/* ---------- Gauges: lamp glass between cast caps, measured in tenths. ---------- */

function paintGauge(a: Art, el: HTMLElement): void {
  const { w } = a;
  const fill = Number(el.dataset.fill ?? 0.5);
  const oil = el.dataset.kind !== 'health';
  const caps = oil ? BRASS : IRON;
  const rows = oil ? [FLAME.oil, FLAME.oil, FLAME.oilMid, FLAME.oilMid, FLAME.oilDeep] : [BLOOD.bright, BLOOD.mid, BLOOD.mid, BLOOD.deep, BLOOD.deep];
  const x0 = 5;
  const x1 = w - 6;
  const len = x1 - x0 + 1;
  const fx = x0 + Math.round(fill * len);
  for (let x = x0; x <= x1; x++) {
    a.px(x, 2, K);
    a.px(x, 8, K);
    for (let y = 3; y <= 7; y++) {
      let c: string;
      if (x < fx) {
        c = rows[y - 3]!;
        if (y === 3 && dither(x, y, 0.5)) c = oil ? FLAME.core : BLOOD.bright;
        if (x === fx - 1 && y < 7) c = oil ? FLAME.core : BLOOD.bright;
        if (y >= 4 && y <= 6 && noise(x, y, 9) < 0.035) c = oil ? FLAME.flame : '#e88070';
      } else {
        c = y === 3 ? (dither(x, y, 0.3) ? '#4a505a' : '#1a1d24') : '#121419';
        if (y === 4 && noise(x, y, 8) < 0.05) c = '#2a2e36';
      }
      a.px(x, y, c);
    }
  }
  for (let i = 1; i < 10; i++) {
    const tx = x0 + Math.round((i * len) / 10);
    a.px(tx, 2, caps[4]!);
    a.px(tx, 1, caps[3]!);
    if (i === 5) a.px(tx, 0, caps[3]!);
    a.px(tx, 7, 'rgb(0 0 0 / 0.35)');
  }
  const capInside = (x: number, y: number) => x >= 0 && x < 5 && y >= 0 && y < 11 && !((x === 0 || x === 4) && (y === 0 || y === 10));
  const capColor = (x: number, y: number) => (y === 5 ? caps[1]! : caps[[5, 4, 3, 2, 1][x]!]!);
  a.shape(5, 11, capInside, capColor, (x, y) => [x, y]);
  a.shape(5, 11, capInside, capColor, (x, y) => [w - 1 - x, y]);
}

/* ---------- Wiring: each element paints its own canvas, sized in art pixels. ---------- */

export const PAINTERS: Record<string, (a: Art, el: HTMLElement) => void> = {
  plate: paintPlate,
  nameplate: paintNameplate,
  notice: paintNotice,
  ticket: paintTicket,
  sign: paintSign,
  gauge: paintGauge,
};

export function artPx(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--art')) || 3;
}

export function paint(el: HTMLElement): void {
  let canvas = el.querySelector<HTMLCanvasElement>(':scope > canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    el.prepend(canvas);
  }
  W = el.closest('[data-run]') ? WEATHER[act] : WEATHER.town;
  // A finer element (`data-density="2"`) paints smaller pixels, rounded to whole screen pixels so they stay crisp:
  // 2 screen pixels at an art pixel of 3 or 4. Size it in `--fine` to match.
  const density = Number(el.dataset.density) || 1;
  const scale = density > 1 ? Math.max(1, Math.round(artPx() / density)) : artPx();
  // The canvas fills its element exactly and never overhangs it. An overhang can add a scrollbar, which resizes
  // the element, which repaints: a loop that jitters every frame.
  const w = Math.max(1, Math.round(el.clientWidth / scale));
  const h = Math.max(1, Math.round(el.clientHeight / scale));
  if (w < 4 || h < 4) return;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  PAINTERS[el.dataset.art ?? '']?.(new Art(ctx, w, h), el);
}

export type ActKey = keyof typeof WEATHER;
export function setAct(next: ActKey): void {
  act = next;
}
export function nextFrame(): void {
  frame++;
}
export { BRASS, IRON, LEATHER, WAX, K, FLAME, BLOOD, INK };
export type { Mask };
