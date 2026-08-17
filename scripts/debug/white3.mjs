import sharp from "sharp";
for (const f of [3,5]) {
  const SRC=`output/isometric/spider/sprites/attack/southwest/${f}.png`;
  await sharp(SRC).flatten({background:{r:255,g:255,b:255}}).resize(640,640,{kernel:sharp.kernel.nearest}).png().toFile(`/tmp/white${f}.png`);
}
console.log("done");
