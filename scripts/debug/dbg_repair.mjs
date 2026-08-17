import sharp from 'sharp';
const file = 'output/isometric/spider/sprites/idle/northwest/0.png';
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const size=info.width;
const mask=new Uint8Array(size*size);
for(let i=0;i<size*size;i++) if(data[i*4+3]>128) mask[i]=1;
const comp=new Int32Array(size*size).fill(-1);const sizes=[];let next=0;const stack=[];
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const idx=y*size+x;if(mask[idx]&&comp[idx]===-1){const id=next++;let s=0;stack.push(idx);comp[idx]=id;while(stack.length){const cur=stack.pop();s++;const cx=cur%size,cy=(cur/size)|0;for(const[nx,ny]of[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){if(nx<0||ny<0||nx>=size||ny>=size)continue;const ni=ny*size+nx;if(mask[ni]&&comp[ni]===-1){comp[ni]=id;stack.push(ni);}}}sizes.push(s);}}
let largest=0,ls=-1;for(let id=0;id<next;id++)if(sizes[id]>ls){ls=sizes[id];largest=id;}
console.log(`components=${next} largest=${largest} (size ${ls})`);
for(let id=0;id<next;id++){
  if(id===largest)continue;
  // find closest pair (detached pixel, body pixel) within 3
  let bestD=Infinity,bf=-1,bt=-1;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    if(comp[y*size+x]!==id)continue;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=size||ny>=size)continue;
      if(comp[ny*size+nx]===largest){const d=dx*dx+dy*dy;if(d<bestD){bestD=d;bf=y*size+x;bt=ny*size+nx;}}
    }
  }
  console.log(`detached id=${id} size=${sizes[id]} bestDistSq=${bestD} (${Math.sqrt(bestD).toFixed(1)}px) from=(${bf%size},${(bf/size)|0}) to=(${bt%size},${(bt/size)|0})`);
}
