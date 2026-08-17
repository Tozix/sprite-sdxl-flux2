import sharp from "sharp";
import { createChromaMask } from "./src/pipelines/isometric/chroma.ts";
const RAW = "output/isometric/spider/raw/attack/southwest/3.png";
const { data, info } = await sharp(RAW).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.from(data);
const matte = createChromaMask(rgba, info.width, info.height, info.channels);
for (let p=0;p<matte.length;p++){ const o=p*info.channels; if(matte[p]){rgba[o]=rgba[o+1]=rgba[o+2]=0;rgba[o+3]=0;} else rgba[o+3]=255; }
const res = await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}})
  .resize(160,160,{fit:"fill",kernel:sharp.kernel.lanczos3}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
console.log("res.data length:", res.data.length, "res.info:", JSON.stringify(res.info));
const d=res.data;
let below40=0, ge40=0, zero=0;
for(let i=0;i<160*160;i++){ const a=d[i*4+3]; if(a===0)zero++; else if(a<40)below40++; else ge40++; }
console.log(`alpha: zero=${zero} <40=${below40} >=40=${ge40}`);
