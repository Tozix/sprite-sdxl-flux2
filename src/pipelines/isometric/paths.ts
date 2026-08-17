import path from "node:path";
import { ISO_CONFIG } from "./config.ts";
import { DIRECTIONS, MOB_NAME } from "./prompts.ts";
import { ensureDir } from "./fs.ts";

export function mobOutputDir(): string {
  return path.join(ISO_CONFIG.outputDir, MOB_NAME);
}

export function isoPaths() {
  const outputDir = mobOutputDir();
  return {
    outputDir,
    sourceAI: path.join(outputDir, "source-ai"),
    masters: path.join(outputDir, "masters"),
    raw: path.join(outputDir, "raw"),
    sprites: path.join(outputDir, "sprites"),
    sheets: path.join(outputDir, "sheets"),
    masterFrontLeft: path.join(
      outputDir,
      "masters",
      "master-front-left.png",
    ),
    masterBackLeft: path.join(
      outputDir,
      "masters",
      "master-back-left.png",
    ),
    palette: path.join(outputDir, "palette.json"),
  };
}

export function rawPath(
  animation: string,
  direction: string,
  frame: number = 0,
  variant: number | null = null,
): string {
  return variant === null
    ? path.join(isoPaths().raw, animation, direction, `${frame}.png`)
    : path.join(
        isoPaths().raw,
        animation,
        `variant-${variant}`,
        direction,
        `${frame}.png`,
      );
}

export function spritePath(
  animation: string,
  direction: string,
  frame: number = 0,
  variant: number | null = null,
): string {
  return variant === null
    ? path.join(isoPaths().sprites, animation, direction, `${frame}.png`)
    : path.join(
        isoPaths().sprites,
        animation,
        `variant-${variant}`,
        direction,
        `${frame}.png`,
      );
}

export function masterForDirection(direction: string): string {
  return direction === "southwest"
    ? isoPaths().masterFrontLeft
    : isoPaths().masterBackLeft;
}

export async function prepareDirectories(): Promise<void> {
  const P = isoPaths();
  const dirs = [
    P.sourceAI,
    P.masters,
    P.raw,
    P.sprites,
    P.sheets,
    path.join(P.sourceAI, "masters"),
  ];

  for (const animation of ["walk", "attack", "death"]) {
    for (const direction of DIRECTIONS) {
      dirs.push(path.join(P.raw, animation, direction));
      dirs.push(path.join(P.sprites, animation, direction));
      dirs.push(path.join(P.sourceAI, "raw", animation, direction));
    }
  }

  for (let variant = 0; variant < ISO_CONFIG.animations.hitVariants; variant++) {
    for (const direction of DIRECTIONS) {
      dirs.push(path.join(P.raw, "hit", `variant-${variant}`, direction));
      dirs.push(path.join(P.sprites, "hit", `variant-${variant}`, direction));
      dirs.push(
        path.join(P.sourceAI, "raw", "hit", `variant-${variant}`, direction),
      );
    }
  }

  for (let variant = 0; variant < ISO_CONFIG.animations.corpseVariants; variant++) {
    for (const direction of DIRECTIONS) {
      dirs.push(path.join(P.raw, "corpse", `variant-${variant}`, direction));
      dirs.push(path.join(P.sprites, "corpse", `variant-${variant}`, direction));
      dirs.push(
        path.join(P.sourceAI, "raw", "corpse", `variant-${variant}`, direction),
      );
    }
  }

  for (const direction of DIRECTIONS) {
    dirs.push(path.join(P.sprites, "idle", direction));
  }

  for (const dir of dirs) {
    await ensureDir(dir);
  }
}
