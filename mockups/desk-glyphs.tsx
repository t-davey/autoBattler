/* Glyphs for the Council desk mockup: 8 × 8 pixel pictures, in colour, that stand in for words.
   Every glyph a player can't hover is paired with words for screen readers by whoever places it. */
import type { ItemStat, PickTag, Rarity } from '../src/sim';

const K = '#0a0a10';
const BRASS = { hi: '#f0c870', mid: '#c89640', lo: '#7a5420' };
const IRON = { hi: '#9aa0ac', mid: '#5a606c', lo: '#30343c' };

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
  newest: [['...k....', '..kyk...', 'kkyyykk.', '.kyyyk..', '.kykyk..', 'kk...kk.', '........', '........'], { y: '#ffe2a0' }],
  level: [['.kkkkkk.', 'kbbbbbbk', 'kbkbbbbk', 'kbkbbbbk', 'kbkbbbbk', 'kbkkkbbk', 'kbbbbbbk', '.kkkkkk.'], { b: BRASS.mid }],
  weapon: [['......kk', '.....kHk', '....kHk.', '.k.kHk..', '..kHk...', '..kbk...', '.kbkk...', 'kk......'], { H: IRON.hi, b: BRASS.mid }],
  body: [['.kk..kk.', 'kHHkkHHk', 'kHHHHHik', '.kHHHik.', '.kHHHik.', '.kHHHik.', '.kHHHik.', '.kkkkkk.'], { H: IRON.hi, i: IRON.lo }],
  trinket: [['..kkkk..', '.kb..bk.', '.kb..bk.', '..kkkk..', '...kk...', '..kggk..', '.kgGggk.', '..kkkk..'], { b: BRASS.mid, g: '#c0402f', G: '#ec8a78' }],
  // Classes, larger at 12 × 12: the Sin-Eater's funeral bread, the Warrener's trap, the Lamplighter's wick pole.
  sinEater: [['............', '............', '....kkkk....', '..kkLLLLkk..', '.kLLlLLlLLk.', 'kLlLLlLLlLLk', 'kLLLLLLLLLLk', 'kLLLLLLLLLDk', 'kDLLLLLLLDDk', 'kDDDDDDDDDDk', '.kkkkkkkkkk.', '............'], { L: '#e0b468', l: '#8a5a28', D: '#a86e32' }],
  warrener: [['...kkkkkk...', '.kkIIIIIIkk.', 'kIIkTkTkTIIk', 'kIT......TIk', 'kI........Ik', 'kIT......TIk', 'kIIkTkTkTIIk', '.kkIIIIIIkk.', '...kkkkkk...', '.....kk.....', '....k..k....', '.....kk.....'], { I: IRON.hi, T: '#ddd2b6' }],
  lamplighter: [['.........y..', '........yfy.', '........kfk.', '.......kbbk.', '......kbkbk.', '.....kwk.k..', '....kwk.....', '...kwk......', '..kwk.......', '.kwk........', 'kwk.........', 'kk..........'], { y: '#ffe2a0', f: '#f4b24a', b: BRASS.hi, w: '#9a7048' }],
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
