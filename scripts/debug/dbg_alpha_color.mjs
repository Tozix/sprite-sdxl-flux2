import sharp from "sharp";
import { createChromaMask } from "./src/pipelines/isometric/chroma.ts";

const RAW = "output/isometric/spider/raw/attack/southwest/5.png";
const { data, info } = await sharp(RAW).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.from(data);
const matte = createChromaMask(rgba, info.width, info.height, info.channels);
for (let p=0;p<matte.length;p++){ const o=p*info.channels; if(matte[p]){rgba[o]=rgba[o+1]=rgba[o+2]=0;rgba[o+3]=0;} else rgba[o+3]=255; }

const { data: d } = await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}})
  .resize(160,160,{fit:"fill",kernel:sharp.kernel.lanczos3}).ensureAlpha().raw().toBuffer({resolveWithObject:true});

// classify pixels with alpha 40..89: dark (leg) vs green (bg) vs other
let dark=0, green=0, other=0;
const darkPts=[];
for(let i=0;i<160*160;i++){
  const a=d[i*4+3];
  if(a<40||a>=90) continue;
  const r=d[i*4],g=d[i*4+1],b=d[i*4+2];
  // green if g notably > r and b
  const isGreen = g>r+30 && g>b+30;
  const isDark = r<80 && g<80 && b<80;
  if(isGreen) green++;
  else if(isDark){ dark++; if(darkPts.length<15) darkPts.push([i%160,(i/160)|0,r,g,b]); }
  else other++;
}
console.log(`alpha 40..89: dark(leg)=${dark} green(bg)=${green} other=${other}`);
console.log("dark pts (x,y,r,g,b):", JSON.stringify(darkPts));
