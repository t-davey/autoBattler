import { RAMPS, SPRITES, type Figure, type Rgb } from './art';

/** The window onto a figure that a portrait shows, in art pixels around its feet. */
export const PORTRAIT = { left: -14, top: -34, width: 28, height: 36 } as const;
const OUTLINE: Rgb = [10, 10, 16];
const GLOW: Rgb = [255, 206, 110];
const EYE: Rgb = [255, 190, 90];
/** A portrait is lit evenly, about as a lantern lights a Hero in the scene. */
const LIT = 2;

/** A figure's Battle sprite as RGBA pixels, for a Hero's plate. Off-figure pixels stay clear. */
export function portraitPixels(figure: Figure): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(PORTRAIT.width * PORTRAIT.height * 4);
  for (const pixel of SPRITES[figure]) {
    const x = pixel.x - PORTRAIT.left;
    const y = pixel.y - PORTRAIT.top;
    if (x < 0 || y < 0 || x >= PORTRAIT.width || y >= PORTRAIT.height) continue;
    const colour =
      pixel.material === null ? OUTLINE
      : pixel.material === 'glow' ? GLOW
      : pixel.material === 'eye' ? EYE
      : RAMPS[pixel.material][Math.min(5, pixel.shade + LIT)]!;
    pixels.set([colour[0], colour[1], colour[2], 255], (y * PORTRAIT.width + x) * 4);
  }
  return pixels;
}
