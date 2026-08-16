import path from "node:path";
import { ISO_CONFIG } from "./config.ts";
import { DIRECTIONS } from "./prompts.ts";
import { ensureDir } from "./fs.ts";

export function isoPaths() {
  return {
    outputDir: ISO_CONFIG.outputDir,
    sourceAI: path.join(ISO_CONFIG.outputDir, "source-ai"),
    masters: path.join(ISO_CONFIG.outputDir, "masters"),
    raw: path.join(ISO_CONFIG.outputDir, "raw"),
    sprites: path.join(ISO_CONFIG.outputDir, "sprites"),
    sheets: path.join(ISO_CONFIG.outputDir, "sheets"),
    masterFrontLeft: path.join(
      ISO_CONFIG.outputDir,
      "masters",
      "master-front-left.png",
    ),
    masterBackLeft: path.join(
      ISO_CONFIG.outputDir,
      "masters",
      "master-back-left.png",
    ),
    palette: path.join(ISO_CONFIG.outputDir, "palette.json"),
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
