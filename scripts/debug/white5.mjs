import sharp from "sharp";
const SRC="output/isometric/spider/sprites/attack/southwest/5.png";
await sharp(SRC).flatten({background:{r:255,g:255,b:255}}).resize(480,480,{kernel:sharp.kernel.nearest}).png().toFile("/tmp/white5.png");
console.log("done");
