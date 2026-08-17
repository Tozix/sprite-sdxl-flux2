import { ISO_CONFIG } from "./config.ts";

export type RGB = { r: number; g: number; b: number };
export type HSV = { h: number; s: number; v: number };

export function parseHexColor(hex: string): RGB {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) {
    throw new Error(`Invalid color: ${hex}`);
  }
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

export const CHROMA_RGB: RGB = parseHexColor(ISO_CONFIG.chroma.hex);

export function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) {
      h = 60 * ((g - b) / delta);
      if (h < 0) h += 360;
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
  }
  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

export const CHROMA_HSV: HSV = rgbToHsv(CHROMA_RGB.r, CHROMA_RGB.g, CHROMA_RGB.b);

export function hueDistance(a: number, b: number): number {
  const raw = Math.abs(a - b);
  return Math.min(raw, 360 - raw);
}

export function isChromaColor(
  r: number,
  g: number,
  b: number,
  loose = false,
): boolean {
  const direct = Math.hypot(r - CHROMA_RGB.r, g - CHROMA_RGB.g, b - CHROMA_RGB.b);
  if (direct <= ISO_CONFIG.chroma.directDistance) {
    return true;
  }
  const hsv = rgbToHsv(r, g, b);
  const hueTolerance = loose
    ? ISO_CONFIG.chroma.spillHueToleranceDegrees
    : ISO_CONFIG.chroma.hueToleranceDegrees;
  const minSaturation = loose
    ? ISO_CONFIG.chroma.spillMinSaturation
    : ISO_CONFIG.chroma.minSaturation;
  const minValue = loose ? ISO_CONFIG.chroma.spillMinValue : ISO_CONFIG.chroma.minValue;
  return (
    hueDistance(hsv.h, CHROMA_HSV.h) <= hueTolerance &&
    hsv.s >= minSaturation &&
    hsv.v >= minValue
  );
}

export function isBloodColor(r: number, g: number, b: number): boolean {
  const hsv = rgbToHsv(r, g, b);
  return (
    (hsv.h < 22 || hsv.h > 342) &&
    hsv.s > 0.42 &&
    hsv.v > 0.08 &&
    hsv.v < 0.72 &&
    r > g * 1.2 &&
    r > b * 1.02
  );
}

export function isEarPink(r: number, g: number, b: number): boolean {
  const hsv = rgbToHsv(r, g, b);
  const warmHue = hsv.h <= 25 || hsv.h >= 325;
  const redDominant = r > g * 1.04;
  const notDark = hsv.v > 0.25;
  return warmHue && hsv.s >= 0.16 && redDominant && notDark;
}

export function createChromaMask(
  rgba: Uint8Array | Buffer,
  width: number,
  height: number,
  channels: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let read = 0;
  let write = 0;

  function push(pixel: number) {
    if (pixel < 0 || pixel >= width * height || mask[pixel]) {
      return;
    }
    const offset = pixel * channels;
    if (
      !isChromaColor(rgba[offset]!, rgba[offset + 1]!, rgba[offset + 2]!, false)
    ) {
      return;
    }
    mask[pixel] = 1;
    queue[write++] = pixel;
  }

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (read < write) {
    const pixel = queue[read++]!;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) push(pixel - 1);
    if (x < width - 1) push(pixel + 1);
    if (y > 0) push(pixel - width);
    if (y < height - 1) push(pixel + width);
  }

  for (let pass = 0; pass < ISO_CONFIG.chroma.spillPasses; pass++) {
    const additions: number[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const pixel = y * width + x;
        if (mask[pixel]) continue;
        const adjacent =
          mask[pixel - 1] ||
          mask[pixel + 1] ||
          mask[pixel - width] ||
          mask[pixel + width];
        if (!adjacent) continue;
        const offset = pixel * channels;
        if (
          isChromaColor(
            rgba[offset]!,
            rgba[offset + 1]!,
            rgba[offset + 2]!,
            true,
          )
        ) {
          additions.push(pixel);
        }
      }
    }
    for (const pixel of additions) {
      mask[pixel] = 1;
    }
  }

  return mask;
}
