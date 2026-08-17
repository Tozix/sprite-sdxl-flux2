import sharp from "sharp";

// Check raw frames for green pixels (chroma spill)
const dirs = ["southwest", "northwest"];
for (const dir of dirs) {
  for (let i = 0; i < 4; i++) {
    const path = `output/isometric/spider/raw/walk/${dir}/${i}.png`;
    try {
      const img = sharp(path);
      const meta = await img.metadata();
      const buf = await img.raw().toBuffer();
      let greenInside = 0, totalGreen = 0;
      // Count green pixels
      for (let p = 0; p < buf.length; p += meta.channels) {
        const r = buf[p], g = buf[p+1], b = buf[p+2];
        if (g > 150 && g > r * 1.3 && g > b * 1.3) totalGreen++;
      }
      // Estimate inside region (away from edges — edges have green bg)
      let insideGreen = 0;
      for (let y = 50; y < meta.height - 50; y++) {
        for (let x = 50; x < meta.width - 50; x++) {
          const i = (y * meta.width + x) * meta.channels;
          const r = buf[i], g = buf[i+1], b = buf[i+2];
          if (g > 150 && g > r * 1.3 && g > b * 1.3) insideGreen++;
        }
      }
      console.log(`${dir}/${i}: totalGreen=${totalGreen} insideGreen=${insideGreen}`);
    } catch (e) { console.log(`${dir}/${i}: error`, e.message); }
  }
}
