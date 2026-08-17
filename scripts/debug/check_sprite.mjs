import sharp from "sharp";
import { readdir } from "node:fs/promises";

const sprites = await readdir("output/isometric/spider/sprites/walk/southwest");
console.log("sprite files:", sprites);

for (const f of sprites) {
  const path = `output/isometric/spider/sprites/walk/southwest/${f}`;
  const img = sharp(path);
  const meta = await img.metadata();
  const buf = await img.raw().toBuffer();
  
  let transparent = 0, greenVisible = 0, totalVisible = 0;
  for (let p = 0; p < buf.length; p += meta.channels) {
    const a = buf[p + 3];
    if (a < 128) transparent++;
    else {
      totalVisible++;
      const r = buf[p], g = buf[p+1], b = buf[p+2];
      if (g > 150 && g > r * 1.3 && g > b * 1.3) greenVisible++;
    }
  }
  console.log(`${f}: size=${meta.width}x${meta.height} channels=${meta.channels} transparent=${transparent} visible=${totalVisible} greenInVisible=${greenVisible}`);
}
