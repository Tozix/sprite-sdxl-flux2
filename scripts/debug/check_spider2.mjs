import sharp from 'sharp';

const file = process.argv[2];
const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
// object mask: not green, opaque
const mask = new Uint8Array(W*H);
for (let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*C; const r=data[i],g=data[i+1],b=data[i+2];
  const isGreen = g>100 && g>r*1.5 && g>b*1.5;
  if(!isGreen) mask[y*W+x]=1;
}
// connected components
const comp = new Int32Array(W*H).fill(-1); const sizes=[]; let next=0; const stack=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const idx=y*W+x;
  if(mask[idx]&&comp[idx]===-1){const id=next++;let size=0;stack.push(idx);comp[idx]=id;
    while(stack.length){const cur=stack.pop();size++;const cx=cur%W,cy=(cur/W)|0;
      for(const[nx,ny]of[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){if(nx<0||ny<0||nx>=W||ny>=H)continue;const ni=ny*W+nx;if(mask[ni]&&comp[ni]===-1){comp[ni]=id;stack.push(ni);}}}
    sizes.push(size);}
}
// report each component bbox + centroid
console.log(`file=${file} comps=${next}`);
const bboxes=[];
for(let id=0;id<next;id++){let minx=W,miny=H,maxx=-1,maxy=-1,cx=0,cy=0,c=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(comp[y*W+x]===id){if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;cx+=x;cy+=y;c++;}}
  bboxes.push({id,size:c,bbox:[minx,miny,maxx,maxy],centroid:[Math.round(cx/c),Math.round(cy/c)]});
}
bboxes.sort((a,b)=>b.size-a.size);
for(const b of bboxes.slice(0,8)) console.log(`  id=${b.id} size=${b.size} bbox=${b.bbox} centroid=${b.centroid}`);
