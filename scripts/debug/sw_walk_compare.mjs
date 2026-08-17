import sharp from "sharp";

const frames = [];
for (let i = 0; i < 4; i++) {
  const buf = await sharp(`output/isometric/spider/raw/walk/southwest/${i}.png`).resize(220, 220).png().toBuffer();
  frames.push(buf);
}

const totalW = 4 * 220;
const totalH = 220;
const out = sharp({
  create: { width: totalW, height: totalH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
});
const composite = [];
for (let i = 0; i < 4; i++) {
  composite.push({ input: frames[i], top: 0, left: i * 220 });
}
await out.composite(composite).png().toFile("/tmp/sw_walk_4.png");
console.log("saved /tmp/sw_walk_4.png");
