import { test, expect } from "bun:test";
import { applyPalette, buildGlobalPalette } from "../pipelines/sprite/pixelize.ts";
import { SPRITE_CONFIG } from "../pipelines/sprite/config.ts";
import {
  walkPrompt,
  attackPrompt,
  buildPrompt,
} from "../pipelines/sprite/animation.ts";
import { applyTemplatePrompts } from "../pipelines/sprite/prompts.ts";

test("buildPrompt appends global art rules", () => {
  const result = buildPrompt("hello");
  expect(result).toContain("hello");
  expect(result).toContain("ABSOLUTE OUTPUT RULES");
});

test("walkPrompt switches camera block by view", () => {
  const side = walkPrompt("side", 0);
  const up = walkPrompt("up", 0);
  expect(side).toContain("orthographic side profile");
  expect(up).toContain("direct overhead dorsal view");
  expect(side).not.toContain("direct overhead dorsal view");
});

test("attackPrompt matches frame index", () => {
  expect(attackPrompt("side", 0)).toContain("ANTICIPATION");
  expect(attackPrompt("side", 3)).toContain("IMPACT");
  expect(attackPrompt("up", 3)).toContain("HIT FRAME");
});

test("applyTemplatePrompts is a no-op when missing", () => {
  applyTemplatePrompts(null);
  expect(attackPrompt("side", 0)).toContain("ANTICIPATION");
});

test("applyTemplatePrompts overrides WALK_SIDE", () => {
  applyTemplatePrompts({ WALK_SIDE: ["OVERRIDDEN CONTACT A"] });
  expect(walkPrompt("side", 0)).toContain("OVERRIDDEN CONTACT A");
});

test("buildGlobalPalette returns at most N colors", () => {
  const buffer = Buffer.alloc(SPRITE_CONFIG.spriteSize * SPRITE_CONFIG.spriteSize * 4);
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = (i / 4) % 256;
    buffer[i + 1] = ((i / 4) * 7) % 256;
    buffer[i + 2] = ((i / 4) * 13) % 256;
    buffer[i + 3] = 255;
  }
  const palette = buildGlobalPalette([buffer], 8);
  expect(palette.length).toBeLessThanOrEqual(8);
  expect(palette.length).toBeGreaterThan(0);
});

test("applyPalette snaps to nearest palette color", () => {
  const buffer = Buffer.alloc(SPRITE_CONFIG.spriteSize * SPRITE_CONFIG.spriteSize * 4);
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

export async function runSpriteTests(): Promise<void> {
  /* bun:test discovery via `bun test src/test/` */
}
