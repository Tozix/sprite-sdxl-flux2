import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

function extractFunction(source, name) {
  const start = source.indexOf(`async function ${name}(`);
  const headerEnd = source.indexOf(")", start);

  if (start === -1 || headerEnd === -1) {
    return undefined;
  }

  const body = source.indexOf("{", headerEnd);

  if (body === -1) {
    return undefined;
  }

  let depth = 0;

  for (let i = body; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
}

test("reuses an anatomy-clean cached frame even when motion is below threshold", async () => {
  const source = await fs.readFile("sprite-pipeline-isometric.mjs", "utf8");
  let generated = false;
  const context = {
    FORCE: false,
    CONFIG: { motion: { maxAttempts: 1 }, generation: { retrySeedOffset: 1 } },
    getSourceAIPath: () => "cached.png",
    exists: async () => true,
    normalizeChroma: async () => {},
    calculateForegroundGeometry: async () => ({ width: 10, height: 10, area: 100 }),
    isSizeStable: () => ({ ok: true }),
    validateAnatomyArtifacts: async () => ({ ok: true }),
    calculateMotionScore: async () => ({ meanDifference: 5.91, changedFraction: 0.037 }),
    motionTooSmall: () => true,
    animationPrompt: () => "prompt",
    runNativeImageJob: async () => {
      generated = true;
      return Buffer.alloc(0);
    },
    saveGeneratedBuffer: async () => {},
    console: { log() {}, warn() {} },
    path,
  };

  vm.createContext(context);
  vm.runInContext(`${extractFunction(source, "generateMotionFrame")}; this.run = generateMotionFrame`, context);
  await context.run({ compareTo: "reference.png", output: "frame.png" });

  assert.equal(generated, false);
});

test("uses anatomy-clean frame when motion retries are exhausted", async () => {
  const source = await fs.readFile("sprite-pipeline-isometric.mjs", "utf8");
  let generated = 0;
  const warn = [];

  const context = {
    FORCE: false,
    CONFIG: {
      motion: {
        maxAttempts: 3,
      },
      generation: {
        retrySeedOffset: 1,
      },
    },
    getSourceAIPath: () => "source.png",
    exists: async () => false,
    normalizeChroma: async () => {},
    calculateForegroundGeometry: async () => ({ width: 10, height: 10, area: 100 }),
    isSizeStable: () => ({ ok: true }),
    validateAnatomyArtifacts: async () => ({ ok: true }),
    calculateMotionScore: async () => ({
      meanDifference: 5.91,

      changedFraction: 0.043,
    }),
    motionTooSmall: () => true,
    animationPrompt: () => "prompt",
    runNativeImageJob: async () => {
      generated++;

      return Buffer.alloc(0);
    },
    saveGeneratedBuffer: async () => {},
    console: {
      log() {},
      warn(...args) {
        warn.push(args);
      },
    },
    path,
  };

  vm.createContext(context);
  vm.runInContext(
    `${extractFunction(source, "generateMotionFrame")}; this.run = generateMotionFrame`,
    context,
  );

  await context.run({
    reference: "reference.png",
    compareTo: "reference.png",
    posePrompt: "pose",
    direction: "southwest",
    seed: 1,
    output: "frame.png",
  });

  assert.equal(generated, 3);
  assert.ok(
    warn.some((args) =>
      args[0].includes("MOTION VALIDATION EXHAUSTED - using last anatomy-clean frame:"),
    ),
  );
});

test("regenerates when cached motion frame drifts in size", async () => {
  const source = await fs.readFile("sprite-pipeline-isometric.mjs", "utf8");
  let generated = 0;

  const context = {
    FORCE: false,
    CONFIG: {
      motion: {
        maxAttempts: 2,
      },
      generation: {
        retrySeedOffset: 1,
      },
    },
    getSourceAIPath: () => "cached.png",
    exists: async () => true,
    normalizeChroma: async () => {},
    calculateForegroundGeometry: async () => ({ width: 10, height: 10, area: 100 }),
    isSizeStable: () => ({ ok: false, reason: "size drift" }),
    validateAnatomyArtifacts: async () => ({ ok: true }),
    calculateMotionScore: async () => ({ meanDifference: 10, changedFraction: 0.3 }),
    motionTooSmall: () => false,
    animationPrompt: () => "prompt",
    runNativeImageJob: async () => {
      generated++;

      return Buffer.alloc(0);
    },
    saveGeneratedBuffer: async () => {},
    console: { log() {}, warn() {} },
    path,
  };

  vm.createContext(context);
  vm.runInContext(`${extractFunction(source, "generateMotionFrame")}; this.run = generateMotionFrame`, context);

  await context.run({ compareTo: "reference.png", output: "frame.png" });

  assert.equal(generated, 2);
});

test("marks idle isometric sources as palette seeds", async () => {
  const source = await fs.readFile("sprite-pipeline-isometric.mjs", "utf8");

  const context = {
    CONFIG: {
      walkFrames: 4,

      attackFrames: 3,

      walkBob: [0, 0, 0, 0, 0, 0],

      attackBob: [0, 0, 0, 0, 0, 0],
    },

    PATHS: {
      masterFrontLeft: "masters/front.png",

      masterBackLeft: "masters/back.png",

      raw: "raw",

      sprites: "sprites",
    },

    extractForeground: async () => ({
      width: 10,

      height: 10,
    }),

    getScale: () => 1,

    path,
  };

  vm.createContext(context);

  vm.runInContext(
    `${extractFunction(source, "getPixelSources")}; this.run = getPixelSources`,
    context,
  );

  const sources = await context.run();

  const paletteSeeds = sources.filter((source) => source.paletteSeed);

  assert.equal(paletteSeeds.length, 2);

  assert.equal(sources[0].paletteSeed, true);

  assert.equal(sources[1].paletteSeed, true);

  const nonSeedEntries = sources

    .slice(2)

    .filter((source) => source.paletteSeed);

  assert.equal(nonSeedEntries.length, 0);
});
