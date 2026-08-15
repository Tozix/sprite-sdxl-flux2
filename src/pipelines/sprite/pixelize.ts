import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { SPRITE_CONFIG, type Direction } from "./config.ts";
import { exists, ensureDir } from "./api.ts";
import { extractForeground, type RGB, colorDistanceSquared } from "./image.ts";
import type { Template } from "../../templates.ts";

type SpriteSource = {
  key: string;
  input: string;
  scale: number;
  yOffset: number;
  output: string;
};

type Paths = {
  masters: string;
  raw: string;
  sprites: string;
  sheets: string;
  masterSide: string;
  masterUp: string;
  palette: string;
};

export function spritePaths(): Paths {
  return {
    masters: path.join(SPRITE_CONFIG.outputDir, "masters"),
    raw: path.join(SPRITE_CONFIG.outputDir, "raw"),
    sprites: path.join(SPRITE_CONFIG.outputDir, "sprites"),
    sheets: path.join(SPRITE_CONFIG.outputDir, "sheets"),
    masterSide: path.join(
      SPRITE_CONFIG.outputDir,
      "masters",
      "master-side.png",
    ),
    masterUp: path.join(
      SPRITE_CONFIG.outputDir,
      "masters",
      "master-up.png",
    ),
    palette: path.join(SPRITE_CONFIG.outputDir, "palette.json"),
  };
}

export async function prepareDirectories(): Promise<void> {
  const PATHS = spritePaths();
  const dirs = [
    PATHS.masters,
    PATHS.raw,
    PATHS.sprites,
    PATHS.sheets,
  ];

  for (const animation of ["walk", "attack"]) {
    for (const direction of SPRITE_CONFIG.directions) {
      dirs.push(path.join(PATHS.raw, animation, direction));
      dirs.push(path.join(PATHS.sprites, animation, direction));
    }
  }

  for (const direction of SPRITE_CONFIG.directions) {
    dirs.push(path.join(PATHS.sprites, "idle", direction));
  }

  for (const dir of dirs) {
    await ensureDir(dir);
  }
}

function getScale(foreground: { width: number; height: number }): number {
  const inner = SPRITE_CONFIG.spriteSize - SPRITE_CONFIG.pixelPadding * 2;
  return Math.min(inner / foreground.width, inner / foreground.height);
}

export async function rasterize(args: {
  input: string;
  referenceScale: number;
  yOffset?: number;
}): Promise<Buffer> {
  const buffer = await fs.readFile(args.input);
  const foreground = await extractForeground(buffer);

  const inner = SPRITE_CONFIG.spriteSize - SPRITE_CONFIG.pixelPadding * 2;
  let scale = args.referenceScale;
  scale = Math.min(
    scale,
    inner / foreground.width,
    inner / foreground.height,
  );

  const targetWidth = Math.max(1, Math.round(foreground.width * scale));
  const targetHeight = Math.max(1, Math.round(foreground.height * scale));

  const { data } = await sharp(foreground.buffer)
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] =
      (data[i + 3] ?? 0) >= SPRITE_CONFIG.alphaThreshold ? 255 : 0;
  }

  const size = SPRITE_CONFIG.spriteSize;
  const canvas = Buffer.alloc(size * size * 4, 0);

  let left = Math.floor((size - targetWidth) / 2);
  let top =
    Math.floor((size - targetHeight) / 2) + (args.yOffset ?? 0);
  left = Math.max(0, Math.min(size - targetWidth, left));
  top = Math.max(0, Math.min(size - targetHeight, top));

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const src = (y * targetWidth + x) * 4;
      const dst = ((top + y) * size + left + x) * 4;
      canvas[dst] = data[src] ?? 0;
      canvas[dst + 1] = data[src + 1] ?? 0;
      canvas[dst + 2] = data[src + 2] ?? 0;
      canvas[dst + 3] = data[src + 3] ?? 0;
    }
  }

  return canvas;
}

function rgbKey(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

function keyToRgb(key: number): RGB {
  return { r: (key >> 16) & 255, g: (key >> 8) & 255, b: key & 255 };
}

function paletteDistance(a: RGB, b: RGB): number {
  return colorDistanceSquared(a.r, a.g, a.b, b.r, b.g, b.b);
}

export function buildGlobalPalette(buffers: Buffer[], wanted: number): RGB[] {
  const histogram = new Map<number, number>();

  for (const buffer of buffers) {
    for (let i = 0; i < buffer.length; i += 4) {
      if ((buffer[i + 3] ?? 0) < SPRITE_CONFIG.alphaThreshold) continue;
      const key = rgbKey(buffer[i] ?? 0, buffer[i + 1] ?? 0, buffer[i + 2] ?? 0);
      histogram.set(key, (histogram.get(key) ?? 0) + 1);
    }
  }

  const entries = [...histogram.entries()]
    .map(([key, count]) => ({ ...keyToRgb(key), count }))
    .sort((a, b) => b.count - a.count);

  if (entries.length <= wanted) {
    return entries.map(({ r, g, b }) => ({ r, g, b }));
  }

  const centers: RGB[] = [
    { r: entries[0]!.r, g: entries[0]!.g, b: entries[0]!.b },
  ];

  while (centers.length < wanted) {
    let best = entries[0]!;
    let bestScore = -Infinity;

    for (const entry of entries) {
      let nearest = Infinity;
      for (const center of centers) {
        nearest = Math.min(nearest, paletteDistance(entry, center));
      }
      const weight = Math.log2(entry.count + 1);
      const score = nearest * weight;
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    centers.push({ r: best.r, g: best.g, b: best.b });
  }

  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centers.map(() => ({ r: 0, g: 0, b: 0, weight: 0 }));
    for (const entry of entries) {
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < centers.length; i++) {
        const distance = paletteDistance(entry, centers[i]!);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      const sum = sums[bestIndex]!;
      sum.r += entry.r * entry.count;
      sum.g += entry.g * entry.count;
      sum.b += entry.b * entry.count;
      sum.weight += entry.count;
    }

    for (let i = 0; i < centers.length; i++) {
      const sum = sums[i]!;
      if (!sum.weight) continue;
      centers[i] = {
        r: Math.round(sum.r / sum.weight),
        g: Math.round(sum.g / sum.weight),
        b: Math.round(sum.b / sum.weight),
      };
    }
  }

  centers.sort((a, b) => a.r + a.g + a.b - (b.r + b.g + b.b));
  return centers;
}

export function applyPalette(input: Buffer, palette: RGB[]): Buffer {
  const output = Buffer.from(input);
  for (let i = 0; i < output.length; i += 4) {
    if ((output[i + 3] ?? 0) < SPRITE_CONFIG.alphaThreshold) {
      output[i] = 0;
      output[i + 1] = 0;
      output[i + 2] = 0;
      output[i + 3] = 0;
      continue;
    }
    const current: RGB = {
      r: output[i] ?? 0,
      g: output[i + 1] ?? 0,
      b: output[i + 2] ?? 0,
    };
    let best = palette[0]!;
    let bestDistance = Infinity;
    for (const color of palette) {
      const distance = paletteDistance(current, color);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = color;
      }
    }
    output[i] = best.r;
    output[i + 1] = best.g;
    output[i + 2] = best.b;
    output[i + 3] = 255;
  }
  return output;
}

export async function writeSprite(
  buffer: Buffer,
  output: string,
): Promise<void> {
  await ensureDir(path.dirname(output));
  await sharp(buffer, {
    raw: {
      width: SPRITE_CONFIG.spriteSize,
      height: SPRITE_CONFIG.spriteSize,
      channels: 4,
    },
  })
    .png()
    .toFile(output);
  await createPreview(output);
}

export async function createPreview(input: string): Promise<void> {
  const parsed = path.parse(input);
  const output = path.join(parsed.dir, `${parsed.name}-preview.png`);
  await sharp(input)
    .resize({
      width: SPRITE_CONFIG.spriteSize * SPRITE_CONFIG.previewScale,
      height: SPRITE_CONFIG.spriteSize * SPRITE_CONFIG.previewScale,
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toFile(output);
}

export async function transformSprite(args: {
  input: string;
  output: string;
  type: "mirror" | "rotate180";
}): Promise<void> {
  await ensureDir(path.dirname(args.output));
  if (args.type === "mirror") {
    await sharp(args.input).flop().png().toFile(args.output);
  } else {
    await sharp(args.input).rotate(180).png().toFile(args.output);
  }
  await createPreview(args.output);
}

export async function getPixelSources(): Promise<SpriteSource[]> {
  const PATHS = spritePaths();

  const sideBuffer = await fs.readFile(PATHS.masterSide);
  const upBuffer = await fs.readFile(PATHS.masterUp);

  const side = await extractForeground(sideBuffer);
  const up = await extractForeground(upBuffer);
  const sideScale = getScale(side);
  const upScale = getScale(up);
  const sources: SpriteSource[] = [];

  sources.push({
    key: "idle:left",
    input: PATHS.masterSide,
    scale: sideScale,
    yOffset: 0,
    output: path.join(PATHS.sprites, "idle", "left", "0.png"),
  });
  sources.push({
    key: "idle:up",
    input: PATHS.masterUp,
    scale: upScale,
    yOffset: 0,
    output: path.join(PATHS.sprites, "idle", "up", "0.png"),
  });

  for (let frame = 0; frame < SPRITE_CONFIG.walkFrames; frame++) {
    sources.push({
      key: `walk:left:${frame}`,
      input: path.join(PATHS.raw, "walk", "left", `${frame}.png`),
      scale: sideScale,
      yOffset: SPRITE_CONFIG.walkBob[frame] ?? 0,
      output: path.join(PATHS.sprites, "walk", "left", `${frame}.png`),
    });
    sources.push({
      key: `walk:up:${frame}`,
      input: path.join(PATHS.raw, "walk", "up", `${frame}.png`),
      scale: upScale,
      yOffset: SPRITE_CONFIG.walkBob[frame] ?? 0,
      output: path.join(PATHS.sprites, "walk", "up", `${frame}.png`),
    });
  }

  for (let frame = 0; frame < SPRITE_CONFIG.attackFrames; frame++) {
    sources.push({
      key: `attack:left:${frame}`,
      input: path.join(PATHS.raw, "attack", "left", `${frame}.png`),
      scale: sideScale,
      yOffset: SPRITE_CONFIG.attackBob[frame] ?? 0,
      output: path.join(PATHS.sprites, "attack", "left", `${frame}.png`),
    });
    sources.push({
      key: `attack:up:${frame}`,
      input: path.join(PATHS.raw, "attack", "up", `${frame}.png`),
      scale: upScale,
      yOffset: SPRITE_CONFIG.attackBob[frame] ?? 0,
      output: path.join(PATHS.sprites, "attack", "up", `${frame}.png`),
    });
  }

  return sources;
}

export async function pixelizeEverything(): Promise<void> {
  const PATHS = spritePaths();
  console.log("");
  console.log("==============================");
  console.log("PIXELIZE + GLOBAL PALETTE");
  console.log("==============================");

  const sources = await getPixelSources();
  for (const source of sources) {
    if (!(await exists(source.input))) {
      throw new Error(`Missing source: ${source.input}`);
    }
  }

  const rasters = new Map<string, Buffer>();
  for (const source of sources) {
    console.log("RASTER:", source.key);
    const buffer = await rasterize({
      input: source.input,
      referenceScale: source.scale,
      yOffset: source.yOffset,
    });
    rasters.set(source.key, buffer);
  }

  const palette = buildGlobalPalette(
    [...rasters.values()],
    SPRITE_CONFIG.paletteSize,
  );

  await fs.writeFile(
    PATHS.palette,
    JSON.stringify(
      {
        size: palette.length,
        colors: palette.map((color) => ({
          ...color,
          hex:
            "#" +
            [color.r, color.g, color.b]
              .map((n) => n.toString(16).padStart(2, "0"))
              .join("")
              .toUpperCase(),
        })),
      },
      null,
      2,
    ),
  );

  for (const source of sources) {
    const raster = rasters.get(source.key)!;
    const quantized = applyPalette(raster, palette);
    await writeSprite(quantized, source.output);
  }

  await transformSprite({
    input: path.join(PATHS.sprites, "idle", "left", "0.png"),
    output: path.join(PATHS.sprites, "idle", "right", "0.png"),
    type: "mirror",
  });
  await transformSprite({
    input: path.join(PATHS.sprites, "idle", "up", "0.png"),
    output: path.join(PATHS.sprites, "idle", "down", "0.png"),
    type: "rotate180",
  });

  for (let frame = 0; frame < SPRITE_CONFIG.walkFrames; frame++) {
    await transformSprite({
      input: path.join(PATHS.sprites, "walk", "left", `${frame}.png`),
      output: path.join(PATHS.sprites, "walk", "right", `${frame}.png`),
      type: "mirror",
    });
    await transformSprite({
      input: path.join(PATHS.sprites, "walk", "up", `${frame}.png`),
      output: path.join(PATHS.sprites, "walk", "down", `${frame}.png`),
      type: "rotate180",
    });
  }

  for (let frame = 0; frame < SPRITE_CONFIG.attackFrames; frame++) {
    await transformSprite({
      input: path.join(PATHS.sprites, "attack", "left", `${frame}.png`),
      output: path.join(PATHS.sprites, "attack", "right", `${frame}.png`),
      type: "mirror",
    });
    await transformSprite({
      input: path.join(PATHS.sprites, "attack", "up", `${frame}.png`),
      output: path.join(PATHS.sprites, "attack", "down", `${frame}.png`),
      type: "rotate180",
    });
  }

  console.log("PIXELIZE DONE");
}

export async function pixelizeMastersOnly(): Promise<void> {
  const PATHS = spritePaths();
  const sideBuffer = await fs.readFile(PATHS.masterSide);
  const upBuffer = await fs.readFile(PATHS.masterUp);

  const side = await extractForeground(sideBuffer);
  const up = await extractForeground(upBuffer);
  const sideScale = getScale(side);
  const upScale = getScale(up);

  const sideRaster = await rasterize({
    input: PATHS.masterSide,
    referenceScale: sideScale,
  });
  const upRaster = await rasterize({
    input: PATHS.masterUp,
    referenceScale: upScale,
  });

  const palette = buildGlobalPalette(
    [sideRaster, upRaster],
    SPRITE_CONFIG.paletteSize,
  );

  const left = path.join(PATHS.sprites, "idle", "left", "0.png");
  const right = path.join(PATHS.sprites, "idle", "right", "0.png");
  const upOutput = path.join(PATHS.sprites, "idle", "up", "0.png");
  const down = path.join(PATHS.sprites, "idle", "down", "0.png");

  await writeSprite(applyPalette(sideRaster, palette), left);
  await writeSprite(applyPalette(upRaster, palette), upOutput);
  await transformSprite({ input: left, output: right, type: "mirror" });
  await transformSprite({ input: upOutput, output: down, type: "rotate180" });

  await buildIdleSheet();
}

export type SpriteRow = {
  animation: "idle" | "walk" | "attack";
  direction: Direction;
  frames: number;
  get: (frame: number) => string;
};

function idleRows(): SpriteRow[] {
  return SPRITE_CONFIG.directions.map(
    (direction): SpriteRow => ({
      animation: "idle",
      direction,
      frames: 1,
      get: () => path.join(spritePaths().sprites, "idle", direction, "0.png"),
    }),
  );
}

function walkRows(): SpriteRow[] {
  return SPRITE_CONFIG.directions.map(
    (direction): SpriteRow => ({
      animation: "walk",
      direction,
      frames: SPRITE_CONFIG.walkFrames,
      get: (frame) =>
        path.join(spritePaths().sprites, "walk", direction, `${frame}.png`),
    }),
  );
}

function attackRows(): SpriteRow[] {
  return SPRITE_CONFIG.directions.map(
    (direction): SpriteRow => ({
      animation: "attack",
      direction,
      frames: SPRITE_CONFIG.attackFrames,
      get: (frame) =>
        path.join(spritePaths().sprites, "attack", direction, `${frame}.png`),
    }),
  );
}

export async function createSheet(args: {
  output: string;
  rows: SpriteRow[];
  columns: number;
}): Promise<void> {
  const PATHS = spritePaths();
  const cell = SPRITE_CONFIG.spriteSize;
  const width = args.columns * cell;
  const height = args.rows.length * cell;
  const composites: Array<{
    input: string;
    left: number;
    top: number;
  }> = [];

  for (let rowIndex = 0; rowIndex < args.rows.length; rowIndex++) {
    const row = args.rows[rowIndex]!;
    for (let frame = 0; frame < row.frames; frame++) {
      const input = row.get(frame);
      if (!(await exists(input))) {
        throw new Error(`Missing sprite: ${input}`);
      }
      composites.push({
        input,
        left: frame * cell,
        top: rowIndex * cell,
      });
    }
  }

  await ensureDir(path.dirname(args.output));

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(args.output);

  const parsed = path.parse(args.output);
  await sharp(args.output)
    .resize({
      width: width * SPRITE_CONFIG.previewScale,
      height: height * SPRITE_CONFIG.previewScale,
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toFile(path.join(parsed.dir, `${parsed.name}-preview.png`));
}

export async function buildIdleSheet(): Promise<void> {
  await createSheet({
    output: path.join(spritePaths().sheets, "idle-sheet.png"),
    rows: idleRows(),
    columns: 1,
  });
}

export async function buildSheets(): Promise<void> {
  const PATHS = spritePaths();
  console.log("");
  console.log("==============================");
  console.log("BUILD SHEETS");
  console.log("==============================");

  await buildIdleSheet();
  await createSheet({
    output: path.join(PATHS.sheets, "walk-sheet.png"),
    rows: walkRows(),
    columns: SPRITE_CONFIG.walkFrames,
  });
  await createSheet({
    output: path.join(PATHS.sheets, "attack-sheet.png"),
    rows: attackRows(),
    columns: SPRITE_CONFIG.attackFrames,
  });

  const allRows = [...idleRows(), ...walkRows(), ...attackRows()];
  await createSheet({
    output: path.join(PATHS.sheets, "spritesheet.png"),
    rows: allRows,
    columns: SPRITE_CONFIG.attackFrames,
  });

  await createManifest(allRows);

  console.log("");
  console.log("FINAL:");
  console.log(path.join(PATHS.sheets, "spritesheet.png"));
}

export async function createManifest(rows: SpriteRow[]): Promise<void> {
  const PATHS = spritePaths();
  const cell = SPRITE_CONFIG.spriteSize;
  const animations: Record<
    string,
    {
      animation: string;
      direction: string;
      loop: boolean;
      fps: number;
      frames: Array<{
        index: number;
        column: number;
        row: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
      events?: Array<{ frame: number; event: string }>;
    }
  > = {};

  rows.forEach((row, rowIndex) => {
    const key = `${row.animation}_${row.direction}`;
    const frames = [];
    for (let frameIndex = 0; frameIndex < row.frames; frameIndex++) {
      frames.push({
        index: frameIndex,
        column: frameIndex,
        row: rowIndex,
        x: frameIndex * cell,
        y: rowIndex * cell,
        width: cell,
        height: cell,
      });
    }
    const isAttack = row.animation === "attack";
    animations[key] = {
      animation: row.animation,
      direction: row.direction,
      loop: !isAttack,
      fps: row.animation === "walk" ? 8 : isAttack ? 10 : 1,
      frames,
    };
    if (isAttack) {
      animations[key]!.events = [{ frame: 3, event: "hit" }];
    }
  });

  const manifest = {
    schemaVersion: 1,
    image: "spritesheet.png",
    format: "fixed-grid",
    transparent: true,
    shadowPolicy: "Shadows, ground shadows and contact shadows are forbidden.",
    frame: { width: cell, height: cell },
    anchor: { x: 0.5, y: 0.5 },
    sheet: {
      columns: SPRITE_CONFIG.attackFrames,
      rows: rows.length,
      width: SPRITE_CONFIG.attackFrames * cell,
      height: rows.length * cell,
    },
    convention: {
      frameOrder: "left-to-right",
      directionOrder: ["down", "left", "right", "up"],
      animationGroupOrder: ["idle", "walk", "attack"],
      derivedDirections: {
        right: "horizontal mirror of left",
        down: "180 degree rotation of up",
      },
    },
    masters: {
      side: {
        file: "../masters/master-side.png",
        canonicalDirection: "left",
      },
      top: {
        file: "../masters/master-up.png",
        canonicalDirection: "up",
      },
    },
    palette: "../palette.json",
    animations,
  };

  await fs.writeFile(
    path.join(PATHS.sheets, "spritesheet.json"),
    JSON.stringify(manifest, null, 2),
  );
}
