import sharp from 'sharp';
const file = process.argv[2];
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W=info.width,H=info.height,C=info.channels;
function isChroma(r,g,b){return g>80&&g>r*1.3&&g>b*1.3;}
const mask=new Uint8Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*C;const r=data[i],g=data[i+1],b=data[i+2];if(data[i+3]>128&&!isChroma(r,g,b))mask[y*W+x]=1;}
// For each object pixel, compute "local width" = min distance to background in 4 directions
// Count pixels that form narrow (1px) connections: pixels where in at least one axis, both sides are object within 1px but the perpendicular is thin
// Simpler: erosion - count object pixels that survive 1 round of erosion (have all 4 cardinal neighbors). The ones that don't are boundary.
// A 1px-wide line: after 1 erosion it disappears. Let's find connected "skeleton" thin lines.
// Compute for each object pixel the number of cardinal object neighbors
const widthMap=new Float32Array(W*H);
// distance transform (approx via repeated erosion)
let layer=Uint8Array.from(mask);
let dist=new Int32Array(W*H);
let alive=0;for(let i=0;i<layer.length;i++)alive+=layer[i];
let d=0;
while(alive>0){
  d++;
  const next=new Uint8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const idx=y*W+x;
    if(!layer[idx])continue;
    const n=(x>0&&layer[idx-1])&&(x<W-1&&layer[idx+1])&&(y>0&&layer[idx-W])&&(y<H-1&&layer[idx+W]);
    if(n){next[idx]=1;dist[idx]=d;}
  }
  alive=0;for(let i=0;i<next.length;i++)alive+=next[i];
  layer=next;
}
// count pixels with small distance (thin)
let thin1=0,thin2=0;
for(let i=0;i<dist.length;i++){if(dist[i]===0&&mask[i])thin1++;else if(dist[i]===1)thin2++;}
console.log(`file=${file} dist0(surface)=${thin1} dist1=${thin2}`);
// max distance = thickness/2
let maxd=0;for(let i=0;i<dist.length;i++)if(dist[i]>maxd)maxd=dist[i];
console.log(`max half-width=${maxd} (full width ~${maxd*2})`);
