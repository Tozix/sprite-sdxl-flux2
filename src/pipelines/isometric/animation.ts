import {
  IDENTITY_LOCK,
  COLOR_LOCK_PROMPT,
  TAIL_INTEGRITY,
  EAR_INTEGRITY,
  ISOMETRIC_CAMERA,
  ANATOMY_INTEGRITY,
  ART_STYLE,
  NO_SYMBOLS,
  CHROMA_BACKGROUND,
} from "./prompts.ts";

export function orientationPrompt(direction: string): string {
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

export function animationPrompt(
  pose: string,
  direction: string,
  { bloodAllowed = false, keepHead = true } = {},
): string {
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
