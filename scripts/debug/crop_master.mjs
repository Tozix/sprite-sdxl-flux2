import sharp from 'sharp';
const src='output/isometric/spider/masters/master-front-left.png';
// crop around (111,214) with margin, upscale x6 for vision
const {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,C=info.channels;
const cx=111,cy=214,m=40;
const x0=Math.max(0,cx-m),y0=Math.max(0,cy-m),x1=Math.min(W,cx+m),y1=Math.min(H,cy+m);
const w=x1-x0,h=y1-y0;
const crop=Buffer.alloc(w*h*4);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const si=((y0+y)*W+(x0+x))*C,di=(y*w+x)*4;crop[di]=data[si];crop[di+1]=data[si+1];crop[di+2]=data[si+2];crop[di+3]=data[si+3];}
await sharp(crop,{raw:{width:w,height:h,channels:4}}).resize(w*6,h*6,{kernel:sharp.kernel.nearest}).png().toFile('/tmp/spider_leg_crop.png');
console.log(`crop ${w}x${h} at (${x0},${y0}) -> /tmp/spider_leg_crop.png`);
