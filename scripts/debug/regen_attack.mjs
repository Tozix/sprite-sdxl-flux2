import { applyTemplateConfig } from "./src/pipelines/isometric/prompts.ts";
import { isoPaths, rawPath, spritePath, prepareDirectories } from "./src/pipelines/isometric/paths.ts";
import { pixelizeSelection } from "./src/pipelines/isometric/pixelize.ts";
import { MIRROR_DIRECTION, CANONICAL_DIRECTIONS } from "./src/pipelines/isometric/prompts.ts";
import fs from "node:fs/promises";

const base = JSON.parse(await fs.readFile("templates/isometric/base.json","utf8"));
const mob = JSON.parse(await fs.readFile("templates/isometric/mobs/spider.json","utf8"));
applyTemplateConfig({ ...base, ...mob });
await prepareDirectories();

const P = isoPaths();
const ctx = {
  outputDir: P.outputDir,
  palettePath: P.palette,
  mirrorDirection: MIRROR_DIRECTION,
  canonicalDirections: CANONICAL_DIRECTIONS,
  masterFrontLeft: P.masterFrontLeft,
  masterBackLeft: P.masterBackLeft,
  rawPath,
  spritePath,
};

await pixelizeSelection({ attack: true }, ctx);
await pixelizeSelection({ walk: true }, ctx);
await pixelizeSelection({}, ctx); // idle (masters)
console.log("DONE");
