import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ISO_CONFIG } from "./config.ts";
import { ensureDir, exists } from "./fs.ts";

export type Row = {
  animation: string;
  variant: number | null;
  direction: string;
  frames: number;
  get: (frame: number) => string;
};

export function buildRows(
  selection: {
    walk?: boolean;
    attack?: boolean;
    hit?: boolean;
    death?: boolean;
    corpse?: boolean;
  },
  ctx: {
    directions: readonly string[];
    spritePath: (
      animation: string,
      direction: string,
      frame?: number,
      variant?: number | null,
    ) => string;
  },
): Row[] {
  const rows: Row[] = [];

  function add(animation: string, frames: number, variant: number | null = null): void {
    for (const direction of ctx.directions) {
      rows.push({
        animation,
        variant,
        direction,
        frames,
        get: (frame) => ctx.spritePath(animation, direction, frame, variant),
      });
    }
  }

  add("idle", 1);

  if (selection.walk) add("walk", ISO_CONFIG.animations.walkFrames);
  if (selection.attack) add("attack", ISO_CONFIG.animations.attackFrames);

  if (selection.hit) {
    for (let variant = 0; variant < ISO_CONFIG.animations.hitVariants; variant++) {
      add("hit", ISO_CONFIG.animations.hitFrames, variant);
    }
  }

  if (selection.death) add("death", ISO_CONFIG.animations.deathFrames);

  if (selection.corpse) {
    for (let variant = 0; variant < ISO_CONFIG.animations.corpseVariants; variant++) {
      add("corpse", 1, variant);
    }
  }

  return rows;
}

export async function createSheet(
  output: string,
  rows: Row[],
): Promise<{ columns: number; rows: number; width: number; height: number } | null> {
  if (!rows.length) return null;

  const cell = ISO_CONFIG.sprite.size;
  const columns = Math.max(...rows.map((row) => row.frames));
  const width = columns * cell;
  const height = rows.length * cell;
  const composites: Array<{ input: string; left: number; top: number }> = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
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

  await ensureDir(path.dirname(output));

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
    .toFile(output);

  const parsed = path.parse(output);
  await sharp(output)
    .resize(
      width * ISO_CONFIG.sprite.previewScale,
      height * ISO_CONFIG.sprite.previewScale,
      { kernel: sharp.kernel.nearest },
    )
    .png()
    .toFile(path.join(parsed.dir, `${parsed.name}-preview.png`));

  return { columns, rows: rows.length, width, height };
}

export async function createManifest(
  rows: Row[],
  sheetInfo: { columns: number; rows: number; width: number; height: number } | null,
  ctx: {
    sheetsDir: string;
    directions: readonly string[];
    hitVariants: number;
    corpseVariants: number;
  },
): Promise<void> {
  const cell = ISO_CONFIG.sprite.size;
  const animations: Record<
    string,
    {
      animation: string;
      variant: number | null;
      direction: string;
      loop: boolean;
      fps: number;
      frames: Array<{
        index: number;
        row: number;
        column: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
      events?: Array<{ frame: number; event: string }>;
    }
  > = {};

  rows.forEach((row, rowIndex) => {
    const animationName =
      row.variant === null ? row.animation : `${row.animation}_${row.variant}`;
    const key = `${animationName}_${row.direction}`;
    const entry = {
      animation: row.animation,
      variant: row.variant,
      direction: row.direction,
      loop: ["idle", "walk"].includes(row.animation),
      fps:
        row.animation === "walk"
          ? 8
          : row.animation === "attack"
            ? 10
            : row.animation === "hit"
              ? 12
              : row.animation === "death"
                ? 8
                : 1,
      frames: Array.from({ length: row.frames }, (_, frame) => ({
        index: frame,
        row: rowIndex,
        column: frame,
        x: frame * cell,
        y: rowIndex * cell,
        width: cell,
        height: cell,
      })),
    };
    animations[key] = entry;

    if (row.animation === "attack") {
      entry.events = [{ frame: Math.min(3, row.frames - 1), event: "hit" }];
    }
    if (row.animation === "death") {
      entry.events = [{ frame: row.frames - 1, event: "dead" }];
    }
    if (row.animation === "hit") {
      entry.events = [{ frame: 0, event: "damage-reaction-start" }];
    }
    if (row.animation === "corpse") {
      entry.events = [{ frame: 0, event: "corpse" }];
    }
  });

  const manifest = {
    schemaVersion: 8,
    assetType: "creature",
    projection: "isometric-2to1",
    engineTarget: "Phaser 4",
    image: "spritesheet.png",
    sourcePipeline: {
      server: ISO_CONFIG.server,
      generation: {
        width: ISO_CONFIG.generation.size,
        height: ISO_CONFIG.generation.size,
        steps: ISO_CONFIG.generation.steps,
        sampler: ISO_CONFIG.generation.sampler,
        cfg: ISO_CONFIG.generation.cfg,
      },
      chroma: ISO_CONFIG.chroma.hex,
      masterBackStrategy:
        "front appearance ref first; perspective QA; ear QA; automatic no-ref fallback",
      walkPassingStrategy:
        "passing frames generated directly from master and validated against both contact poses",
    },
    frame: { width: cell, height: cell },
    sheet: sheetInfo,
    directionOrder: ctx.directions,
    canonicalDirections: {
      southwest: {
        source: "ai",
        facing: "screen-lower-left-front-side",
      },
      northwest: {
        source: "ai",
        facing: "screen-upper-left-back-side",
      },
      southeast: {
        source: "mirror",
        derivedFrom: "southwest",
      },
      northeast: {
        source: "mirror",
        derivedFrom: "northwest",
      },
    },
    variants: {
      hit: ctx.hitVariants,
      corpse: ctx.corpseVariants,
    },
    walkCycle: {
      0: "contact-a",
      1: "passing-a",
      2: "contact-b",
      3: "passing-b",
    },
    anatomyPolicy: {
      ears: "exactly two",
      thirdEar: "forbidden",
      extraEar: "forbidden",
      detachedPaw: "forbidden",
      duplicateLimb: "forbidden",
      tail: "exactly one continuous flesh-pink tail",
      ringedTail: "forbidden",
      stripedTail: "forbidden",
    },
    damagePolicy: {
      hit: "non-gory reaction",
      death: "restrained blood/wounds",
      corpse: "restrained blood/wounds; no dismemberment",
    },
    animations,
  };

  await fs.writeFile(
    path.join(ctx.sheetsDir, "spritesheet.json"),
    JSON.stringify(manifest, null, 2),
  );
}

export async function buildSheets(
  selection: Parameters<typeof buildRows>[0],
  full: boolean,
  ctx: {
    sheetsDir: string;
    directions: readonly string[];
    spritePath: (
      animation: string,
      direction: string,
      frame?: number,
      variant?: number | null,
    ) => string;
    hitVariants: number;
    corpseVariants: number;
  },
): Promise<void> {
  const rows = buildRows(selection, ctx);
  const groups: Array<[string, (row: Row) => boolean]> = [
    ["idle", (row) => row.animation === "idle"],
    ["walk", (row) => row.animation === "walk"],
    ["attack", (row) => row.animation === "attack"],
    ["death", (row) => row.animation === "death"],
  ];

  for (const [name, filter] of groups) {
    const groupRows = rows.filter(filter);
    if (groupRows.length) {
      await createSheet(path.join(ctx.sheetsDir, `${name}-sheet.png`), groupRows);
    }
  }

  if (selection.hit) {
    for (let variant = 0; variant < ctx.hitVariants; variant++) {
      await createSheet(
        path.join(ctx.sheetsDir, `hit-${variant}-sheet.png`),
        rows.filter((row) => row.animation === "hit" && row.variant === variant),
      );
    }
  }

  if (selection.corpse) {
    for (let variant = 0; variant < ctx.corpseVariants; variant++) {
      await createSheet(
        path.join(ctx.sheetsDir, `corpse-${variant}-sheet.png`),
        rows.filter((row) => row.animation === "corpse" && row.variant === variant),
      );
    }
  }

  if (full) {
    const sheetInfo = await createSheet(
      path.join(ctx.sheetsDir, "spritesheet.png"),
      rows,
    );
    await createManifest(rows, sheetInfo, {
      sheetsDir: ctx.sheetsDir,
      directions: ctx.directions,
      hitVariants: ctx.hitVariants,
      corpseVariants: ctx.corpseVariants,
    });
  }
}
