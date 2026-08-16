import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ISO_CONFIG } from "./config.ts";
import { createChromaMask } from "./chroma.ts";
import { ensureDir, exists } from "./fs.ts";
import { log } from "./log.ts";

export function pathFor(
  outputDir: string,
): {
  sourceAI: string;
  masters: string;
  raw: string;
  sprites: string;
  sheets: string;
  masterFrontLeft: string;
  masterBackLeft: string;
  palette: string;
} {
  return {
    sourceAI: path.join(outputDir, "source-ai"),
    masters: path.join(outputDir, "masters"),
    raw: path.join(outputDir, "raw"),
    sprites: path.join(outputDir, "sprites"),
    sheets: path.join(outputDir, "sheets"),
    masterFrontLeft: path.join(outputDir, "masters", "master-front-left.png"),
    masterBackLeft: path.join(outputDir, "masters", "master-back-left.png"),
    palette: path.join(outputDir, "palette.json"),
  };
}

export async function transparentizeFullCanvas(
  inputPath: string,
): Promise<{ rgba: Buffer; info: sharp.OutputInfo }> {
  if (!(await exists(inputPath))) {
    throw new Error(`Missing source: ${inputPath}`);
  }

  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const rgba = Buffer.from(data);
  const matte = createChromaMask(rgba, info.width, info.height, info.channels);

  for (let pixel = 0; pixel < matte.length; pixel++) {
    const offset = pixel * info.channels;
    if (matte[pixel]) {
      rgba[offset] = 0;
      rgba[offset + 1] = 0;
      rgba[offset + 2] = 0;
      rgba[offset + 3] = 0;
    } else {
      rgba[offset + 3] = 255;
    }
  }

  return { rgba, info };
}

function hardenAlpha(buffer: Uint8Array | Buffer): Buffer {
  for (let offset = 0; offset < buffer.length; offset += 4) {
    buffer[offset + 3] =
      buffer[offset + 3]! >= ISO_CONFIG.sprite.alphaThreshold ? 255 : 0;
  }
  return buffer as Buffer;
}

function shiftRgbaCanvas(
  input: Buffer,
  size: number,
  xOffset: number,
  yOffset: number,
): Buffer {
  if (!xOffset && !yOffset) return input;
  const output = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const targetY = y + yOffset;
    if (targetY < 0 || targetY >= size) continue;
    for (let x = 0; x < size; x++) {
      const targetX = x + xOffset;
      if (targetX < 0 || targetX >= size) continue;
      const src = (y * size + x) * 4;
      const dst = (targetY * size + targetX) * 4;
      input.copy(output, dst, src, src + 4);
    }
  }
  return output;
}

export async function rasterize(
  inputPath: string,
  yOffset: number,
): Promise<Buffer> {
  const { rgba, info } = await transparentizeFullCanvas(inputPath);
  const { data } = await sharp(rgba, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .resize(ISO_CONFIG.sprite.size, ISO_CONFIG.sprite.size, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const hardened = hardenAlpha(Buffer.from(data));
  return shiftRgbaCanvas(hardened, ISO_CONFIG.sprite.size, 0, yOffset);
}

export function rgbKey(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

export function keyToRgb(key: number): { r: number; g: number; b: number } {
  return {
    r: (key >> 16) & 255,
    g: (key >> 8) & 255,
    b: key & 255,
  };
}

export function paletteDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

export function buildGlobalPalette(
  buffers: Buffer[],
  wanted: number,
): Array<{ r: number; g: number; b: number }> {
  const histogram = new Map<number, number>();
  for (const buffer of buffers) {
    for (let offset = 0; offset < buffer.length; offset += 4) {
      if (!buffer[offset + 3]) continue;
      const key = rgbKey(buffer[offset]!, buffer[offset + 1]!, buffer[offset + 2]!);
      histogram.set(key, (histogram.get(key) ?? 0) + 1);
    }
  }

  const entries = [...histogram.entries()]
    .map(([key, count]) => ({ ...keyToRgb(key), count }))
    .sort((a, b) => b.count - a.count);

  if (!entries.length) throw new Error("Cannot build palette: no colors");
  if (entries.length <= wanted) {
    return entries.map(({ r, g, b }) => ({ r, g, b }));
  }

  const centers: Array<{ r: number; g: number; b: number }> = [
    { r: entries[0]!.r, g: entries[0]!.g, b: entries[0]!.b },
  ];

  while (centers.length < wanted && centers.length < entries.length) {
    let best = entries[0]!;
    let bestScore = -Infinity;
    for (const entry of entries) {
      let nearest = Infinity;
      for (const center of centers) {
        nearest = Math.min(nearest, paletteDistance(entry, center));
      }
      const score = nearest * Math.log2(entry.count + 1);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    centers.push({ r: best.r, g: best.g, b: best.b });
  }

  for (let iteration = 0; iteration < 8; iteration++) {
    const sums = centers.map(() => ({ r: 0, g: 0, b: 0, weight: 0 }));
    for (const entry of entries) {
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let index = 0; index < centers.length; index++) {
        const distance = paletteDistance(entry, centers[index]!);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
      const sum = sums[bestIndex]!;
      sum.r += entry.r * entry.count;
      sum.g += entry.g * entry.count;
      sum.b += entry.b * entry.count;
      sum.weight += entry.count;
    }
    for (let index = 0; index < centers.length; index++) {
      const sum = sums[index]!;
      if (!sum.weight) continue;
      centers[index] = {
        r: Math.round(sum.r / sum.weight),
        g: Math.round(sum.g / sum.weight),
        b: Math.round(sum.b / sum.weight),
      };
    }
  }

  return centers;
}

export function applyPalette(
  input: Buffer,
  palette: Array<{ r: number; g: number; b: number }>,
): Buffer {
  const output = Buffer.from(input);
  for (let offset = 0; offset < output.length; offset += 4) {
    if (!output[offset + 3]) continue;
    const current = {
      r: output[offset]!,
      g: output[offset + 1]!,
      b: output[offset + 2]!,
    };
    let best = palette[0]!;
    let bestDistance = Infinity;
    for (const candidate of palette) {
      const distance = paletteDistance(current, candidate);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    output[offset] = best.r;
    output[offset + 1] = best.g;
    output[offset + 2] = best.b;
    output[offset + 3] = 255;
  }
  return output;
}

export async function createPreview(input: string): Promise<void> {
  const parsed = path.parse(input);
  await sharp(input)
    .resize(
      ISO_CONFIG.sprite.size * ISO_CONFIG.sprite.previewScale,
      ISO_CONFIG.sprite.size * ISO_CONFIG.sprite.previewScale,
      { kernel: sharp.kernel.nearest },
    )
    .png()
    .toFile(path.join(parsed.dir, `${parsed.name}-preview.png`));
}

export async function writeSprite(buffer: Buffer, output: string): Promise<void> {
  await ensureDir(path.dirname(output));
  await sharp(buffer, {
    raw: {
      width: ISO_CONFIG.sprite.size,
      height: ISO_CONFIG.sprite.size,
      channels: 4,
    },
  })
    .png()
    .toFile(output);
  await createPreview(output);
}

export async function mirrorSprite(input: string, output: string): Promise<void> {
  await ensureDir(path.dirname(output));
  await sharp(input).flop().png().toFile(output);
  await createPreview(output);
}

export type PixelSource = {
  animation: string;
  direction: string;
  frame: number;
  variant: number | null;
  input: string;
  output: string;
  yOffset: number;
};

export function getPixelSources(
  selection: {
    walk?: boolean;
    attack?: boolean;
    hit?: boolean;
    death?: boolean;
    corpse?: boolean;
  },
  ctx: PixelizeContext,
): PixelSource[] {
  const sources: PixelSource[] = [];

  for (const direction of ctx.canonicalDirections) {
    sources.push({
      animation: "idle",
      direction,
      frame: 0,
      variant: null,
      input:
        direction === "southwest"
          ? ctx.masterFrontLeft
          : ctx.masterBackLeft,
      output: ctx.spritePath("idle", direction, 0),
      yOffset: 0,
    });
  }

  if (selection.walk) {
    const bob = [1, 0, 1, 0];
    for (const direction of ctx.canonicalDirections) {
      for (let frame = 0; frame < ISO_CONFIG.animations.walkFrames; frame++) {
        sources.push({
          animation: "walk",
          direction,
          frame,
          variant: null,
          input: ctx.rawPath("walk", direction, frame),
          output: ctx.spritePath("walk", direction, frame),
          yOffset: bob[frame] ?? 0,
        });
      }
    }
  }

  if (selection.attack) {
    const bob = [0, 1, 0, -1, 0, 0];
    for (const direction of ctx.canonicalDirections) {
      for (let frame = 0; frame < ISO_CONFIG.animations.attackFrames; frame++) {
        sources.push({
          animation: "attack",
          direction,
          frame,
          variant: null,
          input: ctx.rawPath("attack", direction, frame),
          output: ctx.spritePath("attack", direction, frame),
          yOffset: bob[frame] ?? 0,
        });
      }
    }
  }

  if (selection.hit) {
    for (let variant = 0; variant < ISO_CONFIG.animations.hitVariants; variant++) {
      for (const direction of ctx.canonicalDirections) {
        for (let frame = 0; frame < ISO_CONFIG.animations.hitFrames; frame++) {
          sources.push({
            animation: "hit",
            direction,
            frame,
            variant,
            input: ctx.rawPath("hit", direction, frame, variant),
            output: ctx.spritePath("hit", direction, frame, variant),
            yOffset: [0, -1, 0, 0, 0][frame] ?? 0,
          });
        }
      }
    }
  }

  if (selection.death) {
    for (const direction of ctx.canonicalDirections) {
      for (let frame = 0; frame < ISO_CONFIG.animations.deathFrames; frame++) {
        sources.push({
          animation: "death",
          direction,
          frame,
          variant: null,
          input: ctx.rawPath("death", direction, frame),
          output: ctx.spritePath("death", direction, frame),
          yOffset: [0, 0, 1, 2, 2, 2, 2, 2][frame] ?? 2,
        });
      }
    }
  }

  if (selection.corpse) {
    for (let variant = 0; variant < ISO_CONFIG.animations.corpseVariants; variant++) {
      for (const direction of ctx.canonicalDirections) {
        sources.push({
          animation: "corpse",
          direction,
          frame: 0,
          variant,
          input: ctx.rawPath("corpse", direction, 0, variant),
          output: ctx.spritePath("corpse", direction, 0, variant),
          yOffset: 2,
        });
      }
    }
  }

  return sources;
}

export type PixelizeContext = {
  outputDir: string;
  palettePath: string;
  mirrorDirection: Record<string, string>;
  canonicalDirections: readonly string[];
  masterFrontLeft: string;
  masterBackLeft: string;
  rawPath: (
    animation: string,
    direction: string,
    frame?: number,
    variant?: number | null,
  ) => string;
  spritePath: (
    animation: string,
    direction: string,
    frame?: number,
    variant?: number | null,
  ) => string;
};

export async function pixelizeSelection(
  selection: Parameters<typeof getPixelSources>[0],
  ctx: PixelizeContext,
): Promise<void> {
  log("PIXEL", "START rasterize + palette");
  const sources = getPixelSources(selection, ctx);

  const rasters = new Map<string, Buffer>();
  for (const source of sources) {
    if (!(await exists(source.input))) {
      throw new Error(`Missing source: ${source.input}`);
    }
    const raster = await rasterize(source.input, source.yOffset ?? 0);
    const key = `${source.animation}:${source.variant ?? -1}:${source.direction}:${source.frame}`;
    rasters.set(key, raster);
  }

  const palette = buildGlobalPalette(
    [...rasters.values()],
    ISO_CONFIG.sprite.paletteSize,
  );

  await fs.writeFile(
    ctx.palettePath,
    JSON.stringify(
      {
        size: palette.length,
        generationSize: ISO_CONFIG.generation.size,
        spriteSize: ISO_CONFIG.sprite.size,
        chromaColor: ISO_CONFIG.chroma.hex,
        colors: palette.map((color) => ({
          ...color,
          hex:
            "#" +
            [color.r, color.g, color.b]
              .map((value) => value.toString(16).padStart(2, "0"))
              .join("")
              .toUpperCase(),
        })),
      },
      null,
      2,
    ),
  );

  for (const source of sources) {
    const key = `${source.animation}:${source.variant ?? -1}:${source.direction}:${source.frame}`;
    await writeSprite(
      applyPalette(rasters.get(key)!, palette),
      source.output,
    );
    const mirrorOutput = ctx.spritePath(
      source.animation,
      ctx.mirrorDirection[source.direction]!,
      source.frame,
      source.variant,
    );
    await mirrorSprite(source.output, mirrorOutput);
  }

  log("PIXEL", `${sources.length * 2} sprite frames written`);
}
