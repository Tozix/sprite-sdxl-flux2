import sharp from 'sharp';
import fs from 'fs';

const file = process.argv[2];
const img = sharp(file);
const meta = await img.metadata();
const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

// find non-transparent / non-background pixels (chroma green or alpha)
// Build alpha mask: pixel is "object" if not near-green and not transparent
const mask = new Uint8Array(W*H);
const green = [0,255,0];
for (let y=0;y<H;y++){
  for(let x=0;x<W;x++){
    const i=(y*W+x)*C;
    const r=data[i],g=data[i+1],b=data[i+2],a=C>3?data[i+3]:255;
    // object if opaque and not green-ish
    const isGreen = g>100 && g>r*1.5 && g>b*1.5;
    if(a>128 && !isGreen) mask[y*W+x]=1;
  }
}

// connected components (4-neighbor)
const comp = new Int32Array(W*H).fill(-1);
const sizes = [];
let next=0;
const stack=[];
for(let y=0;y<H;y++){
  for(let x=0;x<W;x++){
    const idx=y*W+x;
    if(mask[idx] && comp[idx]===-1){
      const id=next++;
      let size=0;
      stack.push(idx);
      comp[idx]=id;
      while(stack.length){
        const cur=stack.pop();
        size++;
        const cx=cur%W, cy=(cur/W)|0;
        const nbs=[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
        for(const [nx,ny] of nbs){
          if(nx<0||ny<0||nx>=W||ny>=H)continue;
          const ni=ny*W+nx;
          if(mask[ni]&&comp[ni]===-1){comp[ni]=id;stack.push(ni);}
        }
      }
      sizes.push(size);
    }
  }
}
const total=next;
const sorted=sizes.slice().sort((a,b)=>b-a);
console.log(`file=${file} dims=${W}x${H} components=${total}`);
console.log(`sizes desc: ${sorted.slice(0,12).join(', ')}`);
// largest component
const largest=sorted[0]||0;
const detached=sizes.filter(s=>s<largest*0.3);
console.log(`largest=${largest} detached(<30% of largest)=${detached.length} small components: ${detached.slice(0,20).join(',')}`);
