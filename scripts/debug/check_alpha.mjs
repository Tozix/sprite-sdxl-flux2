import sharp from 'sharp';
const file = process.argv[2];
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W=info.width,H=info.height,C=info.channels;
const mask=new Uint8Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*C; if(data[i+3]>128) mask[y*W+x]=1;}
const comp=new Int32Array(W*H).fill(-1);const sizes=[];let next=0;const stack=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const idx=y*W+x;if(mask[idx]&&comp[idx]===-1){const id=next++;let size=0;stack.push(idx);comp[idx]=id;
  while(stack.length){const cur=stack.pop();size++;const cx=cur%W,cy=(cur/W)|0;
    for(const[nx,ny]of[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){if(nx<0||ny<0||nx>=W||ny>=H)continue;const ni=ny*W+nx;if(mask[ni]&&comp[ni]===-1){comp[ni]=id;stack.push(ni);}}}
  sizes.push(size);}}
const boxes=[];
for(let id=0;id<next;id++){let minx=W,miny=H,maxx=0,maxy=0,c=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(comp[y*W+x]===id){if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;c++;}}boxes.push({id,size:c,bbox:[minx,miny,maxx,maxy]});}
boxes.sort((p,q)=>q.size-p.size);
console.log(`file=${file} alpha-comps=${next}`);
for(const b of boxes.slice(0,10)) console.log(`  id=${b.id} size=${b.size} bbox=${b.bbox}`);
