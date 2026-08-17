import sharp from "sharp";

const direction = process.argv[2] || "northeast";
const frames = [];
for (let i = 0; i < 4; i++) {
  const buf = await sharp(`output/isometric/spider/raw/walk/${direction}/${i}.png`).resize(220, 220).png().toBuffer();
  frames.push(buf);
}
const totalW = 4 * 220;
const out = sharp({
  create: { width: totalW, height: 220, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
});
const composite = [];
for (let i = 0; i < 4; i++) {
  composite.push({ input: frames[i], top: 0, left: i * 220 });
}
await out.composite(composite).png().toFile(`/tmp/walk_${direction}.png`);
console.log(`saved /tmp/walk_${direction}.png`);
