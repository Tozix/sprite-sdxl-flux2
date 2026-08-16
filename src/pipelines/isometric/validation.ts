import sharp from "sharp";
import { ISO_CONFIG } from "./config.ts";
import { createChromaMask, isEarPink } from "./chroma.ts";

export type Component = {
  pixels: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export function findConnectedComponents(
  mask: Uint8Array,
  width: number,
  height: number,
): Component[] {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const result: Component[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;

    let read = 0;
    let write = 0;
    queue[write++] = start;
    visited[start] = 1;

    let pixels = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (read < write) {
      const pixel = queue[read++]!;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      pixels++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (!mask[next] || visited[next]) continue;
          visited[next] = 1;
          queue[write++] = next;
        }
      }
    }

    result.push({
      pixels,
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
  }

  return result;
}

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export async function getForegroundBounds(imagePath: string): Promise<Bounds | null> {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const rgba = Buffer.from(data);
  const matte = createChromaMask(rgba, info.width, info.height, info.channels);

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let pixel = 0; pixel < matte.length; pixel++) {
    if (matte[pixel]) continue;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (maxX < minX) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export type EarAnalysis = {
  count: number;
  components: Component[];
  searchArea?: { minX: number; minY: number; maxX: number; maxY: number };
};

export async function analyzeEarComponents(imagePath: string): Promise<EarAnalysis> {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const rgba = Buffer.from(data);
  const matte = createChromaMask(rgba, info.width, info.height, info.channels);
  const bounds = await getForegroundBounds(imagePath);

  if (!bounds) {
    return { count: 0, components: [] };
  }

  const searchMinX = bounds.minX;
  const searchMaxX = Math.min(
    info.width - 1,
    Math.round(bounds.minX + bounds.width * 0.58),
  );
  const searchMinY = bounds.minY;
  const searchMaxY = Math.min(
    info.height - 1,
    Math.round(bounds.minY + bounds.height * 0.58),
  );

  const pinkMask = new Uint8Array(info.width * info.height);
  for (let y = searchMinY; y <= searchMaxY; y++) {
    for (let x = searchMinX; x <= searchMaxX; x++) {
      const pixel = y * info.width + x;
      if (matte[pixel]) continue;
      const offset = pixel * info.channels;
      if (isEarPink(rgba[offset]!, rgba[offset + 1]!, rgba[offset + 2]!)) {
        pinkMask[pixel] = 1;
      }
    }
  }

  const rawComponents = findConnectedComponents(pinkMask, info.width, info.height);
  const components = rawComponents
    .filter((component) => {
      if (component.pixels < ISO_CONFIG.master.minEarComponentPixels) return false;
      if (component.width < 4 || component.height < 4) return false;
      return true;
    })
    .sort((a, b) => b.pixels - a.pixels);

  return {
    count: components.length,
    components,
    searchArea: {
      minX: searchMinX,
      minY: searchMinY,
      maxX: searchMaxX,
      maxY: searchMaxY,
    },
  };
}

export function earAnalysisString(analysis: EarAnalysis): string {
  const components = analysis.components
    .map(
      (component, index) =>
        `#${index + 1}:${component.pixels}px/${component.width}x${component.height}`,
    )
    .join(",");
  return `count=${analysis.count}` + (components ? ` [${components}]` : "");
}

export async function validateMasterEarQA(
  imagePath: string,
): Promise<{ pass: boolean; analysis: EarAnalysis }> {
  if (!ISO_CONFIG.master.earQAEnabled) {
    return { pass: true, analysis: { count: 0, components: [] } };
  }
  const analysis = await analyzeEarComponents(imagePath);
  return {
    pass: analysis.count <= ISO_CONFIG.master.maxEarComponents,
    analysis,
  };
}
