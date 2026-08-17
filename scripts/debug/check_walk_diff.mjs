import sharp from "sharp";
import { readFile } from "node:fs/promises";

async function load(p) {
  const img = sharp(p);
  const meta = await img.metadata();
  const buf = await img.raw().toBuffer();
  return { buf, w: meta.width, h: meta.height, channels: meta.channels };
}

function countOpaque(buf, channels) {
  let n = 0;
  for (let i = 3; i < buf.length; i += channels) if (buf[i] >= 128) n++;
  return n;
}

function diff(a, b) {
  const ca = a.channels, cb = b.channels;
  let n = 0, sum = 0;
  const limit = Math.min(a.buf.length, b.buf.length);
  for (let i = 0; i < limit; i += 4) {
    const dr = Math.abs(a.buf[i] - b.buf[i]);
    const dg = Math.abs(a.buf[i+1] - b.buf[i+1]);
    const db = Math.abs(a.buf[i+2] - b.buf[i+2]);
    if (dr + dg + db > 30) { n++; sum += dr + dg + db; }
  }
  return { changed: n, mean: n > 0 ? sum / n : 0 };
}

const dir = "output/isometric/spider/raw/walk/southwest";
for (const f of ["0.png","1.png","2.png"]) {
  const img = await load(`${dir}/${f}`);
  console.log(`${f}: opaque=${countOpaque(img.buf, img.channels)} size=${img.w}x${img.h}`);
}
const [a, b, c] = await Promise.all(["0.png","1.png","2.png"].map(f => load(`${dir}/${f}`)));
console.log("0 vs 1:", diff(a, b));
console.log("0 vs 2:", diff(a, c));
console.log("1 vs 2:", diff(b, c));
