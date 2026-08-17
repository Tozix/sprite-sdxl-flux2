import sharp from 'sharp';
const file = 'output/isometric/spider/sprites/idle/northwest/0.png';
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const size=info.width;
// print full alpha map around 50-62, 33-40
for(let y=33;y<=40;y++){
  let row='';
  for(let x=50;x<=62;x++){
    const i=(y*size+x)*4;
    row += data[i+3]===255?'#':(data[i+3]>0?'o':'.');
  }
  console.log(`y=${y}: ${row}`);
}
