import sharp from 'sharp';
const file = process.argv[2];
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W=info.width,H=info.height,C=info.channels;
const mask=new Uint8Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*C; if(data[i+3]>128) mask[y*W+x]=1;}
// find 1px-wide bridge pixels: object pixel with exactly 2 opposite cardinal neighbors
const bridges=[];
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const idx=y*W+x;
  if(!mask[idx])continue;
  const N=mask[idx-W],S=mask[idx+W],E=mask[idx+1],Wp=mask[idx-1];
  const n=(N?1:0)+(S?1:0)+(E?1:0)+(Wp?1:0);
  if(n===2 && ((N&&S&&!E&&!Wp)||(E&&Wp&&!N&&!S))) bridges.push([x,y]);
}
console.log(`file=${file} 1px bridges=${bridges.length}`);
for(const b of bridges) console.log(`  bridge at ${b}`);
// also find detached components
const comp=new Int32Array(W*H).fill(-1);const sizes=[];let next=0;const stack=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const idx=y*W+x;if(mask[idx]&&comp[idx]===-1){const id=next++;let s=0;stack.push(idx);comp[idx]=id;while(stack.length){const cur=stack.pop();s++;const cx=cur%W,cy=(cur/W)|0;for(const[nx,ny]of[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){if(nx<0||ny<0||nx>=W||ny>=H)continue;const ni=ny*W+nx;if(mask[ni]&&comp[ni]===-1){comp[ni]=id;stack.push(ni);}}}sizes.push(s);}}
const sorted=sizes.slice().sort((a,b)=>b-a);
console.log(`components=${next} largest=${sorted[0]}`);
const detached=[];
for(let id=0;id<next;id++){if(sizes[id]<sorted[0]*0.3){let minx=W,miny=H,maxx=0,maxy=0,c=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(comp[y*W+x]===id){if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;c++;}}detached.push({id,size:c,bbox:[minx,miny,maxx,maxy]});}}
console.log(`detached components=${detached.length}`);
for(const d of detached) console.log(`  detached id=${d.id} size=${d.size} bbox=${d.bbox}`);
