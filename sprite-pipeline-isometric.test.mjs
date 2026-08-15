import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

function extractFunction(source, name) {
  const start =
    source.indexOf(`async function ${name}(`) !== -1
      ? source.indexOf(`async function ${name}(`)
      : source.indexOf(`function ${name}(`);
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
    sourceAIPath: () => "cached.png",
    relativeLabel: (value) => value,
    exists: async () => true,
    differenceString: (score) =>
      `mean=${score.meanDifference} changed=${score.changedFraction} silhouette=${score.silhouetteFraction}`,
    normalizeChroma: async () => ({ mattePixels: 0, color: null }),
    calculateForegroundGeometry: async () => ({ width: 10, height: 10, area: 100 }),
    isSizeStable: () => ({ ok: true }),
    validateAnatomyArtifacts: async () => ({ ok: true }),
    calculateImageDifference: async () => ({
      meanDifference: 5.91,

      changedFraction: 0.037,

      silhouetteFraction: 0.05,
    }),
    motionTooSmall: () => true,
    animationPrompt: () => "prompt",
    masterForDirection: () => "master.png",
    runNativeImageJob: async () => {
      generated = true;
      return Buffer.alloc(0);
    },
    saveGeneratedBuffer: async () => ({ mattePixels: 0, color: null }),
    log: () => {},
    warn() {},
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

        retryWeakPose: true,
      },
      sprite: {
        size: 96,
      },
      generation: {
        retrySeedOffset: 1,
      },
    },
    sourceAIPath: () => "source.png",
    relativeLabel: (value) => value,
    exists: async () => false,
    normalizeChroma: async () => ({ mattePixels: 0, color: null }),
    differenceString: (score) =>
      `mean=${score.meanDifference} changed=${score.changedFraction} silhouette=${score.silhouetteFraction}`,
    calculateForegroundGeometry: async () => ({ width: 10, height: 10, area: 100 }),
    isSizeStable: () => ({ ok: true }),
    validateAnatomyArtifacts: async () => ({ ok: true }),
    calculateImageDifference: async () => ({
      meanDifference: 5.91,

      changedFraction: 0.043,

      silhouetteFraction: 0,
    }),
    motionTooSmall: () => true,
    animationPrompt: () => "prompt",
    masterForDirection: () => "master.png",
    runNativeImageJob: async () => {
      generated++;

      return Buffer.alloc(0);
    },
    saveGeneratedBuffer: async () => ({ mattePixels: 0, color: null }),
    console: {
      log() {},
      warn(...args) {
        warn.push(args);
      },
    },
    warn(...args) {
      warn.push(args);
    },
    log: () => {},
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
    assert.equal(warn.length, 2);
    assert.ok(
      warn.every((args) => args[0] === "MOTION"),
      "expected retry warnings",
    );
  });

test("reuses cached motion frame regardless of drift checks", async () => {
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
    sourceAIPath: () => "cached.png",
    relativeLabel: (value) => value,
    exists: async () => true,
    normalizeChroma: async () => ({ mattePixels: 0, color: null }),
    calculateForegroundGeometry: async () => ({ width: 10, height: 10, area: 100 }),
    isSizeStable: () => ({ ok: false, reason: "size drift" }),
    validateAnatomyArtifacts: async () => ({ ok: true }),
    calculateImageDifference: async () => ({
      meanDifference: 10,

      changedFraction: 0.3,

      silhouetteFraction: 0.6,
    }),
    differenceString: (score) =>
      `mean=${score.meanDifference} changed=${score.changedFraction} silhouette=${score.silhouetteFraction}`,
    motionTooSmall: () => false,
    animationPrompt: () => "prompt",
    masterForDirection: () => "master.png",
    runNativeImageJob: async () => {
      generated++;

      return Buffer.alloc(0);
    },
    saveGeneratedBuffer: async () => {},
    log: () => {},
    console: { log() {}, warn() {} },
    path,
  };

  vm.createContext(context);
  vm.runInContext(`${extractFunction(source, "generateMotionFrame")}; this.run = generateMotionFrame`, context);

  await context.run({ compareTo: "reference.png", output: "frame.png" });

  assert.equal(generated, 0);
});

test("returns idle isometric sources", async () => {
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

    CANONICAL_DIRECTIONS: ["southwest", "northwest"],

    masterForDirection: (direction) =>
      direction === "southwest" ? "masters/front.png" : "masters/back.png",

    rawPath: (animation, direction, frame) =>
      `/raw/${animation}/${direction}/${frame}.png`,

    spritePath: (animation, direction, frame) =>
      `/sprites/${animation}/${direction}/${frame}.png`,

    path,
  };

  vm.createContext(context);

  vm.runInContext(
    `${extractFunction(source, "getPixelSources")}; this.run = getPixelSources`,
    context,
  );

  const sources = await context.run({});

  assert.equal(sources.length, 2);

  assert.equal(sources[0].animation, "idle");

  assert.equal(sources[1].animation, "idle");

  assert.equal(sources[0].frame, 0);

  assert.equal(sources[1].frame, 0);
});
