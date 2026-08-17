import sharp from 'sharp';
const file = process.argv[2];
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W=info.width,H=info.height,C=info.channels;
const mask=new Uint8Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*C; if(data[i+3]>128) mask[y*W+x]=1;}
// count total object pixels
let total=0;for(let i=0;i<mask.length;i++)total+=mask[i];
console.log(`object px=${total}`);
// find 1-pixel-wide bridges: object pixels that have exactly 1 object neighbor in cardinal directions
// (a "cut point" - if removed, splits the shape)
let thin=0;
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const idx=y*W+x;
  if(!mask[idx])continue;
  const n=(mask[idx-1]?1:0)+(mask[idx+1]?1:0)+(mask[idx-W]?1:0)+(mask[idx+W]?1:0);
  if(n<=1) thin++;
}
console.log(`pixels with <=1 cardinal neighbor (tips/isolated)=${thin}`);
// find articulation points (cut vertices) - removing them disconnects the shape
// BFS-based articulation detection is complex; approximate: count 1-wide connections
