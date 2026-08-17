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

const f=3;
const raw = await rasterizeWith(`output/isometric/spider/raw/attack/southwest/${f}.png`, 40);
const { data, info } = await sharp(`output/isometric/spider/raw/attack/southwest/${f}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const matte = createChromaMask(data, info.width, info.height, info.channels);
const bin=new Uint8Array(info.width*info.height); for(let i=0;i<bin.length;i++)bin[i]=matte[i]?0:1;
const S=160,W=info.width,H=info.height;
const gt=new Uint8Array(S*S);
for(let y=0;y<S;y++)for(let x=0;x<S;x++){ gt[y*S+x]=bin[Math.min(H-1,Math.floor(y*H/S))*W+Math.min(W-1,Math.floor(x*W/S))]; }
const lostPts=[];
for(let i=0;i<S*S;i++){ if(gt[i] && raw[i*4+3]<128){ lostPts.push([i%S,(i/S)|0, raw[i*4+3]]); } }
console.log("frame3 lost pts (x,y,alpha) with t=40:", JSON.stringify(lostPts.slice(0,40)), "total", lostPts.length);
