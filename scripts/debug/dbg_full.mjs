import sharp from "sharp";
import { createChromaMask } from "./src/pipelines/isometric/chroma.ts";
import { applyPalette, repairConnections, rgbKey } from "./src/pipelines/isometric/pixelize.ts";

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

// build palette from both frames like pipeline
const frames=[];
for(const f of [0,1,2,3,4,5]) frames.push(await rasterizeWith(`output/isometric/spider/raw/attack/southwest/${f}.png`, 40));
const palette = [];
// simple: gather all opaque colors, cluster to 28
const hist=new Map();
for(const buf of frames){ for(let o=0;o<buf.length;o+=4){ if(!buf[o+3])continue; const k=rgbKey(buf[o],buf[o+1],buf[o+2]); hist.set(k,(hist.get(k)??0)+1);} }
const entries=[...hist.entries()].map(([k,c])=>({k,c})).sort((a,b)=>b.c-a.c);
// just take top 28 distinct-ish (naive)
const centers=[];
for(const e of entries){ if(centers.length>=28)break; centers.push({r:(e.k>>16)&255,g:(e.k>>8)&255,b:e.k&255}); }
console.log("palette size", centers.length);

async function compare(f){
  const raw = await rasterizeWith(`output/isometric/spider/raw/attack/southwest/${f}.png`, 40);
  const pal = applyPalette(raw, centers);
  const repaired = repairConnections(pal, 160);
  // ground truth nearest mask
  const { data, info } = await sharp(`output/isometric/spider/raw/attack/southwest/${f}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const matte = createChromaMask(data, info.width, info.height, info.channels);
  const bin=new Uint8Array(info.width*info.height); for(let i=0;i<bin.length;i++)bin[i]=matte[i]?0:1;
  const S=160,W=info.width,H=info.height;
  const gt=new Uint8Array(S*S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){ gt[y*S+x]=bin[Math.min(H-1,Math.floor(y*H/S))*W+Math.min(W-1,Math.floor(x*W/S))]; }
  let lost=0,kept=0;
  for(let i=0;i<S*S;i++){ if(gt[i]){kept++; if(repaired[i*4+3]<128)lost++;} }
  const spriteOpaque=0; for(let i=0;i<S*S;i++) if(repaired[i*4+3]>128) ;
  let op=0; for(let i=0;i<S*S;i++) if(repaired[i*4+3]>128) op++;
  console.log(`frame ${f}: lost=${lost} (${(100*lost/kept).toFixed(1)}%) spriteOpaque=${op}`);
}
for(const f of [0,1,2,3,4,5]) await compare(f);
