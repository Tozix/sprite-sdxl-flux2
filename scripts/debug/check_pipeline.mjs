import sharp from 'sharp';
import { repairConnections } from './src/pipelines/isometric/pixelize.ts';
// Replicate exactly what pixelizeSelection does for northwest:
// applyPalette is already done (file is post-palette). Just repairConnections.
const file = 'output/isometric/spider/sprites/idle/northwest/0.png';
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const size = info.width;
const repaired = repairConnections(Buffer.from(data), size);
await sharp(repaired, {raw:{width:size,height:size,channels:4}}).png().toFile(file);
console.log('repaired and wrote back');
