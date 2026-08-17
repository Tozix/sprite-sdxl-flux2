import { envString, envInt, envFloat, envBool } from "../../env.ts";

export const ISO_CONFIG = {
  server: envString("IRON_ARCANA_AI_SERVER", "http://192.168.0.16:7861"),

  outputDir: envString("IRON_ARCANA_OUTPUT_DIR", "./output/isometric"),

  generation: {
    size: envInt("IRON_ARCANA_GENERATION_SIZE", 384, 128, 2048),
    steps: envInt("IRON_ARCANA_GENERATION_STEPS", 4, 1, 100),
    sampler: envString("IRON_ARCANA_SAMPLER", "euler"),
    cfg: envFloat("IRON_ARCANA_CFG", 1.0, 0, 30),
    retrySeedOffset: envInt(
      "IRON_ARCANA_RETRY_SEED_OFFSET",
      7919,
      1,
      1_000_000,
    ),
    masterStrength: envFloat("IRON_ARCANA_MASTER_STRENGTH", 0.4, 0, 1),
    motionStrength: envFloat("IRON_ARCANA_MOTION_STRENGTH", 0.7, 0, 1),
    textOnlyMotion: envBool("IRON_ARCANA_TEXT_ONLY_MOTION", false),
  },

  sprite: {
    size: envInt("IRON_ARCANA_SPRITE_SIZE", 96, 16, 512),
    paletteSize: envInt("IRON_ARCANA_PALETTE_SIZE", 28, 8, 256),
    previewScale: envInt("IRON_ARCANA_PREVIEW_SCALE", 3, 1, 12),
    alphaThreshold: envInt("IRON_ARCANA_ALPHA_THRESHOLD", 40, 0, 255),
  },

  chroma: {
    hex: envString("IRON_ARCANA_CHROMA_COLOR", "#00FF00"),
    hueToleranceDegrees: envFloat(
      "IRON_ARCANA_CHROMA_HUE_TOLERANCE",
      48,
      0,
      180,
    ),
    minSaturation: envFloat("IRON_ARCANA_CHROMA_MIN_SATURATION", 0.28, 0, 1),
    minValue: envFloat("IRON_ARCANA_CHROMA_MIN_VALUE", 0.12, 0, 1),
    directDistance: envFloat("IRON_ARCANA_CHROMA_DIRECT_DISTANCE", 150, 0, 500),
    spillPasses: envInt("IRON_ARCANA_CHROMA_SPILL_PASSES", 1, 0, 5),
    spillHueToleranceDegrees: envFloat(
      "IRON_ARCANA_CHROMA_SPILL_HUE_TOLERANCE",
      58,
      0,
      180,
    ),
    spillMinSaturation: envFloat(
      "IRON_ARCANA_CHROMA_SPILL_MIN_SATURATION",
      0.18,
      0,
      1,
    ),
    spillMinValue: envFloat("IRON_ARCANA_CHROMA_SPILL_MIN_VALUE", 0.12, 0, 1),
  },

  appearance: {
    enabled: envBool("IRON_ARCANA_APPEARANCE_LOCK", true),
    strength: envFloat("IRON_ARCANA_APPEARANCE_STRENGTH", 1.0, 0, 1),
    minStdScale: envFloat(
      "IRON_ARCANA_APPEARANCE_MIN_STD_SCALE",
      0.6,
      0.05,
      10,
    ),
    maxStdScale: envFloat(
      "IRON_ARCANA_APPEARANCE_MAX_STD_SCALE",
      1.8,
      0.05,
      10,
    ),
    minForegroundPixels: envInt(
      "IRON_ARCANA_APPEARANCE_MIN_FOREGROUND_PIXELS",
      256,
      1,
      1_000_000,
    ),
  },

  master: {
    maxAttempts: envInt("IRON_ARCANA_MASTER_MAX_ATTEMPTS", 3, 1, 8),
    referenceAttempts: envInt(
      "IRON_ARCANA_MASTER_BACK_REFERENCE_ATTEMPTS",
      2,
      0,
      8,
    ),
    perspectiveMinMean: envFloat(
      "IRON_ARCANA_MASTER_PERSPECTIVE_MIN_MEAN",
      9.0,
      0,
      255,
    ),
    perspectiveMinChanged: envFloat(
      "IRON_ARCANA_MASTER_PERSPECTIVE_MIN_CHANGED",
      0.12,
      0,
      1,
    ),
    perspectiveMinSilhouette: envFloat(
      "IRON_ARCANA_MASTER_PERSPECTIVE_MIN_SILHOETTE",
      0.035,
      0,
      1,
    ),
    earQAEnabled: envBool("IRON_ARCANA_MASTER_EAR_QA", true),
    maxEarComponents: envInt("IRON_ARCANA_MASTER_MAX_EAR_COMPONENTS", 2, 1, 6),
    minEarComponentPixels: envInt(
      "IRON_ARCANA_MASTER_MIN_EAR_COMPONENT_PIXELS",
      500,
      5,
      10_000,
    ),
  },

  motion: {
    analysisSize: envInt("IRON_ARCANA_MOTION_ANALYSIS_SIZE", 128, 32, 512),
    changedPixelThreshold: envFloat(
      "IRON_ARCANA_MOTION_CHANGED_PIXEL_THRESHOLD",
      15,
      0,
      255,
    ),
    minMean: envFloat("IRON_ARCANA_MOTION_MIN_MEAN_DIFFERENCE", 4.5, 0, 255),
    minChanged: envFloat(
      "IRON_ARCANA_MOTION_MIN_CHANGED_FRACTION",
      0.055,
      0,
      1,
    ),
    minSilhouette: envFloat(
      "IRON_ARCANA_MOTION_MIN_SILHOUETTE_CHANGED_FRACTION",
      0.018,
      0,
      1,
    ),
    contactMean: envFloat("IRON_ARCANA_CONTACT_MIN_MEAN_DIFFERENCE", 5.5, 0, 255),
    contactChanged: envFloat("IRON_ARCANA_CONTACT_MIN_CHANGED_FRACTION", 0.065, 0, 1),
    contactSilhouette: envFloat(
      "IRON_ARCANA_CONTACT_MIN_SILHOUETTE_CHANGED_FRACTION",
      0.025,
      0,
      1,
    ),
    walkPassingMean: envFloat("IRON_ARCANA_WALK_PASSING_MIN_MEAN", 9.0, 0, 255),
    walkPassingChanged: envFloat(
      "IRON_ARCANA_WALK_PASSING_MIN_CHANGED",
      0.1,
      0,
      1,
    ),
    walkPassingSilhouette: envFloat(
      "IRON_ARCANA_WALK_PASSING_MIN_SILHOETTE",
      0.04,
      0,
      1,
    ),
    retryWeakPose: envBool("IRON_ARCANA_RETRY_WEAK_POSE", true),
    maxAttempts: envInt("IRON_ARCANA_MOTION_MAX_ATTEMPTS", 2, 1, 4),
  },

  animations: {
    walkFrames: 4,
    attackFrames: 6,
    hitVariants: envInt("IRON_ARCANA_HIT_VARIANTS", 2, 1, 4),
    hitFrames: envInt("IRON_ARCANA_HIT_FRAMES", 3, 2, 5),
    deathFrames: envInt("IRON_ARCANA_DEATH_FRAMES", 5, 3, 8),
    corpseVariants: envInt("IRON_ARCANA_CORPSE_VARIANTS", 3, 1, 6),
  },

  network: {
    pollIntervalMs: envInt("IRON_ARCANA_POLL_INTERVAL_MS", 750, 100, 10_000),
    cooldownMs: envInt("IRON_ARCANA_GENERATION_COOLDOWN_MS", 150, 0, 10_000),
    jobTimeoutMs: envInt(
      "IRON_ARCANA_JOB_TIMEOUT_MS",
      15 * 60_000,
      10_000,
      60 * 60_000,
    ),
    requestAttempts: envInt("IRON_ARCANA_NETWORK_REQUEST_ATTEMPTS", 4, 1, 10),
  },
} as const;

if (ISO_CONFIG.appearance.minStdScale > ISO_CONFIG.appearance.maxStdScale) {
  throw new Error(
    "IRON_ARCANA_APPEARANCE_MIN_STD_SCALE must be <= IRON_ARCANA_APPEARANCE_MAX_STD_SCALE",
  );
}

export const PHASE_SEED_OFFSETS = [0, 37, 1009, 1046, 2018, 2055, 3027, 3064] as const;

export function phaseSeed(base: number, frame: number): number {
  return base + PHASE_SEED_OFFSETS[frame % PHASE_SEED_OFFSETS.length]!;
}

export type CanonicalDirection = "southwest" | "northwest";
export type Direction = CanonicalDirection | "southeast" | "northeast";
export const CANONICAL_DIRECTIONS: readonly CanonicalDirection[] = [
  "southwest",
  "northwest",
];

export const DIRECTIONS: readonly Direction[] = [
  "southwest",
  "southeast",
  "northeast",
  "northwest",
];

export const MIRROR_DIRECTION: Record<Direction, Direction> = {
  southwest: "southeast",
  northwest: "northeast",
  southeast: "southwest",
  northeast: "northwest",
};

export const SEEDS = {
  masterFrontLeft: 101,
  masterBackLeft: 202,
  walkSouthwest: 1000,
  walkNorthwest: 2000,
  attackSouthwest: 3000,
  attackNorthwest: 4000,
  hitSouthwest: 5000,
  hitNorthwest: 6000,
  deathSouthwest: 7000,
  deathNorthwest: 8000,
  corpseSouthwest: 9000,
  corpseNorthwest: 10000,
} as const;
