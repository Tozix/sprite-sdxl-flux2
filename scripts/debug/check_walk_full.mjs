import sharp from "sharp";
import { readFile } from "node:fs/promises";

async function load(p) {
  const img = sharp(p);
  const meta = await img.metadata();
  const buf = await img.raw().toBuffer();
  return { buf, w: meta.width, h: meta.height, channels: meta.channels };
}

function countDark(buf, channels) {
  let n = 0;
  for (let i = 0; i < buf.length; i += channels) {
    const r = buf[i], g = buf[i+1], b = buf[i+2];
    if (r < 80 && g < 80 && b < 80) n++;
  }
  return n;
}

const dirs = ["southwest", "southeast", "northeast", "northwest"];
for (const dir of dirs) {
  const path = `output/isometric/spider/raw/walk/${dir}`;
  const frames = [];
  for (let i = 0; i < 4; i++) {
    const img = await load(`${path}/${i}.png`);
    frames.push(countDark(img.buf, img.channels));
  }
  console.log(`${dir}: dark per frame: 0=${frames[0]} 1=${frames[1]} 2=${frames[2]} 3=${frames[3]} range=${Math.max(...frames) - Math.min(...frames)} (${((Math.max(...frames) - Math.min(...frames)) / frames[0] * 100).toFixed(1)}%)`);
}
