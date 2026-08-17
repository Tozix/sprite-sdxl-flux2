import sharp from "sharp";

// Combine southwest 0, 1, 2 vertically with labels
const frames = [];
for (const i of [0, 1, 2]) {
  const img = sharp(`output/isometric/spider/raw/walk/southwest/${i}.png`);
  frames.push(await img.resize(200, 200).png().toBuffer());
}

const totalH = frames.length * 200;
const totalW = 200;
const out = sharp({
  create: { width: totalW, height: totalH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
});
const composite = [];
for (let i = 0; i < frames.length; i++) {
  composite.push({ input: frames[i], top: i * 200, left: 0 });
}
await out.composite(composite).png().toFile("/tmp/sw_walk_compare.png");
console.log("saved /tmp/sw_walk_compare.png");
