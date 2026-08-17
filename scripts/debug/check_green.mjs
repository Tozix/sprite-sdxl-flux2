import sharp from "sharp";
const dir = "output/isometric/spider/raw/walk/southwest";
for (const f of ["0.png","1.png","2.png"]) {
  const img = sharp(`${dir}/${f}`);
  const meta = await img.metadata();
  const buf = await img.raw().toBuffer();
  let green = 0, dark = 0, total = 0;
  for (let i = 0; i < buf.length; i += meta.channels) {
    total++;
    const r = buf[i], g = buf[i+1], b = buf[i+2];
    if (g > 100 && g > r * 1.5 && g > b * 1.5) green++;
    else if (r < 80 && g < 80 && b < 80) dark++;
  }
  console.log(`${f}: green=${green} dark=${dark} total=${total}`);
}
