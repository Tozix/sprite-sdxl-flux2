import {
  isString,
  isArrayOfString,
  isArrayOfStringArray,
  cloneArrayOfStrings,
  type Template,
} from "../../templates.ts";
import { ISO_CONFIG } from "./config.ts";

export let DIRECTIONS: readonly string[] = [
  "southwest",
  "southeast",
  "northeast",
  "northwest",
];

export let CANONICAL_DIRECTIONS: readonly string[] = ["southwest", "northwest"];

export let MIRROR_DIRECTION: Record<string, string> = {
  southwest: "southeast",
  northwest: "northeast",
  southeast: "southwest",
  northeast: "northwest",
};

export let SEEDS: Record<string, number> = {
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

export let ISOMETRIC_CAMERA = `
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

export let CHROMA_BACKGROUND = `
CRITICAL BACKGROUND REQUIREMENT:

Use one completely uniform chroma-key matte background.

Exact requested matte color:

${ISO_CONFIG.chroma.hex}

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

export let NO_SYMBOLS = `
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

export let RAT_STYLE = `
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

export let TAIL_INTEGRITY = `
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

export let EAR_INTEGRITY = `
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

export let ANATOMY_INTEGRITY = `
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

export let ART_STYLE = `
ART STYLE:

- grim dark-fantasy RPG game asset
- clean stylized 2D source artwork
- strong dark outline
- crisp boundaries
- controlled flat colors
- restrained shading inside the subject silhouette
- enough detail for later ${ISO_CONFIG.sprite.size}x${ISO_CONFIG.sprite.size} pixel-art reduction
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

export let IDENTITY_LOCK = `
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

export let COLOR_LOCK_PROMPT = `
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

export let MASTER_FRONT_LEFT_PROMPT = `
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

export let MASTER_BACK_LEFT_PROMPT = `
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

export let WALK_SW: string[] = [
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
after ${ISO_CONFIG.sprite.size}x${ISO_CONFIG.sprite.size} reduction.
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

CRITICAL ${ISO_CONFIG.sprite.size}x${ISO_CONFIG.sprite.size} READABILITY:

The lifted paw MUST remain visibly separated from the ground
after reduction to ${ISO_CONFIG.sprite.size}x${ISO_CONFIG.sprite.size}.

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

CRITICAL ${ISO_CONFIG.sprite.size}x${ISO_CONFIG.sprite.size} READABILITY:

The lifted paw MUST remain visibly separated from the ground.

Move the WHOLE limb.

Do NOT merely move toes.
`.trim(),
];

export let WALK_NW: string[] = WALK_SW.map((text) =>
  text
    .replaceAll("SCREEN LOWER-LEFT", "SCREEN UPPER-LEFT")
    .replaceAll("SCREEN UPPER-RIGHT", "SCREEN LOWER-RIGHT"),
);

export let ATTACK_SW: string[] = [
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

export let ATTACK_NW: string[] = ATTACK_SW.map((text) =>
  text.replaceAll("SCREEN LOWER-LEFT", "SCREEN UPPER-LEFT"),
);

export let HIT_VARIANTS: string[][] = [
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

export let DEATH_PROMPTS: string[] = [
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

export let CORPSE_PROMPTS: string[] = [
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

export function applyTemplateConfig(template: Template | null): void {
  if (!template) {
    return;
  }

  const candidate = template as Record<string, unknown>;

  if (
    isArrayOfString(candidate.DIRECTIONS) &&
    candidate.DIRECTIONS.length === 4
  ) {
    DIRECTIONS = candidate.DIRECTIONS;
  }

  if (
    Array.isArray(candidate.CANONICAL_DIRECTIONS) &&
    candidate.CANONICAL_DIRECTIONS.length
  ) {
    CANONICAL_DIRECTIONS = candidate.CANONICAL_DIRECTIONS as string[];
  }

  if (candidate.MIRROR_DIRECTION && typeof candidate.MIRROR_DIRECTION === "object") {
    MIRROR_DIRECTION = {
      ...MIRROR_DIRECTION,
      ...(candidate.MIRROR_DIRECTION as Record<string, string>),
    };
  }

  if (candidate.SEEDS && typeof candidate.SEEDS === "object") {
    SEEDS = {
      ...SEEDS,
      ...(candidate.SEEDS as Record<string, number>),
    };
  }

  if (isString(candidate.ISOMETRIC_CAMERA)) {
    ISOMETRIC_CAMERA = candidate.ISOMETRIC_CAMERA;
  }
  if (isString(candidate.CHROMA_BACKGROUND)) {
    CHROMA_BACKGROUND = candidate.CHROMA_BACKGROUND;
  }
  if (isString(candidate.NO_SYMBOLS)) {
    NO_SYMBOLS = candidate.NO_SYMBOLS;
  }
  if (isString(candidate.RAT_STYLE)) {
    RAT_STYLE = candidate.RAT_STYLE;
  }
  if (isString(candidate.TAIL_INTEGRITY)) {
    TAIL_INTEGRITY = candidate.TAIL_INTEGRITY;
  }
  if (isString(candidate.EAR_INTEGRITY)) {
    EAR_INTEGRITY = candidate.EAR_INTEGRITY;
  }
  if (isString(candidate.ANATOMY_INTEGRITY)) {
    ANATOMY_INTEGRITY = candidate.ANATOMY_INTEGRITY;
  }
  if (isString(candidate.ART_STYLE)) {
    ART_STYLE = candidate.ART_STYLE;
  }
  if (isString(candidate.IDENTITY_LOCK)) {
    IDENTITY_LOCK = candidate.IDENTITY_LOCK;
  }
  if (isString(candidate.COLOR_LOCK_PROMPT)) {
    COLOR_LOCK_PROMPT = candidate.COLOR_LOCK_PROMPT;
  }
  if (isString(candidate.MASTER_FRONT_LEFT_PROMPT)) {
    MASTER_FRONT_LEFT_PROMPT = candidate.MASTER_FRONT_LEFT_PROMPT;
  }
  if (isString(candidate.MASTER_BACK_LEFT_PROMPT)) {
    MASTER_BACK_LEFT_PROMPT = candidate.MASTER_BACK_LEFT_PROMPT;
  }
  if (isArrayOfString(candidate.WALK_SW)) {
    WALK_SW = cloneArrayOfStrings(candidate.WALK_SW);
    WALK_NW = WALK_SW.map((text) =>
      text
        .replaceAll("SCREEN LOWER-LEFT", "SCREEN UPPER-LEFT")
        .replaceAll("SCREEN UPPER-RIGHT", "SCREEN LOWER-RIGHT"),
    );
  }
  if (isArrayOfString(candidate.ATTACK_SW)) {
    ATTACK_SW = cloneArrayOfStrings(candidate.ATTACK_SW);
    ATTACK_NW = ATTACK_SW.map((text) =>
      text.replaceAll("SCREEN LOWER-LEFT", "SCREEN UPPER-LEFT"),
    );
  }
  if (isArrayOfStringArray(candidate.HIT_VARIANTS)) {
    HIT_VARIANTS = candidate.HIT_VARIANTS.map((variantSet) =>
      variantSet.map((value) => value.trim()),
    );
  }
  if (isArrayOfString(candidate.DEATH_PROMPTS)) {
    DEATH_PROMPTS = cloneArrayOfStrings(candidate.DEATH_PROMPTS);
  }
  if (isArrayOfString(candidate.CORPSE_PROMPTS)) {
    CORPSE_PROMPTS = cloneArrayOfStrings(candidate.CORPSE_PROMPTS);
  }
}
