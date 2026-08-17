import sharp from "sharp";

async function load(p) {
  const img = sharp(p);
  const meta = await img.metadata();
  const buf = await img.raw().toBuffer();
  return { buf, w: meta.width, h: meta.height, channels: meta.channels };
}

function changedPixels(a, b, thresh = 30) {
  let n = 0;
  const limit = Math.min(a.buf.length, b.buf.length);
  for (let i = 0; i < limit; i += 4) {
    const dr = Math.abs(a.buf[i] - b.buf[i]);
    const dg = Math.abs(a.buf[i+1] - b.buf[i+1]);
    const db = Math.abs(a.buf[i+2] - b.buf[i+2]);
    if (dr + dg + db > thresh) n++;
  }
  return n;
}

const dirs = ["southwest", "northwest"];
for (const dir of dirs) {
  const path = `output/isometric/spider/raw/walk/${dir}`;
  const imgs = [];
  for (let i = 0; i < 4; i++) imgs.push(await load(`${path}/${i}.png`));
  console.log(`\n${dir}:`);
  for (let i = 0; i < 4; i++) {
    for (let j = i+1; j < 4; j++) {
      const n = changedPixels(imgs[i], imgs[j]);
      console.log(`  ${i} vs ${j}: changed=${n} (${(n / (384*384) * 100).toFixed(2)}%)`);
    }
  }
}
