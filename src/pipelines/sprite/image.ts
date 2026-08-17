import sharp from "sharp";
import { SPRITE_CONFIG } from "./config.ts";

export type RGB = { r: number; g: number; b: number };

export function colorDistanceSquared(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt(colorDistanceSquared(a.r, a.g, a.b, b.r, b.g, b.b));
}

function estimateBackground(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
): RGB {
  const samples: RGB[] = [];
  const size = Math.max(
    6,
    Math.min(24, Math.floor(Math.min(width, height) / 10)),
  );

  const corners: Array<[number, number]> = [
    [0, 0],
    [width - size, 0],
    [0, height - size],
    [width - size, height - size],
  ];

  for (const [sx, sy] of corners) {
    for (let y = sy; y < sy + size; y += 2) {
      for (let x = sx; x < sx + size; x += 2) {
        const i = (y * width + x) * channels;
        samples.push({
          r: data[i] ?? 0,
          g: data[i + 1] ?? 0,
          b: data[i + 2] ?? 0,
        });
      }
    }
  }

  const total = samples.reduce(
    (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: Math.round(total.r / samples.length),
    g: Math.round(total.g / samples.length),
    b: Math.round(total.b / samples.length),
  };
}

function createForegroundMask(
  rgba: Buffer,
  width: number,
  height: number,
  channels: number,
  background: RGB,
): Uint8Array {
  const threshold =
    SPRITE_CONFIG.backgroundTolerance * SPRITE_CONFIG.backgroundTolerance;
  const backgroundMask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let read = 0;
  let write = 0;

  const isNearBackground = (pixelIndex: number): boolean => {
    const i = pixelIndex * channels;
    return (
      colorDistanceSquared(
        rgba[i] ?? 0,
        rgba[i + 1] ?? 0,
        rgba[i + 2] ?? 0,
        background.r,
        background.g,
        background.b,
      ) <= threshold
    );
  };

  const push = (index: number) => {
    if (index < 0 || index >= width * height) return;
    if (backgroundMask[index]) return;
    if (!isNearBackground(index)) return;
    backgroundMask[index] = 1;
    queue[write++] = index;
  };

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (read < write) {
    const index = queue[read++];
    if (index === undefined) break;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (y > 0) push(index - width);
    if (y < height - 1) push(index + width);
  }

  const foreground = new Uint8Array(width * height);
  for (let i = 0; i < foreground.length; i++) {
    foreground[i] = backgroundMask[i] ? 0 : 1;
  }
  return foreground;
}

type Component = {
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  averageColor: RGB;
  pixels: number[];
};

function findComponents(
  mask: Uint8Array,
  rgba: Buffer,
  width: number,
  height: number,
  channels: number,
): Component[] {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const components: Component[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;

    let read = 0;
    let write = 0;
    queue[write++] = start;
    visited[start] = 1;

    let area = 0;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    const pixels: number[] = [];

    while (read < write) {
      const index = queue[read++];
      if (index === undefined) break;
      pixels.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      area++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const offset = index * channels;
      totalR += rgba[offset] ?? 0;
      totalG += rgba[offset + 1] ?? 0;
      totalB += rgba[offset + 2] ?? 0;

      if (x > 0 && mask[index - 1] && !visited[index - 1]) {
        visited[index - 1] = 1;
        queue[write++] = index - 1;
      }
      if (x < width - 1 && mask[index + 1] && !visited[index + 1]) {
        visited[index + 1] = 1;
        queue[write++] = index + 1;
      }
      if (y > 0 && mask[index - width] && !visited[index - width]) {
        visited[index - width] = 1;
        queue[write++] = index - width;
      }
      if (y < height - 1 && mask[index + width] && !visited[index + width]) {
        visited[index + width] = 1;
        queue[write++] = index + width;
      }
    }

    components.push({
      area,
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      averageColor: {
        r: Math.round(totalR / area),
        g: Math.round(totalG / area),
        b: Math.round(totalB / area),
      },
      pixels,
    });
  }

  components.sort((a, b) => b.area - a.area);
  return components;
}

function isLikelyShadowComponent(
  component: Component,
  main: Component,
  background: RGB,
): boolean {
  if (component.area < SPRITE_CONFIG.shadow.minComponentArea) return false;
  const aspect = component.width / Math.max(component.height, 1);
  if (aspect < SPRITE_CONFIG.shadow.minAspectRatio) return false;
  if (component.height > main.height * SPRITE_CONFIG.shadow.maxHeightVsBody)
    return false;
  if (component.width < main.width * SPRITE_CONFIG.shadow.minWidthVsBody)
    return false;
  if (component.centerY < main.centerY) return false;
  const distance = colorDistance(component.averageColor, background);
  if (distance > SPRITE_CONFIG.shadow.maxBackgroundColorDistance) return false;
  return true;
}

export type ImageAnalysis = {
  hasShadow: boolean;
  background: RGB;
  components: Component[];
  main?: Component;
  shadows?: Component[];
};

export async function analyzeImage(input: Buffer): Promise<ImageAnalysis> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const rgba = Buffer.from(data);
  const background = estimateBackground(
    rgba,
    info.width,
    info.height,
    info.channels,
  );
  const mask = createForegroundMask(
    rgba,
    info.width,
    info.height,
    info.channels,
    background,
  );
  const components = findComponents(
    mask,
    rgba,
    info.width,
    info.height,
    info.channels,
  );

  if (!components.length) {
    return { hasShadow: false, background, components };
  }

  const main = components[0]!;
  const shadows = components
    .slice(1)
    .filter((component) => isLikelyShadowComponent(component, main, background));

  return {
    hasShadow: shadows.length > 0,
    background,
    main,
    shadows,
    components,
  };
}

export type Foreground = {
  buffer: Buffer;
  width: number;
  height: number;
};

export async function extractForeground(input: Buffer): Promise<Foreground> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const rgba = Buffer.from(data);
  const { width, height, channels } = info;
  const background = estimateBackground(rgba, width, height, channels);
  const mask = createForegroundMask(rgba, width, height, channels, background);
  const components = findComponents(mask, rgba, width, height, channels);

  if (!components.length) {
    throw new Error("No foreground found");
  }

  const main = components[0]!;
  for (const component of components.slice(1)) {
    if (isLikelyShadowComponent(component, main, background)) {
      for (const pixel of component.pixels) {
        mask[pixel] = 0;
      }
    }
  }

  for (let i = 0; i < width * height; i++) {
    rgba[i * channels + 3] = mask[i] ? 255 : 0;
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (rgba[i + 3]) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error("Foreground disappeared");
  }

  const border = 3;
  minX = Math.max(0, minX - border);
  minY = Math.max(0, minY - border);
  maxX = Math.min(width - 1, maxX + border);
  maxY = Math.min(height - 1, maxY + border);

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;

  const buffer = await sharp(rgba, {
    raw: { width, height, channels },
  })
    .extract({
      left: minX,
      top: minY,
      width: cropWidth,
      height: cropHeight,
    })
    .png()
    .toBuffer();

  return { buffer, width: cropWidth, height: cropHeight };
}
