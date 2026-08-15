import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const CONFIG = {
  server: "http://192.168.0.14:7861",

  outputDir: "./output/rat",

  generationSize: "512x512",

  steps: 4,
  sampler: "euler",
  cfg: 1.0,

  /*
  |--------------------------------------------------------------------------
  | PIXEL ART
  |--------------------------------------------------------------------------
  */

  spriteSize: 96,

  paletteSize: 24,

  pixelPadding: 6,

  backgroundTolerance: 34,

  alphaThreshold: 90,

  previewScale: 6,

  /*
  |--------------------------------------------------------------------------
  | ANIMATIONS
  |--------------------------------------------------------------------------
  */

  walkFrames: 4,

  attackFrames: 6,

  walkBob: [1, 0, 1, 0],

  attackBob: [0, 1, 0, -1, 0, 0],

  /*
  |--------------------------------------------------------------------------
  | DIRECTION ORDER
  |--------------------------------------------------------------------------
  |
  | Используем classic RPG order:
  |
  | DOWN
  | LEFT
  | RIGHT
  | UP
  |
  */

  directions: ["down", "left", "right", "up"],

  /*
  |--------------------------------------------------------------------------
  | SEEDS
  |--------------------------------------------------------------------------
  */

  seeds: {
    masterSide: 101,
    masterUp: 202,

    walkSide: 1000,
    walkUp: 2000,

    attackSide: 3000,
    attackUp: 4000,
  },

  /*
  |--------------------------------------------------------------------------
  | SHADOW PROTECTION
  |--------------------------------------------------------------------------
  */

  shadow: {
    maxGenerateAttempts: 3,

    /*
    | Отдельный объект меньше этого количества
    | пикселей не считаем значимым.
    */
    minComponentArea: 80,

    /*
    | Тень обычно значительно шире,
    | чем выше.
    */
    minAspectRatio: 2.5,

    /*
    | Максимальная высота подозрительной
    | полосы относительно тела.
    */
    maxHeightVsBody: 0.2,

    /*
    | Минимальная ширина относительно тела.
    */
    minWidthVsBody: 0.2,

    /*
    | Тень чаще относительно близка
    | к цвету серого background.
    */
    maxBackgroundColorDistance: 115,
  },
};

const CLI_ARGS = process.argv.slice(2);

const FORCE = CLI_ARGS.includes("--force");

function parseTemplateArg(argv = CLI_ARGS) {
  const index = argv.indexOf("--template");

  if (index === -1) {
    return null;
  }

  if (index === argv.length - 1) {
    throw new Error("Missing path after --template");
  }

  const templatePath = argv[index + 1];

  if (!templatePath || templatePath.startsWith("--")) {
    throw new Error("Invalid --template value");
  }

  return templatePath;
}

function parseModeArg(argv = CLI_ARGS) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--template") {
      i += 1;

      continue;
    }

    if (arg === "--force" || arg.startsWith("--")) {
      continue;
    }

    return arg.toLowerCase();
  }

  return "all";
}

function isString(value) {
  return typeof value === "string";
}

function isArrayOfString(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

async function loadTemplate(pathname) {
  if (!pathname) {
    return null;
  }

  const raw = await fs.readFile(pathname, "utf8");

  const template = JSON.parse(raw);

  if (template === null || typeof template !== "object") {
    throw new Error(`Invalid template JSON: ${pathname}`);
  }

  return template;
}

function applyTemplateConfig(template = {}) {
  if (!template || typeof template !== "object") {
    return;
  }

  if (isString(template.GLOBAL_ART_RULES)) {
    GLOBAL_ART_RULES = template.GLOBAL_ART_RULES;
  }

  if (isString(template.MASTER_SIDE_PROMPT)) {
    MASTER_SIDE_PROMPT = template.MASTER_SIDE_PROMPT;
  }

  if (isString(template.MASTER_UP_PROMPT)) {
    MASTER_UP_PROMPT = template.MASTER_UP_PROMPT;
  }

  if (isArrayOfString(template.WALK_SIDE)) {
    WALK_SIDE = template.WALK_SIDE.map((text) => text.trim());
  }

  if (isArrayOfString(template.WALK_UP)) {
    WALK_UP = template.WALK_UP.map((text) => text.trim());
  }

  if (isArrayOfString(template.ATTACK_SIDE)) {
    ATTACK_SIDE = template.ATTACK_SIDE.map((text) => text.trim());
  }

  if (isArrayOfString(template.ATTACK_UP)) {
    ATTACK_UP = template.ATTACK_UP.map((text) => text.trim());
  }
}

/*
|--------------------------------------------------------------------------
| PATHS
|--------------------------------------------------------------------------
*/

const PATHS = {
  masters: path.join(CONFIG.outputDir, "masters"),

  raw: path.join(CONFIG.outputDir, "raw"),

  sprites: path.join(CONFIG.outputDir, "sprites"),

  sheets: path.join(CONFIG.outputDir, "sheets"),

  masterSide: path.join(CONFIG.outputDir, "masters", "master-side.png"),

  masterUp: path.join(CONFIG.outputDir, "masters", "master-up.png"),

  palette: path.join(CONFIG.outputDir, "palette.json"),
};

/*
|--------------------------------------------------------------------------
| GLOBAL ART RULES
|--------------------------------------------------------------------------
|
| Эти правила добавляются КО ВСЕМ prompts.
|
|--------------------------------------------------------------------------
*/

let GLOBAL_ART_RULES = `
ABSOLUTE OUTPUT RULES:

The image must contain ONLY the rat and a perfectly uniform flat background.

SHADOWS ARE STRICTLY FORBIDDEN.

DO NOT DRAW:

- cast shadow
- contact shadow
- ground shadow
- ambient shadow underneath the body
- ellipse underneath the creature
- gray patch underneath the creature
- gray horizontal smear
- dark horizontal smear
- grounding shape
- floor contact shape
- reflected shadow
- drop shadow
- glow
- dust
- speed trail
- motion trail
- motion blur
- floor
- ground plane
- platform
- environment

There must be NO visible surface underneath the rat.

Every pixel outside the actual rat silhouette must belong to the same
perfectly uniform solid light-gray background.

The area directly underneath every paw and underneath the belly must
remain exactly the same plain background color as the image corners.

Do NOT add artistic grounding.

Do NOT add atmospheric effects.

Do NOT add lighting effects outside the rat silhouette.

The rat must look like an isolated 2D game asset floating on a flat
chroma-style background that will later be removed automatically.
`.trim();

/*
|--------------------------------------------------------------------------
| MASTER PROMPTS
|--------------------------------------------------------------------------
*/

let MASTER_SIDE_PROMPT = `
Create one single 2D RPG enemy creature asset.

The creature is a fantasy sewer rat.

CAMERA:

STRICT ORTHOGRAPHIC SIDE PROFILE.

The rat faces LEFT.

- head on the LEFT
- tail extends toward the RIGHT
- body long axis horizontal
- camera perfectly level with the animal
- no three-quarter angle
- no front-facing view
- no overhead view
- entire rat visible

CHARACTER:

- adult fantasy sewer rat
- compact muscular rodent body
- slightly aggressive RPG enemy appearance
- warm dark gray-brown fur
- subtle lighter beige-gray belly
- clean visible fur tufts along neck, back and belly
- large rounded ears
- pink inner ears
- long tapered pink tail
- small pink nose
- black eye
- tiny bright eye highlight
- several clearly visible whiskers
- individual paws clearly readable
- small toes
- tiny claws
- slightly hunched posture
- readable shoulder form
- readable rear thigh form
- clear head / neck / torso separation
- readable game silhouette

DETAIL:

Use enough detail that the asset remains readable after being reduced
to approximately 96x96 pixels.

Do not make it overly simplistic.

Preserve:

- ear structure
- paws
- toes
- eye
- nose
- belly marking
- fur silhouette
- tail shape

ART STYLE:

- clean stylized 2D RPG game asset
- hand-drawn sprite source artwork
- strong clean dark outline
- flat cel-style colors
- limited controlled shading INSIDE the rat only
- crisp boundaries
- approximately 16-24 useful visual colors
- no photorealism
- no gradients
- no blur
- no airbrush
- no texture noise
- no realistic lighting

BACKGROUND:

- completely uniform solid light gray
- no scenery
- no objects
- no text
- no UI
- one rat only

This is a canonical character master that will be used to create
multiple animation frames while preserving identity.
`.trim();

let MASTER_UP_PROMPT = `
Use the reference image as the EXACT SAME RAT.

Preserve EXACTLY:

- species
- identity
- head shape
- body proportions
- body thickness
- fur color
- lighter belly color where anatomically visible
- ear size
- pink inner ears
- paw style
- pink tail
- tail thickness
- fur tufts
- dark outline
- visual detail level
- art style

CHANGE THE CAMERA ONLY.

CRITICAL CAMERA REQUIREMENT:

STRICT DIRECT OVERHEAD DORSAL VIEW.

The virtual camera is vertically ABOVE the rat
and looks STRAIGHT DOWN onto its BACK.

The rat faces NORTH / UP.

COMPOSITION:

- head at TOP
- nose points toward TOP
- tail exits body toward BOTTOM
- body's long axis is vertical
- dorsal spine/back clearly visible
- top of skull visible
- both ears visible from above
- shoulder width visible
- rear body width visible
- paws visible around the sides
- full animal visible
- centered

THIS MUST NOT BE:

- side profile
- rear eye-level view
- three-quarter camera
- frontal portrait
- perspective camera

Imagine a classic top-down RPG where the gameplay camera
is directly above the creature.

ART:

Keep exactly the same stylized clean 2D game artwork.

- clean dark outline
- visible fur silhouette
- crisp boundaries
- flat cel colors
- limited shading INSIDE the silhouette
- enough detail for 96x96 reduction
- no gradients
- no blur

BACKGROUND:

Completely uniform solid light gray.

Do not redesign the character.
`.trim();

/*
|--------------------------------------------------------------------------
| WALK — SIDE
|--------------------------------------------------------------------------
*/

let WALK_SIDE = [
  `
WALK FRAME 1 — CONTACT A.

Rat continues facing LEFT.

Create a clearly readable stride.

- visible front forepaw reaches forward LEFT
- corresponding rear hind paw reaches backward RIGHT
- opposite diagonal pair moves in reverse
- chest moves slightly forward
- body lowers slightly
- spine compresses slightly
- tail counterbalances subtly

The feet must visibly change location.
`,

  `
WALK FRAME 2 — PASSING A.

Rat continues facing LEFT.

- forward forepaw passes beneath chest
- hind paw passes beneath belly
- legs visually pass
- torso rises slightly
- body stretches slightly forward
- head shifts slightly forward
- tail returns closer to neutral

Clearly different from frame 1.
`,

  `
WALK FRAME 3 — CONTACT B.

Rat continues facing LEFT.

Opposite stride phase.

- opposite forepaw reaches forward LEFT
- opposite hind paw reaches backward RIGHT
- leg configuration reversed from frame 1
- chest slightly forward
- body slightly lower
- tail counterbalances opposite frame 1

Feet must visibly move.
`,

  `
WALK FRAME 4 — PASSING B.

Rat continues facing LEFT.

- paws pass underneath torso
- configuration opposite frame 2
- torso rises slightly
- shoulders move forward
- rear legs collect beneath body
- tail follows opposite movement

Clearly different from all other walk frames.
`,
].map((x) => x.trim());

/*
|--------------------------------------------------------------------------
| WALK — UP
|--------------------------------------------------------------------------
*/

let WALK_UP = [
  `
WALK FRAME 1 — CONTACT A.

STRICT DIRECT OVERHEAD CAMERA.

Rat continues facing UP.

- left forepaw reaches toward TOP
- right hind paw reaches toward BOTTOM
- opposite diagonal pair reverses
- shoulders move slightly upward
- torso compresses slightly
- tail bends subtly LEFT

Paw placement must be readable from above.
`,

  `
WALK FRAME 2 — PASSING A.

STRICT DIRECT OVERHEAD CAMERA.

Rat continues facing UP.

- forepaws move closer beneath shoulders
- hind paws move toward torso center
- body lengthens slightly
- shoulders move toward TOP
- tail returns toward central axis

Clearly different from frame 1.
`,

  `
WALK FRAME 3 — CONTACT B.

STRICT DIRECT OVERHEAD CAMERA.

Rat continues facing UP.

- right forepaw reaches toward TOP
- left hind paw reaches toward BOTTOM
- diagonal configuration reversed
- torso slightly compressed
- tail bends subtly RIGHT

Clearly different from frame 1.
`,

  `
WALK FRAME 4 — PASSING B.

STRICT DIRECT OVERHEAD CAMERA.

Rat continues facing UP.

- paws pass beneath body
- configuration opposite frame 2
- torso elongates slightly
- shoulders move forward
- tail travels through opposite return phase

Clearly different from all other walk frames.
`,
].map((x) => x.trim());

/*
|--------------------------------------------------------------------------
| ATTACK — SIDE
|--------------------------------------------------------------------------
|
| 0 anticipation
| 1 wind-up
| 2 lunge
| 3 impact
| 4 recoil
| 5 recovery
|
|--------------------------------------------------------------------------
*/

let ATTACK_SIDE = [
  `
ATTACK FRAME 1 OF 6 — ANTICIPATION.

Rat faces LEFT.

Prepare for an aggressive bite attack.

- body crouches slightly
- hind legs compress
- shoulders pull backward
- head pulls subtly backward
- neck shortens
- ears angle slightly backward
- mouth mostly closed
- tail stiffens slightly
`,

  `
ATTACK FRAME 2 OF 6 — WIND-UP.

Rat faces LEFT.

- hindquarters compress strongly
- rear legs prepare to push
- chest shifts slightly forward
- head pulls back
- mouth begins opening
- nose points toward target direction
- ears slightly backward
- tail counterbalances backward
`,

  `
ATTACK FRAME 3 OF 6 — LUNGE.

Rat faces LEFT.

- hind legs push strongly
- torso stretches toward LEFT
- shoulders move significantly forward
- head thrusts LEFT
- neck extends
- front paws reach forward
- mouth opens
- small incisors may be visible
- tail trails backward

Strong forward attack movement.
`,

  `
ATTACK FRAME 4 OF 6 — IMPACT / BITE.

This is the gameplay HIT FRAME.

Rat faces LEFT.

- head at maximum forward extension
- mouth clearly open in biting pose
- small visible incisors
- muzzle at maximum LEFT position
- front paws forward
- body elongated
- hind legs extended
- shoulders far forward
- tail stretched backward

NO enemy.
NO target.
Only the rat.
`,

  `
ATTACK FRAME 5 OF 6 — RECOIL.

Rat faces LEFT.

- jaw begins closing
- head pulls backward
- shoulders begin returning
- front paws retract
- torso shortens
- hind legs recover
- tail swings toward neutral
`,

  `
ATTACK FRAME 6 OF 6 — RECOVERY.

Rat faces LEFT.

- mouth closed
- head near normal position
- paws return underneath body
- torso returns near normal length
- hindquarters settle
- ears return toward neutral
- tail returns toward normal curve

Keep a subtle recovery pose instead of copying idle exactly.
`,
].map((x) => x.trim());

/*
|--------------------------------------------------------------------------
| ATTACK — UP
|--------------------------------------------------------------------------
*/

let ATTACK_UP = [
  `
ATTACK FRAME 1 OF 6 — ANTICIPATION.

STRICT DIRECT OVERHEAD CAMERA.

Rat faces UP.

- body contracts slightly
- hindquarters compress
- head pulls slightly toward body center
- shoulders move subtly DOWN
- ears angle backward
- front paws draw closer
- tail becomes slightly straighter
`,

  `
ATTACK FRAME 2 OF 6 — WIND-UP.

STRICT DIRECT OVERHEAD CAMERA.

Rat faces UP.

- rear body compresses strongly
- shoulders prepare to surge forward
- skull pulls backward slightly
- front paws brace
- tail counterbalances toward BOTTOM
- mouth begins opening
`,

  `
ATTACK FRAME 3 OF 6 — LUNGE.

STRICT DIRECT OVERHEAD CAMERA.

Rat faces UP.

- head moves strongly toward TOP
- shoulders move toward TOP
- torso lengthens
- forepaws reach forward
- hind legs push backward
- tail trails toward BOTTOM
`,

  `
ATTACK FRAME 4 OF 6 — IMPACT / BITE.

STRICT DIRECT OVERHEAD CAMERA.

Rat faces UP.

This is the gameplay HIT FRAME.

- head at maximum TOP position
- muzzle fully extended
- biting pose readable from overhead
- shoulders far forward
- forepaws extended
- torso elongated
- hindquarters stretched
- tail trails toward BOTTOM

NO enemy.
NO target.
Only the rat.
`,

  `
ATTACK FRAME 5 OF 6 — RECOIL.

STRICT DIRECT OVERHEAD CAMERA.

Rat faces UP.

- head pulls back from TOP
- shoulders return
- forepaws retract
- torso shortens
- hind legs return
- tail begins relaxing
`,

  `
ATTACK FRAME 6 OF 6 — RECOVERY.

STRICT DIRECT OVERHEAD CAMERA.

Rat faces UP.

- body returns near normal length
- head returns toward idle location
- paws return to normal placement
- shoulders settle
- hindquarters settle
- tail approaches neutral alignment

Keep slight post-attack recovery.
`,
].map((x) => x.trim());

/*
|--------------------------------------------------------------------------
| PROMPT BUILDERS
|--------------------------------------------------------------------------
*/

function buildPrompt(prompt) {
  return `
${prompt}

${GLOBAL_ART_RULES}
`.trim();
}

function walkPrompt(view, frame) {
  const pose = view === "side" ? WALK_SIDE[frame] : WALK_UP[frame];

  const camera =
    view === "side"
      ? `
CAMERA:

- strict orthographic side profile
- rat faces LEFT
- head LEFT
- tail RIGHT
- never rotate camera
`
      : `
CAMERA:

- strict direct overhead dorsal view
- camera vertically above
- looking directly down
- rat faces UP
- head TOP
- tail BOTTOM
- never tilt camera
- never use side profile
`;

  return buildPrompt(`
Use the reference image as the EXACT SAME RAT.

Preserve EXACTLY:

- identity
- species
- head shape
- body proportions
- fur colors
- belly marking
- ears
- paws
- pink tail
- dark outline
- art style
- visual detail

${camera}

${pose}

Actually change limb positions.

Do not simply reproduce the reference.

Do not redesign the rat.

Do not change zoom.

Full body visible.
`);
}

function attackPrompt(view, frame) {
  const pose = view === "side" ? ATTACK_SIDE[frame] : ATTACK_UP[frame];

  const camera =
    view === "side"
      ? `
CAMERA:

STRICT ORTHOGRAPHIC SIDE PROFILE.

Rat faces LEFT.
Head LEFT.
Tail RIGHT.
`
      : `
CAMERA:

STRICT DIRECT OVERHEAD DORSAL VIEW.

Camera directly above.
Rat faces UP.
Head TOP.
Tail BOTTOM.
`;

  return buildPrompt(`
Use the reference image as the EXACT SAME RAT.

Preserve EXACTLY:

- identity
- species
- head shape
- body proportions
- fur colors
- belly marking
- ears
- paws
- pink tail
- dark outline
- visual detail
- art style

${camera}

Create one keyframe of a bite / lunge attack.

${pose}

Do not redesign the rat.

Do not change camera.

Do not change zoom.

Full body visible.

NO motion blur.

NO motion trails.
`);
}

/*
|--------------------------------------------------------------------------
| FILE UTILS
|--------------------------------------------------------------------------
*/

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

async function prepareDirectories() {
  const dirs = [PATHS.masters, PATHS.raw, PATHS.sprites, PATHS.sheets];

  for (const animation of ["walk", "attack"]) {
    for (const direction of CONFIG.directions) {
      dirs.push(path.join(PATHS.raw, animation, direction));

      dirs.push(path.join(PATHS.sprites, animation, direction));
    }
  }

  for (const direction of CONFIG.directions) {
    dirs.push(path.join(PATHS.sprites, "idle", direction));
  }

  for (const dir of dirs) {
    await ensureDir(dir);
  }
}

/*
|--------------------------------------------------------------------------
| SERVER
|--------------------------------------------------------------------------
*/

async function checkServer() {
  console.log("Checking FLUX server...");

  const response = await fetch(`${CONFIG.server}/v1/models`);

  if (!response.ok) {
    throw new Error(`FLUX server unavailable: ${response.status}`);
  }

  console.log("FLUX server OK");
}

function extraPrompt(prompt, seed) {
  const args = {
    seed,

    sample_params: {
      sample_steps: CONFIG.steps,

      sample_method: CONFIG.sampler,

      guidance: {
        txt_cfg: CONFIG.cfg,
      },
    },
  };

  return (
    prompt + `\n<sd_cpp_extra_args>${JSON.stringify(args)}</sd_cpp_extra_args>`
  );
}

/*
|--------------------------------------------------------------------------
| COLOR HELPERS
|--------------------------------------------------------------------------
*/

function colorDistanceSquared(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;

  const dg = g1 - g2;

  const db = b1 - b2;

  return dr * dr + dg * dg + db * db;
}

function colorDistance(a, b) {
  return Math.sqrt(colorDistanceSquared(a.r, a.g, a.b, b.r, b.g, b.b));
}

function estimateBackground(data, width, height, channels) {
  const samples = [];

  const size = Math.max(
    6,
    Math.min(24, Math.floor(Math.min(width, height) / 10)),
  );

  const corners = [
    [0, 0],

    [width - size, 0],

    [0, height - size],

    [width - size, height - size],
  ];

  for (const [sx, sy] of corners) {
    for (let y = sy; y < sy + size; y += 2) {
      for (let x = sx; x < sx + size; x += 2) {
        const i = (y * width + x) * channels;

        samples.push({
          r: data[i],
          g: data[i + 1],
          b: data[i + 2],
        });
      }
    }
  }

  const total = samples.reduce(
    (acc, c) => ({
      r: acc.r + c.r,

      g: acc.g + c.g,

      b: acc.b + c.b,
    }),

    {
      r: 0,
      g: 0,
      b: 0,
    },
  );

  return {
    r: Math.round(total.r / samples.length),

    g: Math.round(total.g / samples.length),

    b: Math.round(total.b / samples.length),
  };
}

/*
|--------------------------------------------------------------------------
| FOREGROUND MASK
|--------------------------------------------------------------------------
*/

function createForegroundMask(rgba, width, height, channels, background) {
  const threshold = CONFIG.backgroundTolerance * CONFIG.backgroundTolerance;

  const backgroundMask = new Uint8Array(width * height);

  const queue = new Int32Array(width * height);

  let read = 0;
  let write = 0;

  function isNearBackground(pixelIndex) {
    const i = pixelIndex * channels;

    return (
      colorDistanceSquared(
        rgba[i],
        rgba[i + 1],
        rgba[i + 2],

        background.r,
        background.g,
        background.b,
      ) <= threshold
    );
  }

  function push(index) {
    if (index < 0 || index >= width * height) {
      return;
    }

    if (backgroundMask[index]) {
      return;
    }

    if (!isNearBackground(index)) {
      return;
    }

    backgroundMask[index] = 1;

    queue[write++] = index;
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
    const index = queue[read++];

    const x = index % width;

    const y = Math.floor(index / width);

    if (x > 0) {
      push(index - 1);
    }

    if (x < width - 1) {
      push(index + 1);
    }

    if (y > 0) {
      push(index - width);
    }

    if (y < height - 1) {
      push(index + width);
    }
  }

  const foreground = new Uint8Array(width * height);

  for (let i = 0; i < foreground.length; i++) {
    foreground[i] = backgroundMask[i] ? 0 : 1;
  }

  return foreground;
}

/*
|--------------------------------------------------------------------------
| CONNECTED COMPONENTS
|--------------------------------------------------------------------------
*/

function findComponents(mask, rgba, width, height, channels) {
  const visited = new Uint8Array(width * height);

  const queue = new Int32Array(width * height);

  const components = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) {
      continue;
    }

    let read = 0;
    let write = 0;

    queue[write++] = start;

    visited[start] = 1;

    let area = 0;

    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;

    const pixels = [];

    while (read < write) {
      const index = queue[read++];

      pixels.push(index);

      const x = index % width;

      const y = Math.floor(index / width);

      area++;

      minX = Math.min(minX, x);

      maxX = Math.max(maxX, x);

      minY = Math.min(minY, y);

      maxY = Math.max(maxY, y);

      const offset = index * channels;

      totalR += rgba[offset];

      totalG += rgba[offset + 1];

      totalB += rgba[offset + 2];

      const neighbors = [];

      if (x > 0) {
        neighbors.push(index - 1);
      }

      if (x < width - 1) {
        neighbors.push(index + 1);
      }

      if (y > 0) {
        neighbors.push(index - width);
      }

      if (y < height - 1) {
        neighbors.push(index + width);
      }

      for (const next of neighbors) {
        if (mask[next] && !visited[next]) {
          visited[next] = 1;

          queue[write++] = next;
        }
      }
    }

    components.push({
      area,

      minX,
      maxX,
      minY,
      maxY,

      width: maxX - minX + 1,

      height: maxY - minY + 1,

      centerX: (minX + maxX) / 2,

      centerY: (minY + maxY) / 2,

      averageColor: {
        r: Math.round(totalR / area),

        g: Math.round(totalG / area),

        b: Math.round(totalB / area),
      },

      pixels,
    });
  }

  components.sort((a, b) => b.area - a.area);

  return components;
}

/*
|--------------------------------------------------------------------------
| SHADOW DETECTOR
|--------------------------------------------------------------------------
*/

function isLikelyShadowComponent(component, main, background) {
  if (component.area < CONFIG.shadow.minComponentArea) {
    return false;
  }

  const aspect = component.width / Math.max(component.height, 1);

  if (aspect < CONFIG.shadow.minAspectRatio) {
    return false;
  }

  if (component.height > main.height * CONFIG.shadow.maxHeightVsBody) {
    return false;
  }

  if (component.width < main.width * CONFIG.shadow.minWidthVsBody) {
    return false;
  }

  /*
  | Тень должна быть в нижней
  | половине основного персонажа.
  */

  if (component.centerY < main.centerY) {
    return false;
  }

  const distance = colorDistance(
    component.averageColor,

    background,
  );

  if (distance > CONFIG.shadow.maxBackgroundColorDistance) {
    return false;
  }

  return true;
}

async function analyzeImage(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const rgba = Buffer.from(data);

  const background = estimateBackground(
    rgba,

    info.width,
    info.height,
    info.channels,
  );

  const mask = createForegroundMask(
    rgba,

    info.width,
    info.height,
    info.channels,

    background,
  );

  const components = findComponents(
    mask,
    rgba,

    info.width,
    info.height,
    info.channels,
  );

  if (!components.length) {
    return {
      hasShadow: false,

      background,

      components,
    };
  }

  const main = components[0];

  const shadows = components
    .slice(1)
    .filter((component) =>
      isLikelyShadowComponent(component, main, background),
    );

  return {
    hasShadow: shadows.length > 0,

    background,

    main,

    shadows,

    components,
  };
}

/*
|--------------------------------------------------------------------------
| API RESPONSE
|--------------------------------------------------------------------------
*/

async function saveApiImage(response, output) {
  const text = await response.text();

  if (!response.ok) {
    console.error(text);

    throw new Error(`API failed: HTTP ${response.status}`);
  }

  let json;

  try {
    json = JSON.parse(text);
  } catch {
    console.error(text);

    throw new Error("Server returned invalid JSON");
  }

  const base64 = json?.data?.[0]?.b64_json;

  if (!base64) {
    console.error(JSON.stringify(json, null, 2));

    throw new Error("No image returned by server");
  }

  await ensureDir(path.dirname(output));

  await fs.writeFile(
    output,

    Buffer.from(base64, "base64"),
  );
}

/*
|--------------------------------------------------------------------------
| TEXT GENERATION
|--------------------------------------------------------------------------
*/

async function requestGenerate({ prompt, seed, output }) {
  const response = await fetch(
    `${CONFIG.server}/v1/images/generations`,

    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        prompt: extraPrompt(
          buildPrompt(prompt),

          seed,
        ),

        size: CONFIG.generationSize,

        n: 1,

        output_format: "png",
      }),
    },
  );

  await saveApiImage(response, output);
}

/*
|--------------------------------------------------------------------------
| EDIT GENERATION
|--------------------------------------------------------------------------
*/

async function requestEdit({ reference, prompt, seed, output }) {
  const buffer = await fs.readFile(reference);

  const form = new FormData();

  form.append(
    "image[]",

    new Blob(
      [buffer],

      {
        type: "image/png",
      },
    ),

    path.basename(reference),
  );

  form.append(
    "prompt",

    extraPrompt(prompt, seed),
  );

  form.append("size", CONFIG.generationSize);

  form.append("n", "1");

  form.append("output_format", "png");

  const response = await fetch(
    `${CONFIG.server}/v1/images/edits`,

    {
      method: "POST",

      body: form,
    },
  );

  await saveApiImage(response, output);
}

/*
|--------------------------------------------------------------------------
| AI GENERATE + AUTOMATIC SHADOW RETRY
|--------------------------------------------------------------------------
*/

async function generateSafe({ type, reference, prompt, seed, output }) {
  /*
  | Проверяем cached файл.
  |
  | Если в нём нет обнаруженной тени —
  | используем.
  */

  if (!FORCE && (await exists(output))) {
    const cachedAnalysis = await analyzeImage(output);

    if (!cachedAnalysis.hasShadow) {
      console.log("CACHE:", output);

      return;
    }

    console.log("SHADOW FOUND IN CACHE:", output);

    console.log("Regenerating...");
  }

  for (
    let attempt = 0;
    attempt < CONFIG.shadow.maxGenerateAttempts;
    attempt++
  ) {
    const attemptSeed = seed + attempt * 7919;

    console.log("");
    console.log(`${type.toUpperCase()} ${output}`);

    console.log("seed:", attemptSeed);

    console.log("attempt:", attempt + 1);

    let attemptPrompt = prompt;

    if (attempt > 0) {
      attemptPrompt += `

CRITICAL RETRY CORRECTION:

The previous generation contained an unwanted ground/contact shadow.

THIS RETRY MUST HAVE ABSOLUTELY ZERO SHADOW.

There must not be even a single gray horizontal patch underneath
the creature.

Every pixel outside the rat silhouette must be the exact same flat
background color.
`;
    }

    if (type === "generate") {
      await requestGenerate({
        prompt: attemptPrompt,

        seed: attemptSeed,

        output,
      });
    } else {
      await requestEdit({
        reference,

        prompt: attemptPrompt,

        seed: attemptSeed,

        output,
      });
    }

    const analysis = await analyzeImage(output);

    if (!analysis.hasShadow) {
      return;
    }

    console.warn("Possible shadow artifact detected:", output);

    if (attempt + 1 >= CONFIG.shadow.maxGenerateAttempts) {
      console.warn("Maximum retry count reached.");

      console.warn("Postprocessor will attempt to remove detached shadow.");

      return;
    }
  }
}

/*
|--------------------------------------------------------------------------
| MASTER GENERATION
|--------------------------------------------------------------------------
*/

async function generateMasters() {
  console.log("");
  console.log("==============================");

  console.log("MASTERS");

  console.log("==============================");

  await generateSafe({
    type: "generate",

    prompt: MASTER_SIDE_PROMPT,

    seed: CONFIG.seeds.masterSide,

    output: PATHS.masterSide,
  });

  await generateSafe({
    type: "edit",

    reference: PATHS.masterSide,

    prompt: buildPrompt(MASTER_UP_PROMPT),

    seed: CONFIG.seeds.masterUp,

    output: PATHS.masterUp,
  });
}

/*
|--------------------------------------------------------------------------
| WALK GENERATION
|--------------------------------------------------------------------------
*/

async function generateWalk() {
  console.log("");
  console.log("==============================");

  console.log("WALK");

  console.log("==============================");

  for (let frame = 0; frame < CONFIG.walkFrames; frame++) {
    await generateSafe({
      type: "edit",

      reference: PATHS.masterSide,

      prompt: walkPrompt("side", frame),

      seed: CONFIG.seeds.walkSide + frame,

      output: path.join(PATHS.raw, "walk", "left", `${frame}.png`),
    });

    await generateSafe({
      type: "edit",

      reference: PATHS.masterUp,

      prompt: walkPrompt("up", frame),

      seed: CONFIG.seeds.walkUp + frame,

      output: path.join(PATHS.raw, "walk", "up", `${frame}.png`),
    });
  }
}

/*
|--------------------------------------------------------------------------
| ATTACK GENERATION
|--------------------------------------------------------------------------
*/

async function generateAttack() {
  console.log("");
  console.log("==============================");

  console.log("ATTACK");

  console.log("==============================");

  for (let frame = 0; frame < CONFIG.attackFrames; frame++) {
    await generateSafe({
      type: "edit",

      reference: PATHS.masterSide,

      prompt: attackPrompt("side", frame),

      seed: CONFIG.seeds.attackSide + frame,

      output: path.join(PATHS.raw, "attack", "left", `${frame}.png`),
    });

    await generateSafe({
      type: "edit",

      reference: PATHS.masterUp,

      prompt: attackPrompt("up", frame),

      seed: CONFIG.seeds.attackUp + frame,

      output: path.join(PATHS.raw, "attack", "up", `${frame}.png`),
    });
  }
}

async function generateAnimations() {
  if (!(await exists(PATHS.masterSide)) || !(await exists(PATHS.masterUp))) {
    throw new Error("Masters missing. Run: node sprite-pipeline.mjs masters");
  }

  await generateWalk();

  await generateAttack();
}

/*
|--------------------------------------------------------------------------
| EXTRACT FOREGROUND
|--------------------------------------------------------------------------
*/

async function extractForeground(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const rgba = Buffer.from(data);

  const width = info.width;

  const height = info.height;

  const channels = info.channels;

  const background = estimateBackground(rgba, width, height, channels);

  const mask = createForegroundMask(rgba, width, height, channels, background);

  /*
  |--------------------------------------------------------------------------
  | REMOVE DETACHED SHADOW COMPONENTS
  |--------------------------------------------------------------------------
  */

  const components = findComponents(mask, rgba, width, height, channels);

  if (!components.length) {
    throw new Error(`No foreground found: ${input}`);
  }

  const main = components[0];

  for (const component of components.slice(1)) {
    if (isLikelyShadowComponent(component, main, background)) {
      console.log("REMOVE SHADOW COMPONENT:", input);

      for (const pixel of component.pixels) {
        mask[pixel] = 0;
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | APPLY ALPHA
  |--------------------------------------------------------------------------
  */

  for (let i = 0; i < width * height; i++) {
    rgba[i * channels + 3] = mask[i] ? 255 : 0;
  }

  /*
  |--------------------------------------------------------------------------
  | BOUNDING BOX
  |--------------------------------------------------------------------------
  */

  let minX = width;

  let minY = height;

  let maxX = -1;

  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;

      if (rgba[i + 3]) {
        minX = Math.min(minX, x);

        minY = Math.min(minY, y);

        maxX = Math.max(maxX, x);

        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error(`Foreground disappeared: ${input}`);
  }

  const border = 3;

  minX = Math.max(0, minX - border);

  minY = Math.max(0, minY - border);

  maxX = Math.min(width - 1, maxX + border);

  maxY = Math.min(height - 1, maxY + border);

  const cropWidth = maxX - minX + 1;

  const cropHeight = maxY - minY + 1;

  const buffer = await sharp(
    rgba,

    {
      raw: {
        width,
        height,
        channels,
      },
    },
  )
    .extract({
      left: minX,

      top: minY,

      width: cropWidth,

      height: cropHeight,
    })
    .png()
    .toBuffer();

  return {
    buffer,

    width: cropWidth,

    height: cropHeight,
  };
}

/*
|--------------------------------------------------------------------------
| SCALE
|--------------------------------------------------------------------------
*/

function getScale(foreground) {
  const inner = CONFIG.spriteSize - CONFIG.pixelPadding * 2;

  return Math.min(
    inner / foreground.width,

    inner / foreground.height,
  );
}

/*
|--------------------------------------------------------------------------
| HIGH RES -> LOW RES
|--------------------------------------------------------------------------
*/

async function rasterize({ input, referenceScale, yOffset = 0 }) {
  const foreground = await extractForeground(input);

  const inner = CONFIG.spriteSize - CONFIG.pixelPadding * 2;

  let scale = referenceScale;

  scale = Math.min(
    scale,

    inner / foreground.width,

    inner / foreground.height,
  );

  const targetWidth = Math.max(
    1,

    Math.round(foreground.width * scale),
  );

  const targetHeight = Math.max(
    1,

    Math.round(foreground.height * scale),
  );

  /*
  | Lanczos используется ТОЛЬКО
  | для качественного уменьшения.
  */

  const { data } = await sharp(foreground.buffer)
    .resize({
      width: targetWidth,

      height: targetHeight,

      fit: "fill",

      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({
      resolveWithObject: true,
    });

  /*
  | Hard alpha.
  */

  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = data[i + 3] >= CONFIG.alphaThreshold ? 255 : 0;
  }

  const size = CONFIG.spriteSize;

  const canvas = Buffer.alloc(
    size * size * 4,

    0,
  );

  let left = Math.floor((size - targetWidth) / 2);

  let top = Math.floor((size - targetHeight) / 2) + yOffset;

  left = Math.max(
    0,

    Math.min(
      size - targetWidth,

      left,
    ),
  );

  top = Math.max(
    0,

    Math.min(
      size - targetHeight,

      top,
    ),
  );

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const src = (y * targetWidth + x) * 4;

      const dst = ((top + y) * size + left + x) * 4;

      canvas[dst] = data[src];

      canvas[dst + 1] = data[src + 1];

      canvas[dst + 2] = data[src + 2];

      canvas[dst + 3] = data[src + 3];
    }
  }

  return canvas;
}

/*
|--------------------------------------------------------------------------
| GLOBAL PALETTE
|--------------------------------------------------------------------------
*/

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

function paletteDistance(a, b) {
  return colorDistanceSquared(
    a.r,
    a.g,
    a.b,

    b.r,
    b.g,
    b.b,
  );
}

function buildGlobalPalette(buffers, wanted) {
  const histogram = new Map();

  for (const buffer of buffers) {
    for (let i = 0; i < buffer.length; i += 4) {
      if (buffer[i + 3] < CONFIG.alphaThreshold) {
        continue;
      }

      const key = rgbKey(buffer[i], buffer[i + 1], buffer[i + 2]);

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

  while (centers.length < wanted) {
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

      const weight = Math.log2(entry.count + 1);

      const score = nearest * weight;

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

  /*
  |--------------------------------------------------------------------------
  | WEIGHTED K-MEANS
  |--------------------------------------------------------------------------
  */

  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centers.map(() => ({
      r: 0,
      g: 0,
      b: 0,

      weight: 0,
    }));

    for (const entry of entries) {
      let bestIndex = 0;

      let bestDistance = Infinity;

      for (let i = 0; i < centers.length; i++) {
        const distance = paletteDistance(entry, centers[i]);

        if (distance < bestDistance) {
          bestDistance = distance;

          bestIndex = i;
        }
      }

      const sum = sums[bestIndex];

      sum.r += entry.r * entry.count;

      sum.g += entry.g * entry.count;

      sum.b += entry.b * entry.count;

      sum.weight += entry.count;
    }

    for (let i = 0; i < centers.length; i++) {
      const sum = sums[i];

      if (!sum.weight) {
        continue;
      }

      centers[i] = {
        r: Math.round(sum.r / sum.weight),

        g: Math.round(sum.g / sum.weight),

        b: Math.round(sum.b / sum.weight),
      };
    }
  }

  centers.sort((a, b) => a.r + a.g + a.b - (b.r + b.g + b.b));

  return centers;
}

function applyPalette(input, palette) {
  const output = Buffer.from(input);

  for (let i = 0; i < output.length; i += 4) {
    if (output[i + 3] < CONFIG.alphaThreshold) {
      output[i] = 0;
      output[i + 1] = 0;
      output[i + 2] = 0;
      output[i + 3] = 0;

      continue;
    }

    const current = {
      r: output[i],

      g: output[i + 1],

      b: output[i + 2],
    };

    let best = palette[0];

    let bestDistance = Infinity;

    for (const color of palette) {
      const distance = paletteDistance(current, color);

      if (distance < bestDistance) {
        bestDistance = distance;

        best = color;
      }
    }

    output[i] = best.r;

    output[i + 1] = best.g;

    output[i + 2] = best.b;

    output[i + 3] = 255;
  }

  return output;
}

/*
|--------------------------------------------------------------------------
| WRITE SPRITE / PREVIEW
|--------------------------------------------------------------------------
*/

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

async function createPreview(input) {
  const parsed = path.parse(input);

  const output = path.join(
    parsed.dir,

    `${parsed.name}-preview.png`,
  );

  await sharp(input)
    .resize({
      width: CONFIG.spriteSize * CONFIG.previewScale,

      height: CONFIG.spriteSize * CONFIG.previewScale,

      kernel: sharp.kernel.nearest,
    })
    .png()
    .toFile(output);
}

/*
|--------------------------------------------------------------------------
| TRANSFORM
|--------------------------------------------------------------------------
*/

async function transformSprite({ input, output, type }) {
  await ensureDir(path.dirname(output));

  if (type === "mirror") {
    await sharp(input).flop().png().toFile(output);
  } else if (type === "rotate180") {
    await sharp(input).rotate(180).png().toFile(output);
  } else {
    throw new Error(`Unknown transform: ${type}`);
  }

  await createPreview(output);
}

/*
|--------------------------------------------------------------------------
| PIXEL SOURCES
|--------------------------------------------------------------------------
*/

async function getPixelSources() {
  const side = await extractForeground(PATHS.masterSide);

  const up = await extractForeground(PATHS.masterUp);

  const sideScale = getScale(side);

  const upScale = getScale(up);

  const sources = [];

  /*
  | IDLE
  */

  sources.push({
    key: "idle:left",

    input: PATHS.masterSide,

    scale: sideScale,

    yOffset: 0,

    output: path.join(PATHS.sprites, "idle", "left", "0.png"),
  });

  sources.push({
    key: "idle:up",

    input: PATHS.masterUp,

    scale: upScale,

    yOffset: 0,

    output: path.join(PATHS.sprites, "idle", "up", "0.png"),
  });

  /*
  | WALK
  */

  for (let frame = 0; frame < CONFIG.walkFrames; frame++) {
    sources.push({
      key: `walk:left:${frame}`,

      input: path.join(PATHS.raw, "walk", "left", `${frame}.png`),

      scale: sideScale,

      yOffset: CONFIG.walkBob[frame],

      output: path.join(PATHS.sprites, "walk", "left", `${frame}.png`),
    });

    sources.push({
      key: `walk:up:${frame}`,

      input: path.join(PATHS.raw, "walk", "up", `${frame}.png`),

      scale: upScale,

      yOffset: CONFIG.walkBob[frame],

      output: path.join(PATHS.sprites, "walk", "up", `${frame}.png`),
    });
  }

  /*
  | ATTACK
  */

  for (let frame = 0; frame < CONFIG.attackFrames; frame++) {
    sources.push({
      key: `attack:left:${frame}`,

      input: path.join(PATHS.raw, "attack", "left", `${frame}.png`),

      scale: sideScale,

      yOffset: CONFIG.attackBob[frame],

      output: path.join(PATHS.sprites, "attack", "left", `${frame}.png`),
    });

    sources.push({
      key: `attack:up:${frame}`,

      input: path.join(PATHS.raw, "attack", "up", `${frame}.png`),

      scale: upScale,

      yOffset: CONFIG.attackBob[frame],

      output: path.join(PATHS.sprites, "attack", "up", `${frame}.png`),
    });
  }

  return sources;
}

/*
|--------------------------------------------------------------------------
| PIXELIZE ALL
|--------------------------------------------------------------------------
*/

async function pixelizeEverything() {
  console.log("");
  console.log("==============================");

  console.log("PIXELIZE + GLOBAL PALETTE");

  console.log("==============================");

  const sources = await getPixelSources();

  for (const source of sources) {
    if (!(await exists(source.input))) {
      throw new Error(`Missing source: ${source.input}`);
    }
  }

  const rasters = new Map();

  for (const source of sources) {
    console.log("RASTER:", source.key);

    const buffer = await rasterize({
      input: source.input,

      referenceScale: source.scale,

      yOffset: source.yOffset,
    });

    rasters.set(source.key, buffer);
  }

  /*
  |--------------------------------------------------------------------------
  | ONE GLOBAL CHARACTER PALETTE
  |--------------------------------------------------------------------------
  */

  const palette = buildGlobalPalette(
    [...rasters.values()],

    CONFIG.paletteSize,
  );

  await fs.writeFile(
    PATHS.palette,

    JSON.stringify(
      {
        size: palette.length,

        colors: palette.map((color) => ({
          ...color,

          hex:
            "#" +
            [color.r, color.g, color.b]
              .map((n) => n.toString(16).padStart(2, "0"))
              .join("")
              .toUpperCase(),
        })),
      },

      null,
      2,
    ),
  );

  for (const source of sources) {
    const raster = rasters.get(source.key);

    const quantized = applyPalette(raster, palette);

    await writeSprite(quantized, source.output);
  }

  /*
  |--------------------------------------------------------------------------
  | DERIVED IDLE
  |--------------------------------------------------------------------------
  */

  await transformSprite({
    input: path.join(PATHS.sprites, "idle", "left", "0.png"),

    output: path.join(PATHS.sprites, "idle", "right", "0.png"),

    type: "mirror",
  });

  await transformSprite({
    input: path.join(PATHS.sprites, "idle", "up", "0.png"),

    output: path.join(PATHS.sprites, "idle", "down", "0.png"),

    type: "rotate180",
  });

  /*
  |--------------------------------------------------------------------------
  | DERIVED WALK
  |--------------------------------------------------------------------------
  */

  for (let frame = 0; frame < CONFIG.walkFrames; frame++) {
    await transformSprite({
      input: path.join(PATHS.sprites, "walk", "left", `${frame}.png`),

      output: path.join(PATHS.sprites, "walk", "right", `${frame}.png`),

      type: "mirror",
    });

    await transformSprite({
      input: path.join(PATHS.sprites, "walk", "up", `${frame}.png`),

      output: path.join(PATHS.sprites, "walk", "down", `${frame}.png`),

      type: "rotate180",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | DERIVED ATTACK
  |--------------------------------------------------------------------------
  */

  for (let frame = 0; frame < CONFIG.attackFrames; frame++) {
    await transformSprite({
      input: path.join(PATHS.sprites, "attack", "left", `${frame}.png`),

      output: path.join(PATHS.sprites, "attack", "right", `${frame}.png`),

      type: "mirror",
    });

    await transformSprite({
      input: path.join(PATHS.sprites, "attack", "up", `${frame}.png`),

      output: path.join(PATHS.sprites, "attack", "down", `${frame}.png`),

      type: "rotate180",
    });
  }

  console.log("PIXELIZE DONE");
}

/*
|--------------------------------------------------------------------------
| MASTER ONLY PIXELIZE
|--------------------------------------------------------------------------
*/

async function pixelizeMastersOnly() {
  const side = await extractForeground(PATHS.masterSide);

  const up = await extractForeground(PATHS.masterUp);

  const sideScale = getScale(side);

  const upScale = getScale(up);

  const sideRaster = await rasterize({
    input: PATHS.masterSide,

    referenceScale: sideScale,
  });

  const upRaster = await rasterize({
    input: PATHS.masterUp,

    referenceScale: upScale,
  });

  const palette = buildGlobalPalette(
    [sideRaster, upRaster],

    CONFIG.paletteSize,
  );

  const left = path.join(PATHS.sprites, "idle", "left", "0.png");

  const right = path.join(PATHS.sprites, "idle", "right", "0.png");

  const upOutput = path.join(PATHS.sprites, "idle", "up", "0.png");

  const down = path.join(PATHS.sprites, "idle", "down", "0.png");

  await writeSprite(applyPalette(sideRaster, palette), left);

  await writeSprite(applyPalette(upRaster, palette), upOutput);

  await transformSprite({
    input: left,
    output: right,
    type: "mirror",
  });

  await transformSprite({
    input: upOutput,
    output: down,
    type: "rotate180",
  });

  await buildIdleSheet();
}

/*
|--------------------------------------------------------------------------
| ROW DEFINITIONS
|--------------------------------------------------------------------------
*/

function idleRows() {
  return CONFIG.directions.map((direction) => ({
    animation: "idle",

    direction,

    frames: 1,

    get: () => path.join(PATHS.sprites, "idle", direction, "0.png"),
  }));
}

function walkRows() {
  return CONFIG.directions.map((direction) => ({
    animation: "walk",

    direction,

    frames: CONFIG.walkFrames,

    get: (frame) => path.join(PATHS.sprites, "walk", direction, `${frame}.png`),
  }));
}

function attackRows() {
  return CONFIG.directions.map((direction) => ({
    animation: "attack",

    direction,

    frames: CONFIG.attackFrames,

    get: (frame) =>
      path.join(PATHS.sprites, "attack", direction, `${frame}.png`),
  }));
}

/*
|--------------------------------------------------------------------------
| SHEET BUILDER
|--------------------------------------------------------------------------
*/

async function createSheet({ output, rows, columns }) {
  const cell = CONFIG.spriteSize;

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
    .resize({
      width: width * CONFIG.previewScale,

      height: height * CONFIG.previewScale,

      kernel: sharp.kernel.nearest,
    })
    .png()
    .toFile(path.join(parsed.dir, `${parsed.name}-preview.png`));
}

async function buildIdleSheet() {
  await createSheet({
    output: path.join(PATHS.sheets, "idle-sheet.png"),

    rows: idleRows(),

    columns: 1,
  });
}

async function buildSheets() {
  console.log("");
  console.log("==============================");

  console.log("BUILD SHEETS");

  console.log("==============================");

  await buildIdleSheet();

  await createSheet({
    output: path.join(PATHS.sheets, "walk-sheet.png"),

    rows: walkRows(),

    columns: CONFIG.walkFrames,
  });

  await createSheet({
    output: path.join(PATHS.sheets, "attack-sheet.png"),

    rows: attackRows(),

    columns: CONFIG.attackFrames,
  });

  const allRows = [...idleRows(), ...walkRows(), ...attackRows()];

  await createSheet({
    output: path.join(PATHS.sheets, "spritesheet.png"),

    rows: allRows,

    /*
    | Самая длинная animation —
    | attack = 6 кадров.
    */
    columns: CONFIG.attackFrames,
  });

  await createManifest(allRows);

  console.log("");
  console.log("FINAL:");

  console.log(path.join(PATHS.sheets, "spritesheet.png"));
}

/*
|--------------------------------------------------------------------------
| MANIFEST
|--------------------------------------------------------------------------
*/

async function createManifest(rows) {
  const cell = CONFIG.spriteSize;

  const animations = {};

  rows.forEach((row, rowIndex) => {
    const key = `${row.animation}_${row.direction}`;

    const frames = [];

    for (let frameIndex = 0; frameIndex < row.frames; frameIndex++) {
      frames.push({
        index: frameIndex,

        column: frameIndex,

        row: rowIndex,

        x: frameIndex * cell,

        y: rowIndex * cell,

        width: cell,

        height: cell,
      });
    }

    const isAttack = row.animation === "attack";

    animations[key] = {
      animation: row.animation,

      direction: row.direction,

      loop: !isAttack,

      fps: row.animation === "walk" ? 8 : isAttack ? 10 : 1,

      frames,
    };

    if (isAttack) {
      animations[key].events = [
        {
          frame: 3,
          event: "hit",
        },
      ];
    }
  });

  const manifest = {
    schemaVersion: 1,

    image: "spritesheet.png",

    format: "fixed-grid",

    transparent: true,

    shadowPolicy: "Shadows, ground shadows and contact shadows are forbidden.",

    frame: {
      width: cell,

      height: cell,
    },

    anchor: {
      x: 0.5,
      y: 0.5,
    },

    sheet: {
      columns: CONFIG.attackFrames,

      rows: rows.length,

      width: CONFIG.attackFrames * cell,

      height: rows.length * cell,
    },

    convention: {
      frameOrder: "left-to-right",

      directionOrder: ["down", "left", "right", "up"],

      animationGroupOrder: ["idle", "walk", "attack"],

      derivedDirections: {
        right: "horizontal mirror of left",

        down: "180 degree rotation of up",
      },
    },

    masters: {
      side: {
        file: "../masters/master-side.png",

        canonicalDirection: "left",
      },

      top: {
        file: "../masters/master-up.png",

        canonicalDirection: "up",
      },
    },

    palette: "../palette.json",

    animations,
  };

  await fs.writeFile(
    path.join(PATHS.sheets, "spritesheet.json"),

    JSON.stringify(manifest, null, 2),
  );
}

/*
|--------------------------------------------------------------------------
| MAIN
|--------------------------------------------------------------------------
*/

async function main() {
  const mode = parseModeArg();

  const templatePath = parseTemplateArg();

  const template = await loadTemplate(templatePath);

  applyTemplateConfig(template);

  const modes = ["masters", "animate", "pixelize", "sheet", "all"];

  if (!modes.includes(mode)) {
    console.log(`
Usage:

node sprite-pipeline.mjs masters
node sprite-pipeline.mjs animate
node sprite-pipeline.mjs pixelize
node sprite-pipeline.mjs sheet
  node sprite-pipeline.mjs all

node sprite-pipeline.mjs <mode> --template templates/sprite/base.json

Force AI regeneration:

node sprite-pipeline.mjs all --force
`);

    process.exit(1);
  }

  await prepareDirectories();

  console.log("");
  console.log("MODE:", mode);

  console.log("FORCE:", FORCE);

  console.log("SPRITE:", `${CONFIG.spriteSize}x${CONFIG.spriteSize}`);

  console.log("PALETTE:", CONFIG.paletteSize);

  if (mode === "masters") {
    await checkServer();

    await generateMasters();

    await pixelizeMastersOnly();

    return;
  }

  if (mode === "animate") {
    await checkServer();

    await generateAnimations();

    await pixelizeEverything();

    await buildSheets();

    return;
  }

  if (mode === "pixelize") {
    await pixelizeEverything();

    await buildSheets();

    return;
  }

  if (mode === "sheet") {
    await buildSheets();

    return;
  }

  await checkServer();

  await generateMasters();

  await generateAnimations();

  await pixelizeEverything();

  await buildSheets();
}

main().catch((error) => {
  console.error("");
  console.error("==============================");

  console.error("PIPELINE FAILED");

  console.error("==============================");

  console.error(error);

  process.exit(1);
});
