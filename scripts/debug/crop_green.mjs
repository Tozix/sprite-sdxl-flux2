import sharp from 'sharp';
const src='output/isometric/spider/source-ai/masters/master-front-left.png';
const {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,C=info.channels;
// crop around leg region (110-135, 195-225) upscale x6
const x0=95,y0=185,x1=145,y1=235;
const w=x1-x0,h=y1-y0;
const crop=Buffer.alloc(w*h*4);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const si=((y0+y)*W+(x0+x))*C,di=(y*w+x)*4;crop[di]=data[si];crop[di+1]=data[si+1];crop[di+2]=data[si+2];crop[di+3]=data[si+3];}
await sharp(crop,{raw:{width:w,height:h,channels:4}}).resize(w*6,h*6,{kernel:sharp.kernel.nearest}).png().toFile('/tmp/spider_leg_green.png');
console.log('saved /tmp/spider_leg_green.png');
