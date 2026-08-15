import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/*
|--------------------------------------------------------------------------
| ENV
|--------------------------------------------------------------------------
*/

async function loadEnv(file = ".env") {
  try {
    const text = await fs.readFile(file, "utf8");

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const index = line.indexOf("=");

      if (index <= 0) {
        continue;
      }

      const key = line.slice(0, index).trim();

      let value = line.slice(index + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      } else {
        const commentIndex = value.indexOf(" #");

        if (commentIndex >= 0) {
          value = value.slice(0, commentIndex).trim();
        }
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function envString(name, fallback) {
  const value = process.env[name];

  return value === undefined || value === "" ? fallback : value;
}

function envInt(name, fallback, min = -Infinity, max = Infinity) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);

  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid integer env ${name}=${JSON.stringify(raw)}`);
  }

  return value;
}

function envFloat(name, fallback, min = -Infinity, max = Infinity) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number.parseFloat(raw);

  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid number env ${name}=${JSON.stringify(raw)}`);
  }

  return value;
}

function envBool(name, fallback) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = raw.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  throw new Error(`Invalid boolean env ${name}=${JSON.stringify(raw)}`);
}

await loadEnv(envString("IRON_ARCANA_ENV_FILE", ".env"));

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const CONFIG = {
  server: envString("IRON_ARCANA_AI_SERVER", "http://192.168.0.14:7861"),

  outputDir: envString("IRON_ARCANA_OUTPUT_DIR", "./output/rat-isometric"),

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
  },

  sprite: {
    size: envInt("IRON_ARCANA_SPRITE_SIZE", 96, 16, 512),

    paletteSize: envInt("IRON_ARCANA_PALETTE_SIZE", 28, 8, 256),

    previewScale: envInt("IRON_ARCANA_PREVIEW_SCALE", 3, 1, 12),

    alphaThreshold: envInt("IRON_ARCANA_ALPHA_THRESHOLD", 90, 0, 255),
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

    minValue: envFloat("IRON_ARCANA_CHROMA_MIN_VALUE", 0.035, 0, 1),

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

    spillMinValue: envFloat("IRON_ARCANA_CHROMA_SPILL_MIN_VALUE", 0.025, 0, 1),
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
      "IRON_ARCANA_MASTER_PERSPECTIVE_MIN_SILHOUETTE",
      0.035,
      0,
      1,
    ),

    earQAEnabled: envBool("IRON_ARCANA_MASTER_EAR_QA", true),

    maxEarComponents: envInt("IRON_ARCANA_MASTER_MAX_EAR_COMPONENTS", 2, 1, 6),

    minEarComponentPixels: envInt(
      "IRON_ARCANA_MASTER_MIN_EAR_COMPONENT_PIXELS",
      45,
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

    contactMean: envFloat(
      "IRON_ARCANA_CONTACT_MIN_MEAN_DIFFERENCE",
      5.5,
      0,
      255,
    ),

    contactChanged: envFloat(
      "IRON_ARCANA_CONTACT_MIN_CHANGED_FRACTION",
      0.065,
      0,
      1,
    ),

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
      "IRON_ARCANA_WALK_PASSING_MIN_SILHOUETTE",
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
};

const FORCE = process.argv.includes("--force");

if (CONFIG.appearance.minStdScale > CONFIG.appearance.maxStdScale) {
  throw new Error(
    "IRON_ARCANA_APPEARANCE_MIN_STD_SCALE must be <= IRON_ARCANA_APPEARANCE_MAX_STD_SCALE",
  );
}

/*
|--------------------------------------------------------------------------
| DIRECTIONS / SEEDS
|--------------------------------------------------------------------------
*/

const DIRECTIONS = ["southwest", "southeast", "northeast", "northwest"];

const CANONICAL_DIRECTIONS = ["southwest", "northwest"];

const MIRROR_DIRECTION = {
  southwest: "southeast",
  northwest: "northeast",
};

const SEEDS = {
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
};

const PHASE_SEED_OFFSETS = [0, 37, 1009, 1046, 2018, 2055, 3027, 3064];

function phaseSeed(base, frame) {
  return base + PHASE_SEED_OFFSETS[frame % PHASE_SEED_OFFSETS.length];
}

/*
|--------------------------------------------------------------------------
| LOGGING / TIMINGS
|--------------------------------------------------------------------------
*/

const METRICS = {
  start: performance.now(),

  stages: [],

  aiJobs: 0,

  aiFailures: 0,

  aiMs: 0,
};

function formatDuration(ms) {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }

  return `${Math.floor(ms / 60_000)}m ${((ms % 60_000) / 1000).toFixed(1)}s`;
}

function sinceStart() {
  return `+${formatDuration(performance.now() - METRICS.start)}`;
}

function log(tag, ...args) {
  console.log(`[${sinceStart()}] [${tag}]`, ...args);
}

function warn(tag, ...args) {
  console.warn(`[${sinceStart()}] [${tag}]`, ...args);
}

async function stage(name, fn) {
  const started = performance.now();

  log("STAGE", `START ${name}`);

  try {
    const result = await fn();

    const ms = performance.now() - started;

    METRICS.stages.push({
      name,
      ms,
      ok: true,
    });

    log("STAGE", `DONE  ${name} ${formatDuration(ms)}`);

    return result;
  } catch (error) {
    const ms = performance.now() - started;

    METRICS.stages.push({
      name,
      ms,
      ok: false,
    });

    warn("STAGE", `FAIL  ${name} ${formatDuration(ms)}`);

    throw error;
  }
}

function printSummary() {
  console.log("\n======================================");

  console.log("TIMING SUMMARY");

  console.log("======================================");

  for (const item of METRICS.stages) {
    console.log(
      `${item.ok ? "OK " : "ERR"} ${item.name.padEnd(32)} ${formatDuration(
        item.ms,
      )}`,
    );
  }

  console.log("--------------------------------------");

  console.log(`AI jobs:        ${METRICS.aiJobs}`);

  console.log(`AI failures:    ${METRICS.aiFailures}`);

  console.log(`AI total:       ${formatDuration(METRICS.aiMs)}`);

  if (METRICS.aiJobs) {
    console.log(
      `AI avg/job:     ${formatDuration(METRICS.aiMs / METRICS.aiJobs)}`,
    );
  }

  console.log(
    `PIPELINE TOTAL: ${formatDuration(performance.now() - METRICS.start)}`,
  );

  console.log("======================================");
}

/*
|--------------------------------------------------------------------------
| PATHS
|--------------------------------------------------------------------------
*/

const PATHS = {
  sourceAI: path.join(CONFIG.outputDir, "source-ai"),

  masters: path.join(CONFIG.outputDir, "masters"),

  raw: path.join(CONFIG.outputDir, "raw"),

  sprites: path.join(CONFIG.outputDir, "sprites"),

  sheets: path.join(CONFIG.outputDir, "sheets"),
};

PATHS.masterFrontLeft = path.join(PATHS.masters, "master-front-left.png");

PATHS.masterBackLeft = path.join(PATHS.masters, "master-back-left.png");

PATHS.palette = path.join(CONFIG.outputDir, "palette.json");

async function exists(file) {
  try {
    await fs.access(file);

    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, {
    recursive: true,
  });
}

function sourceAIPath(cleanPath) {
  return path.join(
    PATHS.sourceAI,

    path.relative(CONFIG.outputDir, cleanPath),
  );
}

function relativeLabel(file) {
  return path.relative(CONFIG.outputDir, file).replaceAll(path.sep, "/");
}

function rawPath(animation, direction, frame = 0, variant = null) {
  return variant === null
    ? path.join(PATHS.raw, animation, direction, `${frame}.png`)
    : path.join(
        PATHS.raw,
        animation,
        `variant-${variant}`,
        direction,
        `${frame}.png`,
      );
}

function spritePath(animation, direction, frame = 0, variant = null) {
  return variant === null
    ? path.join(PATHS.sprites, animation, direction, `${frame}.png`)
    : path.join(
        PATHS.sprites,
        animation,
        `variant-${variant}`,
        direction,
        `${frame}.png`,
      );
}

function masterForDirection(direction) {
  return direction === "southwest"
    ? PATHS.masterFrontLeft
    : PATHS.masterBackLeft;
}

async function prepareDirectories() {
  const dirs = [
    PATHS.sourceAI,
    PATHS.masters,
    PATHS.raw,
    PATHS.sprites,
    PATHS.sheets,

    path.join(PATHS.sourceAI, "masters"),
  ];

  for (const animation of ["walk", "attack", "death"]) {
    for (const direction of DIRECTIONS) {
      dirs.push(path.join(PATHS.raw, animation, direction));

      dirs.push(path.join(PATHS.sprites, animation, direction));

      dirs.push(path.join(PATHS.sourceAI, "raw", animation, direction));
    }
  }

  for (let variant = 0; variant < CONFIG.animations.hitVariants; variant++) {
    for (const direction of DIRECTIONS) {
      dirs.push(path.join(PATHS.raw, "hit", `variant-${variant}`, direction));

      dirs.push(
        path.join(PATHS.sprites, "hit", `variant-${variant}`, direction),
      );

      dirs.push(
        path.join(
          PATHS.sourceAI,
          "raw",
          "hit",
          `variant-${variant}`,
          direction,
        ),
      );
    }
  }

  for (let variant = 0; variant < CONFIG.animations.corpseVariants; variant++) {
    for (const direction of DIRECTIONS) {
      dirs.push(
        path.join(PATHS.raw, "corpse", `variant-${variant}`, direction),
      );

      dirs.push(
        path.join(PATHS.sprites, "corpse", `variant-${variant}`, direction),
      );

      dirs.push(
        path.join(
          PATHS.sourceAI,
          "raw",
          "corpse",
          `variant-${variant}`,
          direction,
        ),
      );
    }
  }

  for (const direction of DIRECTIONS) {
    dirs.push(path.join(PATHS.sprites, "idle", direction));
  }

  for (const dir of dirs) {
    await ensureDir(dir);
  }
}

/*
|--------------------------------------------------------------------------
| PROMPTS
|--------------------------------------------------------------------------
*/

const ISOMETRIC_CAMERA = `
CAMERA AND PROJECTION:

Use one fixed classic three-quarter isometric game camera.

The camera is elevated above the creature and looks downward
at a consistent angle.

Use orthographic dimetric projection compatible with classic
2-to-1 isometric game tiles.

There is NO perspective convergence.

Preserve exactly:

- camera elevation
- camera angle
- projection
- zoom
- apparent creature scale

This is NOT:

- strict side profile
- direct top-down
- eye-level view
- cinematic perspective
`.trim();

const CHROMA_BACKGROUND = `
CRITICAL BACKGROUND REQUIREMENT:

Use one completely uniform chroma-key matte background.

Exact requested matte color:

${CONFIG.chroma.hex}

There is NO floor.

There is NO visible ground surface.

ABSOLUTELY NO SHADOW IS ALLOWED.

Forbidden outside the intended subject silhouette:

- cast shadow
- contact shadow
- ground shadow
- ambient occlusion
- floor mark
- dust
- debris
- motion trail
- external glow
- background gradient
- background texture

Do not cast chroma-colored rim light onto the subject.
`.trim();

const NO_SYMBOLS = `
Do not render:

- arrows
- labels
- words
- text
- numbers
- icons
- guides
- markers
- diagrams
- UI
- borders
- motion lines
`.trim();

const RAT_STYLE = `
CHARACTER:

A hostile sewer rat enemy from a grim dark medieval fantasy MMORPG.

BODY:

- lean compact rat body
- low predatory stance
- tense shoulders
- strong hindquarters
- slightly arched spine

FUR:

- dark desaturated charcoal-brown
- dirty dark gray-brown secondary tones
- lighter dirty gray-beige underside
- restrained rough fur tufts

HEAD:

- narrow aggressive rat muzzle
- hostile dark amber-red eye
- tiny eye highlight
- muted dirty pink nose
- tense whiskers

EARS:

- exactly TWO anatomical ears total
- one near ear
- one far ear
- normal rat ear anatomy
- muted dirty pink inner ear
- no third ear
- no duplicated ear

PAWS:

- dirty muted pink
- visible toes
- tiny dark claws

TAIL:

- exactly one normal biological rat tail
- long and thin
- smoothly tapered
- muted dirty flesh-pink
- mostly uniform pink coloration
- only subtle natural shading
- NO stripes
- NO rings
- NO black bands
- NO segmented coloration

MOOD:

- hostile
- predatory
- grim
- suspicious
- dangerous

Do not make the rat:

- cute
- friendly
- plush
- magical
- undead
- mutated
`.trim();

const TAIL_INTEGRITY = `
TAIL INTEGRITY — HARD REQUIREMENT:

The rat has exactly ONE normal biological rat tail.

The tail must be:

- one continuous anatomical shape
- physically attached to the pelvis
- long
- thin
- smoothly tapered toward the tip
- muted dirty flesh-pink
- visually continuous from base to tip

STRICTLY FORBIDDEN ON THE TAIL:

- black rings
- dark rings
- gray rings
- stripes
- bands
- alternating colors
- segmented coloration
- raccoon-like markings
- reptile-like markings
- armor-like segments
- wrapped bands
- black sections
- decorative patterns

The base may be slightly darker pink than the tip,
but there must be NO repeated banding or rings.
`.trim();

const EAR_INTEGRITY = `
EAR ANATOMY — ABSOLUTE HARD REQUIREMENT:

THE RAT HAS EXACTLY TWO EARS TOTAL.

COUNT THEM BEFORE FINISHING THE IMAGE:

EAR 1:
- one near ear attached to one side of the skull

EAR 2:
- one far ear attached to the opposite side of the skull

THERE IS NO EAR 3.

STRICTLY FORBIDDEN:

- third ear
- extra ear
- duplicated ear
- duplicated near ear
- duplicated far ear
- double far ear
- additional pink ear behind the skull
- additional pink shape above the skull
- extra triangular pink flap
- extra triangular dark flap
- ear-like horn
- ear-like spike
- detached ear
- two ears growing from the same skull side
- three triangular shapes on top of the head
- hidden extra ear behind another ear

IMPORTANT:

Do NOT interpret fur tufts as an additional ear.

Do NOT draw a third triangular silhouette
between or behind the two ears.

The complete head silhouette must contain
EXACTLY TWO ear protrusions.

FINAL EAR COUNT:

2

NOT 3.

NOT 4.

EXACTLY 2.
`.trim();

const ANATOMY_INTEGRITY = `
ANATOMY INTEGRITY — HARD REQUIREMENT:

The rat has exactly four anatomical limbs.

Every visible paw must remain attached to its corresponding leg.

When a leg moves, move the ENTIRE LIMB including the paw.

STRICTLY FORBIDDEN:

- detached paw
- floating paw
- duplicate paw
- ghost paw
- extra limb
- duplicated leg
- disconnected foot
- residual old limb fragment
`.trim();

const ART_STYLE = `
ART STYLE:

- grim dark-fantasy RPG game asset
- clean stylized 2D source artwork
- strong dark outline
- crisp boundaries
- controlled flat colors
- restrained shading inside the subject silhouette
- enough detail for later ${CONFIG.sprite.size}x${CONFIG.sprite.size} pixel-art reduction
- approximately 16 to 28 useful colors

DO NOT USE:

- photorealism
- painterly rendering
- airbrush
- soft focus
- excessive gradients
- photographic fur texture
- cinematic lighting
`.trim();

const IDENTITY_LOCK = `
REFERENCE IS THE CANONICAL CHARACTER APPEARANCE.

Preserve:

- species
- skull proportions
- muzzle proportions
- eye color
- ear design
- exactly TWO ears
- fur palette
- body mass
- paw material
- tail thickness
- pink tail material
- line-art style

IMPORTANT:

The reference is NOT a pose template.

The reference is NOT an orientation template.

When the requested pose or facing differs,
IGNORE the reference pose
and obey the requested pose/facing.
`.trim();

const COLOR_LOCK_PROMPT = `
COLOR / LIGHTING LOCK — HARD REQUIREMENT:

The reference image is the color authority.

Do NOT:

- darken the rat globally
- shift fur hue
- change exposure
- change gamma
- change global contrast
- turn brown fur black

The same body part must keep approximately
the same material color and brightness
in every animation frame.
`.trim();

/*
|--------------------------------------------------------------------------
| MASTER FRONT LEFT
|--------------------------------------------------------------------------
*/

const MASTER_FRONT_LEFT_PROMPT = `
Create one isolated fantasy sewer rat enemy.

${ISOMETRIC_CAMERA}

ORIENTATION:

The rat faces diagonally toward SCREEN LOWER-LEFT.

Its nose points lower-left.

Its rear body extends upper-right.

This is a THREE-QUARTER FRONT-AND-SIDE VIEW.

The viewer sees:

- muzzle
- nose
- one hostile eye
- chest
- side of torso
- upper surface of back
- all four limbs
- hindquarters
- EXACTLY TWO ears
- tail

HEAD SILHOUETTE:

There are exactly TWO ear protrusions above the skull.

One near ear.

One far ear.

There is NO third triangular object.

There is NO third ear.

${RAT_STYLE}

${EAR_INTEGRITY}

${TAIL_INTEGRITY}

${ANATOMY_INTEGRITY}

${ART_STYLE}

Full body visible.

Centered composition.

Keep generous empty matte around the rat.

${NO_SYMBOLS}

${CHROMA_BACKGROUND}
`.trim();

/*
|--------------------------------------------------------------------------
| MASTER BACK LEFT
|--------------------------------------------------------------------------
*/

const MASTER_BACK_LEFT_PROMPT = `
Use the reference image ONLY as the appearance and character reference
for the SAME RAT.

REFERENCE USAGE RULES — HIGHEST PRIORITY:

COPY FROM THE REFERENCE:

- rat identity
- fur palette
- body proportions
- paw design
- eye style
- TWO-ear anatomy
- pink tail material
- line-art style

DO NOT COPY FROM THE REFERENCE:

- pose
- facing direction
- head direction
- limb placement
- silhouette
- exact tail curve

THE REFERENCE POSE MUST BE REPLACED.

THE REFERENCE ORIENTATION MUST BE REPLACED.

${ISOMETRIC_CAMERA}

MANDATORY NEW ORIENTATION:

The rat faces diagonally toward SCREEN UPPER-LEFT.

Its nose points UPPER-LEFT.

Its nose must NOT point lower-left.

The head is farther from the viewer.

The rat faces AWAY from the viewer.

The rear body extends toward SCREEN LOWER-RIGHT.

This is a genuine THREE-QUARTER BACK-AND-SIDE VIEW.

The viewer mainly sees:

- back/rear of skull
- rear surface of near ear
- rear surface of far ear
- EXACTLY TWO ears total
- upper neck
- upper back
- spine
- side torso
- hindquarters
- paws
- tail

Only a SMALL amount of muzzle may remain visible.

The chest must NOT dominate the image.

The back and shoulders must dominate more than the chest.

This must NOT look like the lower-left/front master.

This must NOT be the same pose with tiny edits.

This must NOT be a mirrored lower-left/front pose.

Imagine physically walking around the SAME rat
to the opposite diagonal side.

EAR COUNT CHECK:

Visible anatomical ears total = 2.

There must NOT be:

- a third ear behind the near ear
- a third triangular point above the skull
- a duplicated far ear
- an extra pink flap between ears
- an ear-like fur spike

${EAR_INTEGRITY}

${TAIL_INTEGRITY}

${ANATOMY_INTEGRITY}

${ART_STYLE}

Full body visible.

Centered composition.

Keep generous empty matte around the rat.

${NO_SYMBOLS}

${CHROMA_BACKGROUND}
`.trim();

/*
|--------------------------------------------------------------------------
| WALK SOUTHWEST
|--------------------------------------------------------------------------
*/

const WALK_SW = [
  `
WALK CONTACT A — STRONG READABLE STRIDE.

Near-side FRONT leg:

- extend clearly toward SCREEN LOWER-LEFT
- move the paw at least one full paw length beyond idle
- paw clearly projects past the chest

Far-side FRONT leg:

- pull backward beneath the chest

Near-side HIND leg:

- move forward
- bend visibly

Far-side HIND leg:

- extend clearly backward toward SCREEN UPPER-RIGHT

BODY:

- shoulders shift forward
- pelvis counter-shifts
- weight distribution changes

This limb arrangement must remain obvious
after ${CONFIG.sprite.size}x${CONFIG.sprite.size} reduction.
`.trim(),

  `
WALK PASSING A — STRONG MID-SWING FRAME.

THIS MUST NOT LOOK LIKE CONTACT A.

THIS MUST NOT LOOK LIKE CONTACT B.

Near-side FRONT leg:

- lift the ENTIRE front paw clearly OFF the ground
- lift the paw vertically by a clearly visible amount
- create a visible chroma-green gap beneath the paw
- bend wrist
- bend elbow
- move the paw backward beneath the chest

Far-side FRONT leg:

- swing the ENTIRE limb clearly forward toward SCREEN LOWER-LEFT
- extend elbow
- move paw toward future contact point
- paw is NOT planted yet

Near-side HIND leg:

- lift and pass beneath belly
- visibly change knee angle

Far-side HIND leg:

- recover forward beneath hindquarters

BODY:

- torso rises clearly above contact pose
- shoulders rise
- belly rises
- spine elongates slightly
- center of weight moves between both contact phases

CRITICAL ${CONFIG.sprite.size}x${CONFIG.sprite.size} READABILITY:

The lifted paw MUST remain visibly separated from the ground
after reduction to ${CONFIG.sprite.size}x${CONFIG.sprite.size}.

Do NOT merely move toes.

Do NOT merely shift the paw a few pixels.

Move the WHOLE limb.
`.trim(),

  `
WALK CONTACT B — CLEAR OPPOSITE STRIDE.

Far-side FRONT leg:

- extend forward toward SCREEN LOWER-LEFT

Near-side FRONT leg:

- pull backward beneath chest

Far-side HIND leg:

- move forward

Near-side HIND leg:

- extend backward toward SCREEN UPPER-RIGHT

Reverse the diagonal limb arrangement from Contact A.

The silhouette must visibly differ from Contact A.
`.trim(),

  `
WALK PASSING B — STRONG OPPOSITE MID-SWING FRAME.

THIS MUST NOT LOOK LIKE CONTACT B.

THIS MUST NOT LOOK LIKE CONTACT A.

Far-side FRONT leg:

- lift the ENTIRE paw clearly OFF the ground
- create a visible chroma-green gap beneath the lifted paw
- bend wrist
- bend elbow
- retract beneath chest

Near-side FRONT leg:

- swing clearly forward toward SCREEN LOWER-LEFT
- extend elbow
- paw approaches next contact
- paw is NOT planted yet

Far-side HIND leg:

- lift and pass beneath belly

Near-side HIND leg:

- recover forward

BODY:

- torso rises clearly above contact pose
- shoulders rise
- belly rises
- spine elongates slightly

CRITICAL ${CONFIG.sprite.size}x${CONFIG.sprite.size} READABILITY:

The lifted paw MUST remain visibly separated from the ground.

Move the WHOLE limb.

Do NOT merely move toes.
`.trim(),
];

const WALK_NW = WALK_SW.map((text) =>
  text
    .replaceAll("SCREEN LOWER-LEFT", "SCREEN UPPER-LEFT")
    .replaceAll("SCREEN UPPER-RIGHT", "SCREEN LOWER-RIGHT"),
);

/*
|--------------------------------------------------------------------------
| ATTACK
|--------------------------------------------------------------------------
*/

const ATTACK_SW = [
  `
ATTACK ANTICIPATION.

Crouch lower.

Compress hind legs.

Pull shoulders and head backward.

Ears angle backward.

Tail stiffens naturally.
`.trim(),

  `
ATTACK WIND-UP.

Stronger compression.

Rear legs load.

Head retracts.

Mouth begins opening.
`.trim(),

  `
ATTACK LUNGE.

Hind legs push.

Torso stretches strongly toward SCREEN LOWER-LEFT.

Shoulders and head thrust forward.

Front paws reach.

Mouth opens.
`.trim(),

  `
ATTACK IMPACT / BITE.

Maximum forward extension.

Incisors visible.

Forepaws extended.

Torso elongated.

No target.

No blood.

No VFX.
`.trim(),

  `
ATTACK RECOIL.

Head retracts.

Shoulders retract.

Paws retract.

Torso shortens.
`.trim(),

  `
ATTACK RECOVERY.

Return toward combat idle.

Paws settle.

Head settles.

Tail settles.
`.trim(),
];

const ATTACK_NW = ATTACK_SW.map((text) =>
  text.replaceAll("SCREEN LOWER-LEFT", "SCREEN UPPER-LEFT"),
);

/*
|--------------------------------------------------------------------------
| HIT REACTIONS
|--------------------------------------------------------------------------
*/

const HIT_VARIANTS = [
  [
    `
DAMAGE REACTION A — IMPACT.

Hit from front-left.

Head snaps backward.

Shoulders snap backward.

Near front paw lifts clearly.

Torso compresses.

Hind legs brace.

Ears flatten.

Tail flicks.

Rat remains alive.
`.trim(),

    `
DAMAGE REACTION A — PEAK STAGGER.

Torso twists away.

Lifted paw remains displaced.

One hind paw slides.

Tail bends for balance.

Clearly different from previous frame.
`.trim(),

    `
DAMAGE REACTION A — RECOVERY.

Paw returns toward support.

Torso untwists.

Head rises.

Keep residual stagger.

Do not make this identical to idle.
`.trim(),
  ],

  [
    `
DAMAGE REACTION B — IMPACT.

Side impact.

Torso jerks sideways.

Opposite front paw lifts.

One hind paw steps outward.

Head dips.

Ears pin.

Tail whips.

Rat remains alive.
`.trim(),

    `
DAMAGE REACTION B — PEAK.

Front half drops.

One foreleg bends strongly.

Opposite foreleg reaches for balance.

Hindquarters remain slightly raised.
`.trim(),

    `
DAMAGE REACTION B — RECOVERY.

Shoulders rise.

Paws return toward support.

Hind paw steps inward.

Head lifts.

Keep residual stagger.
`.trim(),
  ],
];

/*
|--------------------------------------------------------------------------
| DEATH
|--------------------------------------------------------------------------
*/

const DEATH_PROMPTS = [
  `
DEATH FRAME 0 — FATAL IMPACT.

Strong body jolt.

Head recoils.

One front paw leaves ground.

Legs begin losing support.

Small dark-red torso wound.
`.trim(),

  `
DEATH FRAME 1 — BUCKLE.

Chest drops.

Hindquarters twist.

One hind leg slides.

Head lowers.

Small restrained blood smear.
`.trim(),

  `
DEATH FRAME 2 — COLLAPSE.

Torso rotates strongly onto one side.

Paws stop supporting weight.

Head drops.

Hind legs fold or slide.

Tail falls slack.

Moderate dark-red blood.
`.trim(),

  `
DEATH FRAME 3 — FINAL FALL.

Body almost fully on ground.

Head low.

All legs remain attached and naturally collapsed.

Tail slack.

Small-to-moderate blood pool touching body.
`.trim(),

  `
DEATH FRAME 4 — DEAD FINAL POSE.

Fully motionless.

Head sideways.

Legs attached and collapsed.

Tail slack.

Lifeless or closed eye.

Torn fur.

One or two wounds.

Restrained blood pool.

No dismemberment.

No exposed organs.
`.trim(),
];

/*
|--------------------------------------------------------------------------
| CORPSES
|--------------------------------------------------------------------------
*/

const CORPSE_PROMPTS = [
  `
CORPSE VARIANT A.

Dead side-collapse pose.

Torso fully on one side.

Head sideways.

Front legs folded.

Hind legs collapsed.

Slack natural tail curve.

Lifeless eye.

Torn fur.

One wound.

Restrained blood pool.
`.trim(),

  `
CORPSE VARIANT B.

Dead belly/side twisted pose.

Head low.

One foreleg extended.

Other foreleg folded.

Uneven hind legs.

Different slack tail curve.

Shoulder or flank wound.

Restrained blood smear.
`.trim(),

  `
CORPSE VARIANT C.

Dead curled-side pose.

Torso slightly curled.

Head tucked low.

Asymmetric forelegs.

One hind leg more stretched.

Limp tail around or behind body.

Flank wound.

Small blood pool.
`.trim(),
];

function orientationPrompt(direction) {
  return direction === "southwest"
    ? `
Rat faces SCREEN LOWER-LEFT.

Maintain THREE-QUARTER FRONT-AND-SIDE isometric view.

Head remains lower-left.

Rear body extends upper-right.
`.trim()
    : `
Rat faces SCREEN UPPER-LEFT.

Maintain THREE-QUARTER BACK-AND-SIDE isometric view.

The rat faces AWAY from the viewer.

Head remains upper-left.

Rear body extends lower-right.

Back and shoulders remain more visible than chest.
`.trim();
}

function animationPrompt(
  pose,
  direction,
  { bloodAllowed = false, keepHead = true } = {},
) {
  return `
${IDENTITY_LOCK}

${COLOR_LOCK_PROMPT}

${TAIL_INTEGRITY}

${EAR_INTEGRITY}

${ISOMETRIC_CAMERA}

${orientationPrompt(direction)}

${
  keepHead
    ? `
Keep the head as visually unchanged as possible.

Most visible motion must come from:

- limbs
- body weight
- tail balance
`.trim()
    : `
Head may move naturally,
but character identity must remain exact.
`.trim()
}

POSE:

${pose}

The RAT'S BODY must move.

The CAMERA must remain fixed.

The composition center must remain fixed.

Do not zoom in.

Do not zoom out.

Do not translate the entire rat across the canvas
merely to fake motion.

${ANATOMY_INTEGRITY}

${
  bloodAllowed
    ? `
Restrained dark-red blood and wounds are allowed.

No dismemberment.

No exposed organs.

No extreme gore.
`.trim()
    : `
No blood pool.

No gore.
`.trim()
}

${ART_STYLE}

${NO_SYMBOLS}

${CHROMA_BACKGROUND}
`.trim();
}

/*
|--------------------------------------------------------------------------
| NETWORK
|--------------------------------------------------------------------------
*/

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function abortSignalAfter(timeoutMs) {
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,

    cancel: () => clearTimeout(timer),
  };
}

async function fetchJsonOnce(url, options = {}, timeoutMs = 20_000) {
  const timeout = abortSignalAfter(timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,

      signal: timeout.signal,
    });

    const text = await response.text();

    let json = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = {
          raw: text,
        };
      }
    }

    return {
      response,
      json,
    };
  } finally {
    timeout.cancel();
  }
}

async function fetchJsonRetry(url, options = {}, allowStatuses = []) {
  let lastError = null;

  for (let attempt = 1; attempt <= CONFIG.network.requestAttempts; attempt++) {
    try {
      const { response, json } = await fetchJsonOnce(url, options);

      if (response.ok || allowStatuses.includes(response.status)) {
        return {
          response,
          json,
        };
      }

      if (response.status < 500 && response.status !== 429) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(json)}`);
      }

      lastError = new Error(`HTTP ${response.status}: ${JSON.stringify(json)}`);
    } catch (error) {
      lastError = error;

      warn(
        "NET",

        `attempt ${attempt}/${CONFIG.network.requestAttempts}`,

        error.message,
      );
    }

    if (attempt < CONFIG.network.requestAttempts) {
      await sleep(
        Math.min(
          8000,

          1000 * 2 ** (attempt - 1),
        ),
      );
    }
  }

  throw lastError ?? new Error("Network request failed");
}

async function checkServer() {
  const { response, json } = await fetchJsonRetry(
    `${CONFIG.server}/sdcpp/v1/capabilities`,

    {
      method: "GET",
    },
  );

  if (!response.ok || !json?.supported_modes?.includes("img_gen")) {
    throw new Error("Server img_gen unavailable");
  }

  if (json?.features_by_mode?.img_gen?.ref_images === false) {
    throw new Error("Loaded model/server reports ref_images=false");
  }

  log(
    "SERVER",

    `OK model=${json?.model?.name ?? "unknown"}`,
  );
}

async function fileToDataUrl(filePath) {
  const buffer = await sharp(filePath).removeAlpha().png().toBuffer();

  return "data:image/png;base64," + buffer.toString("base64");
}

function makeNativeRequestBody({ prompt, seed, refImages = [] }) {
  return {
    prompt,

    negative_prompt: "",

    width: CONFIG.generation.size,

    height: CONFIG.generation.size,

    seed,

    batch_count: 1,

    auto_resize_ref_image: true,

    increase_ref_index: false,

    ref_images: refImages,

    sample_params: {
      sample_method: CONFIG.generation.sampler,

      sample_steps: CONFIG.generation.steps,

      guidance: {
        txt_cfg: CONFIG.generation.cfg,
      },
    },

    output_format: "png",

    output_compression: 100,
  };
}

async function runNativeImageJob({ prompt, seed, reference = null, output }) {
  const refImages = reference ? [await fileToDataUrl(reference)] : [];

  const body = makeNativeRequestBody({
    prompt,
    seed,
    refImages,
  });

  const jobNumber = METRICS.aiJobs + METRICS.aiFailures + 1;

  const started = performance.now();

  log(
    "AI",

    `#${String(jobNumber).padStart(3, "0")} START ${relativeLabel(
      output,
    )} seed=${seed} ref=${reference ? path.basename(reference) : "none"}`,
  );

  try {
    const { response, json } = await fetchJsonRetry(
      `${CONFIG.server}/sdcpp/v1/img_gen`,

      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(body),
      },

      [202],
    );

    if (response.status !== 202 || !json?.id) {
      throw new Error(`Native job submission failed: ${JSON.stringify(json)}`);
    }

    const pollUrl = json.poll_url
      ? CONFIG.server + json.poll_url
      : `${CONFIG.server}/sdcpp/v1/jobs/${json.id}`;

    const deadline = Date.now() + CONFIG.network.jobTimeoutMs;

    while (Date.now() < deadline) {
      const {
        response: pollResponse,

        json: pollJson,
      } = await fetchJsonRetry(
        pollUrl,

        {
          method: "GET",
        },

        [404, 410],
      );

      if (pollResponse.status === 404 || pollResponse.status === 410) {
        throw new Error(`Native job ${json.id} disappeared from server`);
      }

      if (pollJson?.status === "completed") {
        const base64 = pollJson?.result?.images?.[0]?.b64_json;

        if (!base64) {
          throw new Error("Completed job contains no image");
        }

        const elapsed = performance.now() - started;

        METRICS.aiJobs++;

        METRICS.aiMs += elapsed;

        log(
          "AI",

          `#${String(jobNumber).padStart(3, "0")} DONE  ${relativeLabel(
            output,
          )} ${formatDuration(elapsed)}`,
        );

        if (CONFIG.network.cooldownMs) {
          await sleep(CONFIG.network.cooldownMs);
        }

        return Buffer.from(base64, "base64");
      }

      if (pollJson?.status === "failed" || pollJson?.status === "cancelled") {
        throw new Error(
          `Generation ${pollJson.status}: ${
            pollJson?.error?.message ?? "no message"
          }`,
        );
      }

      await sleep(CONFIG.network.pollIntervalMs);
    }

    throw new Error("Generation job timeout");
  } catch (error) {
    METRICS.aiFailures++;

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| COLOR / CHROMA
|--------------------------------------------------------------------------
*/

function parseHexColor(hex) {
  const clean = hex.replace("#", "");

  if (clean.length !== 6) {
    throw new Error(`Invalid color: ${hex}`);
  }

  return {
    r: Number.parseInt(clean.slice(0, 2), 16),

    g: Number.parseInt(clean.slice(2, 4), 16),

    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

const CHROMA_RGB = parseHexColor(CONFIG.chroma.hex);

function rgbToHsv(r, g, b) {
  r /= 255;

  g /= 255;

  b /= 255;

  const max = Math.max(r, g, b);

  const min = Math.min(r, g, b);

  const delta = max - min;

  let h = 0;

  if (delta !== 0) {
    if (max === r) {
      h = 60 * ((g - b) / delta);

      if (h < 0) {
        h += 360;
      }
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
  }

  return {
    h,

    s: max === 0 ? 0 : delta / max,

    v: max,
  };
}

const CHROMA_HSV = rgbToHsv(CHROMA_RGB.r, CHROMA_RGB.g, CHROMA_RGB.b);

function hueDistance(a, b) {
  const raw = Math.abs(a - b);

  return Math.min(
    raw,

    360 - raw,
  );
}

function isChromaColor(r, g, b, loose = false) {
  const direct = Math.hypot(
    r - CHROMA_RGB.r,

    g - CHROMA_RGB.g,

    b - CHROMA_RGB.b,
  );

  if (direct <= CONFIG.chroma.directDistance) {
    return true;
  }

  const hsv = rgbToHsv(r, g, b);

  const hueTolerance = loose
    ? CONFIG.chroma.spillHueToleranceDegrees
    : CONFIG.chroma.hueToleranceDegrees;

  const minSaturation = loose
    ? CONFIG.chroma.spillMinSaturation
    : CONFIG.chroma.minSaturation;

  const minValue = loose ? CONFIG.chroma.spillMinValue : CONFIG.chroma.minValue;

  return (
    hueDistance(hsv.h, CHROMA_HSV.h) <= hueTolerance &&
    hsv.s >= minSaturation &&
    hsv.v >= minValue
  );
}

function isBloodColor(r, g, b) {
  const hsv = rgbToHsv(r, g, b);

  return (
    (hsv.h < 22 || hsv.h > 342) &&
    hsv.s > 0.42 &&
    hsv.v > 0.08 &&
    hsv.v < 0.72 &&
    r > g * 1.2 &&
    r > b * 1.02
  );
}

function isEarPink(r, g, b) {
  const hsv = rgbToHsv(r, g, b);

  const warmHue = hsv.h <= 25 || hsv.h >= 325;

  const redDominant = r > g * 1.04;

  const notDark = hsv.v > 0.25;

  return warmHue && hsv.s >= 0.16 && redDominant && notDark;
}

function createChromaMask(rgba, width, height, channels) {
  const mask = new Uint8Array(width * height);

  const queue = new Int32Array(width * height);

  let read = 0;

  let write = 0;

  function push(pixel) {
    if (pixel < 0 || pixel >= width * height || mask[pixel]) {
      return;
    }

    const offset = pixel * channels;

    if (
      !isChromaColor(
        rgba[offset],

        rgba[offset + 1],

        rgba[offset + 2],

        false,
      )
    ) {
      return;
    }

    mask[pixel] = 1;

    queue[write++] = pixel;
  }

  for (let x = 0; x < width; x++) {
    push(x);

    push((height - 1) * width + x);
  }

  for (let y = 0; y < height; y++) {
    push(y * width);

    push(y * width + width - 1);
  }

  while (read < write) {
    const pixel = queue[read++];

    const x = pixel % width;

    const y = Math.floor(pixel / width);

    if (x > 0) {
      push(pixel - 1);
    }

    if (x < width - 1) {
      push(pixel + 1);
    }

    if (y > 0) {
      push(pixel - width);
    }

    if (y < height - 1) {
      push(pixel + width);
    }
  }

  for (let pass = 0; pass < CONFIG.chroma.spillPasses; pass++) {
    const additions = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const pixel = y * width + x;

        if (mask[pixel]) {
          continue;
        }

        const adjacent =
          mask[pixel - 1] ||
          mask[pixel + 1] ||
          mask[pixel - width] ||
          mask[pixel + width];

        if (!adjacent) {
          continue;
        }

        const offset = pixel * channels;

        if (
          isChromaColor(
            rgba[offset],

            rgba[offset + 1],

            rgba[offset + 2],

            true,
          )
        ) {
          additions.push(pixel);
        }
      }
    }

    for (const pixel of additions) {
      mask[pixel] = 1;
    }
  }

  return mask;
}

/*
|--------------------------------------------------------------------------
| APPEARANCE LOCK
|--------------------------------------------------------------------------
*/

const APPEARANCE_STATS_CACHE = new Map();

function calculateRgbStats(
  rgba,
  width,
  height,
  channels,
  matteMask,
  preserveBlood = false,
) {
  let count = 0;

  const mean = [0, 0, 0];

  const m2 = [0, 0, 0];

  for (let pixel = 0; pixel < width * height; pixel++) {
    if (matteMask[pixel]) {
      continue;
    }

    const offset = pixel * channels;

    if (
      preserveBlood &&
      isBloodColor(
        rgba[offset],

        rgba[offset + 1],

        rgba[offset + 2],
      )
    ) {
      continue;
    }

    count++;

    for (let channel = 0; channel < 3; channel++) {
      const delta = rgba[offset + channel] - mean[channel];

      mean[channel] += delta / count;

      m2[channel] += delta * (rgba[offset + channel] - mean[channel]);
    }
  }

  if (!count) {
    return null;
  }

  return {
    count,

    mean,

    std: m2.map((value) =>
      Math.sqrt(
        value /
          Math.max(
            1,

            count - 1,
          ),
      ),
    ),
  };
}

async function readAppearanceImage(imagePath) {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const rgba = Buffer.from(data);

  const matteMask = createChromaMask(
    rgba,

    info.width,
    info.height,
    info.channels,
  );

  return {
    rgba,
    info,
    matteMask,
  };
}

async function getAppearanceReferenceStats(referencePath) {
  const key = path.resolve(referencePath);

  const cached = APPEARANCE_STATS_CACHE.get(key);

  if (cached) {
    return cached;
  }

  const reference = await readAppearanceImage(referencePath);

  const stats = calculateRgbStats(
    reference.rgba,

    reference.info.width,

    reference.info.height,

    reference.info.channels,

    reference.matteMask,

    false,
  );

  if (!stats || stats.count < CONFIG.appearance.minForegroundPixels) {
    throw new Error(
      `Appearance reference has too little foreground: ${referencePath}`,
    );
  }

  APPEARANCE_STATS_CACHE.set(key, stats);

  return stats;
}

async function stabilizeAppearanceToReference(
  candidatePath,
  referencePath,
  preserveBlood = false,
) {
  if (!CONFIG.appearance.enabled || !referencePath) {
    return null;
  }

  const candidate = await readAppearanceImage(candidatePath);

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
    candidateStats.count < CONFIG.appearance.minForegroundPixels
  ) {
    throw new Error(
      `Appearance candidate has too little foreground: ${candidatePath}`,
    );
  }

  const referenceStats = await getAppearanceReferenceStats(referencePath);

  const epsilon = 1e-6;

  const scales = [0, 1, 2].map((channel) =>
    Math.max(
      CONFIG.appearance.minStdScale,

      Math.min(
        CONFIG.appearance.maxStdScale,

        referenceStats.std[channel] /
          Math.max(
            epsilon,

            candidateStats.std[channel],
          ),
      ),
    ),
  );

  for (
    let pixel = 0;
    pixel < candidate.info.width * candidate.info.height;
    pixel++
  ) {
    if (candidate.matteMask[pixel]) {
      continue;
    }

    const offset = pixel * candidate.info.channels;

    if (
      preserveBlood &&
      isBloodColor(
        candidate.rgba[offset],

        candidate.rgba[offset + 1],

        candidate.rgba[offset + 2],
      )
    ) {
      continue;
    }

    for (let channel = 0; channel < 3; channel++) {
      const original = candidate.rgba[offset + channel];

      const target =
        referenceStats.mean[channel] +
        (original - candidateStats.mean[channel]) * scales[channel];

      const final = original + (target - original) * CONFIG.appearance.strength;

      candidate.rgba[offset + channel] = Math.max(
        0,

        Math.min(
          255,

          Math.round(final),
        ),
      );
    }
  }

  await sharp(
    candidate.rgba,

    {
      raw: {
        width: candidate.info.width,

        height: candidate.info.height,

        channels: candidate.info.channels,
      },
    },
  )
    .png()
    .toFile(candidatePath);

  return {
    before:
      candidateStats.mean.reduce(
        (sum, value) => sum + value,

        0,
      ) / 3,

    target:
      referenceStats.mean.reduce(
        (sum, value) => sum + value,

        0,
      ) / 3,
  };
}

async function normalizeChroma(
  sourcePath,
  outputPath,
  { appearanceReference = null, preserveBlood = false } = {},
) {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const rgba = Buffer.from(data);

  const mask = createChromaMask(
    rgba,

    info.width,
    info.height,
    info.channels,
  );

  let replaced = 0;

  for (let pixel = 0; pixel < mask.length; pixel++) {
    if (!mask[pixel]) {
      continue;
    }

    const offset = pixel * info.channels;

    rgba[offset] = CHROMA_RGB.r;

    rgba[offset + 1] = CHROMA_RGB.g;

    rgba[offset + 2] = CHROMA_RGB.b;

    rgba[offset + 3] = 255;

    replaced++;
  }

  await ensureDir(path.dirname(outputPath));

  await sharp(
    rgba,

    {
      raw: {
        width: info.width,

        height: info.height,

        channels: info.channels,
      },
    },
  )
    .png()
    .toFile(outputPath);

  const color = await stabilizeAppearanceToReference(
    outputPath,
    appearanceReference,
    preserveBlood,
  );

  return {
    mattePixels: replaced,

    color,
  };
}

async function saveGeneratedBuffer(
  buffer,
  output,
  { appearanceReference = null, preserveBlood = false } = {},
) {
  const cache = sourceAIPath(output);

  await ensureDir(path.dirname(cache));

  await fs.writeFile(cache, buffer);

  return normalizeChroma(cache, output, {
    appearanceReference,
    preserveBlood,
  });
}

/*
|--------------------------------------------------------------------------
| IMAGE DIFFERENCE
|--------------------------------------------------------------------------
*/

async function calculateImageDifference(
  firstPath,
  secondPath,
  analysisSize = CONFIG.motion.analysisSize,
) {
  const read = (file) =>
    sharp(file)
      .resize(
        analysisSize,
        analysisSize,

        {
          fit: "fill",
        },
      )
      .ensureAlpha()
      .raw()
      .toBuffer();

  const [first, second] = await Promise.all([
    read(firstPath),

    read(secondPath),
  ]);

  let totalDifference = 0;

  let relevantPixels = 0;

  let changedPixels = 0;

  let silhouetteChanged = 0;

  let unionPixels = 0;

  for (let offset = 0; offset < first.length; offset += 4) {
    const firstMatte = isChromaColor(
      first[offset],

      first[offset + 1],

      first[offset + 2],

      true,
    );

    const secondMatte = isChromaColor(
      second[offset],

      second[offset + 1],

      second[offset + 2],

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
      (Math.abs(first[offset] - second[offset]) +
        Math.abs(first[offset + 1] - second[offset + 1]) +
        Math.abs(first[offset + 2] - second[offset + 2])) /
      3;

    totalDifference += difference;

    relevantPixels++;

    if (difference >= CONFIG.motion.changedPixelThreshold) {
      changedPixels++;
    }
  }

  return {
    meanDifference: relevantPixels ? totalDifference / relevantPixels : 0,

    changedFraction: relevantPixels ? changedPixels / relevantPixels : 0,

    silhouetteFraction: unionPixels ? silhouetteChanged / unionPixels : 0,
  };
}

function differenceString(score) {
  return (
    `mean=${score.meanDifference.toFixed(2)} ` +
    `changed=${(score.changedFraction * 100).toFixed(1)}% ` +
    `silhouette=${(score.silhouetteFraction * 100).toFixed(1)}%`
  );
}

function thresholdLabel(thresholds) {
  return (
    `min=${thresholds.mean.toFixed(2)}/` +
    `${(thresholds.changed * 100).toFixed(1)}%/` +
    `${(thresholds.silhouette * 100).toFixed(1)}%`
  );
}

function scoreFailsThresholds(score, thresholds) {
  return (
    score.meanDifference < thresholds.mean ||
    score.changedFraction < thresholds.changed ||
    score.silhouetteFraction < thresholds.silhouette
  );
}

function normalMotionThresholds() {
  return {
    mean: CONFIG.motion.minMean,

    changed: CONFIG.motion.minChanged,

    silhouette: CONFIG.motion.minSilhouette,
  };
}

function contactMotionThresholds() {
  return {
    mean: CONFIG.motion.contactMean,

    changed: CONFIG.motion.contactChanged,

    silhouette: CONFIG.motion.contactSilhouette,
  };
}

function walkPassingThresholds() {
  return {
    mean: CONFIG.motion.walkPassingMean,

    changed: CONFIG.motion.walkPassingChanged,

    silhouette: CONFIG.motion.walkPassingSilhouette,
  };
}

function backMasterTooSimilar(score) {
  let failed = 0;

  if (score.meanDifference < CONFIG.master.perspectiveMinMean) {
    failed++;
  }

  if (score.changedFraction < CONFIG.master.perspectiveMinChanged) {
    failed++;
  }

  if (score.silhouetteFraction < CONFIG.master.perspectiveMinSilhouette) {
    failed++;
  }

  return failed >= 2;
}

/*
|--------------------------------------------------------------------------
| EAR QA
|--------------------------------------------------------------------------
|
| Ищем отдельные розово-красные компоненты в верхней области персонажа.
|
| Это эвристика, а не segmentation model.
|
| Главная задача — ловить явно появившееся третье ухо.
|--------------------------------------------------------------------------
*/

function findConnectedComponents(mask, width, height) {
  const visited = new Uint8Array(width * height);

  const queue = new Int32Array(width * height);

  const result = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) {
      continue;
    }

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
      const pixel = queue[read++];

      const x = pixel % width;

      const y = Math.floor(pixel / width);

      pixels++;

      minX = Math.min(minX, x);

      minY = Math.min(minY, y);

      maxX = Math.max(maxX, x);

      maxY = Math.max(maxY, y);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          const nx = x + dx;

          const ny = y + dy;

          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }

          const next = ny * width + nx;

          if (!mask[next] || visited[next]) {
            continue;
          }

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

async function getForegroundBounds(imagePath) {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const rgba = Buffer.from(data);

  const matte = createChromaMask(
    rgba,

    info.width,
    info.height,
    info.channels,
  );

  let minX = info.width;

  let minY = info.height;

  let maxX = -1;

  let maxY = -1;

  for (let pixel = 0; pixel < matte.length; pixel++) {
    if (matte[pixel]) {
      continue;
    }

    const x = pixel % info.width;

    const y = Math.floor(pixel / info.width);

    minX = Math.min(minX, x);

    minY = Math.min(minY, y);

    maxX = Math.max(maxX, x);

    maxY = Math.max(maxY, y);
  }

  if (maxX < minX) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,

    width: maxX - minX + 1,

    height: maxY - minY + 1,
  };
}

async function analyzeEarComponents(imagePath) {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const rgba = Buffer.from(data);

  const matte = createChromaMask(
    rgba,

    info.width,
    info.height,
    info.channels,
  );

  const bounds = await getForegroundBounds(imagePath);

  if (!bounds) {
    return {
      count: 0,

      components: [],
    };
  }

  /*
  |--------------------------------------------------------------------------
  | HEAD SEARCH AREA
  |--------------------------------------------------------------------------
  |
  | Для обеих канонических левых ориентаций голова находится слева.
  |
  | Ищем розовые компоненты:
  |
  | - в левых ~58% foreground bbox
  | - в верхних ~58% foreground bbox
  |
  | Это отсекает большинство лап и хвост.
  |--------------------------------------------------------------------------
  */

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

      if (matte[pixel]) {
        continue;
      }

      const offset = pixel * info.channels;

      if (
        isEarPink(
          rgba[offset],

          rgba[offset + 1],

          rgba[offset + 2],
        )
      ) {
        pinkMask[pixel] = 1;
      }
    }
  }

  const rawComponents = findConnectedComponents(
    pinkMask,
    info.width,
    info.height,
  );

  const components = rawComponents
    .filter((component) => {
      if (component.pixels < CONFIG.master.minEarComponentPixels) {
        return false;
      }

      /*
          | Ухо должно быть хотя бы несколько пикселей
          | по обеим осям.
          */

      if (component.width < 4 || component.height < 4) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.pixels - a.pixels);

  return {
    count: components.length,

    components,

    searchArea: {
      minX: searchMinX,

      maxX: searchMaxX,

      minY: searchMinY,

      maxY: searchMaxY,
    },
  };
}

function earAnalysisString(analysis) {
  const components = analysis.components
    .map(
      (component, index) =>
        `#${index + 1}:${component.pixels}px/${component.width}x${component.height}`,
    )
    .join(",");

  return `count=${analysis.count}` + (components ? ` [${components}]` : "");
}

async function validateMasterEarQA(imagePath) {
  if (!CONFIG.master.earQAEnabled) {
    return {
      pass: true,

      analysis: {
        count: 0,

        components: [],
      },
    };
  }

  const analysis = await analyzeEarComponents(imagePath);

  /*
  |--------------------------------------------------------------------------
  | ВАЖНО
  |--------------------------------------------------------------------------
  |
  | Для нашей задачи:
  |
  | > 2 крупных ear-pink компонентов = REJECT.
  |
  | 1 компонент разрешаем, потому что дальнее ухо может частично
  | сливаться с ближним или скрываться в перспективе.
  |--------------------------------------------------------------------------
  */

  return {
    pass: analysis.count <= CONFIG.master.maxEarComponents,

    analysis,
  };
}

/*
|--------------------------------------------------------------------------
| VALIDATION
|--------------------------------------------------------------------------
*/

async function validateFrameDifferences(output, validations) {
  const results = [];

  for (const validation of validations) {
    const score = await calculateImageDifference(
      validation.path,
      output,

      validation.analysisSize ?? CONFIG.motion.analysisSize,
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

function validationResultsString(results) {
  return results
    .map(
      (item) =>
        `${item.label}:{${differenceString(item.score)} ${
          item.failed ? "LOW" : "OK"
        } ${thresholdLabel(item.thresholds)}}`,
    )
    .join(" | ");
}

/*
|--------------------------------------------------------------------------
| GENERATION HELPERS
|--------------------------------------------------------------------------
*/

async function generateStill({
  prompt,
  seed,
  output,
  reference = null,
  appearanceReference = null,
  preserveBlood = false,
}) {
  const cache = sourceAIPath(output);

  if (!FORCE && (await exists(cache))) {
    const cleanInfo = await normalizeChroma(cache, output, {
      appearanceReference,
      preserveBlood,
    });

    log(
      "CACHE",

      `${relativeLabel(output)} matte=${cleanInfo.mattePixels}${
        cleanInfo.color
          ? ` color=${cleanInfo.color.before.toFixed(
              1,
            )}->${cleanInfo.color.target.toFixed(1)}`
          : ""
      }`,
    );

    return;
  }

  const buffer = await runNativeImageJob({
    prompt,
    seed,
    reference,
    output,
  });

  const cleanInfo = await saveGeneratedBuffer(buffer, output, {
    appearanceReference,
    preserveBlood,
  });

  log(
    "FRAME",

    `${relativeLabel(output)} matte=${cleanInfo.mattePixels}${
      cleanInfo.color
        ? ` color=${cleanInfo.color.before.toFixed(
            1,
          )}->${cleanInfo.color.target.toFixed(1)}`
        : ""
    }`,
  );
}

async function generateMotionFrame({
  reference,
  validations,
  posePrompt,
  direction,
  seed,
  output,
  preserveBlood = false,
  keepHead = true,
  retryWeakPose = true,
}) {
  const cache = sourceAIPath(output);

  const appearanceReference = masterForDirection(direction);

  if (!FORCE && (await exists(cache))) {
    const cleanInfo = await normalizeChroma(cache, output, {
      appearanceReference,
      preserveBlood,
    });

    const validation = await validateFrameDifferences(output, validations);

    log(
      "CACHE",

      `${relativeLabel(output)} ${validationResultsString(validation.results)}${
        cleanInfo.color
          ? ` color=${cleanInfo.color.before.toFixed(
              1,
            )}->${cleanInfo.color.target.toFixed(1)}`
          : ""
      }`,
    );

    return;
  }

  for (let attempt = 0; attempt < CONFIG.motion.maxAttempts; attempt++) {
    let prompt = animationPrompt(posePrompt, direction, {
      bloodAllowed: preserveBlood,

      keepHead,
    });

    if (attempt > 0) {
      prompt += `

CRITICAL MOTION RETRY:

The previous requested pose change was too weak.

Move the requested COMPLETE limbs much farther.

- move relevant paw at least one full paw length
- visibly bend or extend elbow/knee
- change silhouette clearly at ${CONFIG.sprite.size}x${CONFIG.sprite.size}
- preserve skull
- preserve muzzle
- preserve eye
- preserve EXACTLY TWO ears
- preserve fur colors
- preserve requested facing direction
- tail remains one continuous flesh-pink rat tail
- no duplicate paw
- no ghost paw
- no residual old limb
`;
    }

    const buffer = await runNativeImageJob({
      prompt,

      seed: seed + attempt * CONFIG.generation.retrySeedOffset,

      reference,

      output,
    });

    const cleanInfo = await saveGeneratedBuffer(buffer, output, {
      appearanceReference,
      preserveBlood,
    });

    const validation = await validateFrameDifferences(output, validations);

    log(
      "MOTION",

      `${relativeLabel(output)} ${validationResultsString(
        validation.results,
      )} ${validation.pass ? "PASS" : "RETRY"}${
        cleanInfo.color
          ? ` color=${cleanInfo.color.before.toFixed(
              1,
            )}->${cleanInfo.color.target.toFixed(1)}`
          : ""
      }`,
    );

    if (
      !validation.pass &&
      retryWeakPose &&
      CONFIG.motion.retryWeakPose &&
      attempt + 1 < CONFIG.motion.maxAttempts
    ) {
      warn(
        "MOTION",

        `${relativeLabel(output)} stronger retry`,
      );

      continue;
    }

    return;
  }
}

/*
|--------------------------------------------------------------------------
| MASTER GENERATION
|--------------------------------------------------------------------------
*/

function backMasterRetryPrompt(attempt, useReference) {
  if (attempt === 0) {
    return MASTER_BACK_LEFT_PROMPT;
  }

  return `${MASTER_BACK_LEFT_PROMPT}

MASTER RETRY ${attempt + 1}.

THE PREVIOUS RESULT FAILED QUALITY CONTROL.

POSSIBLE REASONS:

- perspective was too similar to front master
- third ear appeared
- duplicated ear appeared
- extra triangular pink flap appeared

${
  useReference
    ? `
REFERENCE IMAGE RULE:

Use reference ONLY for:

- fur color
- body proportions
- eye design
- ear design
- exactly TWO-ear anatomy
- tail material
- line-art style

DO NOT preserve the reference pose.

DO NOT preserve the reference facing.
`.trim()
    : `
NO reference image is supplied on this fallback attempt.

Recreate the same described rat,
but prioritize correct BACK-LEFT orientation
and correct anatomy.
`.trim()
}

FORCE THE BACK-LEFT VIEW:

- nose points SCREEN UPPER-LEFT
- nose MUST NOT point lower-left
- rat faces AWAY from viewer
- back of skull visible
- upper back visible
- spine visible
- chest visibility reduced
- hindquarters extend SCREEN LOWER-RIGHT

EAR FIX:

TOTAL EAR COUNT = EXACTLY 2.

There are only:

1. near ear
2. far ear

Delete any:

- third ear
- duplicated far ear
- duplicated near ear
- extra triangular flap
- extra pink spike
- extra dark spike on top of skull

The head silhouette has exactly TWO ear protrusions.

TAIL:

- one continuous flesh-pink rat tail
- zero rings
- zero black bands
- zero stripes
`;
}

async function generateFrontMaster() {
  const cache = sourceAIPath(PATHS.masterFrontLeft);

  if (!FORCE && (await exists(cache))) {
    await normalizeChroma(cache, PATHS.masterFrontLeft);

    const earQA = await validateMasterEarQA(PATHS.masterFrontLeft);

    log(
      "MASTER QA",

      `front cached ears ${earAnalysisString(earQA.analysis)} ${
        earQA.pass ? "PASS" : "REJECT"
      }`,
    );

    if (earQA.pass) {
      return;
    }
  }

  for (let attempt = 0; attempt < CONFIG.master.maxAttempts; attempt++) {
    let prompt = MASTER_FRONT_LEFT_PROMPT;

    if (attempt > 0) {
      prompt += `

MASTER FRONT RETRY ${attempt + 1}:

The previous result failed anatomy QA.

Create the SAME requested lower-left rat again.

CRITICAL EAR FIX:

TOTAL EAR COUNT MUST EQUAL EXACTLY 2.

There is:

- one near ear
- one far ear

There is NO:

- third ear
- duplicated ear
- extra pink triangle
- extra dark triangle
- ear-like horn
- ear-like fur spike

The head silhouette has exactly TWO ear protrusions.

TAIL:

- one continuous flesh-pink tail
- zero rings
- zero stripes
- zero black bands

Four connected limbs.
Normal rat anatomy.
`;
    }

    const buffer = await runNativeImageJob({
      prompt,

      seed: SEEDS.masterFrontLeft + attempt * CONFIG.generation.retrySeedOffset,

      reference: null,

      output: PATHS.masterFrontLeft,
    });

    await saveGeneratedBuffer(buffer, PATHS.masterFrontLeft);

    const earQA = await validateMasterEarQA(PATHS.masterFrontLeft);

    log(
      "MASTER QA",

      `front attempt=${attempt + 1}/${CONFIG.master.maxAttempts} ears ${earAnalysisString(
        earQA.analysis,
      )} ${earQA.pass ? "PASS" : "REJECT"}`,
    );

    if (earQA.pass) {
      return;
    }

    if (attempt + 1 < CONFIG.master.maxAttempts) {
      warn(
        "MASTER QA",

        "front master ear QA failed; regenerating",
      );
    }
  }

  throw new Error("Could not generate valid front master without extra ears.");
}

async function generateBackMaster() {
  const cache = sourceAIPath(PATHS.masterBackLeft);

  if (!FORCE && (await exists(cache))) {
    await normalizeChroma(cache, PATHS.masterBackLeft, {
      appearanceReference: PATHS.masterFrontLeft,
    });

    const perspective = await calculateImageDifference(
      PATHS.masterFrontLeft,
      PATHS.masterBackLeft,
    );

    const earQA = await validateMasterEarQA(PATHS.masterBackLeft);

    const perspectiveFail = backMasterTooSimilar(perspective);

    log(
      "MASTER QA",

      `back cached perspective ${differenceString(perspective)} ${
        perspectiveFail ? "REJECT" : "PASS"
      } | ears ${earAnalysisString(earQA.analysis)} ${
        earQA.pass ? "PASS" : "REJECT"
      }`,
    );

    if (!perspectiveFail && earQA.pass) {
      return;
    }
  }

  for (let attempt = 0; attempt < CONFIG.master.maxAttempts; attempt++) {
    /*
    |--------------------------------------------------------------------------
    | Reference strategy
    |--------------------------------------------------------------------------
    |
    | Попытки 0..referenceAttempts-1:
    | используем front master как appearance reference.
    |
    | Последующие:
    | reference=null, если Klein слишком сильно держится за front pose.
    |--------------------------------------------------------------------------
    */

    const useReference = attempt < CONFIG.master.referenceAttempts;

    const reference = useReference ? PATHS.masterFrontLeft : null;

    const prompt = backMasterRetryPrompt(attempt, useReference);

    const buffer = await runNativeImageJob({
      prompt,

      seed: SEEDS.masterBackLeft + attempt * CONFIG.generation.retrySeedOffset,

      reference,

      output: PATHS.masterBackLeft,
    });

    await saveGeneratedBuffer(buffer, PATHS.masterBackLeft, {
      /*
        | ВАЖНО:
        |
        | appearanceReference применяется ПОСЛЕ generation.
        |
        | Он только выравнивает цвета и не способен вернуть
        | геометрию front-master.
        */

      appearanceReference: PATHS.masterFrontLeft,
    });

    const perspective = await calculateImageDifference(
      PATHS.masterFrontLeft,
      PATHS.masterBackLeft,
    );

    const earQA = await validateMasterEarQA(PATHS.masterBackLeft);

    const perspectiveFail = backMasterTooSimilar(perspective);

    const earFail = !earQA.pass;

    log(
      "MASTER QA",

      `back attempt=${attempt + 1}/${CONFIG.master.maxAttempts} ref=${
        reference ? "front-master" : "none"
      } perspective ${differenceString(perspective)} ${
        perspectiveFail ? "REJECT" : "PASS"
      } | ears ${earAnalysisString(earQA.analysis)} ${
        earFail ? "REJECT" : "PASS"
      }`,
    );

    if (!perspectiveFail && !earFail) {
      return;
    }

    if (attempt + 1 < CONFIG.master.maxAttempts) {
      const reasons = [];

      if (perspectiveFail) {
        reasons.push("perspective");
      }

      if (earFail) {
        reasons.push("ears");
      }

      const nextAttempt = attempt + 1;

      const nextUsesReference = nextAttempt < CONFIG.master.referenceAttempts;

      warn(
        "MASTER QA",

        `back master retry: ${reasons.join("+")}; next ref=${
          nextUsesReference ? "front-master" : "none"
        }`,
      );
    }
  }

  throw new Error(
    "Could not generate valid northwest master: perspective/ear QA failed.",
  );
}

async function generateMasters() {
  await generateFrontMaster();

  await generateBackMaster();
}

async function ensureMasters() {
  if (
    (await exists(PATHS.masterFrontLeft)) &&
    (await exists(PATHS.masterBackLeft))
  ) {
    return;
  }

  await generateMasters();
}

/*
|--------------------------------------------------------------------------
| WALK
|--------------------------------------------------------------------------
*/

async function generateWalkDirection(direction, master, baseSeed, poses) {
  const frame0 = rawPath("walk", direction, 0);

  const frame1 = rawPath("walk", direction, 1);

  const frame2 = rawPath("walk", direction, 2);

  const frame3 = rawPath("walk", direction, 3);

  /*
  |--------------------------------------------------------------------------
  | CONTACT A
  |--------------------------------------------------------------------------
  */

  await generateMotionFrame({
    reference: master,

    validations: [
      {
        path: master,

        label: "vs-master",

        thresholds: contactMotionThresholds(),
      },
    ],

    posePrompt: poses[0],

    direction,

    seed: phaseSeed(baseSeed, 0),

    output: frame0,
  });

  /*
  |--------------------------------------------------------------------------
  | CONTACT B
  |--------------------------------------------------------------------------
  |
  | Генерируем от MASTER,
  | но валидируем против Contact A.
  |--------------------------------------------------------------------------
  */

  await generateMotionFrame({
    reference: master,

    validations: [
      {
        path: frame0,

        label: "vs-contact-a",

        thresholds: contactMotionThresholds(),
      },
    ],

    posePrompt: poses[2],

    direction,

    seed: phaseSeed(baseSeed, 2),

    output: frame2,
  });

  /*
  |--------------------------------------------------------------------------
  | PASSING A
  |--------------------------------------------------------------------------
  |
  | ВАЖНО:
  |
  | reference = MASTER
  |
  | НЕ frame0.
  |
  | Иначе diffusion слишком сильно держится за Contact A.
  |
  | Passing обязан отличаться И от Contact A, И от Contact B.
  |--------------------------------------------------------------------------
  */

  await generateMotionFrame({
    reference: master,

    validations: [
      {
        path: frame0,

        label: "vs-contact-a",

        thresholds: walkPassingThresholds(),
      },

      {
        path: frame2,

        label: "vs-contact-b",

        thresholds: walkPassingThresholds(),
      },
    ],

    posePrompt: poses[1],

    direction,

    seed: phaseSeed(baseSeed, 1),

    output: frame1,
  });

  /*
  |--------------------------------------------------------------------------
  | PASSING B
  |--------------------------------------------------------------------------
  */

  await generateMotionFrame({
    reference: master,

    validations: [
      {
        path: frame2,

        label: "vs-contact-b",

        thresholds: walkPassingThresholds(),
      },

      {
        path: frame0,

        label: "vs-contact-a",

        thresholds: walkPassingThresholds(),
      },
    ],

    posePrompt: poses[3],

    direction,

    seed: phaseSeed(baseSeed, 3),

    output: frame3,
  });

  /*
  |--------------------------------------------------------------------------
  | FINAL WALK QA
  |--------------------------------------------------------------------------
  */

  const scores = {
    "0->1": await calculateImageDifference(frame0, frame1),

    "1->2": await calculateImageDifference(frame1, frame2),

    "2->3": await calculateImageDifference(frame2, frame3),

    "3->0": await calculateImageDifference(frame3, frame0),

    "0->2": await calculateImageDifference(frame0, frame2),

    "1->3": await calculateImageDifference(frame1, frame3),
  };

  log(
    "WALK QA",

    `${direction}`,
  );

  for (const [pair, score] of Object.entries(scores)) {
    log(
      "WALK QA",

      `${direction} ${pair} ${differenceString(score)}`,
    );
  }
}

async function generateWalk() {
  await generateWalkDirection(
    "southwest",
    PATHS.masterFrontLeft,
    SEEDS.walkSouthwest,
    WALK_SW,
  );

  await generateWalkDirection(
    "northwest",
    PATHS.masterBackLeft,
    SEEDS.walkNorthwest,
    WALK_NW,
  );
}

/*
|--------------------------------------------------------------------------
| SEQUENTIAL ANIMATIONS
|--------------------------------------------------------------------------
*/

async function generateSequentialAnimation({
  animation,
  direction,
  master,
  baseSeed,
  poses,
  strongFrames = [],
  preserveBlood = false,
  keepHead = true,
}) {
  let previous = master;

  for (let frame = 0; frame < poses.length; frame++) {
    const output = rawPath(animation, direction, frame);

    await generateMotionFrame({
      reference: previous,

      validations: [
        {
          path: previous,

          label: "vs-prev",

          thresholds: strongFrames.includes(frame)
            ? contactMotionThresholds()
            : normalMotionThresholds(),
        },
      ],

      posePrompt: poses[frame],

      direction,

      seed: phaseSeed(baseSeed, frame),

      output,

      preserveBlood,

      keepHead,

      retryWeakPose: frame < poses.length - 1,
    });

    previous = output;
  }
}

/*
|--------------------------------------------------------------------------
| ATTACK
|--------------------------------------------------------------------------
*/

async function generateAttack() {
  await generateSequentialAnimation({
    animation: "attack",

    direction: "southwest",

    master: PATHS.masterFrontLeft,

    baseSeed: SEEDS.attackSouthwest,

    poses: ATTACK_SW,

    strongFrames: [2, 3],
  });

  await generateSequentialAnimation({
    animation: "attack",

    direction: "northwest",

    master: PATHS.masterBackLeft,

    baseSeed: SEEDS.attackNorthwest,

    poses: ATTACK_NW,

    strongFrames: [2, 3],
  });
}

/*
|--------------------------------------------------------------------------
| HIT
|--------------------------------------------------------------------------
*/

function hitPose(variant, frame) {
  const poses = HIT_VARIANTS[variant % HIT_VARIANTS.length];

  return (
    poses[frame] ??
    `
DAMAGE RECOVERY FRAME ${frame}.

Return toward stance but retain visible stagger.
`.trim()
  );
}

async function generateHitReactions() {
  for (let variant = 0; variant < CONFIG.animations.hitVariants; variant++) {
    for (const direction of CANONICAL_DIRECTIONS) {
      let previous = masterForDirection(direction);

      const baseSeed =
        (direction === "southwest" ? SEEDS.hitSouthwest : SEEDS.hitNorthwest) +
        variant * 1009;

      for (let frame = 0; frame < CONFIG.animations.hitFrames; frame++) {
        const output = rawPath("hit", direction, frame, variant);

        await generateMotionFrame({
          reference: previous,

          validations: [
            {
              path: previous,

              label: "vs-prev",

              thresholds:
                frame < 2
                  ? contactMotionThresholds()
                  : normalMotionThresholds(),
            },
          ],

          posePrompt: hitPose(variant, frame),

          direction,

          seed: phaseSeed(baseSeed, frame),

          output,

          retryWeakPose: frame < 2,
        });

        previous = output;
      }
    }
  }
}

/*
|--------------------------------------------------------------------------
| DEATH
|--------------------------------------------------------------------------
*/

function deathPose(frame) {
  return (
    DEATH_PROMPTS[frame] ??
    `
DEAD SETTLING FRAME ${frame}.

Corpse settles slightly lower.

Wounds and blood stay consistent.

All limbs stay attached.
`.trim()
  );
}

async function generateDeath() {
  for (const direction of CANONICAL_DIRECTIONS) {
    let previous = masterForDirection(direction);

    const baseSeed =
      direction === "southwest" ? SEEDS.deathSouthwest : SEEDS.deathNorthwest;

    for (let frame = 0; frame < CONFIG.animations.deathFrames; frame++) {
      const output = rawPath("death", direction, frame);

      await generateMotionFrame({
        reference: previous,

        validations: [
          {
            path: previous,

            label: "vs-prev",

            thresholds:
              frame > 0 && frame < Math.min(4, CONFIG.animations.deathFrames)
                ? contactMotionThresholds()
                : normalMotionThresholds(),
          },
        ],

        posePrompt: deathPose(frame),

        direction,

        seed: phaseSeed(baseSeed, frame),

        output,

        preserveBlood: true,

        keepHead: false,

        retryWeakPose: frame < CONFIG.animations.deathFrames - 1,
      });

      previous = output;
    }
  }
}

/*
|--------------------------------------------------------------------------
| CORPSES
|--------------------------------------------------------------------------
*/

async function generateCorpses() {
  for (let variant = 0; variant < CONFIG.animations.corpseVariants; variant++) {
    for (const direction of CANONICAL_DIRECTIONS) {
      const master = masterForDirection(direction);

      const output = rawPath("corpse", direction, 0, variant);

      const baseSeed =
        direction === "southwest"
          ? SEEDS.corpseSouthwest
          : SEEDS.corpseNorthwest;

      const prompt = animationPrompt(
        `
${CORPSE_PROMPTS[variant % CORPSE_PROMPTS.length]}

This is corpse variant ${variant}.

Make pose, leg arrangement and tail curve
clearly different from the other corpse variants.

Keep exact rat identity.

The rat still has exactly TWO ears.

The tail remains a continuous flesh-pink rat tail.

ZERO rings.

ZERO black bands.

ZERO stripes.
`.trim(),

        direction,

        {
          bloodAllowed: true,

          keepHead: false,
        },
      );

      await generateStill({
        prompt,

        seed: baseSeed + variant * 1009,

        output,

        reference: master,

        appearanceReference: master,

        preserveBlood: true,
      });
    }
  }
}

/*
|--------------------------------------------------------------------------
| PIXELIZATION
|--------------------------------------------------------------------------
*/

async function transparentizeFullCanvas(inputPath) {
  if (!(await exists(inputPath))) {
    const cache = sourceAIPath(inputPath);

    if (!(await exists(cache))) {
      throw new Error(`Missing source: ${inputPath}`);
    }

    const direction =
      CANONICAL_DIRECTIONS.find((dir) => inputPath.includes(dir)) ?? null;

    const preserveBlood =
      inputPath.includes("death") || inputPath.includes("corpse");

    await normalizeChroma(cache, inputPath, {
      appearanceReference: direction ? masterForDirection(direction) : null,

      preserveBlood,
    });
  }

  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const rgba = Buffer.from(data);

  const matte = createChromaMask(
    rgba,

    info.width,
    info.height,
    info.channels,
  );

  for (let pixel = 0; pixel < matte.length; pixel++) {
    const offset = pixel * info.channels;

    if (matte[pixel]) {
      rgba[offset] = 0;

      rgba[offset + 1] = 0;

      rgba[offset + 2] = 0;

      rgba[offset + 3] = 0;
    } else {
      rgba[offset + 3] = 255;
    }
  }

  return {
    rgba,
    info,
  };
}

function hardenAlpha(buffer) {
  for (let offset = 0; offset < buffer.length; offset += 4) {
    buffer[offset + 3] =
      buffer[offset + 3] >= CONFIG.sprite.alphaThreshold ? 255 : 0;
  }

  return buffer;
}

function shiftRgbaCanvas(input, size, xOffset, yOffset) {
  if (!xOffset && !yOffset) {
    return input;
  }

  const output = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    const targetY = y + yOffset;

    if (targetY < 0 || targetY >= size) {
      continue;
    }

    for (let x = 0; x < size; x++) {
      const targetX = x + xOffset;

      if (targetX < 0 || targetX >= size) {
        continue;
      }

      const src = (y * size + x) * 4;

      const dst = (targetY * size + targetX) * 4;

      input.copy(output, dst, src, src + 4);
    }
  }

  return output;
}

async function rasterize(inputPath, yOffset = 0) {
  const { rgba, info } = await transparentizeFullCanvas(inputPath);

  const { data } = await sharp(
    rgba,

    {
      raw: {
        width: info.width,

        height: info.height,

        channels: info.channels,
      },
    },
  )
    .resize(
      CONFIG.sprite.size,

      CONFIG.sprite.size,

      {
        fit: "fill",

        kernel: sharp.kernel.lanczos3,
      },
    )
    .ensureAlpha()
    .raw()
    .toBuffer({
      resolveWithObject: true,
    });

  const hardened = hardenAlpha(Buffer.from(data));

  return shiftRgbaCanvas(hardened, CONFIG.sprite.size, 0, yOffset);
}

function rgbKey(r, g, b) {
  return (r << 16) | (g << 8) | b;
}

function keyToRgb(key) {
  return {
    r: (key >> 16) & 255,

    g: (key >> 8) & 255,

    b: key & 255,
  };
}

function paletteDistance(first, second) {
  return Math.hypot(
    first.r - second.r,

    first.g - second.g,

    first.b - second.b,
  );
}

function buildGlobalPalette(buffers, wanted) {
  const histogram = new Map();

  for (const buffer of buffers) {
    for (let offset = 0; offset < buffer.length; offset += 4) {
      if (!buffer[offset + 3]) {
        continue;
      }

      const key = rgbKey(
        buffer[offset],

        buffer[offset + 1],

        buffer[offset + 2],
      );

      histogram.set(
        key,

        (histogram.get(key) ?? 0) + 1,
      );
    }
  }

  const entries = [...histogram.entries()]
    .map(([key, count]) => ({
      ...keyToRgb(key),

      count,
    }))
    .sort((a, b) => b.count - a.count);

  if (!entries.length) {
    throw new Error("Cannot build palette: no colors");
  }

  if (entries.length <= wanted) {
    return entries.map(({ r, g, b }) => ({
      r,
      g,
      b,
    }));
  }

  const centers = [
    {
      r: entries[0].r,

      g: entries[0].g,

      b: entries[0].b,
    },
  ];

  while (centers.length < wanted && centers.length < entries.length) {
    let best = entries[0];

    let bestScore = -Infinity;

    for (const entry of entries) {
      let nearest = Infinity;

      for (const center of centers) {
        nearest = Math.min(
          nearest,

          paletteDistance(entry, center),
        );
      }

      const score = nearest * Math.log2(entry.count + 1);

      if (score > bestScore) {
        bestScore = score;

        best = entry;
      }
    }

    centers.push({
      r: best.r,

      g: best.g,

      b: best.b,
    });
  }

  for (let iteration = 0; iteration < 8; iteration++) {
    const sums = centers.map(() => ({
      r: 0,
      g: 0,
      b: 0,
      weight: 0,
    }));

    for (const entry of entries) {
      let bestIndex = 0;

      let bestDistance = Infinity;

      for (let index = 0; index < centers.length; index++) {
        const distance = paletteDistance(entry, centers[index]);

        if (distance < bestDistance) {
          bestDistance = distance;

          bestIndex = index;
        }
      }

      const sum = sums[bestIndex];

      sum.r += entry.r * entry.count;

      sum.g += entry.g * entry.count;

      sum.b += entry.b * entry.count;

      sum.weight += entry.count;
    }

    for (let index = 0; index < centers.length; index++) {
      const sum = sums[index];

      if (!sum.weight) {
        continue;
      }

      centers[index] = {
        r: Math.round(sum.r / sum.weight),

        g: Math.round(sum.g / sum.weight),

        b: Math.round(sum.b / sum.weight),
      };
    }
  }

  return centers;
}

function applyPalette(input, palette) {
  const output = Buffer.from(input);

  for (let offset = 0; offset < output.length; offset += 4) {
    if (!output[offset + 3]) {
      continue;
    }

    const current = {
      r: output[offset],

      g: output[offset + 1],

      b: output[offset + 2],
    };

    let best = palette[0];

    let bestDistance = Infinity;

    for (const candidate of palette) {
      const distance = paletteDistance(current, candidate);

      if (distance < bestDistance) {
        bestDistance = distance;

        best = candidate;
      }
    }

    output[offset] = best.r;

    output[offset + 1] = best.g;

    output[offset + 2] = best.b;

    output[offset + 3] = 255;
  }

  return output;
}

async function createPreview(input) {
  const parsed = path.parse(input);

  await sharp(input)
    .resize(
      CONFIG.sprite.size * CONFIG.sprite.previewScale,

      CONFIG.sprite.size * CONFIG.sprite.previewScale,

      {
        kernel: sharp.kernel.nearest,
      },
    )
    .png()
    .toFile(
      path.join(
        parsed.dir,

        `${parsed.name}-preview.png`,
      ),
    );
}

async function writeSprite(buffer, output) {
  await ensureDir(path.dirname(output));

  await sharp(
    buffer,

    {
      raw: {
        width: CONFIG.sprite.size,

        height: CONFIG.sprite.size,

        channels: 4,
      },
    },
  )
    .png()
    .toFile(output);

  await createPreview(output);
}

async function mirrorSprite(input, output) {
  await ensureDir(path.dirname(output));

  await sharp(input).flop().png().toFile(output);

  await createPreview(output);
}

/*
|--------------------------------------------------------------------------
| PIXEL SOURCES
|--------------------------------------------------------------------------
*/

function getPixelSources(selection) {
  const sources = [];

  /*
  | IDLE
  */

  for (const direction of CANONICAL_DIRECTIONS) {
    sources.push({
      animation: "idle",

      direction,

      frame: 0,

      variant: null,

      input: masterForDirection(direction),

      output: spritePath("idle", direction, 0),

      yOffset: 0,
    });
  }

  /*
  | WALK
  */

  if (selection.walk) {
    const bob = [1, 0, 1, 0];

    for (const direction of CANONICAL_DIRECTIONS) {
      for (let frame = 0; frame < CONFIG.animations.walkFrames; frame++) {
        sources.push({
          animation: "walk",

          direction,

          frame,

          variant: null,

          input: rawPath("walk", direction, frame),

          output: spritePath("walk", direction, frame),

          yOffset: bob[frame] ?? 0,
        });
      }
    }
  }

  /*
  | ATTACK
  */

  if (selection.attack) {
    const bob = [0, 1, 0, -1, 0, 0];

    for (const direction of CANONICAL_DIRECTIONS) {
      for (let frame = 0; frame < CONFIG.animations.attackFrames; frame++) {
        sources.push({
          animation: "attack",

          direction,

          frame,

          variant: null,

          input: rawPath("attack", direction, frame),

          output: spritePath("attack", direction, frame),

          yOffset: bob[frame] ?? 0,
        });
      }
    }
  }

  /*
  | HIT
  */

  if (selection.hit) {
    for (let variant = 0; variant < CONFIG.animations.hitVariants; variant++) {
      for (const direction of CANONICAL_DIRECTIONS) {
        for (let frame = 0; frame < CONFIG.animations.hitFrames; frame++) {
          sources.push({
            animation: "hit",

            direction,

            frame,

            variant,

            input: rawPath("hit", direction, frame, variant),

            output: spritePath("hit", direction, frame, variant),

            yOffset: [0, -1, 0, 0, 0][frame] ?? 0,
          });
        }
      }
    }
  }

  /*
  | DEATH
  */

  if (selection.death) {
    for (const direction of CANONICAL_DIRECTIONS) {
      for (let frame = 0; frame < CONFIG.animations.deathFrames; frame++) {
        sources.push({
          animation: "death",

          direction,

          frame,

          variant: null,

          input: rawPath("death", direction, frame),

          output: spritePath("death", direction, frame),

          yOffset: [0, 0, 1, 2, 2, 2, 2, 2][frame] ?? 2,
        });
      }
    }
  }

  /*
  | CORPSE
  */

  if (selection.corpse) {
    for (
      let variant = 0;
      variant < CONFIG.animations.corpseVariants;
      variant++
    ) {
      for (const direction of CANONICAL_DIRECTIONS) {
        sources.push({
          animation: "corpse",

          direction,

          frame: 0,

          variant,

          input: rawPath("corpse", direction, 0, variant),

          output: spritePath("corpse", direction, 0, variant),

          yOffset: 2,
        });
      }
    }
  }

  return sources;
}

async function pixelizeSelection(selection) {
  log(
    "PIXEL",

    "START rasterize + palette",
  );

  const sources = getPixelSources(selection);

  const rasters = new Map();

  for (const source of sources) {
    if (!(await exists(source.input))) {
      throw new Error(`Missing source: ${source.input}`);
    }

    const raster = await rasterize(source.input, source.yOffset ?? 0);

    const key = `${source.animation}:${source.variant ?? -1}:${source.direction}:${source.frame}`;

    rasters.set(key, raster);
  }

  /*
  |--------------------------------------------------------------------------
  | GLOBAL PALETTE
  |--------------------------------------------------------------------------
  |
  | Используем все текущие rasters.
  |
  | Это особенно важно для death/corpse,
  | чтобы кровавые оттенки не пропали из palette.
  |--------------------------------------------------------------------------
  */

  const palette = buildGlobalPalette(
    [...rasters.values()],

    CONFIG.sprite.paletteSize,
  );

  await fs.writeFile(
    PATHS.palette,

    JSON.stringify(
      {
        size: palette.length,

        generationSize: CONFIG.generation.size,

        spriteSize: CONFIG.sprite.size,

        chromaColor: CONFIG.chroma.hex,

        colors: palette.map((color) => ({
          ...color,

          hex:
            "#" +
            [color.r, color.g, color.b]
              .map((value) => value.toString(16).padStart(2, "0"))
              .join("")
              .toUpperCase(),
        })),
      },

      null,
      2,
    ),
  );

  for (const source of sources) {
    const key = `${source.animation}:${source.variant ?? -1}:${source.direction}:${source.frame}`;

    await writeSprite(
      applyPalette(
        rasters.get(key),

        palette,
      ),

      source.output,
    );

    const mirrorOutput = spritePath(
      source.animation,

      MIRROR_DIRECTION[source.direction],

      source.frame,

      source.variant,
    );

    await mirrorSprite(source.output, mirrorOutput);
  }

  log(
    "PIXEL",

    `${sources.length * 2} sprite frames written`,
  );
}

/*
|--------------------------------------------------------------------------
| SHEETS
|--------------------------------------------------------------------------
*/

function buildRows(selection) {
  const rows = [];

  function add(animation, frames, variant = null) {
    for (const direction of DIRECTIONS) {
      rows.push({
        animation,

        variant,

        direction,

        frames,

        get: (frame) => spritePath(animation, direction, frame, variant),
      });
    }
  }

  add("idle", 1);

  if (selection.walk) {
    add("walk", CONFIG.animations.walkFrames);
  }

  if (selection.attack) {
    add("attack", CONFIG.animations.attackFrames);
  }

  if (selection.hit) {
    for (let variant = 0; variant < CONFIG.animations.hitVariants; variant++) {
      add("hit", CONFIG.animations.hitFrames, variant);
    }
  }

  if (selection.death) {
    add("death", CONFIG.animations.deathFrames);
  }

  if (selection.corpse) {
    for (
      let variant = 0;
      variant < CONFIG.animations.corpseVariants;
      variant++
    ) {
      add("corpse", 1, variant);
    }
  }

  return rows;
}

async function createSheet(output, rows) {
  if (!rows.length) {
    return null;
  }

  const cell = CONFIG.sprite.size;

  const columns = Math.max(...rows.map((row) => row.frames));

  const width = columns * cell;

  const height = rows.length * cell;

  const composites = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];

    for (let frame = 0; frame < row.frames; frame++) {
      const input = row.get(frame);

      if (!(await exists(input))) {
        throw new Error(`Missing sprite: ${input}`);
      }

      composites.push({
        input,

        left: frame * cell,

        top: rowIndex * cell,
      });
    }
  }

  await ensureDir(path.dirname(output));

  await sharp({
    create: {
      width,

      height,

      channels: 4,

      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    },
  })
    .composite(composites)
    .png()
    .toFile(output);

  const parsed = path.parse(output);

  await sharp(output)
    .resize(
      width * CONFIG.sprite.previewScale,

      height * CONFIG.sprite.previewScale,

      {
        kernel: sharp.kernel.nearest,
      },
    )
    .png()
    .toFile(
      path.join(
        parsed.dir,

        `${parsed.name}-preview.png`,
      ),
    );

  return {
    columns,

    rows: rows.length,

    width,

    height,
  };
}

/*
|--------------------------------------------------------------------------
| MANIFEST
|--------------------------------------------------------------------------
*/

async function createManifest(rows, sheetInfo) {
  const animations = {};

  const cell = CONFIG.sprite.size;

  rows.forEach((row, rowIndex) => {
    const animationName =
      row.variant === null ? row.animation : `${row.animation}_${row.variant}`;

    const key = `${animationName}_${row.direction}`;

    animations[key] = {
      animation: row.animation,

      variant: row.variant,

      direction: row.direction,

      loop: ["idle", "walk"].includes(row.animation),

      fps:
        row.animation === "walk"
          ? 8
          : row.animation === "attack"
            ? 10
            : row.animation === "hit"
              ? 12
              : row.animation === "death"
                ? 8
                : 1,

      frames: Array.from(
        {
          length: row.frames,
        },

        (_, frame) => ({
          index: frame,

          row: rowIndex,

          column: frame,

          x: frame * cell,

          y: rowIndex * cell,

          width: cell,

          height: cell,
        }),
      ),
    };

    if (row.animation === "attack") {
      animations[key].events = [
        {
          frame: Math.min(3, row.frames - 1),

          event: "hit",
        },
      ];
    }

    if (row.animation === "death") {
      animations[key].events = [
        {
          frame: row.frames - 1,

          event: "dead",
        },
      ];
    }

    if (row.animation === "hit") {
      animations[key].events = [
        {
          frame: 0,

          event: "damage-reaction-start",
        },
      ];
    }

    if (row.animation === "corpse") {
      animations[key].events = [
        {
          frame: 0,

          event: "corpse",
        },
      ];
    }
  });

  const manifest = {
    schemaVersion: 8,

    assetType: "creature",

    projection: "isometric-2to1",

    engineTarget: "Phaser 4",

    image: "spritesheet.png",

    sourcePipeline: {
      server: CONFIG.server,

      generation: {
        width: CONFIG.generation.size,

        height: CONFIG.generation.size,

        steps: CONFIG.generation.steps,

        sampler: CONFIG.generation.sampler,

        cfg: CONFIG.generation.cfg,
      },

      chroma: CONFIG.chroma.hex,

      masterBackStrategy:
        "front appearance ref first; perspective QA; ear QA; automatic no-ref fallback",

      walkPassingStrategy:
        "passing frames generated directly from master and validated against both contact poses",
    },

    frame: {
      width: cell,

      height: cell,
    },

    sheet: sheetInfo,

    directionOrder: DIRECTIONS,

    canonicalDirections: {
      southwest: {
        source: "ai",

        facing: "screen-lower-left-front-side",
      },

      northwest: {
        source: "ai",

        facing: "screen-upper-left-back-side",
      },

      southeast: {
        source: "mirror",

        derivedFrom: "southwest",
      },

      northeast: {
        source: "mirror",

        derivedFrom: "northwest",
      },
    },

    variants: {
      hit: CONFIG.animations.hitVariants,

      corpse: CONFIG.animations.corpseVariants,
    },

    walkCycle: {
      0: "contact-a",

      1: "passing-a",

      2: "contact-b",

      3: "passing-b",
    },

    anatomyPolicy: {
      ears: "exactly two",

      thirdEar: "forbidden",

      extraEar: "forbidden",

      detachedPaw: "forbidden",

      duplicateLimb: "forbidden",

      tail: "exactly one continuous flesh-pink tail",

      ringedTail: "forbidden",

      stripedTail: "forbidden",
    },

    damagePolicy: {
      hit: "non-gory reaction",

      death: "restrained blood/wounds",

      corpse: "restrained blood/wounds; no dismemberment",
    },

    animations,
  };

  await fs.writeFile(
    path.join(PATHS.sheets, "spritesheet.json"),

    JSON.stringify(manifest, null, 2),
  );
}

/*
|--------------------------------------------------------------------------
| BUILD SHEETS
|--------------------------------------------------------------------------
*/

async function buildSheets(selection, full = false) {
  const rows = buildRows(selection);

  const groups = [
    ["idle", (row) => row.animation === "idle"],

    ["walk", (row) => row.animation === "walk"],

    ["attack", (row) => row.animation === "attack"],

    ["death", (row) => row.animation === "death"],
  ];

  for (const [name, filter] of groups) {
    const groupRows = rows.filter(filter);

    if (groupRows.length) {
      await createSheet(
        path.join(PATHS.sheets, `${name}-sheet.png`),

        groupRows,
      );
    }
  }

  if (selection.hit) {
    for (let variant = 0; variant < CONFIG.animations.hitVariants; variant++) {
      await createSheet(
        path.join(PATHS.sheets, `hit-${variant}-sheet.png`),

        rows.filter(
          (row) => row.animation === "hit" && row.variant === variant,
        ),
      );
    }
  }

  if (selection.corpse) {
    for (
      let variant = 0;
      variant < CONFIG.animations.corpseVariants;
      variant++
    ) {
      await createSheet(
        path.join(PATHS.sheets, `corpse-${variant}-sheet.png`),

        rows.filter(
          (row) => row.animation === "corpse" && row.variant === variant,
        ),
      );
    }
  }

  if (full) {
    const sheetInfo = await createSheet(
      path.join(PATHS.sheets, "spritesheet.png"),

      rows,
    );

    await createManifest(rows, sheetInfo);
  }
}

/*
|--------------------------------------------------------------------------
| SELECTIONS
|--------------------------------------------------------------------------
*/

const SELECTIONS = {
  masters: {},

  walk: {
    walk: true,
  },

  attack: {
    attack: true,
  },

  hit: {
    hit: true,
  },

  death: {
    death: true,
  },

  corpses: {
    corpse: true,
  },

  combat: {
    attack: true,

    hit: true,

    death: true,

    corpse: true,
  },

  all: {
    walk: true,

    attack: true,

    hit: true,

    death: true,

    corpse: true,
  },
};

/*
|--------------------------------------------------------------------------
| CONFIG LOG
|--------------------------------------------------------------------------
*/

function printConfig(mode) {
  console.log("======================================");

  console.log("IRON ARCANA ISOMETRIC PIPELINE");

  console.log("======================================");

  console.log(`MODE: ${mode}`);

  console.log(`FORCE: ${FORCE}`);

  console.log(
    `GENERATION: ${CONFIG.generation.size}x${CONFIG.generation.size} steps=${CONFIG.generation.steps} sampler=${CONFIG.generation.sampler} cfg=${CONFIG.generation.cfg}`,
  );

  console.log(
    `SPRITE: ${CONFIG.sprite.size}x${CONFIG.sprite.size} palette=${CONFIG.sprite.paletteSize} preview=x${CONFIG.sprite.previewScale}`,
  );

  console.log(
    `MASTER: attempts=${CONFIG.master.maxAttempts} refAttempts=${CONFIG.master.referenceAttempts}`,
  );

  console.log(
    `MASTER PERSPECTIVE QA: mean>=${CONFIG.master.perspectiveMinMean} changed>=${(
      CONFIG.master.perspectiveMinChanged * 100
    ).toFixed(1)}% silhouette>=${(
      CONFIG.master.perspectiveMinSilhouette * 100
    ).toFixed(1)}%`,
  );

  console.log(
    `MASTER EAR QA: enabled=${CONFIG.master.earQAEnabled} maxComponents=${CONFIG.master.maxEarComponents} minPixels=${CONFIG.master.minEarComponentPixels}`,
  );

  console.log(
    `MOTION NORMAL: mean>=${CONFIG.motion.minMean} changed>=${(
      CONFIG.motion.minChanged * 100
    ).toFixed(1)}% silhouette>=${(CONFIG.motion.minSilhouette * 100).toFixed(
      1,
    )}%`,
  );

  console.log(
    `MOTION CONTACT: mean>=${CONFIG.motion.contactMean} changed>=${(
      CONFIG.motion.contactChanged * 100
    ).toFixed(1)}% silhouette>=${(
      CONFIG.motion.contactSilhouette * 100
    ).toFixed(1)}%`,
  );

  console.log(
    `WALK PASSING: mean>=${CONFIG.motion.walkPassingMean} changed>=${(
      CONFIG.motion.walkPassingChanged * 100
    ).toFixed(1)}% silhouette>=${(
      CONFIG.motion.walkPassingSilhouette * 100
    ).toFixed(1)}%`,
  );

  console.log(
    `MOTION RETRY: ${CONFIG.motion.retryWeakPose} attempts=${CONFIG.motion.maxAttempts}`,
  );

  console.log(
    `HIT: ${CONFIG.animations.hitVariants}x${CONFIG.animations.hitFrames} | DEATH: ${CONFIG.animations.deathFrames} | CORPSES: ${CONFIG.animations.corpseVariants}`,
  );

  console.log(`CHROMA: ${CONFIG.chroma.hex}`);

  console.log("API: sdcpp native async jobs");
}

/*
|--------------------------------------------------------------------------
| MAIN
|--------------------------------------------------------------------------
*/

async function main() {
  const mode = (process.argv[2] ?? "all").toLowerCase();

  const validModes = [
    "masters",
    "walk",
    "attack",
    "hit",
    "death",
    "corpses",
    "combat",
    "all",
    "pixelize",
    "sheet",
  ];

  if (!validModes.includes(mode)) {
    throw new Error(`Unknown mode: ${mode}`);
  }

  await prepareDirectories();

  printConfig(mode);

  /*
  |--------------------------------------------------------------------------
  | PIXELIZE
  |--------------------------------------------------------------------------
  */

  if (mode === "pixelize") {
    await stage(
      "pixelize all",

      () => pixelizeSelection(SELECTIONS.all),
    );

    await stage(
      "build sheets + manifest",

      () => buildSheets(SELECTIONS.all, true),
    );

    printSummary();

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | SHEET
  |--------------------------------------------------------------------------
  */

  if (mode === "sheet") {
    await stage(
      "build sheets + manifest",

      () => buildSheets(SELECTIONS.all, true),
    );

    printSummary();

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | SERVER
  |--------------------------------------------------------------------------
  */

  await stage("server check", checkServer);

  /*
  |--------------------------------------------------------------------------
  | MASTERS
  |--------------------------------------------------------------------------
  */

  if (mode === "masters") {
    await stage("generate masters", generateMasters);

    await stage(
      "pixelize masters",

      () => pixelizeSelection(SELECTIONS.masters),
    );

    await stage(
      "build idle sheet",

      () => buildSheets(SELECTIONS.masters),
    );

    printSummary();

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | ENSURE MASTERS
  |--------------------------------------------------------------------------
  */

  if (mode === "all") {
    await stage("generate masters", generateMasters);
  } else {
    await stage("ensure masters", ensureMasters);
  }

  /*
  |--------------------------------------------------------------------------
  | WALK
  |--------------------------------------------------------------------------
  */

  if (mode === "walk") {
    await stage("generate walk", generateWalk);

    await stage(
      "pixelize walk",

      () => pixelizeSelection(SELECTIONS.walk),
    );

    await stage(
      "build walk sheets",

      () => buildSheets(SELECTIONS.walk),
    );

    printSummary();

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | ATTACK
  |--------------------------------------------------------------------------
  */

  if (mode === "attack") {
    await stage("generate attack", generateAttack);

    await stage(
      "pixelize attack",

      () => pixelizeSelection(SELECTIONS.attack),
    );

    await stage(
      "build attack sheets",

      () => buildSheets(SELECTIONS.attack),
    );

    printSummary();

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | HIT
  |--------------------------------------------------------------------------
  */

  if (mode === "hit") {
    await stage("generate hit reactions", generateHitReactions);

    await stage(
      "pixelize hit",

      () => pixelizeSelection(SELECTIONS.hit),
    );

    await stage(
      "build hit sheets",

      () => buildSheets(SELECTIONS.hit),
    );

    printSummary();

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | DEATH
  |--------------------------------------------------------------------------
  */

  if (mode === "death") {
    await stage("generate death", generateDeath);

    await stage(
      "pixelize death",

      () => pixelizeSelection(SELECTIONS.death),
    );

    await stage(
      "build death sheets",

      () => buildSheets(SELECTIONS.death),
    );

    printSummary();

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | CORPSES
  |--------------------------------------------------------------------------
  */

  if (mode === "corpses") {
    await stage("generate corpses", generateCorpses);

    await stage(
      "pixelize corpses",

      () => pixelizeSelection(SELECTIONS.corpses),
    );

    await stage(
      "build corpse sheets",

      () => buildSheets(SELECTIONS.corpses),
    );

    printSummary();

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | COMBAT
  |--------------------------------------------------------------------------
  */

  if (mode === "combat") {
    await stage("generate attack", generateAttack);

    await stage("generate hit reactions", generateHitReactions);

    await stage("generate death", generateDeath);

    await stage("generate corpses", generateCorpses);

    await stage(
      "pixelize combat",

      () => pixelizeSelection(SELECTIONS.combat),
    );

    await stage(
      "build combat sheets",

      () => buildSheets(SELECTIONS.combat),
    );

    printSummary();

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | ALL
  |--------------------------------------------------------------------------
  */

  await stage("generate walk", generateWalk);

  await stage("generate attack", generateAttack);

  await stage("generate hit reactions", generateHitReactions);

  await stage("generate death", generateDeath);

  await stage("generate corpses", generateCorpses);

  await stage(
    "pixelize all",

    () => pixelizeSelection(SELECTIONS.all),
  );

  await stage(
    "build sheets + manifest",

    () => buildSheets(SELECTIONS.all, true),
  );

  printSummary();
}

main().catch((error) => {
  console.error("\n======================================");

  console.error("PIPELINE FAILED");

  console.error("======================================");

  console.error(error);

  printSummary();

  console.error("Rerun WITHOUT --force to reuse source-ai cache.");

  process.exit(1);
});
