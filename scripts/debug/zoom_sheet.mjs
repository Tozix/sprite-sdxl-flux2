import sharp from "sharp";
const sheet = sharp("output/isometric/spider/sheets/walk-sheet-preview.png");
const meta = await sheet.metadata();
console.log("sheet size:", meta.width, "x", meta.height);

// The sheet is likely 4 rows x 4 cols of spiders
// Each cell is meta.width/4 wide, meta.height/4 tall
const cellW = Math.floor(meta.width / 4);
const cellH = Math.floor(meta.height / 4);
console.log("cell:", cellW, "x", cellH);

// Zoom into row 2 (southeast)
const row = 1; // 0=sw, 1=southeast (mirror), 2=nw, 3=ne
await sharp("output/isometric/spider/sheets/walk-sheet-preview.png")
  .extract({ left: 0, top: row * cellH, width: meta.width, height: cellH })
  .png()
  .toFile("/tmp/walk_sheet_row.png");
console.log("saved /tmp/walk_sheet_row.png");
