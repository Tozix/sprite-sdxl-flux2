import sharp from 'sharp';
import { repairConnections } from './src/pipelines/isometric/pixelize.ts';
const file = 'output/isometric/spider/sprites/idle/northwest/0.png';
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const size=info.width;
const repaired = repairConnections(Buffer.from(data), size);
// check if (57,37) now has alpha
const pts=[[55,36],[56,37],[57,37],[58,37]];
for(const[x,y]of pts){const i=(y*size+x)*4;console.log(`(${x},${y}) alpha=${repaired[i+3]}`);}
