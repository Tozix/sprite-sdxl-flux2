import sharp from "sharp";
import { createChromaMask } from "./src/pipelines/isometric/chroma.ts";

const RAW = "output/isometric/spider/raw/attack/southwest/5.png";
const SPRITE = "output/isometric/spider/sprites/attack/southwest/5.png";

const { data: rd, info: ri } = await sharp(RAW).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const matte = createChromaMask(rd, ri.width, ri.height, ri.channels);
const rawMask = new Uint8Array(ri.width * ri.height);
for (let i=0;i<ri.width*ri.height;i++) rawMask[i] = matte[i]?0:1;

const { data: sd, info: si } = await sharp(SPRITE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const spriteMask = new Uint8Array(si.width*si.height);
for (let i=0;i<si.width*si.height;i++) spriteMask[i] = sd[i*4+3]>128?1:0;

console.log("raw size", ri.width, ri.height, "sprite size", si.width, si.height);
console.log("raw opaque px", rawMask.reduce((a,b)=>a+b,0));
console.log("sprite opaque px", spriteMask.reduce((a,b)=>a+b,0));

const scale = si.width/ri.width;
const downMask = new Uint8Array(si.width*si.height);
for (let y=0;y<si.height;y++) for (let x=0;x<si.width;x++){
  const sx = Math.min(ri.width-1, Math.floor(x/scale));
  const sy = Math.min(ri.height-1, Math.floor(y/scale));
  downMask[y*si.width+x] = rawMask[sy*ri.width+sx];
}
let lost=0, kept=0;
const lostPts=[];
for (let i=0;i<si.width*si.height;i++){
  if (downMask[i] && !spriteMask[i]) { lost++; if(lostPts.length<30) lostPts.push([i%si.width,(i/si.width)|0]); }
  if (downMask[i]) kept++;
}
console.log("raw-downscaled opaque", kept, "lost in sprite", lost);
console.log("lost points (x,y):", JSON.stringify(lostPts));
