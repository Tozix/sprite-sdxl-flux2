import sharp from 'sharp';
const file = process.argv[2];
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W=info.width,H=info.height,C=info.channels;
// Replicate createChromaMask logic: flood-fill from borders of "chroma" pixels
// chroma config: hex #00FF00, directDistance, hueTol, minSat, minVal
// Use loose approximation: green = g dominant
function isChroma(r,g,b){
  // green dominant, moderately saturated, not too dark
  return g>80 && g>r*1.3 && g>b*1.3;
}
const mask=new Uint8Array(W*H);const queue=new Int32Array(W*H);let rp=0,wp=0;
function push(p){if(p<0||p>=W*H||mask[p])return;const o=p*C;if(!isChroma(data[o],data[o+1],data[o+2]))return;mask[p]=1;queue[wp++]=p;}
for(let x=0;x<W;x++){push(x);push((H-1)*W+x);}
for(let y=0;y<H;y++){push(y*W);push(y*W+W-1);}
while(rp<wp){const p=queue[rp++];const x=p%W,y=(p/W)|0;if(x>0)push(p-1);if(x<W-1)push(p+1);if(y>0)push(p-W);if(y<H-1)push(p+W);}
// count mask pixels
let m=0;for(let i=0;i<mask.length;i++)m+=mask[i];
console.log(`file=${file} chromaMaskPixels=${m} (${(100*m/(W*H)).toFixed(1)}%)`);
