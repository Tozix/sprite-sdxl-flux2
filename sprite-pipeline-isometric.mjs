import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

async function loadEnv(file = ".env") {
  try {
    const text = await fs.readFile(file, "utf8");

    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const index = line.indexOf("=");

      if (index < 1) {
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
        const comment = value.indexOf(" #");

        if (comment >= 0) {
          value = value.slice(0, comment).trim();
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

const envString = (name, fallback) => {
  const value = process.env[name];

  return value === undefined || value === "" ? fallback : value;
};

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

const CONFIG = {
  server: envString("IRON_ARCANA_AI_SERVER", "http://192.168.0.14:7861"),

  outputDir: envString("IRON_ARCANA_OUTPUT_DIR", "./output/rat-isometric"),

  generationSize: envInt("IRON_ARCANA_GENERATION_SIZE", 384, 128, 2048),

  steps: envInt("IRON_ARCANA_GENERATION_STEPS", 4, 1, 100),

  sampler: envString("IRON_ARCANA_SAMPLER", "euler"),

  cfg: envFloat("IRON_ARCANA_CFG", 1.0, 0, 30),

  spriteSize: envInt("IRON_ARCANA_SPRITE_SIZE", 96, 16, 512),

  paletteSize: envInt("IRON_ARCANA_PALETTE_SIZE", 28, 8, 256),

  previewScale: envInt("IRON_ARCANA_PREVIEW_SCALE", 3, 1, 12),

  alphaThreshold: envInt("IRON_ARCANA_ALPHA_THRESHOLD", 90, 0, 255),

  chromaHex: envString("IRON_ARCANA_CHROMA_COLOR", "#00FF00"),

  chroma: {
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

  walkFrames: 4,
  attackFrames: 6,

  hitVariants: envInt("IRON_ARCANA_HIT_VARIANTS", 2, 1, 4),

  hitFrames: envInt("IRON_ARCANA_HIT_FRAMES", 3, 2, 5),

  deathFrames: envInt("IRON_ARCANA_DEATH_FRAMES", 5, 3, 8),

  corpseVariants: envInt("IRON_ARCANA_CORPSE_VARIANTS", 3, 1, 6),

  masterMaxAttempts: envInt("IRON_ARCANA_MASTER_MAX_ATTEMPTS", 2, 1, 5),

  motion: {
    analysisSize: envInt("IRON_ARCANA_MOTION_ANALYSIS_SIZE", 128, 32, 512),

    changedPixelThreshold: envFloat(
      "IRON_ARCANA_MOTION_CHANGED_PIXEL_THRESHOLD",
      15,
      0,
      255,
    ),

    minMeanDifference: envFloat(
      "IRON_ARCANA_MOTION_MIN_MEAN_DIFFERENCE",
      4.5,
      0,
      255,
    ),

    minChangedFraction: envFloat(
      "IRON_ARCANA_MOTION_MIN_CHANGED_FRACTION",
      0.055,
      0,
      1,
    ),

    minSilhouetteFraction: envFloat(
      "IRON_ARCANA_MOTION_MIN_SILHOUETTE_CHANGED_FRACTION",
      0.018,
      0,
      1,
    ),

    contactMeanDifference: envFloat(
      "IRON_ARCANA_CONTACT_MIN_MEAN_DIFFERENCE",
      5.5,
      0,
      255,
    ),

    contactChangedFraction: envFloat(
      "IRON_ARCANA_CONTACT_MIN_CHANGED_FRACTION",
      0.065,
      0,
      1,
    ),

    contactSilhouetteFraction: envFloat(
      "IRON_ARCANA_CONTACT_MIN_SILHOUETTE_CHANGED_FRACTION",
      0.025,
      0,
      1,
    ),

    retryWeakPose: envBool("IRON_ARCANA_RETRY_WEAK_POSE", true),

    maxAttempts: envInt("IRON_ARCANA_MOTION_MAX_ATTEMPTS", 2, 1, 4),
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
  throw new Error("IRON_ARCANA_APPEARANCE_MIN_STD_SCALE must be <= max scale");
}

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

const PHASE_SEED_OFFSET = [0, 37, 1009, 1046, 2018, 2055, 3027, 3064];

function phaseSeed(base, frame) {
  return base + PHASE_SEED_OFFSET[frame % PHASE_SEED_OFFSET.length];
}

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
      `${
        item.ok ? "OK " : "ERR"
      } ${item.name.padEnd(30)} ${formatDuration(item.ms)}`,
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

function getSourceAIPath(cleanPath) {
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

  for (let variant = 0; variant < CONFIG.hitVariants; variant++) {
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

  for (let variant = 0; variant < CONFIG.corpseVariants; variant++) {
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

function masterForDirection(direction) {
  return direction === "southwest"
    ? PATHS.masterFrontLeft
    : PATHS.masterBackLeft;
}

const ISOMETRIC_CAMERA = `
CAMERA AND PROJECTION:

Use one fixed classic three-quarter isometric game camera.

The camera is elevated above the creature and looks downward
at a consistent angle.

Use orthographic dimetric projection compatible with classic
2-to-1 isometric game tiles.

There is NO perspective convergence.

ALL images must preserve exactly the same:

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

${CONFIG.chromaHex}

There is NO floor.

There is NO visible ground surface.

ABSOLUTELY NO SHADOW IS ALLOWED.

Forbidden outside the creature silhouette:

- cast shadow
- contact shadow
- ground shadow
- ambient occlusion
- gray darkening
- black darkening
- brown darkening
- grounding ellipse
- floor mark
- dust
- debris
- motion trail
- external glow
- background gradient
- background texture

The area directly beneath every paw, belly and tail
must remain chroma matte.

Do not cast chroma-colored rim light onto the creature.
`.trim();

const NO_SYMBOLS = `
Render only the creature and, only where explicitly requested,
restrained blood/wounds.

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

const ANATOMY_INTEGRITY = `
ANATOMY INTEGRITY IS A HARD REQUIREMENT:

The creature has exactly four anatomical limbs.

Every visible paw must be physically attached to its
corresponding leg by one continuous anatomical shape.

When a leg moves, move the ENTIRE LIMB including the paw.

The previous paw position must disappear completely.

STRICTLY FORBIDDEN:

- detached paw
- floating paw
- leftover paw from reference pose
- duplicate paw
- ghost paw
- extra limb
- duplicated leg
- disconnected foot
- old limb fragment remaining on the matte
- two paws belonging to one leg

Do not add a new paw while leaving the old paw behind.

REPLACE the old limb pose with the new limb pose.
`.trim();

const TAIL_INTEGRITY = `
TAIL DESIGN IS A HARD CHARACTER IDENTITY REQUIREMENT:

The rat has exactly ONE normal biological rat tail.

TAIL COLOR:

- muted dirty flesh-pink
- slightly darker pink only near the base
- smooth natural color transition
- subtle restrained shading only

THE TAIL MUST NEVER HAVE:

- black rings
- dark rings
- gray rings
- stripes
- bands
- alternating colors
- segmented coloration
- raccoon-like markings
- reptile markings
- armor-like segments
- wrapped bands
- painted bands
- black sections
- charcoal sections
- decorative patterns
- abrupt repeated dark/light boundaries

IMPORTANT:

The tail is NOT striped.

The tail is NOT ringed.

The tail is NOT segmented by color.

It must remain one continuous flesh-pink rat tail
from base to tip.

The base may be only slightly darker than the tip,
but there must be NO abrupt color boundaries.

TAIL ANATOMY:

- one continuous tail
- long and thin
- smoothly tapered
- smooth natural curve
- physically attached to the pelvis
- gradually thinner toward the tip
- no fork
- no duplicate tail
- no detached tail
- no sudden thickness changes
- no knots
- no unnatural sharp joints
`.trim();

const RAT_STYLE = `
CHARACTER:

A hostile sewer rat enemy from a grim dark medieval fantasy MMORPG.

BODY:

- lean compact body
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

- narrow aggressive muzzle
- hostile dark amber-red eye
- tiny eye highlight
- muted dirty pink nose
- tense whiskers
- slightly ragged ears

TAIL:

- one normal biological rat tail
- long
- thin
- smoothly tapered
- muted dirty flesh-pink
- almost uniform pink coloration
- only subtle natural shading
- base may be slightly darker pink
- smooth continuous transition from base to tip
- absolutely no stripes
- absolutely no rings
- absolutely no black bands
- absolutely no segmented coloration

PAWS:

- dirty muted pink
- visible toes
- tiny dark claws

MOOD:

- hostile
- predatory
- grim
- suspicious
- dangerous

Do not make it:

- cute
- friendly
- cuddly
- plush
- glossy
- magical
- undead
- mutated

It must remain clearly recognizable as a normal rat.
`.trim();

const ART_STYLE = `
ART STYLE:

- grim dark-fantasy RPG game asset
- clean stylized 2D source artwork
- strong dark outline
- crisp boundaries
- controlled flat colors
- restrained shading INSIDE the creature silhouette only
- enough detail for later ${CONFIG.spriteSize}x${CONFIG.spriteSize} pixel-art reduction
- approximately 16 to 28 useful colors

DO NOT USE:

- photorealism
- painterly rendering
- airbrush
- soft focus
- blurred edges
- excessive gradients
- photographic fur texture
- cinematic lighting
`.trim();

const IDENTITY_LOCK = `
REFERENCE IS THE CANONICAL CHARACTER MODEL.

Preserve exactly:

- skull shape
- muzzle proportions
- eye color
- eye position
- ear shape
- fur palette
- body mass
- body proportions
- paw material
- tail thickness
- tail color
- line-art style

Animate pose only.

Do not redesign or reinterpret the rat.
`.trim();

const COLOR_LOCK_PROMPT = `
COLOR / LIGHTING LOCK — HARD REQUIREMENT:

The reference image is the color authority.

Do NOT:

- darken the rat
- shift fur hue
- change exposure
- change gamma
- change global contrast
- turn brown fur black

The same body part must keep approximately
the same material color and brightness
in every animation frame.
`.trim();

const MASTER_FRONT_LEFT_PROMPT = `
Create one isolated fantasy sewer rat enemy.

${ISOMETRIC_CAMERA}

ORIENTATION:

The rat faces diagonally toward SCREEN LOWER-LEFT.

Its nose points lower-left.

Its rear body extends upper-right.

Its tail extends naturally backward from the pelvis
and remains fully visible.

This is a THREE-QUARTER FRONT-AND-SIDE VIEW.

The viewer sees:

- muzzle
- nose
- one hostile eye
- chest
- side torso
- upper back
- all four limbs
- hindquarters
- ears
- tail

It must clearly read as an isometric game sprite
rather than a side profile.

${RAT_STYLE}

${TAIL_INTEGRITY}

${ART_STYLE}

${ANATOMY_INTEGRITY}

TAIL FINAL CHECK BEFORE RENDER COMPLETES:

Inspect the entire tail from pelvis to tip.

It must be one continuous muted flesh-pink tail.

There must be:

ZERO black rings.
ZERO dark bands.
ZERO gray rings.
ZERO repeated stripes.
ZERO alternating dark/light tail segments.

Full body visible.

Centered composition.

Keep generous empty matte around the rat.

${NO_SYMBOLS}

${CHROMA_BACKGROUND}
`.trim();

const MASTER_BACK_LEFT_PROMPT = `
Use the reference image as the EXACT SAME RAT.

${IDENTITY_LOCK}

${COLOR_LOCK_PROMPT}

${TAIL_INTEGRITY}

${ISOMETRIC_CAMERA}

CHANGE ONLY ORIENTATION.

The rat faces diagonally toward SCREEN UPPER-LEFT.

The head is farther from the viewer.

The rear body occupies more of the lower-right area.

The tail extends naturally backward from the same
pelvis attachment point.

This is a THREE-QUARTER BACK-AND-SIDE VIEW.

Preserve the exact tail anatomy and exact continuous
flesh-pink tail coloration from the reference.

Do NOT introduce:

- rings
- bands
- stripes
- dark segments
- alternating tail colors
- black tail markings

when rotating the rat.

The viewer mainly sees:

- back of skull
- rear ear surfaces
- upper neck
- upper back
- spine
- side torso
- hindquarters
- paws
- tail

Only a small amount of muzzle may remain visible.

${RAT_STYLE}

${ART_STYLE}

${ANATOMY_INTEGRITY}

Full body visible.

Centered composition.

${NO_SYMBOLS}

${CHROMA_BACKGROUND}
`.trim();

const WALK_SW = [
  `
WALK CONTACT A.

Make a strong readable walk stride.

Near-side FRONT leg:

- extends clearly forward toward SCREEN LOWER-LEFT
- paw moves at least one full paw length beyond idle
- paw projects clearly past the chest

Far-side FRONT leg:

- pulls back beneath chest

Near-side HIND leg:

- moves forward
- bends visibly

Far-side HIND leg:

- extends clearly backward toward SCREEN UPPER-RIGHT

BODY:

- shoulders shift forward slightly
- pelvis counter-shifts
- torso changes weight distribution

The difference must remain obvious after 96x96 reduction.
`.trim(),

  `
WALK PASSING A.

Starting from Contact A:

Near-side FRONT leg:

- retracts
- lifts clearly away from its old contact position

Far-side FRONT leg:

- swings forward

Near-side HIND paw:

- passes forward beneath belly

Far-side HIND leg:

- recovers beneath hindquarters

Torso rises slightly.

Paw displacement must be at least one paw length.
`.trim(),

  `
WALK CONTACT B.

Make the unmistakably OPPOSITE stride from Contact A.

Far-side FRONT leg:

- extends forward toward SCREEN LOWER-LEFT

Near-side FRONT leg:

- pulls back

Far-side HIND leg:

- moves forward

Near-side HIND leg:

- extends backward toward SCREEN UPPER-RIGHT

Reverse the diagonal limb arrangement
and body weight shift from Contact A.
`.trim(),

  `
WALK PASSING B.

Opposite of Passing A.

Far-side FRONT leg:

- retracts
- lifts

Near-side FRONT leg:

- swings forward

Far-side HIND paw:

- passes forward

Near-side HIND leg:

- recovers beneath body

Torso rises slightly.

Clearly different from Contact B.
`.trim(),
];

const WALK_NW = WALK_SW.map((text) =>
  text
    .replaceAll("SCREEN LOWER-LEFT", "SCREEN UPPER-LEFT")
    .replaceAll("SCREEN UPPER-RIGHT", "SCREEN LOWER-RIGHT"),
);

const ATTACK_SW = [
  `
ATTACK ANTICIPATION.

Crouch lower.

Compress hind legs.

Shoulders and head pull back.

Ears angle backward.

Tail stiffens naturally without changing
its color or design.
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

const HIT_VARIANT_PROMPTS = [
  [
    `
DAMAGE REACTION A — IMPACT.

A hit from front-left makes:

- head snap back
- shoulders snap back
- near front paw lift clearly
- torso compress
- hind legs brace
- ears flatten
- tail flick naturally

Rat remains alive.

No blood required.
`.trim(),

    `
DAMAGE REACTION A — PEAK STAGGER.

Torso twists away from impact.

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

Keep a small residual stagger.

Do not make this frame identical to idle.
`.trim(),
  ],

  [
    `
DAMAGE REACTION B — SIDE IMPACT.

Torso jerks sideways.

Opposite front paw lifts.

One hind paw steps outward.

Head dips.

Ears pin.

Tail whips for balance.

Rat remains alive.
`.trim(),

    `
DAMAGE REACTION B — LOW STAGGER.

Front half drops.

One foreleg bends strongly.

Opposite foreleg reaches for balance.

Hindquarters remain slightly raised.
`.trim(),

    `
DAMAGE REACTION B — RECOVERY.

Shoulders rise.

Paws move back toward support.

Hind paw steps inward.

Head lifts.

Keep residual stagger.
`.trim(),
  ],
];

const DEATH_PROMPTS = [
  `
DEATH FRAME 0 — FATAL IMPACT.

Strong body jolt.

Head recoils.

One front paw leaves ground.

Legs begin losing support.

Add only a small dark-red wound.
`.trim(),

  `
DEATH FRAME 1 — LEGS BUCKLE.

Chest drops.

Hindquarters twist.

One hind leg slides.

Head lowers.

Add a small restrained blood smear.
`.trim(),

  `
DEATH FRAME 2 — COLLAPSE.

Torso rotates strongly onto one side.

Paws stop supporting weight.

Head drops.

Hind legs fold or slide.

Tail falls slack.

Moderate dark-red blood is allowed.
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

Fully motionless on ground.

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

const CORPSE_PROMPTS = [
  `
CORPSE VARIANT A.

Dead side-collapse pose.

Torso fully on one side.

Head sideways.

Front legs folded.

Hind legs collapsed.

Tail has a slack natural curve
and remains a continuous flesh-pink rat tail.

Lifeless eye.

Torn fur.

One wound.

Restrained blood pool touching body.
`.trim(),

  `
CORPSE VARIANT B.

Dead belly/side twisted pose.

Head low.

One foreleg extended.

One foreleg folded.

Uneven hind-leg arrangement.

Different slack tail curve.

Shoulder or flank wound.

Restrained blood smear.
`.trim(),

  `
CORPSE VARIANT C.

Dead curled-side pose.

Torso slightly curled.

Head tucked low.

Asymmetric folded forelegs.

One hind leg more stretched.

Limp tail around or behind body.

Flank wound.

Small blood pool.
`.trim(),
];

function orientationPrompt(direction) {
  return direction === "southwest"
    ? `
Rat faces SCREEN LOWER-LEFT
in three-quarter FRONT-AND-SIDE isometric view.

Head remains lower-left.

Rear body remains upper-right.
`.trim()
    : `
Rat faces SCREEN UPPER-LEFT
in three-quarter BACK-AND-SIDE isometric view.

Head remains upper-left.

Rear body remains lower-right.
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
merely to show motion.

${ANATOMY_INTEGRITY}

${
  bloodAllowed
    ? `
Restrained dark-red blood and wounds are allowed.

Blood must be physically associated with
the injured/dead rat.

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
      await sleep(Math.min(8000, 1000 * 2 ** (attempt - 1)));
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

  log("SERVER", `OK model=${json?.model?.name ?? "unknown"}`);
}

async function fileToDataUrl(filePath) {
  const buffer = await sharp(filePath).removeAlpha().png().toBuffer();

  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function makeNativeRequestBody({ prompt, seed, refImages = [] }) {
  return {
    prompt,

    negative_prompt: "",

    width: CONFIG.generationSize,

    height: CONFIG.generationSize,

    seed,

    batch_count: 1,

    auto_resize_ref_image: true,

    increase_ref_index: false,

    ref_images: refImages,

    sample_params: {
      sample_method: CONFIG.sampler,

      sample_steps: CONFIG.steps,

      guidance: {
        txt_cfg: CONFIG.cfg,
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

  const jobNumber = METRICS.aiJobs + 1;

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

function parseHexColor(hex) {
  const clean = hex.replace("#", "");

  if (clean.length !== 6) {
    throw new Error(`Invalid color: ${hex}`);
  }

  return {
    r: parseInt(clean.slice(0, 2), 16),

    g: parseInt(clean.slice(2, 4), 16),

    b: parseInt(clean.slice(4, 6), 16),
  };
}

const CHROMA_RGB = parseHexColor(CONFIG.chromaHex);

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

  return Math.min(raw, 360 - raw);
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

    std: m2.map((value) => Math.sqrt(value / Math.max(1, count - 1))),
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

  const before =
    candidateStats.mean.reduce(
      (sum, value) => sum + value,

      0,
    ) / 3;

  const target =
    referenceStats.mean.reduce(
      (sum, value) => sum + value,

      0,
    ) / 3;

  return {
    before,
    target,
    scales,
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
  { direction = null, preserveBlood = false } = {},
) {
  const sourceOutput = getSourceAIPath(output);

  await ensureDir(path.dirname(sourceOutput));

  await fs.writeFile(sourceOutput, buffer);

  return normalizeChroma(sourceOutput, output, {
    appearanceReference: direction ? masterForDirection(direction) : null,

    preserveBlood,
  });
}

async function analyzeTailBanding(imagePath) {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const rgba = Buffer.from(data);

  const matte = createChromaMask(rgba, info.width, info.height, info.channels);

  let minX = info.width;

  let maxX = -1;

  let minY = info.height;

  let maxY = -1;

  for (let pixel = 0; pixel < matte.length; pixel++) {
    if (matte[pixel]) {
      continue;
    }

    const x = pixel % info.width;

    const y = Math.floor(pixel / info.width);

    minX = Math.min(minX, x);

    maxX = Math.max(maxX, x);

    minY = Math.min(minY, y);

    maxY = Math.max(maxY, y);
  }

  if (maxX < minX) {
    return {
      suspicious: false,
      score: 0,
      transitions: 0,
      samples: 0,
    };
  }

  const bboxWidth = maxX - minX + 1;

  const startX = minX + Math.floor(bboxWidth * 0.68);

  const rows = [];

  for (let y = minY; y <= maxY; y += 2) {
    let pink = 0;
    let dark = 0;

    for (let x = startX; x <= maxX; x++) {
      const pixel = y * info.width + x;

      if (matte[pixel]) {
        continue;
      }

      const offset = pixel * info.channels;

      const r = rgba[offset];

      const g = rgba[offset + 1];

      const b = rgba[offset + 2];

      const hsv = rgbToHsv(r, g, b);

      const pinkish =
        (hsv.h < 35 || hsv.h > 335) &&
        r > g * 1.1 &&
        r > b * 0.95 &&
        hsv.s > 0.15;

      const darkish = (r + g + b) / 3 < 75;

      if (pinkish) {
        pink++;
      } else if (darkish) {
        dark++;
      }
    }

    if (pink + dark >= 3) {
      rows.push(pink >= dark ? 1 : 0);
    }
  }

  let transitions = 0;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i] !== rows[i - 1]) {
      transitions++;
    }
  }

  const score = rows.length ? transitions / rows.length : 0;

  return {
    suspicious: rows.length >= 8 && transitions >= 4 && score > 0.18,

    score,
    transitions,

    samples: rows.length,
  };
}

async function logMasterQa(imagePath) {
  const qa = await analyzeTailBanding(imagePath);

  if (qa.suspicious) {
    warn(
      "MASTER QA",

      `${path.basename(
        imagePath,
      )} possible tail banding: transitions=${qa.transitions}/${qa.samples} score=${qa.score.toFixed(
        2,
      )}`,
    );
  } else {
    log(
      "MASTER QA",

      `${path.basename(
        imagePath,
      )} tail-band heuristic PASS transitions=${qa.transitions}/${qa.samples}`,
    );
  }

  return qa;
}

async function calculateMotionScore(firstPath, secondPath) {
  const read = (file) =>
    sharp(file)
      .resize(
        CONFIG.motion.analysisSize,

        CONFIG.motion.analysisSize,

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

function motionTooSmall(score, strong = false) {
  const minMean = strong
    ? CONFIG.motion.contactMeanDifference
    : CONFIG.motion.minMeanDifference;

  const minChanged = strong
    ? CONFIG.motion.contactChangedFraction
    : CONFIG.motion.minChangedFraction;

  const minSilhouette = strong
    ? CONFIG.motion.contactSilhouetteFraction
    : CONFIG.motion.minSilhouetteFraction;

  return (
    score.meanDifference < minMean ||
    score.changedFraction < minChanged ||
    score.silhouetteFraction < minSilhouette
  );
}

function motionString(score) {
  return `mean=${score.meanDifference.toFixed(2)} changed=${(
    score.changedFraction * 100
  ).toFixed(1)}% silhouette=${(score.silhouetteFraction * 100).toFixed(1)}%`;
}

async function generateStill({
  prompt,
  seed,
  output,
  reference = null,
  direction = null,
  preserveBlood = false,
}) {
  const sourceAI = getSourceAIPath(output);

  if (!FORCE && (await exists(sourceAI))) {
    const cleanInfo = await normalizeChroma(sourceAI, output, {
      appearanceReference: direction ? masterForDirection(direction) : null,

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
    direction,
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
  compareTo,
  posePrompt,
  direction,
  seed,
  output,
  strongMotion = false,
  preserveBlood = false,
  keepHead = true,
  retryWeakPose = true,
}) {
  const sourceAI = getSourceAIPath(output);

  if (!FORCE && (await exists(sourceAI))) {
    const cleanInfo = await normalizeChroma(sourceAI, output, {
      appearanceReference: masterForDirection(direction),

      preserveBlood,
    });

    const score = await calculateMotionScore(compareTo, output);

    log(
      "CACHE",

      `${relativeLabel(output)} ${motionString(score)}${
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

The previous pose was too weak.

Move the requested COMPLETE limbs much farther
while keeping character identity exact.

- move the relevant paw at least one full paw length
- visibly bend or extend elbow/knee
- make the silhouette visibly different after 96x96 reduction
- preserve skull, muzzle, eye, ears, fur colors and tail design
- the tail must remain continuous flesh-pink with ZERO rings/bands/stripes
- no duplicate paw
- no ghost paw
- no residual old limb
`;
    }

    const buffer = await runNativeImageJob({
      prompt,

      seed: seed + attempt * 7919,

      reference,
      output,
    });

    const cleanInfo = await saveGeneratedBuffer(buffer, output, {
      direction,
      preserveBlood,
    });

    const score = await calculateMotionScore(compareTo, output);

    const weak = motionTooSmall(score, strongMotion);

    log(
      "MOTION",

      `${relativeLabel(output)} ${motionString(score)} ${weak ? "LOW" : "OK"}${
        cleanInfo.color
          ? ` color=${cleanInfo.color.before.toFixed(
              1,
            )}->${cleanInfo.color.target.toFixed(1)}`
          : ""
      }`,
    );

    if (
      weak &&
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

async function generateMasterWithTailGuard({
  output,
  seed,
  prompt,
  reference = null,
}) {
  const sourceAI = getSourceAIPath(output);

  if (!FORCE && (await exists(sourceAI))) {
    await normalizeChroma(sourceAI, output);

    log("CACHE", relativeLabel(output));

    await logMasterQa(output);

    return;
  }

  for (let attempt = 0; attempt < CONFIG.masterMaxAttempts; attempt++) {
    let finalPrompt = prompt;

    if (attempt > 0) {
      finalPrompt += `

MASTER RETRY — TAIL QUALITY IS CRITICAL:

The previous master was rejected because the tail may
have acquired dark rings, stripes, bands or segmented coloration.

Render the SAME rat again.

The complete tail must be one uninterrupted muted
flesh-pink biological rat tail from pelvis to tip.

ZERO black rings.

ZERO gray rings.

ZERO dark bands.

ZERO alternating segments.

ZERO raccoon-like markings.

Do not change:

- rat identity
- camera
- proportions
- fur colors
- ears
- eye
- muzzle
`;
    }

    const buffer = await runNativeImageJob({
      prompt: finalPrompt,

      seed: seed + attempt * 7919,

      reference,
      output,
    });

    await saveGeneratedBuffer(buffer, output);

    const qa = await logMasterQa(output);

    if (!qa.suspicious || attempt + 1 >= CONFIG.masterMaxAttempts) {
      if (qa.suspicious) {
        warn(
          "MASTER QA",

          `${path.basename(
            output,
          )} still looks suspicious to heuristic; keeping last result. Inspect master visually before animation.`,
        );
      }

      return;
    }

    warn(
      "MASTER QA",

      `${path.basename(
        output,
      )} retrying master because of possible tail banding`,
    );
  }
}

async function generateMasters() {
  await generateMasterWithTailGuard({
    output: PATHS.masterFrontLeft,

    seed: SEEDS.masterFrontLeft,

    prompt: MASTER_FRONT_LEFT_PROMPT,
  });

  await generateMasterWithTailGuard({
    output: PATHS.masterBackLeft,

    seed: SEEDS.masterBackLeft,

    prompt: MASTER_BACK_LEFT_PROMPT,

    reference: PATHS.masterFrontLeft,
  });
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

async function generateWalkDirection(direction, master, baseSeed, poses) {
  const frame0 = rawPath("walk", direction, 0);

  const frame1 = rawPath("walk", direction, 1);

  const frame2 = rawPath("walk", direction, 2);

  const frame3 = rawPath("walk", direction, 3);

  await generateMotionFrame({
    reference: master,

    compareTo: master,

    posePrompt: poses[0],

    direction,

    seed: phaseSeed(baseSeed, 0),

    output: frame0,

    strongMotion: true,
  });

  await generateMotionFrame({
    reference: master,

    compareTo: frame0,

    posePrompt: poses[2],

    direction,

    seed: phaseSeed(baseSeed, 2),

    output: frame2,

    strongMotion: true,
  });

  await generateMotionFrame({
    reference: frame0,

    compareTo: frame0,

    posePrompt: poses[1],

    direction,

    seed: phaseSeed(baseSeed, 1),

    output: frame1,
  });

  await generateMotionFrame({
    reference: frame2,

    compareTo: frame2,

    posePrompt: poses[3],

    direction,

    seed: phaseSeed(baseSeed, 3),

    output: frame3,
  });
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

      compareTo: previous,

      posePrompt: poses[frame],

      direction,

      seed: phaseSeed(baseSeed, frame),

      output,

      strongMotion: strongFrames.includes(frame),

      preserveBlood,

      keepHead,

      retryWeakPose: frame < poses.length - 1,
    });

    previous = output;
  }
}

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

function hitPose(variant, frame) {
  const poses = HIT_VARIANT_PROMPTS[variant % HIT_VARIANT_PROMPTS.length];

  return (
    poses[frame] ??
    `
DAMAGE RECOVERY FRAME ${frame}.

Return toward stance but retain visible stagger.
`.trim()
  );
}

async function generateHitReactions() {
  for (let variant = 0; variant < CONFIG.hitVariants; variant++) {
    for (const direction of CANONICAL_DIRECTIONS) {
      let previous = masterForDirection(direction);

      const baseSeed =
        (direction === "southwest" ? SEEDS.hitSouthwest : SEEDS.hitNorthwest) +
        variant * 1009;

      for (let frame = 0; frame < CONFIG.hitFrames; frame++) {
        const output = rawPath("hit", direction, frame, variant);

        await generateMotionFrame({
          reference: previous,

          compareTo: previous,

          posePrompt: hitPose(variant, frame),

          direction,

          seed: phaseSeed(baseSeed, frame),

          output,

          strongMotion: frame < 2,

          retryWeakPose: frame < 2,
        });

        previous = output;
      }
    }
  }
}

function deathPose(frame) {
  return (
    DEATH_PROMPTS[frame] ??
    `
DEAD SETTLING FRAME ${frame}.

Corpse settles slightly lower.

Wounds and restrained blood remain consistent.

All limbs stay attached.
`.trim()
  );
}

async function generateDeath() {
  for (const direction of CANONICAL_DIRECTIONS) {
    let previous = masterForDirection(direction);

    const baseSeed =
      direction === "southwest" ? SEEDS.deathSouthwest : SEEDS.deathNorthwest;

    for (let frame = 0; frame < CONFIG.deathFrames; frame++) {
      const output = rawPath("death", direction, frame);

      await generateMotionFrame({
        reference: previous,

        compareTo: previous,

        posePrompt: deathPose(frame),

        direction,

        seed: phaseSeed(baseSeed, frame),

        output,

        strongMotion: frame > 0 && frame < Math.min(4, CONFIG.deathFrames),

        preserveBlood: true,

        keepHead: false,

        retryWeakPose: frame < CONFIG.deathFrames - 1,
      });

      previous = output;
    }
  }
}

async function generateCorpses() {
  for (let variant = 0; variant < CONFIG.corpseVariants; variant++) {
    for (const direction of CANONICAL_DIRECTIONS) {
      const master = masterForDirection(direction);

      const output = rawPath("corpse", direction, 0, variant);

      const baseSeed =
        direction === "southwest"
          ? SEEDS.corpseSouthwest
          : SEEDS.corpseNorthwest;

      const corpsePrompt = animationPrompt(
        `
${CORPSE_PROMPTS[variant % CORPSE_PROMPTS.length]}

This is corpse variant ${variant}.

Make pose, leg arrangement and tail curve
clearly different from other corpse variants
while keeping the exact same rat identity.

The tail must remain flesh-pink.

The tail must NOT acquire:

- dark rings
- black bands
- stripes
- segmented coloration
`.trim(),

        direction,

        {
          bloodAllowed: true,

          keepHead: false,
        },
      );

      await generateStill({
        prompt: corpsePrompt,

        seed: baseSeed + variant * 1009,

        output,

        reference: master,

        direction,

        preserveBlood: true,
      });
    }
  }
}

async function transparentizeFullCanvas(inputPath) {
  if (!(await exists(inputPath))) {
    const sourceAI = getSourceAIPath(inputPath);

    if (!(await exists(sourceAI))) {
      throw new Error(`Missing source: ${inputPath}`);
    }

    const direction =
      CANONICAL_DIRECTIONS.find((dir) => inputPath.includes(dir)) ?? null;

    const preserveBlood =
      inputPath.includes("death") || inputPath.includes("corpse");

    await normalizeChroma(sourceAI, inputPath, {
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
    buffer[offset + 3] = buffer[offset + 3] >= CONFIG.alphaThreshold ? 255 : 0;
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
      CONFIG.spriteSize,
      CONFIG.spriteSize,

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

  return shiftRgbaCanvas(hardened, CONFIG.spriteSize, 0, yOffset);
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
      CONFIG.spriteSize * CONFIG.previewScale,

      CONFIG.spriteSize * CONFIG.previewScale,

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
        width: CONFIG.spriteSize,

        height: CONFIG.spriteSize,

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

function getPixelSources(selection) {
  const sources = [];

  for (const direction of CANONICAL_DIRECTIONS) {
    sources.push({
      animation: "idle",

      direction,

      frame: 0,

      variant: null,

      input: masterForDirection(direction),

      output: spritePath("idle", direction, 0),

      paletteSeed: true,

      yOffset: 0,
    });
  }

  if (selection.walk) {
    for (const direction of CANONICAL_DIRECTIONS) {
      for (let frame = 0; frame < CONFIG.walkFrames; frame++) {
        sources.push({
          animation: "walk",

          direction,

          frame,

          variant: null,

          input: rawPath("walk", direction, frame),

          output: spritePath("walk", direction, frame),

          yOffset: [1, 0, 1, 0][frame],
        });
      }
    }
  }

  if (selection.attack) {
    for (const direction of CANONICAL_DIRECTIONS) {
      for (let frame = 0; frame < CONFIG.attackFrames; frame++) {
        sources.push({
          animation: "attack",

          direction,

          frame,

          variant: null,

          input: rawPath("attack", direction, frame),

          output: spritePath("attack", direction, frame),

          yOffset: [0, 1, 0, -1, 0, 0][frame],
        });
      }
    }
  }

  if (selection.hit) {
    for (let variant = 0; variant < CONFIG.hitVariants; variant++) {
      for (const direction of CANONICAL_DIRECTIONS) {
        for (let frame = 0; frame < CONFIG.hitFrames; frame++) {
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

  if (selection.death) {
    for (const direction of CANONICAL_DIRECTIONS) {
      for (let frame = 0; frame < CONFIG.deathFrames; frame++) {
        sources.push({
          animation: "death",

          direction,

          frame,

          variant: null,

          input: rawPath("death", direction, frame),

          output: spritePath("death", direction, frame),

          paletteSeed: frame === CONFIG.deathFrames - 1,

          yOffset: [0, 0, 1, 2, 2, 2, 2, 2][frame] ?? 2,
        });
      }
    }
  }

  if (selection.corpse) {
    for (let variant = 0; variant < CONFIG.corpseVariants; variant++) {
      for (const direction of CANONICAL_DIRECTIONS) {
        sources.push({
          animation: "corpse",

          direction,

          frame: 0,

          variant,

          input: rawPath("corpse", direction, 0, variant),

          output: spritePath("corpse", direction, 0, variant),

          paletteSeed: true,

          yOffset: 2,
        });
      }
    }
  }

  return sources;
}

async function pixelizeSelection(selection) {
  log("PIXEL", "START rasterize + palette");

  const sources = getPixelSources(selection);

  const rasters = new Map();

  const paletteSeeds = [];

  for (const source of sources) {
    if (!(await exists(source.input))) {
      throw new Error(`Missing source: ${source.input}`);
    }

    const raster = await rasterize(source.input, source.yOffset ?? 0);

    const key = `${source.animation}:${source.variant ?? -1}:${source.direction}:${source.frame}`;

    rasters.set(key, raster);

    if (source.paletteSeed) {
      paletteSeeds.push(raster);
    }
  }

  const palette = buildGlobalPalette(
    paletteSeeds.length ? paletteSeeds : [...rasters.values()],

    CONFIG.paletteSize,
  );

  await fs.writeFile(
    PATHS.palette,

    JSON.stringify(
      {
        size: palette.length,

        generationSize: CONFIG.generationSize,

        spriteSize: CONFIG.spriteSize,

        chromaColor: CONFIG.chromaHex,

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

  log("PIXEL", `${sources.length * 2} sprite frames written`);
}

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
    add("walk", CONFIG.walkFrames);
  }

  if (selection.attack) {
    add("attack", CONFIG.attackFrames);
  }

  if (selection.hit) {
    for (let variant = 0; variant < CONFIG.hitVariants; variant++) {
      add("hit", CONFIG.hitFrames, variant);
    }
  }

  if (selection.death) {
    add("death", CONFIG.deathFrames);
  }

  if (selection.corpse) {
    for (let variant = 0; variant < CONFIG.corpseVariants; variant++) {
      add("corpse", 1, variant);
    }
  }

  return rows;
}

async function createSheet(output, rows) {
  const cell = CONFIG.spriteSize;

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
      width * CONFIG.previewScale,

      height * CONFIG.previewScale,

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

async function createManifest(rows, sheetInfo) {
  const animations = {};

  const cell = CONFIG.spriteSize;

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
    schemaVersion: 5,

    assetType: "creature",

    projection: "isometric-2to1",

    engineTarget: "Phaser 4",

    image: "spritesheet.png",

    sourcePipeline: {
      server: CONFIG.server,

      generation: {
        width: CONFIG.generationSize,

        height: CONFIG.generationSize,

        steps: CONFIG.steps,

        sampler: CONFIG.sampler,

        cfg: CONFIG.cfg,
      },

      chroma: CONFIG.chromaHex,

      rasterMode: "fixed-canvas",

      tailPolicy: "continuous flesh-pink; no rings/bands/stripes",
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
      },

      northwest: {
        source: "ai",
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
      hit: CONFIG.hitVariants,

      corpse: CONFIG.corpseVariants,
    },

    walkCycle: {
      0: "contact-a",

      1: "passing-a",

      2: "contact-b",

      3: "passing-b",
    },

    tailPolicy: {
      stripedTail: "forbidden",

      ringedTail: "forbidden",

      segmentedTailColor: "forbidden",

      duplicateTail: "forbidden",

      expectedColor: "muted dirty flesh-pink",
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
    for (let variant = 0; variant < CONFIG.hitVariants; variant++) {
      await createSheet(
        path.join(PATHS.sheets, `hit-${variant}-sheet.png`),

        rows.filter(
          (row) => row.animation === "hit" && row.variant === variant,
        ),
      );
    }
  }

  if (selection.corpse) {
    for (let variant = 0; variant < CONFIG.corpseVariants; variant++) {
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

function printConfig(mode) {
  console.log("======================================");

  console.log("IRON ARCANA ISOMETRIC PIPELINE");

  console.log("======================================");

  console.log(`MODE: ${mode}`);

  console.log(`FORCE: ${FORCE}`);

  console.log(
    `GENERATION: ${CONFIG.generationSize}x${CONFIG.generationSize} steps=${CONFIG.steps} sampler=${CONFIG.sampler} cfg=${CONFIG.cfg}`,
  );

  console.log(
    `SPRITE: ${CONFIG.spriteSize}x${CONFIG.spriteSize} palette=${CONFIG.paletteSize} preview=x${CONFIG.previewScale}`,
  );

  console.log(
    `MOTION: retry=${CONFIG.motion.retryWeakPose} attempts=${CONFIG.motion.maxAttempts} normal=${CONFIG.motion.minMeanDifference}/${(
      CONFIG.motion.minChangedFraction * 100
    ).toFixed(1)}%/sil${(CONFIG.motion.minSilhouetteFraction * 100).toFixed(
      1,
    )}%`,
  );

  console.log(
    `MASTER: attempts=${CONFIG.masterMaxAttempts} tail-guard=prompt+heuristic`,
  );

  console.log(
    `HIT: ${CONFIG.hitVariants}x${CONFIG.hitFrames} | DEATH: ${CONFIG.deathFrames} | CORPSES: ${CONFIG.corpseVariants}`,
  );

  console.log(`CHROMA: ${CONFIG.chromaHex}`);

  console.log("API: sdcpp native async jobs");
}

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

  if (mode === "sheet") {
    await stage(
      "build sheets + manifest",

      () => buildSheets(SELECTIONS.all, true),
    );

    printSummary();

    return;
  }

  await stage("server check", checkServer);

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

  if (mode === "all") {
    await stage("generate masters", generateMasters);
  } else {
    await stage("ensure masters", ensureMasters);
  }

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
