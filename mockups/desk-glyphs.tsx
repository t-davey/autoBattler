/* Glyphs for the Council desk mockup: 8 × 8 pixel pictures, in colour, that stand in for words.
   Every glyph a player can't hover is paired with words for screen readers by whoever places it. */
import type { ItemStat, PickTag, Rarity } from '../src/sim';

const K = '#0a0a10';
const BRASS = { hi: '#f0c870', mid: '#c89640', lo: '#7a5420' };
const IRON = { hi: '#9aa0ac', mid: '#5a606c', lo: '#30343c' };

/** A glyph drawn from a picture function rather than typed out, outlined in black wherever it meets the empty. */
function drawn(size: number, at: (x: number, y: number) => string): string[] {
  const fill = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => at(x, y)));
  return fill.map((row, y) =>
    row
      .map((ch, x) => {
        if (ch !== '.') return ch;
        const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const near = fill[y + dy!]?.[x + dx!];
          return near !== undefined && near !== '.';
        });
        return touches ? 'k' : '.';
      })
      .join(''),
  );
}

/** The Sin-Eater: a loaf of funeral bread, scored three times, on a linen cloth. */
const SIN_EATER = drawn(24, (x, y) => {
  const nx = (x - 11.5) / 10;
  const ny = (y - 12) / 7;
  const d = Math.hypot(nx, ny);
  if (d <= 1 && y <= 17) {
    const u = x + (y - 12) * 0.8;
    if (y >= 8 && y <= 14 && d < 0.78 && x > 3 && x < 20) {
      if (((Math.round(u) % 6) + 6) % 6 === 1) return 'l';
      if (((Math.round(u) % 6) + 6) % 6 === 2) return 'H';
    }
    const light = -nx * 0.5 - ny * 0.8;
    return light > 0.45 ? 'H' : light > 0 ? 'L' : light > -0.4 ? 'M' : 'D';
  }
  if (y >= 18 && y <= 20 && x >= 1 && x <= 22) return x % 5 === 0 || y === 20 ? 'W' : 'w';
  return '.';
});

/** The Warrener: a leg-hold trap from above: toothed jaws, the pan at the heart, springs out to the sides, a chain. */
const WARRENER = drawn(24, (x, y) => {
  const dx = x - 11.5;
  const dy = y - 10;
  const r = Math.hypot(dx, dy);
  if (r >= 6.6 && r <= 8.2) {
    const light = -(dx + dy) / r;
    return light > 0.4 ? 'H' : light > -0.3 ? 'I' : 'i';
  }
  if (r >= 6 && r < 6.6) return 'i';
  if (r >= 3.9 && r < 6) {
    const phase = ((((Math.atan2(dy, dx) + Math.PI) / ((2 * Math.PI) / 12)) % 1) + 1) % 1;
    return Math.abs(phase - 0.5) < ((r - 3.9) / 2.1) * 0.5 ? (dx + dy > 0 ? 't' : 'T') : '.';
  }
  if (r < 2.3) return r < 1.2 && dx + dy < 0 ? 'p' : 'P';
  const ax = Math.abs(dx);
  if (ax > 8.2 && ax <= 11.5 && Math.abs(dy) <= 0.5) return 'I';
  if (ax >= 10 && ax <= 11.5 && Math.abs(dy) <= 2 && !(ax > 10 && ax < 11.5 && Math.abs(dy) < 2)) return 'H';
  const link = y - 19;
  if (link >= 0 && link <= 4) return (link % 2 === 0 ? x === 11 || x === 12 : x === 10 || x === 13) ? 'I' : '.';
  return '.';
});

/** The Lamplighter: a wick pole, a brass ferrule and hook at its head, the wick alight. */
const LAMPLIGHTER = drawn(24, (x, y) => {
  const along = (ax: number, ay: number, bx: number, by: number) => {
    const vx = bx - ax;
    const vy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
    return { d: Math.hypot(x - (ax + vx * t), y - (ay + vy * t)), side: (x - ax) * vy - (y - ay) * vx };
  };
  const flameHalf = [0.5, 1, 1.5, 2, 2, 1.5][y];
  if (flameHalf !== undefined && Math.abs(x - 19.5) <= flameHalf) {
    if (y === 0) return 'O';
    return Math.abs(x - 19.5) < flameHalf - 0.8 && y >= 2 ? 'Y' : 'F';
  }
  const hook = Math.hypot(x - 21, y - 9);
  if (Math.abs(hook - 2) < 0.6 && x >= 21) return 'b';
  const ferrule = along(16, 9, 19, 6);
  if (ferrule.d <= 1.6) return ferrule.side < 0 ? 'B' : 'b';
  const pole = along(2, 22, 16, 9);
  if (pole.d <= 1.2) return pole.side < 0 ? 'w' : 'W';
  return '.';
});

/** Each glyph: eight rows of characters, and what colour each character paints. `c` paints the current colour. */
const GLYPHS = {
  // Stats.
  maxHealth: [['.kk..kk.', 'kRrkkrrk', 'kRrrrrrk', 'krrrrrrk', '.krrrrk.', '..krrk..', '...kk...', '........'], { R: '#ec8a78', r: '#c0402f' }],
  power: [['........', '.kkkkkk.', 'kskskskk', 'kskskssk', 'kddddddk', 'kssssssk', '.ksssdk.', '..kkkk..'], { s: '#e6b48a', d: '#a46a48' }],
  armour: [['kkkkkkkk', 'kHHHHHik', 'kHHbbHik', 'kHHbbHik', 'kHHHHHik', '.kHHHik.', '..kHik..', '...kk...'], { H: IRON.hi, i: IRON.lo, b: BRASS.hi }],
  critChance: [['........', '..kkkk..', '.kwwwwk.', 'kwfkkfwk', 'kwfkkfwk', '.kwwwwk.', '..kkkk..', '........'], { w: '#ece0c4', f: '#f4b24a' }],
  poisonResistance: [['...kk...', '...kgk..', '..kgGk..', '.kgGggk.', 'kgGggggk', 'kgggggGk', '.kgggGk.', '..kkkk..'], { g: '#4f9a66', G: '#a8dcae' }],
  speed: [['bbbbbbbb', '.kssssk.', '..kssk..', '...kk...', '...kk...', '..k..k..', '.kssssk.', 'bbbbbbbb'], { b: BRASS.mid, s: '#f4b24a' }],
  // Pick tags that aren't stats.
  stacking: [['........', '..kkkk..', '..kbbk..', '.kkkkkk.', '.kbbbbk.', 'kkkkkkkk', 'kbbbbbbk', 'kkkkkkkk'], { b: BRASS.mid }],
  guardian: [['.kkkkkk.', 'kwwwwwwk', 'kwwwwwwk', 'kwkkwkkk', 'kwwwwwwk', '.kwkkwk.', '.kwwwwk.', '.kwkwkk.'], { w: '#ddd2b6' }],
  // The ledger.
  stairs: [['kk......', 'ttk.....', 'kkkk....', 'ttttk...', 'kkkkkk..', 'ttttttk.', 'kkkkkkkk', 'tttttttt'], { t: '#8a7458' }],
  deep: [['..kkkk..', '..kiik..', '..kiik..', 'kkkiikkk', '.kiiiik.', '..kiik..', '...kk...', '........'], { i: '#f4b24a' }],
  damage: [['......kk', '.....kHk', '....kHk.', '.k.kHk..', '..kHk...', '..kbk...', '.kbkk...', 'kk......'], { H: IRON.hi, b: BRASS.mid }],
  healed: [['...kk...', '..kggk..', 'kkkggkkk', 'kgggggGk', 'kkkggkkk', '..kggk..', '...kk...', '........'], { g: '#5aa878', G: '#a8dcae' }],
  gem: [['........', '.kkkkkk.', 'kGccccck', '.kcccck.', '..kcck..', '...kk...', '........', '........'], { G: '#ffffff' }],
  lampLit: [['...kk...', '..k..k..', '.kkkkkk.', '.kfyyfk.', '.kfyyfk.', '.kffffk.', '.kkkkkk.', '..kkkk..'], { f: '#f4b24a', y: '#ffe2a0' }],
  lampDark: [['...kk...', '..k..k..', '.kkkkkk.', '.kddddk.', '.kddddk.', '.kddddk.', '.kkkkkk.', '..kkkk..'], { d: '#3a2e24', k: '#6a6258' }],
  star: [['...kk...', '...kyk..', 'kkkyykkk', '.kyyyyk.', '..kyyk..', '.kykkyk.', '.kk..kk.', '........'], { y: '#f4d080' }],
  flame: [['...k....', '...kk...', '..kfk...', '..kffk..', '.kfyfk..', '.kfyyfk.', '.kfyyfk.', '..kkkk..'], { f: '#f4b24a', y: '#ffe2a0' }],
  // Controls.
  snuffer: [['......kw', '.....kwk', '....kwk.', '.kkkkk..', 'kbbbbk..', '.kbbk...', '..kk....', '........'], { b: BRASS.mid, w: '#8a6a40' }],
  lift: [['...kk...', '..kbbk..', '.kbbbbk.', 'kkkbbkkk', '..kbbk..', '..kbbk..', '..kkkk..', '........'], { b: BRASS.hi }],
  equip: [['..kkkk..', '..kbbk..', 'kkkbbkkk', '.kbbbbk.', '..kbbk..', '...kk...', 'kkkkkkkk', 'kiiiiiik'], { b: BRASS.hi, i: IRON.mid }],
  lock: [['..kkkk..', '.kk..kk.', '.k....k.', 'kkkkkkkk', 'kbbbbbbk', 'kbbkkbbk', 'kbbbbbbk', 'kkkkkkkk'], { b: BRASS.mid }],
  sieve: [['........', 'kkkkkkkk', 'kBBbbbbk', 'kkkkkkkk', '.kikikk.', '..kikk..', '...kk...', '........'], { B: BRASS.hi, b: BRASS.mid, i: IRON.hi }],
  newest: [['...k....', '..kyk...', 'kkyyykk.', '.kyyyk..', '.kykyk..', 'kk...kk.', '........', '........'], { y: '#ffe2a0' }],
  level: [['.kkkkkk.', 'kbbbbbbk', 'kbkbbbbk', 'kbkbbbbk', 'kbkbbbbk', 'kbkkkbbk', 'kbbbbbbk', '.kkkkkk.'], { b: BRASS.mid }],
  weapon: [['......kk', '.....kHk', '....kHk.', '.k.kHk..', '..kHk...', '..kbk...', '.kbkk...', 'kk......'], { H: IRON.hi, b: BRASS.mid }],
  body: [['.kk..kk.', 'kHHkkHHk', 'kHHHHHik', '.kHHHik.', '.kHHHik.', '.kHHHik.', '.kHHHik.', '.kkkkkk.'], { H: IRON.hi, i: IRON.lo }],
  trinket: [['..kkkk..', '.kb..bk.', '.kb..bk.', '..kkkk..', '...kk...', '..kggk..', '.kgGggk.', '..kkkk..'], { b: BRASS.mid, g: '#c0402f', G: '#ec8a78' }],
  // Classes, at 24 × 24: the Sin-Eater's funeral bread, the Warrener's trap, the Lamplighter's wick pole.
  sinEater: [SIN_EATER, { H: '#f4d28e', L: '#dcac60', M: '#b87a38', D: '#8a5424', l: '#5a3214', w: '#ddd4c0', W: '#a89c84' }],
  warrener: [WARRENER, { H: IRON.hi, I: IRON.mid, i: IRON.lo, T: '#e6dcc4', t: '#a89c84', P: BRASS.mid, p: BRASS.hi }],
  lamplighter: [LAMPLIGHTER, { W: '#7a5434', w: '#c4945c', B: BRASS.hi, b: BRASS.lo, F: '#f4b24a', Y: '#ffe2a0', O: '#e38a36' }],
  battle: [['kk....kk', 'kHk..kHk', '.kHkkHk.', '..kHHk..', '..kHHk..', '.kbkkbk.', 'kbk..kbk', 'kk....kk'], { H: IRON.hi, b: BRASS.mid }],
} as const satisfies Record<string, readonly [readonly string[], Record<string, string>]>;

export type GlyphName = keyof typeof GLYPHS;

export const STAT_GLYPH: Readonly<Record<ItemStat, GlyphName>> = {
  maxHealth: 'maxHealth',
  power: 'power',
  armour: 'armour',
  critChance: 'critChance',
  poisonResistance: 'poisonResistance',
  speed: 'speed',
};

export const TAG_GLYPH: Readonly<Record<PickTag, GlyphName>> = {
  guardian: 'guardian',
  poison: 'poisonResistance',
  stacking: 'stacking',
  power: 'power',
  armour: 'armour',
  crit: 'critChance',
};

export const RARITY_COLOUR: Readonly<Record<Rarity, string>> = { common: '#a89c88', magic: '#7aa8e0', rare: '#f0c060' };

/** A glyph as crisp pixels. Decorative by default; pass `label` when it stands alone for a word. */
export function Glyph({ name, label, className, colour }: { name: GlyphName; label?: string; className?: string; colour?: string }) {
  const [rows, palette] = GLYPHS[name] as readonly [readonly string[], Record<string, string>];
  const colours: Record<string, string> = { k: K, c: 'currentColor', ...palette };
  return (
    <svg
      className={className ? `glyph ${className}` : 'glyph'}
      viewBox={`0 0 ${rows[0]!.length} ${rows.length}`}
      shapeRendering="crispEdges"
      style={colour ? { color: colour } : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label && <title>{label}</title>}
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => {
          const fill = colours[ch];
          return fill ? <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={fill} /> : null;
        }),
      )}
    </svg>
  );
}
