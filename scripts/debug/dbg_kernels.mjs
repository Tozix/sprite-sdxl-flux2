import sharp from "sharp";
import { createChromaMask } from "./src/pipelines/isometric/chroma.ts";

const RAW = "output/isometric/spider/raw/attack/southwest/5.png";
const { data, info } = await sharp(RAW).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.from(data);
const matte = createChromaMask(rgba, info.width, info.height, info.channels);
for (let p=0;p<matte.length;p++){ const o=p*info.channels; if(matte[p]){rgba[o]=rgba[o+1]=rgba[o+2]=0;rgba[o+3]=0;} else rgba[o+3]=255; }

// ground truth: nearest-downscale of binary mask
const bin = new Uint8Array(info.width*info.height);
for(let i=0;i<bin.length;i++) bin[i]=matte[i]?0:1;
const W=info.width,H=info.height,S=160;
const gt = new Uint8Array(S*S);
for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const sx=Math.min(W-1,Math.floor(x*W/S));
  const sy=Math.min(H-1,Math.floor(y*H/S));
  gt[y*S+x]=bin[sy*W+sx];
}
const gtCount=gt.reduce((a,b)=>a+b,0);

for (const kernel of ["lanczos3","mitchell","cubic","nearest"]) {
  const { data: d } = await sharp(rgba,{raw:{width:W,height:H,channels:4}})
    .resize(S,S,{fit:"fill",kernel}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // harden at 90
  let kept=0, lost=0;
  for(let i=0;i<S*S;i++){
    const a=d[i*4+3];
    const op = a>=90?1:0;
    if(gt[i]){ if(op) kept++; else lost++; }
  }
  console.log(`${kernel}: kept=${kept} lost=${lost} (${(100*lost/gtCount).toFixed(1)}% of ground-truth lost)`);
}
