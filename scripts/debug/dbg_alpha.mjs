import sharp from 'sharp';
const file = 'output/isometric/spider/sprites/idle/northwest/0.png';
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const size=info.width;
// print alpha values around detached region (55,36)-(56,37)
for(let y=34;y<=39;y++){
  let row='';
  for(let x=52;x<=60;x++){
    const i=(y*size+x)*4;
    row += data[i+3]===255?'#':(data[i+3]>0?'o':'.');
  }
  console.log(`y=${y}: ${row}`);
}
