/* Painters for the Council desk mockup: the desk, the ledger, the dossier, the strongbox, slips, and portraits. */
import { figureOf, LANTERNS, RAMPS, SPRITES } from '../src/ui/battleScene/art';
import { Art, BRASS, dither, IRON, K, LEATHER, noise, PAINTERS, paper, rivet, type Mask } from './painters';

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

/** The hand bell that sends the Party: brass, on a turned wooden handle, its shadow on the desk. */
function paintBell(a: Art): void {
  const { w, h } = a;
  const cx = (w - 1) / 2;
  const top = 7;
  const lip = h - 4;
  const half = (y: number) => {
    const t = (y - top) / (lip - top);
    return 2.5 + Math.pow(t, 1.6) * (w / 2 - 3.5) + (y >= lip - 1 ? 1 : 0);
  };
  // Shadow.
  for (let x = 1; x < w - 1; x++) for (let y = h - 3; y < h; y++) if (Math.abs(x - cx) < w / 2 - 1 - (h - 1 - y) && dither(x, y, 0.6)) a.px(x, y, 'rgb(0 0 0 / 0.55)');
  // The handle, turned wood with a knob.
  for (let y = 0; y < top; y++)
    for (let x = 0; x < w; x++) {
      const r = y < 3 ? 2 : 1;
      const d = Math.abs(x - cx);
      if (d > r + 0.5) continue;
      a.px(x, y, d > r - 0.5 ? K : x < cx ? LEATHER[4]! : LEATHER[2]!);
    }
  // The bell.
  for (let y = top; y <= lip; y++)
    for (let x = 0; x < w; x++) {
      const hw = half(y);
      const d = x - cx;
      if (Math.abs(d) > hw + 0.5) continue;
      const edge = Math.abs(d) > hw - 0.5 || y === top || y === lip;
      const t = (d + hw) / (2 * hw);
      let c = BRASS[t < 0.2 ? 5 : t < 0.45 ? 4 : t < 0.75 ? 3 : 2]!;
      if (y === lip - 2) c = BRASS[1]!;
      if (dither(x, y, 0.12) && t > 0.6) c = BRASS[1]!;
      a.px(x, y, edge ? K : c);
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
  bell: paintBell,
  seal: paintSeal,
  medallion: paintMedallion,
  desk: paintDesk,
  ledger: paintLedger,
  folder: paintFolder,
  strongbox: paintStrongbox,
  slip: paintSlip,
  portrait: paintPortrait,
});
