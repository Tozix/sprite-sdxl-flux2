import sharp from "sharp";
import { createChromaMask } from "./src/pipelines/isometric/chroma.ts";

for (let f=0; f<6; f++) {
  const RAW = `output/isometric/spider/raw/attack/southwest/${f}.png`;
  const SPRITE = `output/isometric/spider/sprites/attack/southwest/${f}.png`;
  const { data: rd, info: ri } = await sharp(RAW).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const matte = createChromaMask(rd, ri.width, ri.height, ri.channels);
  const rawMask = new Uint8Array(ri.width * ri.height);
  for (let i=0;i<ri.width*ri.height;i++) rawMask[i] = matte[i]?0:1;
  const { data: sd, info: si } = await sharp(SPRITE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const spriteMask = new Uint8Array(si.width*si.height);
  for (let i=0;i<si.width*si.height;i++) spriteMask[i] = sd[i*4+3]>128?1:0;
  const scale = si.width/ri.width;
  const downMask = new Uint8Array(si.width*si.height);
  for (let y=0;y<si.height;y++) for (let x=0;x<si.width;x++){
    const sx = Math.min(ri.width-1, Math.floor(x/scale));
    const sy = Math.min(ri.height-1, Math.floor(y/scale));
    downMask[y*si.width+x] = rawMask[sy*ri.width+sx];
  }
  let lost=0, kept=0;
  for (let i=0;i<si.width*si.height;i++){
    if (downMask[i] && !spriteMask[i]) lost++;
    if (downMask[i]) kept++;
  }
  console.log(`frame ${f}: downOpaque=${kept} spriteOpaque=${spriteMask.reduce((a,b)=>a+b,0)} LOST=${lost} (${(100*lost/kept).toFixed(1)}%)`);
}
