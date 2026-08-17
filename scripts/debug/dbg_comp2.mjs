import sharp from 'sharp';
const file = 'output/isometric/spider/sprites/idle/northwest/0.png';
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const size=info.width;
// Check: is (56,37) alpha>128? and neighbors
const pts=[[55,36],[56,36],[55,37],[56,37],[57,37],[58,37],[57,36]];
for(const[x,y]of pts){const i=(y*size+x)*4;console.log(`(${x},${y}) alpha=${data[i+3]}`);}
