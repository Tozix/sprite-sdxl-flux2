import {
  GLOBAL_ART_RULES,
  WALK_SIDE,
  WALK_UP,
  ATTACK_SIDE,
  ATTACK_UP,
} from "./prompts.ts";

export function buildPrompt(prompt: string): string {
  return `${prompt}\n\n${GLOBAL_ART_RULES}`.trim();
}

export function walkPrompt(view: "side" | "up", frame: number): string {
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

  return buildPrompt(
    `
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
`.trim(),
  );
}

export function attackPrompt(view: "side" | "up", frame: number): string {
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

  return buildPrompt(
    `
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
`.trim(),
  );
}
