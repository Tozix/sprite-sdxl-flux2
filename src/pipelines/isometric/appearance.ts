import sharp from "sharp";
import { ISO_CONFIG } from "./config.ts";
import { createChromaMask, isBloodColor } from "./chroma.ts";

type RgbaImage = {
  rgba: Buffer;
  info: { width: number; height: number; channels: number };
  matteMask: Uint8Array;
};

const APPEARANCE_STATS_CACHE = new Map<string, RgbStats>();

function readRgbaImage(imagePath: string): Promise<RgbaImage> {
  return sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      const rgba = Buffer.from(data);
      const matteMask = createChromaMask(rgba, info.width, info.height, info.channels);
      return { rgba, info, matteMask };
    });
}

type RgbStats = {
  count: number;
  mean: number[];
  std: number[];
};

function calculateRgbStats(
  rgba: Buffer,
  width: number,
  height: number,
  channels: number,
  matteMask: Uint8Array,
  preserveBlood = false,
): RgbStats | null {
  let count = 0;
  const mean = [0, 0, 0];
  const m2 = [0, 0, 0];

  for (let pixel = 0; pixel < width * height; pixel++) {
    if (matteMask[pixel]) continue;
    const offset = pixel * channels;
    if (
      preserveBlood &&
      isBloodColor(rgba[offset]!, rgba[offset + 1]!, rgba[offset + 2]!)
    ) {
      continue;
    }
    count++;
    for (let channel = 0; channel < 3; channel++) {
      const delta = rgba[offset + channel]! - mean[channel]!;
      mean[channel]! += delta / count;
      m2[channel]! += delta * (rgba[offset + channel]! - mean[channel]!);
    }
  }

  if (!count) return null;
  return {
    count,
    mean,
    std: m2.map((value) =>
      Math.sqrt(value / Math.max(1, count - 1)),
    ),
  };
}

async function getAppearanceReferenceStats(referencePath: string): Promise<RgbStats> {
  const key = referencePath;
  const cached = APPEARANCE_STATS_CACHE.get(key);
  if (cached) return cached;

  const reference = await readRgbaImage(referencePath);
  const stats = calculateRgbStats(
    reference.rgba,
    reference.info.width,
    reference.info.height,
    reference.info.channels,
    reference.matteMask,
    false,
  );

  if (!stats || stats.count < ISO_CONFIG.appearance.minForegroundPixels) {
    throw new Error(
      `Appearance reference has too little foreground: ${referencePath}`,
    );
  }

  APPEARANCE_STATS_CACHE.set(key, stats);
  return stats;
}

export async function stabilizeAppearanceToReference(
  candidatePath: string,
  referencePath: string | null,
  preserveBlood = false,
): Promise<{ before: number; target: number } | null> {
  if (!ISO_CONFIG.appearance.enabled || !referencePath) {
    return null;
  }

  const candidate = await readRgbaImage(candidatePath);
  const candidateStats = calculateRgbStats(
    candidate.rgba,
    candidate.info.width,
    candidate.info.height,
    candidate.info.channels,
    candidate.matteMask,
    preserveBlood,
  );

  if (
    !candidateStats ||
    candidateStats.count < ISO_CONFIG.appearance.minForegroundPixels
  ) {
    throw new Error(
      `Appearance candidate has too little foreground: ${candidatePath}`,
    );
  }

  const referenceStats = await getAppearanceReferenceStats(referencePath);
  const epsilon = 1e-6;
  const scales = [0, 1, 2].map((channel) =>
    Math.max(
      ISO_CONFIG.appearance.minStdScale,
      Math.min(
        ISO_CONFIG.appearance.maxStdScale,
        referenceStats.std[channel]! /
          Math.max(epsilon, candidateStats.std[channel]!),
      ),
    ),
  );

  for (
    let pixel = 0;
    pixel < candidate.info.width * candidate.info.height;
    pixel++
  ) {
    if (candidate.matteMask[pixel]) continue;
    const offset = pixel * candidate.info.channels;
    if (
      preserveBlood &&
      isBloodColor(
        candidate.rgba[offset]!,
        candidate.rgba[offset + 1]!,
        candidate.rgba[offset + 2]!,
      )
    ) {
      continue;
    }
    for (let channel = 0; channel < 3; channel++) {
      const original = candidate.rgba[offset + channel]!;
      const target =
        referenceStats.mean[channel]! +
        (original - candidateStats.mean[channel]!) * scales[channel]!;
      const final = original + (target - original) * ISO_CONFIG.appearance.strength;
      candidate.rgba[offset + channel] = Math.max(
        0,
        Math.min(255, Math.round(final)),
      );
    }
  }

  await sharp(candidate.rgba, {
    raw: {
      width: candidate.info.width,
      height: candidate.info.height,
      channels: candidate.info.channels,
    },
  })
    .png()
    .toFile(candidatePath);

  return {
    before: candidateStats.mean.reduce((sum, value) => sum + value, 0) / 3,
    target: referenceStats.mean.reduce((sum, value) => sum + value, 0) / 3,
  };
}
