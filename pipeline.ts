#!/usr/bin/env bun

import fs from "node:fs/promises";
import path from "node:path";

type Pipeline = "sprite" | "isometric";

type SpriteMode = "masters" | "animate" | "pixelize" | "sheet" | "all";

type IsometricMode =
  | "masters"
  | "walk"
  | "attack"
  | "hit"
  | "death"
  | "corpses"
  | "combat"
  | "all"
  | "pixelize"
  | "sheet";

type PipelineMode = SpriteMode | IsometricMode;

type Options = {
  pipeline: Pipeline;
  templatePath: string;
  mode: PipelineMode;
  force: boolean;
};

const ROOT = process.cwd();

const LEGACY_SCRIPT: Record<Pipeline, `${string}.mjs`> = {
  sprite: "sprite-pipeline.mjs",
  isometric: "sprite-pipeline-isometric.mjs",
};

const TEMPLATE_DIR: Record<Pipeline, string> = {
  sprite: path.join(ROOT, "templates", "sprite"),
  isometric: path.join(ROOT, "templates", "isometric"),
};

const VALID_MODES: Record<Pipeline, readonly PipelineMode[]> = {
  sprite: ["masters", "animate", "pixelize", "sheet", "all"],
  isometric: [
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
  ],
} as const;

function usage(): void {
  const spriteModes = VALID_MODES.sprite.join("|");
  const isoModes = VALID_MODES.isometric.join("|");

  console.log(`Usage:

  bun run pipeline.ts sprite <template> <mode> [--force]
  mode: ${spriteModes}

  bun run pipeline.ts isometric <template> <mode> [--force]
  mode: ${isoModes}

Template values:
- common: base
- or a custom path to any .json file
`);
}

function parseArgs(argv: string[]): Options {
  const [pipelineArg, templateArg, modeArg, ...flags] = argv;

  if (!pipelineArg || !templateArg || !modeArg) {
    usage();
    throw new Error("Expected: <pipeline> <template> <mode> [--force]");
  }

  if (flags.length > 1 || (flags[0] && flags[0] !== "--force")) {
    usage();
    throw new Error("Unknown flag: only --force is supported");
  }

  if (!isPipeline(pipelineArg)) {
    usage();
    throw new Error(`Unknown pipeline: ${pipelineArg}`);
  }

  const force = flags[0] === "--force";

  if (!isModeForPipeline(pipelineArg, modeArg)) {
    usage();
    throw new Error(`Mode ${modeArg} is not valid for pipeline ${pipelineArg}`);
  }

  return {
    pipeline: pipelineArg,
    templatePath: templateArg,
    mode: modeArg,
    force,
  };
}

function isPipeline(value: string): value is Pipeline {
  return value === "sprite" || value === "isometric";
}

function isModeForPipeline(
  pipeline: Pipeline,
  mode: string,
): mode is PipelineMode {
  return VALID_MODES[pipeline].includes(mode as PipelineMode);
}

function isExplicitPath(templateArg: string): boolean {
  return templateArg.endsWith(".json") && !templateArg.includes(" ");
}

async function resolveTemplate(pipeline: Pipeline, templateArg: string): Promise<string> {
  const normalized = isExplicitPath(templateArg)
    ? path.resolve(ROOT, templateArg)
    : path.join(TEMPLATE_DIR[pipeline], `${templateArg}.json`);

  await fs.access(normalized);

  return normalized;
}

function runLegacy(
  pipeline: Pipeline,
  mode: PipelineMode,
  templatePath: string,
  force: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = path.join(ROOT, LEGACY_SCRIPT[pipeline]);
    const args = [script, mode, "--template", templatePath];

    if (force) {
      args.push("--force");
    }

    const proc = Bun.spawn({
      cmd: ["node", ...args],
      cwd: ROOT,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });

    proc.exited
      .then((code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Legacy pipeline exited with code ${code}`));
        }
      })
      .catch(reject);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const templatePath = await resolveTemplate(options.pipeline, options.templatePath);

  console.log(
    `Running ${options.pipeline} pipeline using template: ${path.relative(ROOT, templatePath)}`,
  );

  await runLegacy(options.pipeline, options.mode, templatePath, options.force);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
