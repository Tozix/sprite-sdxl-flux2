import sharp from 'sharp';
const src = 'output/isometric/spider/source-ai/masters/master-front-left.png';
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W=info.width,H=info.height,C=info.channels;
// green detection (chroma-ish)
function isGreen(r,g,b){return g>80&&g>r*1.3&&g>b*1.3;}
// flood-fill chroma mask from borders (what normalizeChroma removes)
const mask=new Uint8Array(W*H);const q=new Int32Array(W*H);let rp=0,wp=0;
function push(p){if(p<0||p>=W*H||mask[p])return;const o=p*C;if(!isGreen(data[o],data[o+1],data[o+2]))return;mask[p]=1;q[wp++]=p;}
for(let x=0;x<W;x++){push(x);push((H-1)*W+x);}for(let y=0;y<H;y++){push(y*W);push(y*W+W-1);}
while(rp<wp){const p=q[rp++];const x=p%W,y=(p/W)|0;if(x>0)push(p-1);if(x<W-1)push(p+1);if(y>0)push(p-W);if(y<H-1)push(p+W);}
// count ALL green pixels (not just flood) vs flood mask
let allGreen=0, floodGreen=0;
const greenPts=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*C;const r=data[i],g=data[i+1],b=data[i+2];
  if(isGreen(r,g,b)){allGreen++;greenPts.push([x,y]);if(mask[y*W+x])floodGreen++;}}
console.log(`all green px=${allGreen}, flood-reachable green=${floodGreen}, isolated green (not reachable from border)=${allGreen-floodGreen}`);
// find isolated green clusters (green NOT reachable from border = green ON the spider body/leg)
const comp=new Int32Array(W*H).fill(-1);const sizes=[];let next=0;const stack=[];
const isoSet=new Uint8Array(W*H);for(const[x,y]of greenPts){if(!mask[y*W+x])isoSet[y*W+x]=1;}
for(const[x,y]of greenPts){if(!mask[y*W+x]&&comp[y*W+x]===-1){const id=next++;let s=0;stack.push(y*W+x);comp[y*W+x]=id;while(stack.length){const cur=stack.pop();s++;const cx=cur%W,cy=(cur/W)|0;for(const[nx,ny]of[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){if(nx<0||ny<0||nx>=W||ny>=H)continue;const ni=ny*W+nx;if(isoSet[ni]&&comp[ni]===-1){comp[ni]=id;stack.push(ni);}}}sizes.push(s);}}
const boxes=[];
for(let id=0;id<next;id++){let minx=W,miny=H,maxx=0,maxy=0,c=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(comp[y*W+x]===id){if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;c++;}}boxes.push({id,size:c,bbox:[minx,miny,maxx,maxy]});}
boxes.sort((p,q)=>q.size-p.size);
console.log(`isolated green clusters=${next}`);
for(const b of boxes.slice(0,10)) console.log(`  id=${b.id} size=${b.size} bbox=${b.bbox}`);
