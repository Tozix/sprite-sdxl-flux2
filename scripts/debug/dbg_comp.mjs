import sharp from 'sharp';
const file = 'output/isometric/spider/sprites/idle/northwest/0.png';
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const size=info.width;
const mask=new Uint8Array(size*size);
for(let i=0;i<size*size;i++) if(data[i*4+3]>128) mask[i]=1;
const comp=new Int32Array(size*size).fill(-1);const sizes=[];let next=0;const stack=[];
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const idx=y*size+x;if(mask[idx]&&comp[idx]===-1){const id=next++;let s=0;stack.push(idx);comp[idx]=id;while(stack.length){const cur=stack.pop();s++;const cx=cur%size,cy=(cur/size)|0;for(const[nx,ny]of[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){if(nx<0||ny<0||nx>=size||ny>=size)continue;const ni=ny*size+nx;if(mask[ni]&&comp[ni]===-1){comp[ni]=id;stack.push(ni);}}}sizes.push(s);}}
// print comp id for region
for(let y=33;y<=40;y++){
  let row='';
  for(let x=50;x<=62;x++){
    const c=comp[y*size+x];
    row += c===-1?'.':(c===0?'A':String(c));
  }
  console.log(`y=${y}: ${row}`);
}
