import sharp from "sharp";
import { createChromaMask } from "./src/pipelines/isometric/chroma.ts";

const RAW = "output/isometric/spider/raw/attack/southwest/3.png";
const { data, info } = await sharp(RAW).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.from(data);
const matte = createChromaMask(rgba, info.width, info.height, info.channels);
const bin=new Uint8Array(info.width*info.height); for(let i=0;i<bin.length;i++)bin[i]=matte[i]?0:1;
const W=info.width,H=info.height,S=160;

// lanczos color+alpha
const { data: d } = await sharp(rgba,{raw:{width:W,height:H,channels:4}})
  .resize(S,S,{fit:"fill",kernel:sharp.kernel.lanczos3}).ensureAlpha().raw().toBuffer({resolveWithObject:true});

// coverage mask: target opaque if ANY opaque source pixel in its region
const cov = new Uint8Array(S*S);
for(let ty=0;ty<S;ty++){
  const y0=Math.floor(ty*H/S), y1=Math.max(y0+1, Math.floor((ty+1)*H/S));
  for(let tx=0;tx<S;tx++){
    const x0=Math.floor(tx*W/S), x1=Math.max(x0+1, Math.floor((tx+1)*W/S));
    let any=false;
    for(let y=y0;y<y1 && !any;y++)for(let x=x0;x<x1;x++){ if(bin[y*W+x]){any=true;break;} }
    if(any) cov[ty*S+tx]=1;
  }
}
const covCount=cov.reduce((a,b)=>a+b,0);

// lanczos harden at 40
const l40=new Uint8Array(S*S);
for(let i=0;i<S*S;i++) l40[i]=d[i*4+3]>=40?1:0;
const l40Count=l40.reduce((a,b)=>a+b,0);

// pixels added by coverage beyond lanczos40, classify color
let addedDark=0,addedGreen=0,addedOther=0;
const addedPts=[];
for(let i=0;i<S*S;i++){
  if(cov[i] && !l40[i]){
    const r=d[i*4],g=d[i*4+1],b=d[i*4+2];
    const isGreen=g>r+30&&g>b+30;
    const isDark=r<80&&g<80&&b<80;
    if(isGreen)addedGreen++; else if(isDark)addedDark++; else addedOther++;
    if(addedPts.length<15)addedPts.push([i%S,(i/S)|0,r,g,b]);
  }
}
console.log(`lanczos40 opaque=${l40Count} coverage opaque=${covCount}`);
console.log(`added by coverage: dark=${addedDark} green=${addedGreen} other=${addedOther}`);
console.log("added pts (x,y,r,g,b):", JSON.stringify(addedPts));
