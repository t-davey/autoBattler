import type { Rgb } from './art';
import { ORIGIN_Y, UNITS_PER_PIXEL } from './iso';
import { MATERIAL_HILLS, MATERIAL_SKY, noise } from './roomBake';

/** The night sky over the lamp road, above a near ridge and paler far hills. Positions are the framing's art pixels. */

const ZENITH: Rgb = [6, 5, 11];
const HORIZON: Rgb = [34, 24, 52];
const CLOUD: Rgb = [46, 33, 66];
const STAR: Rgb = [176, 166, 214];
const STAR_DIM: Rgb = [92, 86, 124];
/** The near ridge in silhouette: darker than the sky behind it, as land is at night. */
export const RIDGE_LAND: Rgb = [10, 9, 15];
const FAR_HILLS: Rgb = [19, 15, 28];
const FAR_HILLS_EDGE: Rgb = [26, 20, 38];

/** How far above the Room's far corner the near ridge runs. Clear of the drystone, which stands 10 pixels at the corner. */
const RIDGE_ABOVE_CORNER = 25;
/** How many pixels of moor below the ridge darken into its silhouette. */
const HAZE = 14;
/** How far out from the stage the sky can begin, in tiles, so it never cuts into the Room. */
export const SKY_CLEAR_OF_STAGE = 0.4;
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]] as const;

function smooth(x: number, salt: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  return noise(i, salt) * (1 - s) + noise(i + 1, salt) * s;
}

const mix = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** Where the near ridge meets what lies behind it, at a column. */
const ridgeAt = (px: number): number => ORIGIN_Y / UNITS_PER_PIXEL - RIDGE_ABOVE_CORNER + smooth(px / 41, 71) * 9 + smooth(px / 11, 73) * 2.5;
/** Where the far hills meet the sky, a few pixels above the ridge. */
const farRidgeAt = (px: number): number => ridgeAt(px) - 3 - smooth(px / 23 + 40, 91) * 7;

/** What lies behind the near ridge at a pixel, as a material and its value, or null on this side of it.
 *  The sky's value is its height above the far hills, and the hills' is 1 along their lit top edge. */
export function skylineAt(px: number, py: number, outside: number): { material: number; value: number } | null {
  if (outside < SKY_CLEAR_OF_STAGE || py >= ridgeAt(px)) return null;
  const far = farRidgeAt(px);
  if (py >= far) return { material: MATERIAL_HILLS, value: py < far + 1 ? 1 : 0 };
  return { material: MATERIAL_SKY, value: far - py };
}

/** How far the moor at a pixel darkens into the ridge's silhouette, 0 to 1. */
export function hazeAt(px: number, py: number, outside: number): number {
  const below = py - ridgeAt(px);
  if (below < 0 || below >= HAZE) return 0;
  const reach = Math.min(1, (outside - SKY_CLEAR_OF_STAGE) / 0.6);
  return reach <= 0 ? 0 : (1 - below / HAZE) ** 1.5 * reach;
}

export function hillsColour(value: number): Rgb {
  return value > 0 ? FAR_HILLS_EDGE : FAR_HILLS;
}

/** The sky at a pixel, given its height above the far hills: a glow over the hills, low cloud, and stars that thin towards the horizon. */
export function skyColour(px: number, py: number, height: number, time: number): Rgb {
  const dither = (BAYER[((py % 4) + 4) % 4]![((px % 4) + 4) % 4]! / 16 - 0.47) * 0.22;
  const glow = Math.max(0, Math.min(1, 1 - height / 30 + dither));
  let colour = mix(ZENITH, HORIZON, glow * glow);
  const band = Math.max(0, 1 - Math.abs(height - 11) / 8);
  const cloud = smooth(px / 31 + time * 0.04, 81) * smooth(px / 17 - time * 0.02 + height / 9, 83) * band;
  if (cloud > 0.3 + dither * 0.5) colour = mix(colour, CLOUD, 0.5);
  const threshold = 0.985 + Math.max(0, 1 - height / 30) * 0.015;
  if (height > 6 && noise(px, py + 500) > threshold) colour = Math.sin(time * 2 + px * 3.1) > -0.5 ? STAR : STAR_DIM;
  return colour;
}
