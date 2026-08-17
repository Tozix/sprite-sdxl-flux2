import { isString, isArrayOfString, cloneArrayOfStrings } from "../../templates.ts";
import type { Template } from "../../templates.ts";

export let GLOBAL_ART_RULES = `
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

export let MASTER_SIDE_PROMPT = `
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

export let MASTER_UP_PROMPT = `
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

export let WALK_SIDE: string[] = [
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
`.trim(),

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
`.trim(),

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
`.trim(),

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
`.trim(),
];

export let WALK_UP: string[] = [
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
`.trim(),

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
`.trim(),

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
`.trim(),

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
`.trim(),
];

export let ATTACK_SIDE: string[] = [
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
`.trim(),

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
`.trim(),

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
`.trim(),

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
`.trim(),

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
`.trim(),

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
`.trim(),
];

export let ATTACK_UP: string[] = [
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
`.trim(),

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
`.trim(),

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
`.trim(),

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
`.trim(),

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
`.trim(),

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
`.trim(),
];

export function applyTemplatePrompts(template: Template | null): void {
  if (!template) {
    return;
  }

  const candidate = template as Record<string, unknown>;

  if (isString(candidate.GLOBAL_ART_RULES)) {
    GLOBAL_ART_RULES = candidate.GLOBAL_ART_RULES;
  }
  if (isString(candidate.MASTER_SIDE_PROMPT)) {
    MASTER_SIDE_PROMPT = candidate.MASTER_SIDE_PROMPT;
  }
  if (isString(candidate.MASTER_UP_PROMPT)) {
    MASTER_UP_PROMPT = candidate.MASTER_UP_PROMPT;
  }
  if (isArrayOfString(candidate.WALK_SIDE)) {
    WALK_SIDE = cloneArrayOfStrings(candidate.WALK_SIDE);
  }
  if (isArrayOfString(candidate.WALK_UP)) {
    WALK_UP = cloneArrayOfStrings(candidate.WALK_UP);
  }
  if (isArrayOfString(candidate.ATTACK_SIDE)) {
    ATTACK_SIDE = cloneArrayOfStrings(candidate.ATTACK_SIDE);
  }
  if (isArrayOfString(candidate.ATTACK_UP)) {
    ATTACK_UP = cloneArrayOfStrings(candidate.ATTACK_UP);
  }
}
