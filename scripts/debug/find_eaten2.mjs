import sharp from 'sharp';
const a = await sharp('output/isometric/spider/source-ai/masters/master-front-left.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const b = await sharp('output/isometric/spider/masters/master-front-left.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=a.info.width,H=a.info.height,C=a.info.channels;
function isGreen(data,i){const r=data[i],g=data[i+1],bl=data[i+2];return g>80&&g>r*1.3&&g>bl*1.3;}
const eaten=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*C;
  const aGreen=isGreen(a.data,i), bGreen=isGreen(b.data,i);
  if(!aGreen && bGreen) eaten.push([x,y]);
}
// cluster eaten into connected components
const comp=new Int32Array(W*H).fill(-1);const sizes=[];let next=0;const stack=[];
const eSet=new Uint8Array(W*H);for(const[x,y]of eaten)eSet[y*W+x]=1;
for(const[x,y]of eaten){const idx=y*W+x;if(comp[idx]!==-1)continue;const id=next++;let size=0;stack.push(idx);comp[idx]=id;
  while(stack.length){const cur=stack.pop();size++;const cx=cur%W,cy=(cur/W)|0;
    for(const[nx,ny]of[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){if(nx<0||ny<0||nx>=W||ny>=H)continue;const ni=ny*W+nx;if(eSet[ni]&&comp[ni]===-1){comp[ni]=id;stack.push(ni);}}}
  sizes.push(size);}
const boxes=[];
for(let id=0;id<next;id++){let minx=W,miny=H,maxx=0,maxy=0,c=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(comp[y*W+x]===id){if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;c++;}}boxes.push({id,size:c,bbox:[minx,miny,maxx,maxy]});}
boxes.sort((p,q)=>q.size-p.size);
console.log(`eaten total=${eaten.length} components=${next}`);
for(const b2 of boxes.slice(0,10)) console.log(`  id=${b2.id} size=${b2.size} bbox=${b2.bbox}`);
