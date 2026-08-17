import sharp from 'sharp';
// Read the written northwest file and check component at 55,36
const file = 'output/isometric/spider/sprites/idle/northwest/0.png';
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const size=info.width;
// print alpha around 54-60, 35-39
for(let y=35;y<=39;y++){
  let row='';
  for(let x=53;x<=60;x++){
    const i=(y*size+x)*4;
    row += data[i+3]===255?'#':(data[i+3]>0?'o':'.');
  }
  console.log(`y=${y}: ${row}`);
}
