import sharp from "sharp";
for (const d of ["southwest","southeast","northwest","northeast"]) {
  const SRC=`output/isometric/spider/sprites/idle/${d}/0.png`;
  await sharp(SRC).flatten({background:{r:255,g:255,b:255}}).resize(640,640,{kernel:sharp.kernel.nearest}).png().toFile(`/tmp/idle_${d}.png`);
}
console.log("done");
