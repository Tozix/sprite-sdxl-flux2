import sharp from "sharp";
import { ISO_CONFIG } from "./config.ts";
import { isChromaColor } from "./chroma.ts";

export type DifferenceScore = {
  meanDifference: number;
  changedFraction: number;
  silhouetteFraction: number;
};

export async function calculateImageDifference(
  firstPath: string,
  secondPath: string,
  analysisSize: number = ISO_CONFIG.motion.analysisSize,
): Promise<DifferenceScore> {
  const read = (file: string) =>
    sharp(file)
      .resize(analysisSize, analysisSize, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer();

  const [first, second] = await Promise.all([read(firstPath), read(secondPath)]);

  let totalDifference = 0;
  let relevantPixels = 0;
  let changedPixels = 0;
  let silhouetteChanged = 0;
  let unionPixels = 0;

  for (let offset = 0; offset < first.length; offset += 4) {
    const firstMatte = isChromaColor(
      first[offset]!,
      first[offset + 1]!,
      first[offset + 2]!,
      true,
    );
    const secondMatte = isChromaColor(
      second[offset]!,
      second[offset + 1]!,
      second[offset + 2]!,
      true,
    );

    if (!firstMatte || !secondMatte) {
      unionPixels++;
    }

    if (firstMatte !== secondMatte) {
      silhouetteChanged++;
    }

    if (firstMatte && secondMatte) {
      continue;
    }

    const difference =
      (Math.abs(first[offset]! - second[offset]!) +
        Math.abs(first[offset + 1]! - second[offset + 1]!) +
        Math.abs(first[offset + 2]! - second[offset + 2]!)) /
      3;

    totalDifference += difference;
    relevantPixels++;

    if (difference >= ISO_CONFIG.motion.changedPixelThreshold) {
      changedPixels++;
    }
  }

  return {
    meanDifference: relevantPixels ? totalDifference / relevantPixels : 0,
    changedFraction: relevantPixels ? changedPixels / relevantPixels : 0,
    silhouetteFraction: unionPixels ? silhouetteChanged / unionPixels : 0,
  };
}

export type Thresholds = {
  mean: number;
  changed: number;
  silhouette: number;
};

export function differenceString(score: DifferenceScore): string {
  return (
    `mean=${score.meanDifference.toFixed(2)} ` +
    `changed=${(score.changedFraction * 100).toFixed(1)}% ` +
    `silhouette=${(score.silhouetteFraction * 100).toFixed(1)}%`
  );
}

export function thresholdLabel(thresholds: Thresholds): string {
  return (
    `min=${thresholds.mean.toFixed(2)}/` +
    `${(thresholds.changed * 100).toFixed(1)}%/` +
    `${(thresholds.silhouette * 100).toFixed(1)}%`
  );
}

export function scoreFailsThresholds(
  score: DifferenceScore,
  thresholds: Thresholds,
): boolean {
  return (
    score.meanDifference < thresholds.mean ||
    score.changedFraction < thresholds.changed ||
    score.silhouetteFraction < thresholds.silhouette
  );
}

export function normalMotionThresholds(): Thresholds {
  return {
    mean: ISO_CONFIG.motion.minMean,
    changed: ISO_CONFIG.motion.minChanged,
    silhouette: ISO_CONFIG.motion.minSilhouette,
  };
}

export function contactMotionThresholds(): Thresholds {
  return {
    mean: ISO_CONFIG.motion.contactMean,
    changed: ISO_CONFIG.motion.contactChanged,
    silhouette: ISO_CONFIG.motion.contactSilhouette,
  };
}

export function walkPassingThresholds(): Thresholds {
  return {
    mean: ISO_CONFIG.motion.walkPassingMean,
    changed: ISO_CONFIG.motion.walkPassingChanged,
    silhouette: ISO_CONFIG.motion.walkPassingSilhouette,
  };
}

export function backMasterTooSimilar(score: DifferenceScore): boolean {
  let failed = 0;
  if (score.meanDifference < ISO_CONFIG.master.perspectiveMinMean) failed++;
  if (score.changedFraction < ISO_CONFIG.master.perspectiveMinChanged) failed++;
  if (score.silhouetteFraction < ISO_CONFIG.master.perspectiveMinSilhouette) failed++;
  return failed >= 2;
}

export type Validation = {
  label: string;
  path: string;
  thresholds: Thresholds;
  analysisSize?: number;
};

export type ValidationResult = {
  label: string;
  score: DifferenceScore;
  thresholds: Thresholds;
  failed: boolean;
};

export async function validateFrameDifferences(
  output: string,
  validations: Validation[],
): Promise<{ pass: boolean; results: ValidationResult[] }> {
  const results: ValidationResult[] = [];
  for (const validation of validations) {
    const score = await calculateImageDifference(
      validation.path,
      output,
      validation.analysisSize ?? ISO_CONFIG.motion.analysisSize,
    );
    const failed = scoreFailsThresholds(score, validation.thresholds);
    results.push({
      label: validation.label,
      score,
      thresholds: validation.thresholds,
      failed,
    });
  }
  return {
    pass: results.every((item) => !item.failed),
    results,
  };
}

export function validationResultsString(results: ValidationResult[]): string {
  return results
    .map(
      (item) =>
        `${item.label}:{${differenceString(item.score)} ${
          item.failed ? "LOW" : "OK"
        } ${thresholdLabel(item.thresholds)}}`,
    )
    .join(" | ");
}
