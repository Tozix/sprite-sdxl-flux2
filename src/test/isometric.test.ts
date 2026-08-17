import { test, expect } from "bun:test";
import { ISO_CONFIG } from "../pipelines/isometric/config.ts";
import { phaseSeed, PHASE_SEED_OFFSETS } from "../pipelines/isometric/config.ts";
import { animationPrompt, orientationPrompt } from "../pipelines/isometric/animation.ts";
import {
  applyTemplateConfig,
  WALK_SW,
  WALK_NW,
  HIT_VARIANTS,
  DEATH_PROMPTS,
  CORPSE_PROMPTS,
  CANONICAL_DIRECTIONS,
  DIRECTIONS,
  MIRROR_DIRECTION,
  MOB_NAME,
  MOB_STYLE,
  MOB_ANATOMY,
} from "../pipelines/isometric/prompts.ts";
import {
  buildGlobalPalette,
  applyPalette,
  rgbKey,
  keyToRgb,
} from "../pipelines/isometric/pixelize.ts";
import {
  calculateImageDifference,
  scoreFailsThresholds,
  normalMotionThresholds,
} from "../pipelines/isometric/difference.ts";
import {
  isChromaColor,
  isBloodColor,
  isEarPink,
  rgbToHsv,
  parseHexColor,
} from "../pipelines/isometric/chroma.ts";

test("parseHexColor parses 6-digit hex", () => {
  expect(parseHexColor("#00FF00")).toEqual({ r: 0, g: 255, b: 0 });
  expect(parseHexColor("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
});

test("rgbToHsv understands pure red/green/blue", () => {
  expect(rgbToHsv(255, 0, 0).h).toBe(0);
  expect(rgbToHsv(0, 255, 0).h).toBe(120);
  expect(rgbToHsv(0, 0, 255).h).toBe(240);
  expect(rgbToHsv(0, 0, 0).s).toBe(0);
});

test("isChromaColor catches chroma green", () => {
  expect(isChromaColor(0, 255, 0)).toBe(true);
  expect(isChromaColor(255, 0, 0)).toBe(false);
});

test("isBloodColor accepts dark red, rejects pure green", () => {
  expect(isBloodColor(120, 10, 10)).toBe(true);
  expect(isBloodColor(0, 255, 0)).toBe(false);
});

test("isEarPink accepts warm pink, rejects cool gray", () => {
  expect(isEarPink(220, 160, 160)).toBe(true);
  expect(isEarPink(80, 80, 80)).toBe(false);
});

test("animationPrompt differs by direction", () => {
  const sw = animationPrompt("pose", "southwest");
  const nw = animationPrompt("pose", "northwest");
  expect(sw).toContain("SCREEN LOWER-LEFT");
  expect(nw).toContain("SCREEN UPPER-LEFT");
  expect(sw).not.toContain("SCREEN UPPER-LEFT");
});

test("orientationPrompt flips SW vs NW", () => {
  expect(orientationPrompt("southwest")).toContain("SCREEN LOWER-LEFT");
  expect(orientationPrompt("northwest")).toContain("SCREEN UPPER-LEFT");
});

test("applyTemplateConfig overrides WALK_SW and regenerates WALK_NW", () => {
  applyTemplateConfig({
    WALK_SW: ["TEMPLATE OVERRIDE WALK CONTACT A toward SCREEN LOWER-LEFT"],
  });
  expect(WALK_SW[0]).toContain("TEMPLATE OVERRIDE");
  expect(WALK_NW[0]).toContain("TEMPLATE OVERRIDE");
  expect(WALK_NW[0]).toContain("SCREEN UPPER-LEFT");
});

test("applyTemplateConfig overrides HIT_VARIANTS", () => {
  applyTemplateConfig({
    HIT_VARIANTS: [["ONLY ONE FRAME"]],
  });
  expect(HIT_VARIANTS.length).toBe(1);
  expect(HIT_VARIANTS[0]![0]).toBe("ONLY ONE FRAME");
});

test("applyTemplateConfig overrides DEATH_PROMPTS and CORPSE_PROMPTS", () => {
  applyTemplateConfig({
    DEATH_PROMPTS: ["TEMPLATE DEATH"],
    CORPSE_PROMPTS: ["TEMPLATE CORPSE"],
  });
  expect(DEATH_PROMPTS[0]).toBe("TEMPLATE DEATH");
  expect(CORPSE_PROMPTS[0]).toBe("TEMPLATE CORPSE");
});

test("applyTemplateConfig overrides DIRECTIONS and CANONICAL_DIRECTIONS", () => {
  applyTemplateConfig({
    DIRECTIONS: ["southwest", "southeast", "northeast", "northwest"],
    CANONICAL_DIRECTIONS: ["southwest", "northwest"],
  });
  expect(DIRECTIONS).toEqual([
    "southwest",
    "southeast",
    "northeast",
    "northwest",
  ]);
  expect(CANONICAL_DIRECTIONS).toEqual(["southwest", "northwest"]);
});

test("applyTemplateConfig overrides MIRROR_DIRECTION", () => {
  applyTemplateConfig({
    MIRROR_DIRECTION: { southwest: "northwest" },
  });
  expect(MIRROR_DIRECTION.southwest).toBe("northwest");
});

test("applyTemplateConfig overrides MOB_NAME and MOB_STYLE", () => {
  applyTemplateConfig({
    MOB_NAME: "spider",
    MOB_STYLE: "A hostile cave spider enemy.",
    MOB_ANATOMY: "The spider has exactly eight legs.",
  });
  expect(MOB_NAME).toBe("spider");
  expect(MOB_STYLE).toContain("spider");
  expect(MOB_ANATOMY).toContain("eight legs");
});

test("animationPrompt uses MOB_NAME in body motion phrase", () => {
  applyTemplateConfig({ MOB_NAME: "spider" });
  const prompt = animationPrompt("pose", "southwest");
  expect(prompt).toContain("SPIDER'S BODY must move");
  expect(prompt).toContain("Spider faces SCREEN LOWER-LEFT");
});

test("phaseSeed advances per frame", () => {
  const base = 1000;
  expect(phaseSeed(base, 0)).toBe(base + PHASE_SEED_OFFSETS[0]!);
  expect(phaseSeed(base, 1)).toBe(base + PHASE_SEED_OFFSETS[1]!);
  expect(phaseSeed(base, PHASE_SEED_OFFSETS.length)).toBe(
    base + PHASE_SEED_OFFSETS[0]!,
  );
});

test("rgbKey and keyToRgb round-trip", () => {
  const key = rgbKey(10, 20, 30);
  expect(keyToRgb(key)).toEqual({ r: 10, g: 20, b: 30 });
});

test("buildGlobalPalette returns at most N colors", () => {
  const buffer = Buffer.alloc(
    ISO_CONFIG.sprite.size * ISO_CONFIG.sprite.size * 4,
  );
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = (i / 4) % 256;
    buffer[i + 1] = ((i / 4) * 7) % 256;
    buffer[i + 2] = ((i / 4) * 13) % 256;
    buffer[i + 3] = 255;
  }
  const palette = buildGlobalPalette([buffer], 12);
  expect(palette.length).toBeLessThanOrEqual(12);
  expect(palette.length).toBeGreaterThan(0);
});

test("applyPalette snaps to nearest palette color", () => {
  const buffer = Buffer.alloc(
    ISO_CONFIG.sprite.size * ISO_CONFIG.sprite.size * 4,
  );
  buffer[0] = 250;
  buffer[1] = 5;
  buffer[2] = 5;
  buffer[3] = 255;
  const palette = [{ r: 255, g: 0, b: 0 }];
  const out = applyPalette(buffer, palette);
  expect(out[0]).toBe(255);
  expect(out[1]).toBe(0);
  expect(out[2]).toBe(0);
});

test("scoreFailsThresholds catches below-min mean", () => {
  const thresholds = normalMotionThresholds();
  const score = {
    meanDifference: thresholds.mean - 1,
    changedFraction: thresholds.changed,
    silhouetteFraction: thresholds.silhouette,
  };
  expect(scoreFailsThresholds(score, thresholds)).toBe(true);
});

test("scoreFailsThresholds passes when all above thresholds", () => {
  const thresholds = normalMotionThresholds();
  const score = {
    meanDifference: thresholds.mean + 1,
    changedFraction: thresholds.changed + 0.1,
    silhouetteFraction: thresholds.silhouette + 0.1,
  };
  expect(scoreFailsThresholds(score, thresholds)).toBe(false);
});

test("calculateImageDifference returns sane defaults for missing files", async () => {
  await expect(
    calculateImageDifference("/no/such.png", "/no/such.png"),
  ).rejects.toThrow();
});
