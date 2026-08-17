import sharp from "sharp";
import { createChromaMask } from "./src/pipelines/isometric/chroma.ts";
import { applyPalette, repairConnections } from "./src/pipelines/isometric/pixelize.ts";
import fs from "node:fs/promises";

const pal = JSON.parse(await fs.readFile("output/isometric/spider/palette.json","utf8")).colors;

async function rasterizeWith(RAW, threshold){
  const { data, info } = await sharp(RAW).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  const matte = createChromaMask(rgba, info.width, info.height, info.channels);
  for (let p=0;p<matte.length;p++){ const o=p*info.channels; if(matte[p]){rgba[o]=rgba[o+1]=rgba[o+2]=0;rgba[o+3]=0;} else rgba[o+3]=255; }
  const { data: d } = await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}})
    .resize(160,160,{fit:"fill",kernel:sharp.kernel.lanczos3}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const out = Buffer.from(d);
  for(let o=0;o<out.length;o+=4){ out[o+3] = out[o+3]>=threshold?255:0; }
  return out;
}

const raw = await rasterizeWith("output/isometric/spider/raw/attack/southwest/5.png", 40);
const pal2 = applyPalette(raw, pal);
const repaired = repairConnections(pal2, 160);
await sharp(repaired,{raw:{width:160,height:160,channels:4}}).png().toFile("/tmp/regen5_t40.png");
await sharp(repaired,{raw:{width:160,height:160,channels:4}}).flatten({background:{r:255,g:255,b:255}}).resize(480,480,{kernel:sharp.kernel.nearest}).png().toFile("/tmp/regen5_t40_white.png");
console.log("done");
