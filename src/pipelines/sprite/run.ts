import fs from "node:fs/promises";
import path from "node:path";
import { SPRITE_CONFIG } from "./config.ts";
import {
  exists,
  ensureDir,
  checkServer,
  requestEdit,
  requestGenerate,
} from "./api.ts";
import { analyzeImage } from "./image.ts";
import {
  spritePaths,
  prepareDirectories,
  pixelizeEverything,
  pixelizeMastersOnly,
  buildSheets,
} from "./pixelize.ts";
import {
  MASTER_SIDE_PROMPT,
  MASTER_UP_PROMPT,
  applyTemplatePrompts,
} from "./prompts.ts";
import { walkPrompt, attackPrompt, buildPrompt } from "./animation.ts";
import type { Template } from "../../templates.ts";

async function generateSafe(args: {
  type: "generate" | "edit";
  reference?: string;
  prompt: string;
  seed: number;
  output: string;
  force: boolean;
}): Promise<void> {
  if (!args.force && (await exists(args.output))) {
    const cached = await analyzeImage(await fs.readFile(args.output));
    if (!cached.hasShadow) {
      console.log("CACHE:", args.output);
      return;
    }
    console.log("SHADOW FOUND IN CACHE:", args.output);
    console.log("Regenerating...");
  }

  for (
    let attempt = 0;
    attempt < SPRITE_CONFIG.shadow.maxGenerateAttempts;
    attempt++
  ) {
    const attemptSeed = args.seed + attempt * 7919;

    console.log("");
    console.log(`${args.type.toUpperCase()} ${args.output}`);
    console.log("seed:", attemptSeed);
    console.log("attempt:", attempt + 1);

    let attemptPrompt = args.prompt;
    if (attempt > 0) {
      attemptPrompt += `

CRITICAL RETRY CORRECTION:

The previous generation contained an unwanted ground/contact shadow.

THIS RETRY MUST HAVE ABSOLUTELY ZERO SHADOW.

There must not be even a single gray horizontal patch underneath
the creature.

Every pixel outside the rat silhouette must be the exact same flat
background color.
`;
    }

    if (args.type === "generate") {
      await requestGenerate({
        prompt: attemptPrompt,
        seed: attemptSeed,
        output: args.output,
      });
    } else {
      await requestEdit({
        reference: args.reference!,
        prompt: attemptPrompt,
        seed: attemptSeed,
        output: args.output,
      });
    }

    const analysis = await analyzeImage(await fs.readFile(args.output));
    if (!analysis.hasShadow) return;

    console.warn("Possible shadow artifact detected:", args.output);
    if (attempt + 1 >= SPRITE_CONFIG.shadow.maxGenerateAttempts) {
      console.warn("Maximum retry count reached.");
      console.warn("Postprocessor will attempt to remove detached shadow.");
      return;
    }
  }
}

export async function generateMasters(args: {
  force: boolean;
}): Promise<void> {
  const PATHS = spritePaths();
  console.log("");
  console.log("==============================");
  console.log("MASTERS");
  console.log("==============================");

  await generateSafe({
    type: "generate",
    prompt: MASTER_SIDE_PROMPT,
    seed: SPRITE_CONFIG.seeds.masterSide,
    output: PATHS.masterSide,
    force: args.force,
  });
  await generateSafe({
    type: "edit",
    reference: PATHS.masterSide,
    prompt: buildPrompt(MASTER_UP_PROMPT),
    seed: SPRITE_CONFIG.seeds.masterUp,
    output: PATHS.masterUp,
    force: args.force,
  });
}

export async function generateWalk(args: {
  force: boolean;
}): Promise<void> {
  const PATHS = spritePaths();
  console.log("");
  console.log("==============================");
  console.log("WALK");
  console.log("==============================");

  for (let frame = 0; frame < SPRITE_CONFIG.walkFrames; frame++) {
    await generateSafe({
      type: "edit",
      reference: PATHS.masterSide,
      prompt: walkPrompt("side", frame),
      seed: SPRITE_CONFIG.seeds.walkSide + frame,
      output: path.join(PATHS.raw, "walk", "left", `${frame}.png`),
      force: args.force,
    });
    await generateSafe({
      type: "edit",
      reference: PATHS.masterUp,
      prompt: walkPrompt("up", frame),
      seed: SPRITE_CONFIG.seeds.walkUp + frame,
      output: path.join(PATHS.raw, "walk", "up", `${frame}.png`),
      force: args.force,
    });
  }
}

export async function generateAttack(args: {
  force: boolean;
}): Promise<void> {
  const PATHS = spritePaths();
  console.log("");
  console.log("==============================");
  console.log("ATTACK");
  console.log("==============================");

  for (let frame = 0; frame < SPRITE_CONFIG.attackFrames; frame++) {
    await generateSafe({
      type: "edit",
      reference: PATHS.masterSide,
      prompt: attackPrompt("side", frame),
      seed: SPRITE_CONFIG.seeds.attackSide + frame,
      output: path.join(PATHS.raw, "attack", "left", `${frame}.png`),
      force: args.force,
    });
    await generateSafe({
      type: "edit",
      reference: PATHS.masterUp,
      prompt: attackPrompt("up", frame),
      seed: SPRITE_CONFIG.seeds.attackUp + frame,
      output: path.join(PATHS.raw, "attack", "up", `${frame}.png`),
      force: args.force,
    });
  }
}

export async function generateAnimations(args: {
  force: boolean;
}): Promise<void> {
  const PATHS = spritePaths();
  if (
    !(await exists(PATHS.masterSide)) ||
    !(await exists(PATHS.masterUp))
  ) {
    throw new Error("Masters missing. Run: sprite mode=masters");
  }
  await generateWalk(args);
  await generateAttack(args);
}

const SPRITE_MODES = ["masters", "animate", "pixelize", "sheet", "all"] as const;
type SpriteMode = (typeof SPRITE_MODES)[number];

export async function runSprite(args: {
  mode: string;
  template: Template | null;
  force: boolean;
}): Promise<void> {
  applyTemplatePrompts(args.template);

  if (!SPRITE_MODES.includes(args.mode as SpriteMode)) {
    throw new Error(
      `Unknown sprite mode: ${args.mode}. Expected: ${SPRITE_MODES.join(", ")}`,
    );
  }
  const mode = args.mode as SpriteMode;

  await prepareDirectories();

  console.log("");
  console.log("MODE:", mode);
  console.log("FORCE:", args.force);
  console.log("SPRITE:", `${SPRITE_CONFIG.spriteSize}x${SPRITE_CONFIG.spriteSize}`);
  console.log("PALETTE:", SPRITE_CONFIG.paletteSize);

  if (mode === "masters") {
    await checkServer();
    await generateMasters({ force: args.force });
    await pixelizeMastersOnly();
    return;
  }

  if (mode === "animate") {
    await checkServer();
    await generateAnimations({ force: args.force });
    await pixelizeEverything();
    await buildSheets();
    return;
  }

  if (mode === "pixelize") {
    await pixelizeEverything();
    await buildSheets();
    return;
  }

  if (mode === "sheet") {
    await buildSheets();
    return;
  }

  await checkServer();
  await generateMasters({ force: args.force });
  await generateAnimations({ force: args.force });
  await pixelizeEverything();
  await buildSheets();
}
