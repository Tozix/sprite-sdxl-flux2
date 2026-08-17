import sharp from "sharp";
import { createChromaMask } from "./src/pipelines/isometric/chroma.ts";

async function analyze(RAW){
  const { data, info } = await sharp(RAW).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  const matte = createChromaMask(rgba, info.width, info.height, info.channels);
  for (let p=0;p<matte.length;p++){ const o=p*info.channels; if(matte[p]){rgba[o]=rgba[o+1]=rgba[o+2]=0;rgba[o+3]=0;} else rgba[o+3]=255; }
  const { data: d } = await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}})
    .resize(160,160,{fit:"fill",kernel:sharp.kernel.lanczos3}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // for thresholds 30,40,50,60,70,80: count dark vs green added (alpha in [t,90))
  const bands=[];
  for(const t of [30,40,50,60,70,80]){
    let dark=0,green=0,other=0;
    for(let i=0;i<160*160;i++){
      const a=d[i*4+3];
      if(a<t||a>=90) continue;
      const r=d[i*4],g=d[i*4+1],b=d[i*4+2];
      const isGreen = g>r+30 && g>b+30;
      const isDark = r<80 && g<80 && b<80;
      if(isGreen) green++; else if(isDark) dark++; else other++;
    }
    bands.push(`t=${t}: dark=${dark} green=${green} other=${other}`);
  }
  return bands;
}

for(const [name,path] of [
  ["master-front", "output/isometric/spider/masters/master-front-left.png"],
  ["master-back", "output/isometric/spider/masters/master-back-left.png"],
  ["attack3", "output/isometric/spider/raw/attack/southwest/3.png"],
]){
  const r = await analyze(path);
  console.log(`--- ${name} ---`);
  for(const b of r) console.log("  "+b);
}
