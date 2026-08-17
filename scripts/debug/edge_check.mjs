import sharp from "sharp";
import { createChromaMask } from "./src/pipelines/isometric/chroma.ts";
const RAW = "output/isometric/spider/raw/attack/southwest/5.png";
const { data: rd, info: ri } = await sharp(RAW).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const matte = createChromaMask(rd, ri.width, ri.height, ri.channels);
const W=ri.width, H=ri.height;
// count opaque pixels touching each edge
let top=0,bot=0,left=0,right=0;
const edgePts=[];
for (let x=0;x<W;x++){ if(matte[0*W+x]===0){top++; if(edgePts.length<20)edgePts.push([x,0]);} if(matte[(H-1)*W+x]===0){bot++; if(edgePts.length<20)edgePts.push([x,H-1]);} }
for (let y=0;y<H;y++){ if(matte[y*W+0]===0){left++; if(edgePts.length<20)edgePts.push([0,y]);} if(matte[y*W+W-1]===0){right++; if(edgePts.length<20)edgePts.push([W-1,y]);} }
console.log("raw 5.png edge opaque: top=",top,"bot=",bot,"left=",left,"right=",right);
console.log("sample edge pts:", JSON.stringify(edgePts));
// min/max bbox of opaque
let minx=W,miny=H,maxx=-1,maxy=-1;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(matte[y*W+x]===0){ if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; } }
console.log("bbox: x",minx,"..",maxx," y",miny,"..",maxy);
