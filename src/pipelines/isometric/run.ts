import { ISO_CONFIG } from "./config.ts";
import type { Template } from "../../templates.ts";
import { applyTemplateConfig } from "./prompts.ts";
import { prepareDirectories, isoPaths, spritePath, rawPath } from "./paths.ts";
import { checkServer } from "./api.ts";
import { stage, printSummary, log, formatDuration } from "./log.ts";
import { generateMasters, ensureMasters } from "./masters.ts";
import {
  generateWalk,
  generateAttack,
  generateHitReactions,
  generateDeath,
  generateCorpses,
} from "./animations.ts";
import { pixelizeSelection } from "./pixelize.ts";
import { buildSheets } from "./sheets.ts";
import { DIRECTIONS, CANONICAL_DIRECTIONS, MIRROR_DIRECTION } from "./prompts.ts";

const ISO_MODES = [
  "masters",
  "walk",
  "attack",
  "hit",
  "death",
  "corpses",
  "combat",
  "all",
  "pixelize",
  "sheet",
] as const;
type IsoMode = (typeof ISO_MODES)[number];

const SELECTIONS = {
  masters: {},
  walk: { walk: true },
  attack: { attack: true },
  hit: { hit: true },
  death: { death: true },
  corpses: { corpse: true },
  combat: { attack: true, hit: true, death: true, corpse: true },
  all: { walk: true, attack: true, hit: true, death: true, corpse: true },
};

function printConfig(mode: string, force: boolean): void {
  console.log("======================================");
  console.log("IRON ARCANA ISOMETRIC PIPELINE");
  console.log("======================================");
  console.log(`MODE: ${mode}`);
  console.log(`FORCE: ${force}`);
  console.log(
    `GENERATION: ${ISO_CONFIG.generation.size}x${ISO_CONFIG.generation.size} steps=${ISO_CONFIG.generation.steps} sampler=${ISO_CONFIG.generation.sampler} cfg=${ISO_CONFIG.generation.cfg}`,
  );
  console.log(
    `SPRITE: ${ISO_CONFIG.sprite.size}x${ISO_CONFIG.sprite.size} palette=${ISO_CONFIG.sprite.paletteSize} preview=x${ISO_CONFIG.sprite.previewScale}`,
  );
  console.log(
    `MASTER: attempts=${ISO_CONFIG.master.maxAttempts} refAttempts=${ISO_CONFIG.master.referenceAttempts}`,
  );
  console.log(
    `MASTER PERSPECTIVE QA: mean>=${ISO_CONFIG.master.perspectiveMinMean} changed>=${(ISO_CONFIG.master.perspectiveMinChanged * 100).toFixed(1)}% silhouette>=${(ISO_CONFIG.master.perspectiveMinSilhouette * 100).toFixed(1)}%`,
  );
  console.log(
    `MASTER EAR QA: enabled=${ISO_CONFIG.master.earQAEnabled} maxComponents=${ISO_CONFIG.master.maxEarComponents} minPixels=${ISO_CONFIG.master.minEarComponentPixels}`,
  );
  console.log(
    `MOTION NORMAL: mean>=${ISO_CONFIG.motion.minMean} changed>=${(ISO_CONFIG.motion.minChanged * 100).toFixed(1)}% silhouette>=${(ISO_CONFIG.motion.minSilhouette * 100).toFixed(1)}%`,
  );
  console.log(
    `MOTION CONTACT: mean>=${ISO_CONFIG.motion.contactMean} changed>=${(ISO_CONFIG.motion.contactChanged * 100).toFixed(1)}% silhouette>=${(ISO_CONFIG.motion.contactSilhouette * 100).toFixed(1)}%`,
  );
  console.log(
    `WALK PASSING: mean>=${ISO_CONFIG.motion.walkPassingMean} changed>=${(ISO_CONFIG.motion.walkPassingChanged * 100).toFixed(1)}% silhouette>=${(ISO_CONFIG.motion.walkPassingSilhouette * 100).toFixed(1)}%`,
  );
  console.log(
    `MOTION RETRY: ${ISO_CONFIG.motion.retryWeakPose} attempts=${ISO_CONFIG.motion.maxAttempts}`,
  );
  console.log(
    `HIT: ${ISO_CONFIG.animations.hitVariants}x${ISO_CONFIG.animations.hitFrames} | DEATH: ${ISO_CONFIG.animations.deathFrames} | CORPSES: ${ISO_CONFIG.animations.corpseVariants}`,
  );
  console.log(`CHROMA: ${ISO_CONFIG.chroma.hex}`);
  console.log("API: sdcpp native async jobs");
}

const P = isoPaths();

function pixelizeCtx() {
  return {
    outputDir: ISO_CONFIG.outputDir,
    palettePath: P.palette,
    mirrorDirection: MIRROR_DIRECTION,
    canonicalDirections: CANONICAL_DIRECTIONS,
    masterFrontLeft: P.masterFrontLeft,
    masterBackLeft: P.masterBackLeft,
    rawPath,
    spritePath,
  };
}

function sheetsCtx() {
  return {
    sheetsDir: P.sheets,
    directions: DIRECTIONS,
    spritePath,
    hitVariants: ISO_CONFIG.animations.hitVariants,
    corpseVariants: ISO_CONFIG.animations.corpseVariants,
  };
}

export async function runIsometric(args: {
  mode: string;
  template: Template | null;
  force: boolean;
}): Promise<void> {
  applyTemplateConfig(args.template);

  if (!ISO_MODES.includes(args.mode as IsoMode)) {
    throw new Error(
      `Unknown isometric mode: ${args.mode}. Expected: ${ISO_MODES.join(", ")}`,
    );
  }
  const mode = args.mode as IsoMode;

  await prepareDirectories();
  printConfig(mode, args.force);

  if (mode === "pixelize") {
    await stage("pixelize all", () => pixelizeSelection(SELECTIONS.all, pixelizeCtx()));
    await stage(
      "build sheets + manifest",
      () => buildSheets(SELECTIONS.all, true, sheetsCtx()),
    );
    printSummary();
    return;
  }

  if (mode === "sheet") {
    await stage(
      "build sheets + manifest",
      () => buildSheets(SELECTIONS.all, true, sheetsCtx()),
    );
    printSummary();
    return;
  }

  await stage("server check", checkServer);

  if (mode === "masters") {
    await stage("generate masters", () => generateMasters(args.force));
    await stage("pixelize masters", () => pixelizeSelection(SELECTIONS.masters, pixelizeCtx()));
    await stage("build idle sheet", () => buildSheets(SELECTIONS.masters, false, sheetsCtx()));
    printSummary();
    return;
  }

  if (mode === "all") {
    await stage("generate masters", () => generateMasters(args.force));
  } else {
    await stage("ensure masters", () => ensureMasters());
  }

  if (mode === "walk") {
    await stage("generate walk", () => generateWalk(args.force));
    await stage("pixelize walk", () => pixelizeSelection(SELECTIONS.walk, pixelizeCtx()));
    await stage("build walk sheets", () => buildSheets(SELECTIONS.walk, false, sheetsCtx()));
    printSummary();
    return;
  }

  if (mode === "attack") {
    await stage("generate attack", () => generateAttack(args.force));
    await stage("pixelize attack", () => pixelizeSelection(SELECTIONS.attack, pixelizeCtx()));
    await stage("build attack sheets", () => buildSheets(SELECTIONS.attack, false, sheetsCtx()));
    printSummary();
    return;
  }

  if (mode === "hit") {
    await stage("generate hit reactions", () => generateHitReactions(args.force));
    await stage("pixelize hit", () => pixelizeSelection(SELECTIONS.hit, pixelizeCtx()));
    await stage("build hit sheets", () => buildSheets(SELECTIONS.hit, false, sheetsCtx()));
    printSummary();
    return;
  }

  if (mode === "death") {
    await stage("generate death", () => generateDeath(args.force));
    await stage("pixelize death", () => pixelizeSelection(SELECTIONS.death, pixelizeCtx()));
    await stage("build death sheets", () => buildSheets(SELECTIONS.death, false, sheetsCtx()));
    printSummary();
    return;
  }

  if (mode === "corpses") {
    await stage("generate corpses", () => generateCorpses(args.force));
    await stage("pixelize corpses", () => pixelizeSelection(SELECTIONS.corpses, pixelizeCtx()));
    await stage("build corpse sheets", () => buildSheets(SELECTIONS.corpses, false, sheetsCtx()));
    printSummary();
    return;
  }

  if (mode === "combat") {
    await stage("generate attack", () => generateAttack(args.force));
    await stage("generate hit reactions", () => generateHitReactions(args.force));
    await stage("generate death", () => generateDeath(args.force));
    await stage("generate corpses", () => generateCorpses(args.force));
    await stage("pixelize combat", () => pixelizeSelection(SELECTIONS.combat, pixelizeCtx()));
    await stage("build combat sheets", () => buildSheets(SELECTIONS.combat, false, sheetsCtx()));
    printSummary();
    return;
  }

  // all
  await stage("generate walk", () => generateWalk(args.force));
  await stage("generate attack", () => generateAttack(args.force));
  await stage("generate hit reactions", () => generateHitReactions(args.force));
  await stage("generate death", () => generateDeath(args.force));
  await stage("generate corpses", () => generateCorpses(args.force));
  await stage("pixelize all", () => pixelizeSelection(SELECTIONS.all, pixelizeCtx()));
  await stage(
    "build sheets + manifest",
    () => buildSheets(SELECTIONS.all, true, sheetsCtx()),
  );
  printSummary();
}
