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

/** The ledger: a dark ruled page with a red margin, the binding's shadow at its left, and page edges at its right. */
function paintLedger(a: Art): void {
  const { w, h } = a;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c = noise(x, y, 41) < 0.03 ? '#2a2118' : '#211a13';
      if ((y - 18) % 7 === 0 && y > 14 && x > 3 && x < w - 5) c = '#2b231a';
      if (x === 12 || x === 13) c = x === 12 ? '#5a2620' : '#3e1d17';
      if (x < 5 && dither(x, y, (5 - x) / 6)) c = '#0e0b08';
      if (x >= w - 4) c = (x + (y >> 1)) % 2 ? '#3a3024' : '#18130e';
      if (x === w - 1 || y === 0 || y === h - 1) c = K;
      a.px(x, y, c);
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

/** The Party's lamp, painted at twice the art density: a hurricane chimney over a glass oil font on a brass foot.
 *  Lit, the flame stands tall and throws a halo; unlit, it gutters low. */
function paintOilLamp(a: Art, el: HTMLElement): void {
  const { w, h } = a;
  const lit = el.dataset.lit === 'true';
  const cx = (w - 1) / 2;
  const top = 3;
  const collar = Math.round(h * 0.5);
  const fontTop = collar + 4;
  const stem = h - 9;
  const flameBase = collar - 1;
  const flameTall = lit ? Math.round(h * 0.3) : Math.round(h * 0.11);
  a.halo(Math.round(cx), flameBase - Math.round(flameTall / 2), lit ? Math.round(w * 0.9) : Math.round(w * 0.3));

  // The chimney: a hurricane glass, narrow at the neck, swelling round the flame, sooted at the lip.
  const chimneyHalf = (y: number) => {
    const t = (y - top) / (collar - top);
    if (t < 0.18) return 3.5;
    return 3.5 + Math.sin(((t - 0.18) / 0.82) * Math.PI) * (w / 2 - 10) + (t > 0.9 ? 2 : 0);
  };
  for (let y = top; y < collar; y++) {
    const half = chimneyHalf(y);
    for (let x = 0; x < w; x++) {
      const d = x - cx;
      if (Math.abs(d) > half + 0.5) continue;
      const edge = Math.abs(d) > half - 0.5 || y === top;
      let c = 'rgb(170 190 205 / 0.16)';
      if (d < -half + 2.5 && d > -half + 0.5 && y > top + 6) c = 'rgb(235 244 250 / 0.55)';
      if (d > half - 2.5 && d < half - 0.5 && y > top + 10) c = 'rgb(200 215 225 / 0.28)';
      if (y < top + 5 && dither(x, y, 1 - (y - top) / 5)) c = 'rgb(34 28 24 / 0.85)';
      a.px(x, y, edge ? (d < 0 ? 'rgb(120 130 140)' : K) : c);
    }
  }

  // The flame: a teardrop, blue at the wick, white at its heart, orange at the tip.
  for (let i = 0; i < flameTall; i++) {
    const y = flameBase - i;
    const t = i / Math.max(1, flameTall - 1);
    const shape = t < 0.25 ? 0.55 + 1.8 * t : Math.pow(1 - (t - 0.25) / 0.75, 0.8);
    const half = (lit ? 3.4 : 1.6) * shape;
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - cx);
      if (d > half + 0.5) continue;
      let c = FLAME.flame;
      if (d < half * 0.5 && t < 0.6) c = FLAME.core;
      if (t > 0.75) c = d < half * 0.5 ? FLAME.flame : FLAME.oil;
      if (i === 0) c = 'rgb(120 150 220)';
      a.px(x, y, c);
    }
  }
  // The wick.
  a.px(Math.floor(cx), flameBase + 1, K);
  a.px(Math.ceil(cx), flameBase + 1, K);

  // The burner: a crenellated brass gallery, with the wick's winding knob on the right.
  const gallery = Math.round(w / 2 - 5);
  for (let y = collar; y < fontTop; y++)
    for (let x = Math.round(cx - gallery); x <= Math.round(cx + gallery); x++) {
      if (y === collar && x & 1) continue;
      const edge = y === fontTop - 1 || x === Math.round(cx - gallery) || x === Math.round(cx + gallery);
      a.px(x, y, edge ? K : BRASS[x < cx - 2 ? 5 : x < cx + 3 ? 4 : 2]!);
    }
  const kx = Math.round(cx + gallery + 2);
  const ky = collar + 2;
  for (let y = -2; y <= 2; y++) for (let x = -1; x <= 2; x++) a.px(kx + x, ky + y, Math.abs(y) === 2 || x === 2 ? K : x === -1 ? BRASS[2]! : BRASS[4]!);

  // The font: a round glass belly, oil in its lower half, a meniscus and two highlights.
  const rx = w / 2 - 1.5;
  const ry = (stem - fontTop) / 2;
  const fy = fontTop + ry;
  const oilLine = fy - ry * 0.15;
  for (let y = fontTop; y < stem; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / rx, (y - fy) / ry);
      if (d > 1) continue;
      let c: string;
      if (d > 0.9) c = d > 0.95 || x > cx ? K : 'rgb(120 130 140)';
      else if (y > oilLine) {
        const deep = (y - oilLine) / (fy + ry - oilLine);
        c = dither(x, y, 1 - deep) ? FLAME.oil : deep > 0.6 ? FLAME.oilDeep : FLAME.oilMid;
        if (y === Math.ceil(oilLine)) c = FLAME.core;
      } else c = 'rgb(170 190 205 / 0.18)';
      if (d <= 0.9 && d > 0.62 && x < cx && y < fy - ry * 0.2 && (x + y) % 3 === 0) c = 'rgb(240 246 250 / 0.7)';
      if (d <= 0.9 && x > cx + rx * 0.45 && x < cx + rx * 0.6 && y > fy && y < fy + ry * 0.5) c = 'rgb(255 226 160 / 0.6)';
      a.px(x, y, c);
    }

  // The foot: a short stem, then a stepped brass base.
  for (let y = stem; y < h; y++) {
    const step = y - stem;
    const half = step < 3 ? 2.5 : Math.min(w / 2 - 1, 4 + (step - 3) * 3);
    for (let x = 0; x < w; x++) {
      const d = x - cx;
      if (Math.abs(d) > half + 0.5) continue;
      const edge = Math.abs(d) > half - 0.5 || y === h - 1 || (step === 3 && Math.abs(d) > 2.5);
      const t = (d + half) / (2 * half);
      a.px(x, y, edge ? K : BRASS[t < 0.25 ? 5 : t < 0.55 ? 4 : t < 0.8 ? 3 : 2]!);
    }
  }
}

/** A steampunk-gothic oiler, painted at twice the art density: a blackened iron vessel on a brass foot, a lancet
 *  sight-glass showing the oil, a thumb pump crowned with a spire, a pointed-arch handle, and a curving brass spout
 *  with a valve wheel at its root. */
function paintOilCan(a: Art): void {
  const { w, h } = a;
  const cx = Math.round(w * 0.58);
  const y0 = Math.round(h * 0.38);
  const y1 = h - 4;
  const halfAt = (y: number) => 6 + ((y - y0) / (y1 - y0)) * 3;
  const IRONISH = ['#14151a', '#1e2027', '#2a2d35', '#3c404a', '#5a606c'];

  // The spout, behind the vessel: a brass curve from the shoulder up to a flared tip.
  const sx = cx - halfAt(y0 + 3);
  const sy = y0 + 3;
  const ex = 3;
  const ey = 4;
  const qx = 4;
  const qy = y0 + 2;
  const points: { x: number; y: number; r: number }[] = [];
  for (let t = 0; t <= 1; t += 0.02) {
    const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * qx + t * t * ex;
    const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * qy + t * t * ey;
    points.push({ x, y, r: t < 0.5 ? 1.6 : 1.1 });
  }
  for (const { x, y, r } of points)
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dy) <= r + 1) a.px(Math.round(x + dx), Math.round(y + dy), K);
  for (const { x, y, r } of points)
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dy) <= r) a.px(Math.round(x + dx), Math.round(y + dy), dy < 0 ? BRASS[5]! : dy === 0 ? BRASS[4]! : BRASS[2]!);
  // The flared tip.
  for (let dx = -2; dx <= 2; dx++) {
    a.px(ex + dx, ey - 3, K);
    a.px(ex + dx, ey - 2, Math.abs(dx) === 2 ? K : BRASS[5]!);
  }

  // The handle: a pointed gothic arch on the far side, iron, with a brass finial at its peak.
  const hTop = y0 + 1;
  const hBottom = y1 - 5;
  for (let y = hTop; y <= hBottom; y++) {
    const t = (y - hTop) / (hBottom - hTop);
    const reach = 6.5 * (1 - Math.pow(Math.abs(2 * t - 0.7) / 1.3, 1.4));
    const x = Math.round(cx + halfAt(y) + Math.max(1, reach));
    a.px(x - 1, y, K);
    a.px(x, y, IRONISH[4]!);
    a.px(x + 1, y, IRONISH[2]!);
    a.px(x + 2, y, K);
  }
  const peakY = Math.round(hTop + (hBottom - hTop) * 0.35);
  const peakX = Math.round(cx + halfAt(peakY) + 6.5) + 1;
  for (let i = 0; i < 3; i++) {
    a.px(peakX + 2 + i, peakY - i, i === 2 ? BRASS[5]! : BRASS[3]!);
    a.px(peakX + 2 + i, peakY - i + 1, K);
  }

  // The vessel: blackened iron, lit from the left, brass-banded and riveted.
  for (let y = y0; y <= y1; y++) {
    const half = halfAt(y);
    for (let x = 0; x < w; x++) {
      const d = x - cx;
      if (Math.abs(d) > half + 0.5) continue;
      const edge = Math.abs(d) > half - 0.5 || y === y0;
      const t = (d + half) / (2 * half);
      let c = IRONISH[t < 0.12 ? 2 : t < 0.32 ? 4 : t < 0.55 ? 3 : t < 0.8 ? 2 : 1]!;
      const band = y === y0 + 1 || y === y0 + 2 || y === y1 - 1;
      if (band) c = BRASS[t < 0.3 ? 5 : t < 0.65 ? 4 : 2]!;
      if (y === y0 + 1 && Math.round(d) % 3 === 0) c = BRASS[5]!;
      if (!band && noise(x, y, 97) < 0.03) c = '#5a3220';
      a.px(x, y, edge ? K : c);
    }
  }

  // The lancet window: a pointed-arch sight-glass in a brass frame, oil standing in its lower half.
  const archTop = y0 + 4;
  const archBottom = y1 - 3;
  const archHalf = 2.5;
  const level = archTop + Math.round((archBottom - archTop) * 0.45);
  for (let y = archTop - 1; y <= archBottom + 1; y++) {
    const rise = y - archTop;
    const half = rise < 3 ? rise * 0.85 : archHalf;
    for (let x = cx - 5; x <= cx + 5; x++) {
      const d = Math.abs(x - cx);
      if (y <= archBottom && d <= half) {
        let c = y > level ? (dither(x, y, 0.5) ? FLAME.oil : FLAME.oilMid) : '#20262c';
        if (y === level + 1) c = FLAME.core;
        if (y < level && x === cx - 1 && rise > 2) c = 'rgb(220 235 245 / 0.55)';
        a.px(x, y, c);
      } else if (d <= half + 1.2 || (y === archBottom + 1 && d <= archHalf + 1)) a.px(x, y, x < cx ? BRASS[5]! : BRASS[3]!);
    }
  }
  // Gauge ticks beside the glass.
  for (let y = archTop + 3; y <= archBottom; y += 2) a.px(cx + 5, y, BRASS[4]!);

  // The shoulder: a brass dome, and the thumb pump rising from it, crowned with a gothic spire.
  for (let y = y0 - 3; y < y0; y++) {
    const half = 3 + (y - (y0 - 3)) * 1.2;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const edge = x === Math.round(cx - half) || x === Math.round(cx + half) || y === y0 - 3;
      a.px(x, y, edge ? K : x < cx ? BRASS[5]! : BRASS[3]!);
    }
  }
  for (let y = 5; y < y0 - 3; y++) {
    a.px(cx - 1, y, K);
    a.px(cx, y, IRONISH[4]!);
    a.px(cx + 1, y, K);
  }
  // The pump's cross-handle, and the spire on it.
  for (let x = cx - 4; x <= cx + 4; x++) {
    a.px(x, 4, K);
    a.px(x, 5, Math.abs(x - cx) === 4 ? K : x < cx ? BRASS[5]! : BRASS[3]!);
    a.px(x, 6, K);
  }
  for (let i = 1; i <= 3; i++) {
    a.px(cx, 4 - i, i === 3 ? BRASS[5]! : BRASS[4]!);
    a.px(cx - 1, 4 - i, K);
    a.px(cx + 1, 4 - i, K);
  }
  a.px(cx, 0, K);

  // A valve wheel where the spout leaves the vessel: a brass ring of spokes round a dark hub.
  const vx = Math.round(sx) - 1;
  const vy = sy - 1;
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      const r = Math.hypot(dx, dy);
      if (r > 3.4) continue;
      let c: string | null = null;
      if (r > 2.6) c = K;
      else if (r > 1.6) c = dx + dy < 0 ? BRASS[5]! : BRASS[3]!;
      else if (dx === 0 || dy === 0) c = BRASS[4]!;
      else c = IRONISH[0]!;
      if (r <= 0.5) c = K;
      a.px(vx + dx, vy + dy, c);
    }

  // The foot: a flared brass plinth.
  for (let y = y1 + 1; y < h; y++) {
    const half = halfAt(y1) + (y - y1);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const edge = x === Math.round(cx - half) || x === Math.round(cx + half) || y === h - 1;
      a.px(x, y, edge ? K : x < cx - half / 3 ? BRASS[5]! : x < cx + half / 3 ? BRASS[4]! : BRASS[2]!);
    }
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
  oilLamp: paintOilLamp,
  oilCan: paintOilCan,
  seal: paintSeal,
  medallion: paintMedallion,
  desk: paintDesk,
  ledger: paintLedger,
  folder: paintFolder,
  strongbox: paintStrongbox,
  slip: paintSlip,
  portrait: paintPortrait,
});
