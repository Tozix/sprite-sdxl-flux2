#!/usr/bin/env bun

import path from "node:path";
import fs from "node:fs/promises";
import {
  loadTemplate,
  type Template,
} from "./templates.ts";

type Pipeline = "sprite" | "isometric";

const VALID_MODES = {
  sprite: ["masters", "animate", "pixelize", "sheet", "all"] as const,
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
  ] as const,
} as const;

function usage(): void {
  console.log(`Usage:

  bun run src/cli.ts sprite <template> <mode> [--force]
  mode: ${VALID_MODES.sprite.join("|")}

  bun run src/cli.ts isometric <template> <mode> [--force] [--mob <name>]
  mode: ${VALID_MODES.isometric.join("|")}

Template values:
- common: base (loaded from templates/<pipeline>/base.json)
- or a custom path to any .json file

--mob <name> (isometric only):
- loads templates/isometric/mobs/<name>.json on top of the base template
- mobs: rat, spider, slime
`);
}

function isPipeline(value: string): value is Pipeline {
  return value === "sprite" || value === "isometric";
}

function isModeForPipeline(
  pipeline: Pipeline,
  mode: string,
): mode is (typeof VALID_MODES)[Pipeline][number] {
  return (VALID_MODES[pipeline] as readonly string[]).includes(mode);
}

function isExplicitPath(arg: string): boolean {
  return arg.endsWith(".json") && !arg.includes(" ");
}

async function resolveTemplate(
  pipeline: Pipeline,
  arg: string,
): Promise<string> {
  const candidate = isExplicitPath(arg)
    ? path.resolve(process.cwd(), arg)
    : path.join(process.cwd(), "templates", pipeline, `${arg}.json`);

  await fs.access(candidate);
  return candidate;
}

type Options = {
  pipeline: Pipeline;
  templatePath: string;
  mode: string;
  force: boolean;
  mob: string | null;
};

function parseArgs(argv: string[]): Options {
  const [pipelineArg, templateArg, modeArg, ...rest] = argv;

  if (!pipelineArg || !templateArg || !modeArg) {
    usage();
    throw new Error("Expected: <pipeline> <template> <mode> [--force] [--mob <name>]");
  }

  let force = false;
  let mob: string | null = null;

  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i]!;
    if (flag === "--force") {
      force = true;
    } else if (flag === "--mob") {
      const value = rest[i + 1];
      if (!value || value.startsWith("--")) {
        usage();
        throw new Error("Missing value after --mob");
      }
      mob = value;
      i += 1;
    } else {
      usage();
      throw new Error("Unknown flag: only --force and --mob are supported");
    }
  }

  if (!isPipeline(pipelineArg)) {
    usage();
    throw new Error(`Unknown pipeline: ${pipelineArg}`);
  }

  if (!isModeForPipeline(pipelineArg, modeArg)) {
    usage();
    throw new Error(
      `Mode ${modeArg} is not valid for pipeline ${pipelineArg}`,
    );
  }

  if (mob && pipelineArg !== "isometric") {
    usage();
    throw new Error("--mob is only supported for the isometric pipeline");
  }

  return {
    pipeline: pipelineArg,
    templatePath: templateArg,
    mode: modeArg,
    force,
    mob,
  };
}

async function runPipeline(options: Options): Promise<void> {
  const resolvedPath = await resolveTemplate(
    options.pipeline,
    options.templatePath,
  );

  console.log(
    `Running ${options.pipeline} pipeline using template: ${path.relative(process.cwd(), resolvedPath)}`,
  );

  let template: Template | null = await loadTemplate(resolvedPath);

  if (options.pipeline === "isometric" && options.mob) {
    const mobPath = path.join(
      process.cwd(),
      "templates",
      "isometric",
      "mobs",
      `${options.mob}.json`,
    );
    const mobTemplate = await loadTemplate(mobPath);
    if (mobTemplate) {
      template = { ...template, ...mobTemplate };
      console.log(
        `Mob: ${options.mob} (merged templates/isometric/mobs/${options.mob}.json)`,
      );
    }
  }

  if (options.pipeline === "sprite") {
    const { runSprite } = await import("./pipelines/sprite/run.ts");
    await runSprite({
      mode: options.mode,
      template,
      force: options.force,
    });
    return;
  }

  const { runIsometric } = await import("./pipelines/isometric/run.ts");
  await runIsometric({
    mode: options.mode,
    template,
    force: options.force,
  });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [pipelineArg] = argv;

  if (!pipelineArg || pipelineArg === "--help" || pipelineArg === "-h") {
    usage();
    return;
  }

  if (pipelineArg === "test") {
    const tests = await import("./test/sprite.test.ts");
    await tests.runSpriteTests();
    return;
  }

  const options = parseArgs(argv);
  await runPipeline(options);
}

main().catch((error: unknown) => {
  console.error("");
  console.error("==============================");
  console.error("PIPELINE FAILED");
  console.error("==============================");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
