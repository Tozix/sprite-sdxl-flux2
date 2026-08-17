import sharp from 'sharp';
const file = process.argv[2];
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const size=info.width;
// print alpha around bridge (89,74) for northeast
for(let y=70;y<=78;y++){
  let row='';
  for(let x=85;x<=93;x++){
    const i=(y*size+x)*4;
    row += data[i+3]===255?'#':(data[i+3]>0?'o':'.');
  }
  console.log(`y=${y}: ${row}`);
}
