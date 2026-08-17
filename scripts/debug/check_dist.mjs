import sharp from 'sharp';
const file = process.argv[2];
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W=info.width,H=info.height,C=info.channels;
const mask=new Uint8Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*C; if(data[i+3]>128) mask[y*W+x]=1;}
// components
const comp=new Int32Array(W*H).fill(-1);const sizes=[];let next=0;const stack=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const idx=y*W+x;if(mask[idx]&&comp[idx]===-1){const id=next++;let s=0;stack.push(idx);comp[idx]=id;while(stack.length){const cur=stack.pop();s++;const cx=cur%W,cy=(cur/W)|0;for(const[nx,ny]of[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){if(nx<0||ny<0||nx>=W||ny>=H)continue;const ni=ny*W+nx;if(mask[ni]&&comp[ni]===-1){comp[ni]=id;stack.push(ni);}}}sizes.push(s);}}
let largest=0,ls=-1;for(let id=0;id<next;id++)if(sizes[id]>ls){ls=sizes[id];largest=id;}
// for each small component, find min distance to largest
for(let id=0;id<next;id++){
  if(id===largest)continue;
  let minD=Infinity;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(comp[y*W+x]!==id)continue;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=W||ny>=H)continue;
      if(comp[ny*W+nx]===largest){const d=dx*dx+dy*dy;if(d<minD)minD=d;}
    }
  }
  let minx=W,miny=H,maxx=0,maxy=0,c=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(comp[y*W+x]===id){if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;c++;}}
  console.log(`component id=${id} size=${c} bbox=[${minx},${miny},${maxx},${maxy}] minDistToBody=${Math.sqrt(minD).toFixed(1)}px`);
}
