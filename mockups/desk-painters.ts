/* Painters for the Council desk mockup: the desk, the ledger, the dossier, the strongbox, slips, and portraits. */
import { figureOf, LANTERNS, RAMPS, SPRITES } from '../src/ui/battleScene/art';
import { Art, BRASS, dither, FLAME, IRON, K, LEATHER, noise, PAINTERS, paper, rivet, type Mask } from './painters';

const rgb = ([r, g, b]: readonly number[], a = 1) => (a === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${a})`);

/** The desk: dark planks under a hanging lamp, its light falling off into the corners. */
function paintDesk(a: Art): void {
  const { w, h } = a;
  const cx = w / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const plank = Math.floor(y / 14);
      const seam = y % 14 === 0;
      const offset = (plank * 37) % 60;
      const butt = (x + offset) % 90 === 0;
      const grain = noise(Math.floor((x + offset) / 6), y, 31 + plank) < 0.3;
      const d = Math.hypot((x - cx) / (w * 0.6), y / (h * 0.9));
      const light = Math.max(0, 1 - d) * 0.9;
      let c = dither(x, y, light) ? (grain ? LEATHER[2]! : LEATHER[1]!) : grain ? LEATHER[1]! : LEATHER[0]!;
      if (seam || butt) c = K;
      if (noise(x, y, 33) < 0.004) c = '#3a2a18';
      a.px(x, y, c);
    }
}

/** The report: a tablet of grey ashlar set in a riveted iron frame. A brass supply pipe climbs its left side and runs
 *  under the lintel through the Party's lantern, weeping oil at its joints. The lantern's light warms the stone near
 *  it, more when it's lit, and its smoke soots the top. */
const STONE = ['#18181c', '#222227', '#2b2b31', '#34343b', '#3f3f47', '#4d4d56'];
const LAMPLIT = ['#1f1914', '#2a2119', '#352a1f', '#413326', '#4e3d2d', '#5e4a36'];

function paintLedger(a: Art, el: HTMLElement): void {
  const { w, h } = a;
  const frame = 5;
  const course = 9;
  const block = 22;
  const pipeX = 11;
  // The pipe's centre runs 15.5 art pixels down; the lantern works' CSS lines up on it.
  const pipeY = frame + 8;
  // The light comes from the lantern works hung on the pipe, wherever the page has put it.
  const works = el.querySelector<HTMLElement>('.lantern-works');
  const box = el.getBoundingClientRect();
  const at = works?.getBoundingClientRect();
  const fine = at ? at.width / WORKS.width : 2;
  const art = box.width / w;
  const lampX = at ? Math.round((at.left - box.left + WORKS.flameX * fine) / art) : w - 30;
  const lampY = at ? Math.round((at.top - box.top + (WORKS.flameY - 4) * fine) / art) : pipeY + 14;
  const burning = el.dataset.lit === 'true';

  // The stone, block by block: each its own tone, bevelled light from the top left, pitted.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const row = Math.floor(y / course);
      const offset = (row % 2) * (block >> 1) + (noise(row, 0, 3) < 0.5 ? 3 : 0);
      const col = Math.floor((x + offset) / block);
      const jx = (x + offset) % block;
      const jy = y % course;
      const tone = noise(col, row, 13);
      let i = 2 + (tone > 0.7 ? 1 : tone < 0.22 ? -1 : 0);
      if (jx === 1 || jy === 1) i += 1;
      if (jx === block - 1 || jy === course - 1) i -= 1;
      if (noise(x, y, 17) < 0.06) i -= 1;
      else if (noise(x, y, 19) > 0.985) i += 1;
      // Soot from the lamp, thickest at the top and round the lamp.
      const soot = Math.max(0, 1 - y / (h * 0.18)) * 0.6 + Math.max(0, 1 - Math.hypot(x - lampX, (y - lampY) * 0.6) / 20) * 0.4;
      if (dither(x, y, soot)) i -= 1;
      i = Math.max(0, Math.min(5, i));
      // Lamplight falls warm on the stone near the lamp, dithered off into the grey.
      const warm = Math.max(0, 1 - Math.hypot(x - lampX, (y - lampY) * 1.15) / (burning ? 70 : 46));
      const lit = dither(x, y, warm * 0.95);
      let c = lit ? LAMPLIT[Math.min(5, i + (warm > 0.55 ? 1 : 0))]! : STONE[i]!;
      if (jx === 0 || jy === 0) c = lit ? '#140f0b' : '#101013';
      a.px(x, y, c);
    }

  // Oil weeping from the pipe's joints, darkening the stone below them.
  const joints: number[] = [];
  for (let y = pipeY + 30; y < h - frame - 6; y += 46) joints.push(y);
  for (const jy of joints)
    for (let y = jy + 2; y < Math.min(h - frame, jy + 14 + Math.round(noise(jy, 1, 23) * 16)); y++) {
      const x = pipeX + 4 + (noise(jy, y >> 3, 29) < 0.5 ? 0 : 1);
      a.px(x, y, 'rgb(60 36 12 / 0.75)');
      if (dither(x + 1, y, 0.4)) a.px(x + 1, y, 'rgb(60 36 12 / 0.35)');
    }

  // The supply pipe: up the left side, round an elbow, and along under the lintel to the lamp.
  // k runs 0..4 across the pipe: outline, highlight, body, shadow, outline.
  const shade = (k: number) => (k === 0 || k === 4 ? K : BRASS[k === 1 ? 5 : k === 2 ? 4 : 2]!);
  for (let y = pipeY; y < h - frame; y++) for (let k = 0; k < 5; k++) a.px(pipeX + k, y, shade(k));
  for (let x = pipeX; x < w - frame; x++) for (let k = 0; k < 5; k++) a.px(x, pipeY + k, shade(k));
  // The elbow, a brass casting with a rivet.
  for (let y = pipeY - 1; y < pipeY + 6; y++)
    for (let x = pipeX - 1; x < pipeX + 6; x++) {
      const edge = x === pipeX - 1 || y === pipeY - 1 || x === pipeX + 5 || y === pipeY + 5;
      a.px(x, y, edge ? K : x + y < pipeX + pipeY + 3 ? BRASS[5]! : BRASS[3]!);
    }
  rivet(a, pipeX + 2, pipeY + 2);
  // Flanged joints, bolted.
  for (const jy of joints)
    for (let y = jy - 1; y <= jy + 1; y++)
      for (let x = pipeX - 1; x <= pipeX + 4; x++) a.px(x, y, x === pipeX - 1 || x === pipeX + 4 || y !== jy ? K : BRASS[4]!);
  for (let x = pipeX + 40; x < w - frame - 6; x += 46)
    for (let x2 = x - 1; x2 <= x + 1; x2++)
      for (let y = pipeY - 1; y <= pipeY + 4; y++) a.px(x2, y, y === pipeY - 1 || y === pipeY + 4 || x2 !== x ? K : BRASS[4]!);
  // A valve wheel low on the pipe, and the feed dropping down to the lamp.
  const vy = h - frame - 26;
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const r = Math.hypot(dx, dy);
      if (r > 4.4) continue;
      a.px(pipeX + 2 + dx, vy + dy, r > 3.6 ? K : r > 2.4 ? (dx + dy < 0 ? BRASS[5]! : BRASS[3]!) : dx === 0 || dy === 0 ? BRASS[4]! : r < 1 ? K : IRON[1]!);
    }

  // The iron frame: a bevelled strap, riveted, with brass corner caps.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (d >= frame) continue;
      const far = Math.min(w - 1 - x, h - 1 - y) < Math.min(x, y);
      let c = [K, IRON[far ? 2 : 4]!, IRON[3]!, IRON[far ? 1 : 2]!, K][d]!;
      if (d > 0 && d < 4 && noise(x, y, 31) < 0.04) c = '#5a3220';
      a.px(x, y, c);
    }
  for (let x = 14; x < w - 10; x += 16) {
    rivet(a, x, 2);
    rivet(a, x, h - 3);
  }
  for (let y = 16; y < h - 10; y += 16) {
    rivet(a, 2, y);
    rivet(a, w - 3, y);
  }
  for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8 - y; x++) {
        const px = fx ? w - 1 - x : x;
        const py = fy ? h - 1 - y : y;
        a.px(px, py, x === 0 || y === 0 ? BRASS[4]! : x + y === 7 ? K : BRASS[3 - ((x + y) >> 2)]!);
      }
}

/** The dossier: an oxblood leather folder, stitched round, with brass corner caps. */
function paintFolder(a: Art): void {
  const { w, h } = a;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inset = Math.min(x, y, w - 1 - x, h - 1 - y);
      const n = noise(x, y, 51);
      let c = dither(x, y, 0.35) ? '#3a1c18' : '#2e1612';
      if (n < 0.04) c = '#24100d';
      if (n > 0.985) c = '#4a2620';
      if (inset === 3 && (x + y) % 4 < 2) c = '#6a4030';
      if (inset === 1) c = '#48241c';
      if (inset === 0) c = K;
      a.px(x, y, c);
    }
  const cap = (ox: number, oy: number, fx: number, fy: number) => {
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 9 - y; x++) {
        const px = fx ? w - 1 - (ox + x) : ox + x;
        const py = fy ? h - 1 - (oy + y) : oy + y;
        a.px(px, py, x === 0 || y === 0 ? BRASS[4]! : x + y === 8 ? K : BRASS[3 - ((x + y) >> 2)]!);
      }
  };
  cap(0, 0, 0, 0);
  cap(0, 0, 1, 0);
  cap(0, 0, 0, 1);
  cap(0, 0, 1, 1);
}

/** The strongbox: a heavy iron box, lid hinged across the top, with a brass escutcheon. */
function paintStrongbox(a: Art, el: HTMLElement): void {
  const { w, h } = a;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const near = Math.min(x, y);
      const far = Math.min(w - 1 - x, h - 1 - y);
      const d = Math.min(near, far);
      const n = noise(x, y, 61);
      let c = dither(x, y, 0.25) ? IRON[1]! : '#17191e';
      if (n < 0.03) c = IRON[0]!;
      if (d < 7) c = [K, IRON[4]!, IRON[3]!, IRON[3]!, IRON[2]!, IRON[1]!, K][d]!;
      if (d < 7 && far < near && d > 0 && d < 6) c = [K, IRON[3]!, IRON[2]!, IRON[2]!, IRON[1]!, IRON[0]!][d]!;
      if (d >= 1 && d <= 5 && n > 0.985) c = '#5a3220';
      a.px(x, y, c);
    }
  // The lid's seam and its two hinge straps. Lifted, the lid shows its underside: oxblood felt.
  const lid = 22;
  const open = el.dataset.open === 'true';
  if (open)
    for (let y = 7; y < lid; y++)
      for (let x = 7; x < w - 7; x++) {
        let c = dither(x, y, 0.4) ? '#3a1c18' : '#2e1612';
        if (y === 7) c = K;
        if (y === lid - 1) c = '#1a0c0a';
        a.px(x, y, c);
      }
  for (let x = 7; x < w - 7; x++) {
    a.px(x, lid, K);
    a.px(x, lid + 1, IRON[3]!);
  }
  for (const sx of [Math.floor(w * 0.22), Math.floor(w * 0.78) - 6])
    for (let y = 7; y < lid + 8; y++)
      for (let x = 0; x < 6; x++) {
        const edge = x === 0 || x === 5 || y === lid + 7;
        a.px(sx + x, y, edge ? K : x === 1 ? IRON[4]! : IRON[2]!);
        if (!edge && (y - 9) % 7 === 0 && x === 2) rivet(a, sx + 2, y);
      }
  // The escutcheon and keyhole sit on the lid's face, so they're hidden while it's up.
  if (open) return;
  const ex = Math.floor(w / 2) - 4;
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 9; x++) {
      if ((x === 0 || x === 8) && (y === 0 || y === 11)) continue;
      const edge = x === 0 || x === 8 || y === 0 || y === 11;
      a.px(ex + x, lid - 4 + y, edge ? K : BRASS[[5, 4, 4, 3, 3, 3, 3, 2, 2, 1][y - 1] ?? 3]!);
    }
  for (const [dx, dy] of [[4, 3], [3, 4], [4, 4], [5, 4], [4, 5], [4, 6], [4, 7]] as const) a.px(ex + dx, lid - 4 + dy, K);
}

/** A slip or chit of paper, ragged along one edge. */
function paintSlip(a: Art, el: HTMLElement): void {
  const { w, h } = a;
  const seed = Number(el.dataset.seed ?? 1);
  const mask: Mask = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    if (x === w - 1 && noise(x, y, seed) < 0.5) return false;
    if (y === 0 && noise(x, y, seed + 1) < 0.3) return false;
    return true;
  };
  paper(a, mask, seed);
  if (el.dataset.active === 'true') for (let y = 2; y < h - 2; y++) a.px(1, y, '#f4b24a');
}

/** A Hero's portrait: their Battle sprite in an iron frame, lit by their own lantern as their Oil allows. */
function paintPortrait(a: Art, el: HTMLElement): void {
  const { w, h } = a;
  const oil = Number(el.dataset.oil ?? 1);
  const figure = figureOf({ id: el.dataset.hero ?? 'warrener', name: '' });
  const pixels = SPRITES[figure];
  const top = Math.min(...pixels.map((pixel) => pixel.y));
  // A bust frames the head and shoulders: find the body's middle, ignoring poles and lanterns held out to the side.
  const bust = el.dataset.frame === 'bust';
  const xs = pixels.map((pixel) => pixel.x).sort((p, q) => p - q);
  const middle = xs[Math.floor(xs.length / 2)] ?? 0;
  const head = Math.min(...pixels.filter((pixel) => Math.abs(pixel.x - middle) <= 3).map((pixel) => pixel.y));
  const cx = Math.floor(w / 2) - (bust ? middle : 0);
  // Full length stands the figure on the frame's floor, lifted so a tall one still fits under the top edge.
  const cy = bust ? (Math.min(w, h) < 24 ? 2 : 4) - head : Math.min(h - 6, Math.round((h - top) / 2 + 2));
  const lantern = LANTERNS[figure];
  const lx = cx + (lantern?.x ?? 0);
  const ly = cy + (lantern?.y ?? -20);
  const reach = 26 * (lantern?.reach ?? 1) * (0.45 + 0.55 * oil);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - lx, (y - ly) * 1.1) / reach;
      const lit = Math.max(0, 1 - d);
      let c = dither(x, y, lit * 0.9) ? '#3a2c1e' : dither(x, y, lit * 1.8) ? '#221a13' : '#120f0b';
      if (y > cy - 2 && Math.abs(x - cx) < 14 - (y - cy) * 2 && dither(x, y, 0.6)) c = '#070605';
      a.px(x, y, c);
    }
  const LANTERN_DARK = [60, 40, 20];
  for (const pixel of pixels) {
    const x = cx + pixel.x;
    const y = cy + pixel.y;
    if (pixel.material === null) a.px(x, y, K);
    else if (pixel.material === 'glow') {
      const bright = pixel.shade > 1 ? [255, 232, 160] : [255, 186, 90];
      const t = 0.35 + 0.65 * oil;
      a.px(x, y, rgb(LANTERN_DARK.map((v, i) => Math.round(v + (bright[i]! - v) * t))));
    } else if (pixel.material === 'eye') a.px(x, y, 'rgb(255 190 90)');
    else {
      const near = Math.max(0, 1 - Math.hypot(x - lx, y - ly) / reach);
      const step = near > 0.45 ? 1 : 0;
      a.px(x, y, rgb(RAMPS[pixel.material][Math.max(0, Math.min(5, pixel.shade + step))]!));
    }
  }
  // The frame: bevelled iron, brass at the corners. A small bust gets a thin frame, or it would be all frame.
  const thin = Math.min(w, h) < 24;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (thin) {
        if (d === 0) a.px(x, y, K);
        else if (d === 1) a.px(x, y, x === 1 || y === 1 ? BRASS[4]! : IRON[2]!);
        continue;
      }
      if (d > 3) continue;
      const far = Math.min(w - 1 - x, h - 1 - y) < Math.min(x, y);
      let c = [K, IRON[4]!, IRON[2]!, K][d]!;
      if (far && d === 1) c = IRON[2]!;
      const corner = Math.min(x, w - 1 - x) < 6 && Math.min(y, h - 1 - y) < 6;
      if (corner && d > 0 && d < 3) c = d === 1 ? BRASS[5]! : BRASS[3]!;
      a.px(x, y, c);
    }
}

/** The lantern works, in line on the report's supply pipe and painted at twice the art density: a valve wheel, a
 *  sight-glass, a pressure gauge, and the Party's lantern hung from a brass junction. `data-phase` runs 0 (shut) to
 *  8 (open): the wheel turns, oil runs through the glass, the needle climbs, and the flame stands up. */
const WORKS = { width: 84, height: 60, pipe: 16, flameX: 69, flameY: 40 } as const;

function paintLanternWorks(a: Art, el: HTMLElement): void {
  const phase = Math.max(0, Math.min(8, Number(el.dataset.phase ?? 0)));
  const open = phase / 8;
  const { w } = a;
  const py = WORKS.pipe;
  const lx = WORKS.flameX;
  const IR = ['#14151a', '#1e2027', '#2a2d35', '#3c404a', '#5a606c'];
  const brassRow = [K, BRASS[5]!, BRASS[4]!, BRASS[4]!, BRASS[3]!, BRASS[3]!, BRASS[2]!, K];

  const flameTall = Math.round(5 + 8 * Math.min(1, phase / 4));
  const flameBase = 45;
  a.halo(lx, flameBase - Math.round(flameTall / 2), Math.round(8 + 14 * open));

  // The pipe, straight through, with a coupling at each end where it meets the painted pipe behind.
  for (let x = 0; x < w; x++) for (let k = 0; k < 8; k++) a.px(x, py - 4 + k, brassRow[k]!);
  const coupling = (x0: number, x1: number) => {
    for (let y = py - 6; y <= py + 5; y++)
      for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || y === py - 6 || y === py + 5;
        a.px(x, y, edge ? K : y < py - 2 ? BRASS[5]! : y < py + 2 ? BRASS[4]! : BRASS[2]!);
      }
  };
  coupling(0, 3);
  coupling(w - 4, w - 1);

  // The valve: a stem collar on the pipe and a spoked brass wheel that turns as it opens.
  const vx = 10;
  for (let y = py - 3; y <= py + 3; y++) for (let x = vx - 3; x <= vx + 3; x++) a.px(x, y, Math.abs(x - vx) === 3 || Math.abs(y - py) === 3 ? K : IR[3]!);
  for (let dy = -7; dy <= 7; dy++)
    for (let dx = -7; dx <= 7; dx++) {
      const r = Math.hypot(dx, dy);
      if (r > 7.2 || r < 5.4) continue;
      a.px(vx + dx, py + dy, r > 6.6 || r < 5.9 ? K : dx + dy < 0 ? BRASS[5]! : BRASS[3]!);
    }
  for (let s = 0; s < 4; s++) {
    const angle = (s * Math.PI) / 2 + (phase * Math.PI) / 8;
    for (let r = 1.5; r < 6; r += 0.5) a.px(Math.round(vx + Math.cos(angle) * r), Math.round(py + Math.sin(angle) * r), BRASS[4]!);
  }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a.px(vx + dx, py + dy, dx === 0 && dy === 0 ? BRASS[5]! : K);

  // The sight-glass: a glass length of pipe between brass collars. Shut, the oil lies still; open, it runs.
  const g0 = 20;
  const g1 = 41;
  for (const cx of [g0, g1])
    for (let y = py - 5; y <= py + 4; y++)
      for (let x = cx - 1; x <= cx + 1; x++) a.px(x, y, x === cx - 1 || x === cx + 1 || y === py - 5 || y === py + 4 ? K : BRASS[4]!);
  for (let x = g0 + 2; x <= g1 - 2; x++)
    for (let y = py - 3; y <= py + 2; y++) {
      let c = 'rgb(150 170 185 / 0.35)';
      const full = open > 0 ? py - 3 : py;
      if (y >= full) c = dither(x, y, 0.5) ? FLAME.oil : FLAME.oilMid;
      if (y === full && open === 0) c = FLAME.core;
      if (y === py - 3 && open === 0) c = 'rgb(230 240 248 / 0.6)';
      if (open > 0 && (x - g0 - phase * 3 + (y & 1) * 5) % 7 === 0 && y < py + 2) c = FLAME.core;
      a.px(x, y, c);
    }
  for (const y of [py - 4, py + 3]) for (let x = g0 + 2; x <= g1 - 2; x++) a.px(x, y, K);

  // The gauge: a brass-ringed dial on a stem, its needle climbing towards the red.
  const gx = 50;
  const gy = 6;
  for (let y = gy + 5; y < py - 4; y++) for (let x = gx - 1; x <= gx + 1; x++) a.px(x, y, x === gx ? IR[4]! : K);
  for (let dy = -6; dy <= 6; dy++)
    for (let dx = -6; dx <= 6; dx++) {
      const r = Math.hypot(dx, dy);
      if (r > 6.2) continue;
      let c = r > 5.6 ? K : r > 4.4 ? (dx + dy < 0 ? BRASS[5]! : BRASS[3]!) : '#e6dcc0';
      if (r <= 4.4 && r > 3.4) {
        const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        if (deg > 195 && deg < 345 && Math.round(deg) % 35 < 9) c = deg > 315 ? '#b03e32' : K;
      }
      a.px(gx + dx, gy + dy, c);
    }
  const needle = ((200 + 135 * open) * Math.PI) / 180;
  for (let r = 0; r <= 3.6; r += 0.4) a.px(Math.round(gx + Math.cos(needle) * r), Math.round(gy + Math.sin(needle) * r), '#9a2a20');
  a.px(gx, gy, K);

  // The lantern's vent chimney, slotted, with a spire and two pinnacles.
  for (let y = 3; y < py - 6; y++)
    for (let x = lx - 3; x <= lx + 3; x++) {
      const edge = x === lx - 3 || x === lx + 3;
      a.px(x, y, edge ? K : y % 2 === 0 && x > lx - 2 && x < lx + 2 ? K : x < lx ? IR[4]! : IR[2]!);
    }
  for (let x = lx - 5; x <= lx + 5; x++) a.px(x, 3, x === lx - 5 || x === lx + 5 ? K : BRASS[4]!);
  for (let x = lx - 5; x <= lx + 5; x++) a.px(x, 2, K);
  a.px(lx, 1, BRASS[5]!);
  a.px(lx, 0, BRASS[4]!);
  a.px(lx - 1, 1, K);
  a.px(lx + 1, 1, K);
  for (const px of [lx - 9, lx + 9]) {
    a.px(px, py - 9, BRASS[5]!);
    a.px(px, py - 8, BRASS[4]!);
    a.px(px, py - 7, BRASS[3]!);
  }

  // The junction: a riveted brass box the pipe runs through, the lantern hung beneath it.
  const j0 = lx - 9;
  const j1 = lx + 9;
  for (let y = py - 6; y <= py + 6; y++)
    for (let x = j0; x <= j1; x++) {
      const edge = x === j0 || x === j1 || y === py - 6 || y === py + 6;
      const t = (x - j0) / (j1 - j0);
      a.px(x, y, edge ? K : y === py - 5 ? BRASS[5]! : BRASS[t < 0.3 ? 5 : t < 0.7 ? 4 : 2]!);
    }
  for (const [rx, ry] of [[j0 + 2, py - 4], [j1 - 3, py - 4], [j0 + 2, py + 3], [j1 - 3, py + 3]] as const) rivet(a, rx, ry);
  // A pointed arch embossed on its face.
  for (let y = py - 3; y <= py + 4; y++) {
    const half = y < py ? (y - (py - 3)) * 0.7 : 2.1;
    a.px(Math.round(lx - half - 0.5), y, BRASS[1]!);
    a.px(Math.round(lx + half + 0.5), y, BRASS[5]!);
  }

  // The housing: three lancet panes in an iron cage, glass warmed by the flame.
  const h0 = py + 7;
  const h1 = 50;
  const panes = [[lx - 8, lx - 4], [lx - 2, lx + 2], [lx + 4, lx + 8]] as const;
  for (let y = h0; y <= h1; y++)
    for (let x = lx - 9; x <= lx + 9; x++) {
      const pane = panes.find(([p0, p1]) => x >= p0 && x <= p1);
      const arch = pane ? Math.abs(x - (pane[0] + pane[1]) / 2) - (y - h0) * 0.9 : 0;
      if (!pane || arch > 0) {
        const outer = x === lx - 9 || x === lx + 9;
        a.px(x, y, outer ? K : x < lx ? IR[3]! : IR[2]!);
        continue;
      }
      const glow = Math.max(0, 1 - Math.hypot(x - lx, (y - flameBase + flameTall / 2) * 0.8) / (6 + 10 * open));
      a.px(x, y, dither(x, y, glow) ? 'rgb(255 196 110 / 0.55)' : 'rgb(150 170 185 / 0.22)');
    }
  // The flame, behind the cage's middle bars.
  for (let i = 0; i < flameTall; i++) {
    const y = flameBase - i;
    const t = i / Math.max(1, flameTall - 1);
    const shape = t < 0.25 ? 0.55 + 1.8 * t : Math.pow(1 - (t - 0.25) / 0.75, 0.8);
    const half = (1.6 + 1.6 * open) * shape;
    for (let x = lx - 4; x <= lx + 4; x++) {
      const d = Math.abs(x - lx);
      if (d > half + 0.5) continue;
      let c = FLAME.flame;
      if (d < half * 0.5 && t < 0.6) c = FLAME.core;
      if (t > 0.75) c = d < half * 0.5 ? FLAME.flame : FLAME.oil;
      if (i === 0) c = 'rgb(120 150 220)';
      a.px(x, y, c);
    }
  }
  for (const x of [lx - 3, lx + 3]) for (let y = h0 + 4; y <= h1; y++) a.px(x, y, K);
  for (let x = lx - 9; x <= lx + 9; x++) a.px(x, h0 + 9, K);

  // The font: a brass bowl of oil, then a hanging finial.
  for (let y = h1 + 1; y <= h1 + 5; y++) {
    const half = 9 - (y - h1 - 1) * 1.4;
    for (let x = Math.round(lx - half); x <= Math.round(lx + half); x++) {
      const edge = x === Math.round(lx - half) || x === Math.round(lx + half) || y === h1 + 5;
      a.px(x, y, edge ? K : y === h1 + 1 ? BRASS[5]! : x < lx ? BRASS[4]! : BRASS[2]!);
    }
  }
  for (let y = h1 + 6; y < WORKS.height; y++) {
    const half = y === h1 + 7 ? 1.5 : y > h1 + 7 ? 0 : 1;
    for (let x = Math.round(lx - half - 1); x <= Math.round(lx + half + 1); x++) a.px(x, y, Math.abs(x - lx) > half ? K : x < lx ? BRASS[5]! : BRASS[3]!);
  }
}

/** A blob of red sealing wax, pressed with a ring. */
function paintSeal(a: Art): void {
  const { w, h } = a;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r = Math.min(w, h) / 2 - 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const wobble = noise(Math.round(Math.atan2(y - cy, x - cx) * 4), 0, 71) * 1.6;
      if (d > r - wobble + 0.6) continue;
      let c = d > r - wobble - 0.6 ? '#4a1410' : (x - cx) + (y - cy) < -r * 0.6 ? '#c45a40' : '#9a3424';
      if (Math.abs(d - r * 0.62) < 0.6) c = '#6e2018';
      if (Math.abs(d - r * 0.62 + 1) < 0.5 && x < cx) c = '#b84a34';
      a.px(x, y, c);
    }
}

/** A brass medallion for a level or a rank. */
function paintMedallion(a: Art): void {
  const { w, h } = a;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r = Math.min(w, h) / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r) continue;
      const t = (x - cx + (y - cy)) / (2 * r) + 0.5;
      let c = BRASS[t < 0.3 ? 5 : t < 0.6 ? 4 : 3]!;
      if (d > r - 1) c = K;
      else if (d > r - 2) c = t < 0.5 ? BRASS[5]! : BRASS[2]!;
      a.px(x, y, c);
    }
}

Object.assign(PAINTERS, {
  lanternWorks: paintLanternWorks,
  seal: paintSeal,
  medallion: paintMedallion,
  desk: paintDesk,
  ledger: paintLedger,
  folder: paintFolder,
  strongbox: paintStrongbox,
  slip: paintSlip,
  portrait: paintPortrait,
});
