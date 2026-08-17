import sharp from "sharp";
import { createChromaMask } from "./src/pipelines/isometric/chroma.ts";

const RAW = "output/isometric/spider/raw/attack/southwest/5.png";
const { data, info } = await sharp(RAW).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.from(data);
const matte = createChromaMask(rgba, info.width, info.height, info.channels);
for (let p=0;p<matte.length;p++){ const o=p*info.channels; if(matte[p]){rgba[o]=rgba[o+1]=rgba[o+2]=0;rgba[o+3]=0;} else rgba[o+3]=255; }

// replicate rasterize: lanczos3 downscale to 160
const { data: d160, info: i160 } = await sharp(rgba,{raw:{width:info.width,height:info.height,channels:info.channels}})
  .resize(160,160,{fit:"fill",kernel:sharp.kernel.lanczos3}).ensureAlpha().raw().toBuffer({resolveWithObject:true});

// histogram of alpha values (before harden) for opaque-ish pixels
const hist = new Map();
for(let o=0;o<d160.length;o+=4){ const a=d160[o+3]; hist.set(a,(hist.get(a)??0)+1); }
const sorted=[...hist.entries()].sort((a,b)=>a[0]-b[0]);
console.log("alpha histogram (alpha:count) for alpha 1..255:");
for(const [a,c] of sorted) if(a>0 && a<255) console.log(`  ${a}: ${c}`);
const totalPartial=[...hist.entries()].filter(([a])=>a>0&&a<255).reduce((s,[,c])=>s+c,0);
console.log("total partial-alpha px:", totalPartial);
console.log("alpha>=90 (kept):", [...hist.entries()].filter(([a])=>a>=90).reduce((s,[,c])=>s+c,0));
console.log("alpha 1..89 (lost by harden):", [...hist.entries()].filter(([a])=>a>0&&a<90).reduce((s,[,c])=>s+c,0));
