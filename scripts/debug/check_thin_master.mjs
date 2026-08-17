import sharp from 'sharp';
const file = process.argv[2];
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W=info.width,H=info.height,C=info.channels;
// object mask: not green
function isChroma(r,g,b){return g>80&&g>r*1.3&&g>b*1.3;}
const mask=new Uint8Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*C;const r=data[i],g=data[i+1],b=data[i+2];if(data[i+3]>128&&!isChroma(r,g,b))mask[y*W+x]=1;}
// find "cut vertices": object pixels where removing them would disconnect - approximate by checking if pixel has 2 object neighbors that are NOT adjacent to each other
// simpler: find narrow bridges - for each object pixel, count object neighbors in 8-dir; if the pixel is a 1-wide bridge
let bridge=0;
const bridgePts=[];
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const idx=y*W+x;
  if(!mask[idx])continue;
  // check 4 cardinal neighbors
  const N=mask[idx-W],S=mask[idx+W],E=mask[idx+1],Wp=mask[idx-1];
  const ncount=(N?1:0)+(S?1:0)+(E?1:0)+(Wp?1:0);
  // a bridge pixel has exactly 2 cardinal neighbors, and they're opposite (vertical or horizontal line)
  if(ncount===2){
    if((N&&S&&!E&&!Wp)||(E&&Wp&&!N&&!S)){
      bridge++; bridgePts.push([x,y]);
    }
  }
}
console.log(`file=${file} 1px-wide bridge pixels=${bridge}`);
if(bridgePts.length){
  let minx=W,miny=H,maxx=0,maxy=0;
  for(const[x,y]of bridgePts){if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;}
  console.log(`bridge region bbox=[${minx},${miny},${maxx},${maxy}]`);
}
