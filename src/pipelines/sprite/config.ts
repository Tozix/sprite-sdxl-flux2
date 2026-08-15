export const SPRITE_CONFIG = {
  server: "http://192.168.0.14:7861",
  outputDir: "./output/rat",
  generationSize: "512x512",
  steps: 4,
  sampler: "euler",
  cfg: 1.0,

  spriteSize: 96,
  paletteSize: 24,
  pixelPadding: 6,
  backgroundTolerance: 34,
  alphaThreshold: 90,
  previewScale: 6,

  walkFrames: 4,
  attackFrames: 6,
  walkBob: [1, 0, 1, 0] as readonly number[],
  attackBob: [0, 1, 0, -1, 0, 0] as readonly number[],

  directions: ["down", "left", "right", "up"] as const,

  seeds: {
    masterSide: 101,
    masterUp: 202,
    walkSide: 1000,
    walkUp: 2000,
    attackSide: 3000,
    attackUp: 4000,
  },

  shadow: {
    maxGenerateAttempts: 3,
    minComponentArea: 80,
    minAspectRatio: 2.5,
    maxHeightVsBody: 0.2,
    minWidthVsBody: 0.2,
    maxBackgroundColorDistance: 115,
  },
} as const;

export type Direction = (typeof SPRITE_CONFIG.directions)[number];
