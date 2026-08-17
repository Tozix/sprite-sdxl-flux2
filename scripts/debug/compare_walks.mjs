import sharp from "sharp";

// Compare walk-sheet vs test_s0.7 (which is what walk should look like)
const wsBuf = await sharp("output/isometric/spider/sheets/walk-sheet-preview.png").raw().toBuffer();
const wsMeta = await sharp("output/isometric/spider/sheets/walk-sheet-preview.png").metadata();

// Convert test to comparable scale
const testBuf = await sharp("/tmp/test_s0.7_ifalse_c1_0.png").resize(wsMeta.width, wsMeta.height).raw().toBuffer();

// Save side-by-side
const totalW = wsMeta.width * 2 + 20;
const out = sharp({
  create: { width: totalW, height: wsMeta.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
});
await out.composite([
  { input: await sharp("output/isometric/spider/sheets/walk-sheet-preview.png").toBuffer(), left: 0, top: 0 },
  { input: "/tmp/test_s0.7_ifalse_c1_0.png", left: wsMeta.width + 20, top: 0 },
]).png().toFile("/tmp/compare_walks.png");
console.log("saved /tmp/compare_walks.png (walk-sheet on left, single test frame on right)");
