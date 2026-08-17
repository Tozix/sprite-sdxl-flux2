import { ISO_CONFIG } from "./config.ts";
import {
  SEEDS,
  HIT_VARIANTS,
  DEATH_PROMPTS,
  CORPSE_PROMPTS,
  WALK_SW,
  WALK_NW,
  ATTACK_SW,
  ATTACK_NW,
} from "./prompts.ts";
import {
  exists,
} from "./fs.ts";
import { isoPaths, rawPath, masterForDirection, mobOutputDir } from "./paths.ts";
import {
  runNativeImageJob,
  normalizeChroma,
  saveGeneratedBuffer,
  sourceAIPath,
  relativeLabel,
} from "./api.ts";
import { log, warn } from "./log.ts";
import {
  calculateImageDifference,
  differenceString,
  validateFrameDifferences,
  validationResultsString,
  contactMotionThresholds,
  walkPassingThresholds,
  normalMotionThresholds,
  type Validation,
} from "./difference.ts";
import { phaseSeed } from "./config.ts";
import { animationPrompt } from "./animation.ts";

export async function generateStill({
  prompt,
  seed,
  output,
  reference = null,
  strength = ISO_CONFIG.generation.masterStrength,
  appearanceReference = null,
  preserveBlood = false,
  force = false,
}: {
  prompt: string;
  seed: number;
  output: string;
  reference?: string | null;
  strength?: number;
  appearanceReference?: string | null;
  preserveBlood?: boolean;
  force?: boolean;
}): Promise<void> {
  const AI_CTX = { outputDir: mobOutputDir() };
  const cache = sourceAIPath(output, mobOutputDir());
  if (!force && (await exists(cache))) {
    const cleanInfo = await normalizeChroma(
      cache,
      output,
      { appearanceReference, preserveBlood },
      AI_CTX,
    );
    log(
      "CACHE",
      `${relativeLabel(output, mobOutputDir())} matte=${cleanInfo.mattePixels}${
        cleanInfo.color
          ? ` color=${cleanInfo.color.before.toFixed(1)}->${cleanInfo.color.target.toFixed(1)}`
          : ""
      }`,
    );
    return;
  }

  const buffer = await runNativeImageJob({ prompt, seed, reference, strength, output });
  const cleanInfo = await saveGeneratedBuffer(
    buffer,
    output,
    AI_CTX,
    { appearanceReference, preserveBlood },
  );
  log(
    "FRAME",
    `${relativeLabel(output, mobOutputDir())} matte=${cleanInfo.mattePixels}${
      cleanInfo.color
        ? ` color=${cleanInfo.color.before.toFixed(1)}->${cleanInfo.color.target.toFixed(1)}`
        : ""
    }`,
  );
}

export async function generateMotionFrame({
  reference,
  validations,
  posePrompt,
  direction,
  seed,
  output,
  strength = ISO_CONFIG.generation.motionStrength,
  preserveBlood = false,
  keepHead = true,
  retryWeakPose = true,
  force = false,
}: {
  reference: string;
  validations: Validation[];
  posePrompt: string;
  direction: string;
  seed: number;
  output: string;
  strength?: number;
  preserveBlood?: boolean;
  keepHead?: boolean;
  retryWeakPose?: boolean;
  force?: boolean;
}): Promise<void> {
  const textOnly = ISO_CONFIG.generation.textOnlyMotion;
  if (textOnly) reference = null;
  const AI_CTX = { outputDir: mobOutputDir() };
  const cache = sourceAIPath(output, mobOutputDir());
  const appearanceReference = masterForDirection(direction);

  if (!force && (await exists(cache))) {
    const cleanInfo = await normalizeChroma(
      cache,
      output,
      { appearanceReference, preserveBlood },
      AI_CTX,
    );
    const validation = await validateFrameDifferences(output, validations);
    log(
      "CACHE",
      `${relativeLabel(output, mobOutputDir())} ${validationResultsString(validation.results)}${
        cleanInfo.color
          ? ` color=${cleanInfo.color.before.toFixed(1)}->${cleanInfo.color.target.toFixed(1)}`
          : ""
      }`,
    );
    return;
  }

  for (let attempt = 0; attempt < ISO_CONFIG.motion.maxAttempts; attempt++) {
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
- change silhouette clearly at ${ISO_CONFIG.sprite.size}x${ISO_CONFIG.sprite.size}
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
      seed: seed + attempt * ISO_CONFIG.generation.retrySeedOffset,
      reference,
      strength,
      output,
    });
    const cleanInfo = await saveGeneratedBuffer(
      buffer,
      output,
      AI_CTX,
      { appearanceReference, preserveBlood },
    );
    const validation = await validateFrameDifferences(output, validations);
    log(
      "MOTION",
      `${relativeLabel(output, mobOutputDir())} ${validationResultsString(validation.results)} ${validation.pass ? "PASS" : "RETRY"}${
        cleanInfo.color
          ? ` color=${cleanInfo.color.before.toFixed(1)}->${cleanInfo.color.target.toFixed(1)}`
          : ""
      }`,
    );

    if (
      !validation.pass &&
      retryWeakPose &&
      ISO_CONFIG.motion.retryWeakPose &&
      attempt + 1 < ISO_CONFIG.motion.maxAttempts
    ) {
      warn("MOTION", `${relativeLabel(output, mobOutputDir())} stronger retry`);
      continue;
    }
    return;
  }
}

export async function generateWalkDirection(
  direction: string,
  master: string,
  baseSeed: number,
  poses: string[],
  force: boolean,
): Promise<void> {
  const frame0 = rawPath("walk", direction, 0);
  const frame1 = rawPath("walk", direction, 1);
  const frame2 = rawPath("walk", direction, 2);
  const frame3 = rawPath("walk", direction, 3);

  await generateMotionFrame({
    reference: master,
    validations: [
      { path: master, label: "vs-master", thresholds: contactMotionThresholds() },
    ],
    posePrompt: poses[0]!,
    direction,
    seed: phaseSeed(baseSeed, 0),
    output: frame0,
    force,
  });

  await generateMotionFrame({
    reference: master,
    validations: [
      { path: frame0, label: "vs-contact-a", thresholds: contactMotionThresholds() },
    ],
    posePrompt: poses[2]!,
    direction,
    seed: phaseSeed(baseSeed, 2),
    output: frame2,
    force,
  });

  await generateMotionFrame({
    reference: master,
    validations: [
      { path: frame0, label: "vs-contact-a", thresholds: walkPassingThresholds() },
      { path: frame2, label: "vs-contact-b", thresholds: walkPassingThresholds() },
    ],
    posePrompt: poses[1]!,
    direction,
    seed: phaseSeed(baseSeed, 1),
    output: frame1,
    force,
  });

  await generateMotionFrame({
    reference: master,
    validations: [
      { path: frame2, label: "vs-contact-b", thresholds: walkPassingThresholds() },
      { path: frame0, label: "vs-contact-a", thresholds: walkPassingThresholds() },
    ],
    posePrompt: poses[3]!,
    direction,
    seed: phaseSeed(baseSeed, 3),
    output: frame3,
    force,
  });

  const scores = {
    "0->1": await calculateImageDifference(frame0, frame1),
    "1->2": await calculateImageDifference(frame1, frame2),
    "2->3": await calculateImageDifference(frame2, frame3),
    "3->0": await calculateImageDifference(frame3, frame0),
    "0->2": await calculateImageDifference(frame0, frame2),
    "1->3": await calculateImageDifference(frame1, frame3),
  };
  log("WALK QA", `${direction}`);
  for (const [pair, score] of Object.entries(scores)) {
    log("WALK QA", `${direction} ${pair} ${differenceString(score)}`);
  }
}

export async function generateWalk(force: boolean): Promise<void> {
  const P = isoPaths();
  await generateWalkDirection(
    "southwest",
    P.masterFrontLeft,
    SEEDS.walkSouthwest!,
    WALK_SW,
    force,
  );
  await generateWalkDirection(
    "northwest",
    P.masterBackLeft,
    SEEDS.walkNorthwest!,
    WALK_NW,
    force,
  );
}

export async function generateSequentialAnimation({
  animation,
  direction,
  master,
  baseSeed,
  poses,
  strongFrames = [],
  preserveBlood = false,
  keepHead = true,
  force = false,
}: {
  animation: string;
  direction: string;
  master: string;
  baseSeed: number;
  poses: string[];
  strongFrames?: number[];
  preserveBlood?: boolean;
  keepHead?: boolean;
  force?: boolean;
}): Promise<void> {
  for (let frame = 0; frame < poses.length; frame++) {
    const output = rawPath(animation, direction, frame);
    await generateMotionFrame({
      reference: master,
      validations: [
        {
          path: master,
          label: "vs-master",
          thresholds: strongFrames.includes(frame)
            ? contactMotionThresholds()
            : normalMotionThresholds(),
        },
      ],
      posePrompt: poses[frame]!,
      direction,
      seed: phaseSeed(baseSeed, frame),
      output,
      preserveBlood,
      keepHead,
      retryWeakPose: frame < poses.length - 1,
      force,
    });
  }
}

export async function generateAttack(force: boolean): Promise<void> {
  const P = isoPaths();
  await generateSequentialAnimation({
    animation: "attack",
    direction: "southwest",
    master: P.masterFrontLeft,
    baseSeed: SEEDS.attackSouthwest!,
    poses: ATTACK_SW,
    strongFrames: [2, 3],
    force,
  });
  await generateSequentialAnimation({
    animation: "attack",
    direction: "northwest",
    master: P.masterBackLeft,
    baseSeed: SEEDS.attackNorthwest!,
    poses: ATTACK_NW,
    strongFrames: [2, 3],
    force,
  });
}

function hitPose(variant: number, frame: number): string {
  const poses = HIT_VARIANTS[variant % HIT_VARIANTS.length]!;
  return (
    poses[frame] ??
    `
DAMAGE RECOVERY FRAME ${frame}.

Return toward stance but retain visible stagger.
`.trim()
  );
}

export async function generateHitReactions(force: boolean): Promise<void> {
  for (let variant = 0; variant < ISO_CONFIG.animations.hitVariants; variant++) {
    for (const direction of ["southwest", "northwest"] as const) {
      const master = masterForDirection(direction);
      const baseSeed =
        (direction === "southwest" ? SEEDS.hitSouthwest! : SEEDS.hitNorthwest!) +
        variant * 1009;
      for (let frame = 0; frame < ISO_CONFIG.animations.hitFrames; frame++) {
        const output = rawPath("hit", direction, frame, variant);
        await generateMotionFrame({
          reference: master,
          validations: [
            {
              path: master,
              label: "vs-master",
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
          force,
        });
      }
    }
  }
}

function deathPose(frame: number): string {
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

export async function generateDeath(force: boolean): Promise<void> {
  for (const direction of ["southwest", "northwest"] as const) {
    const master = masterForDirection(direction);
    const baseSeed =
      direction === "southwest" ? SEEDS.deathSouthwest! : SEEDS.deathNorthwest!;
    for (let frame = 0; frame < ISO_CONFIG.animations.deathFrames; frame++) {
      const output = rawPath("death", direction, frame);
      await generateMotionFrame({
        reference: master,
        validations: [
          {
            path: master,
            label: "vs-master",
            thresholds:
              frame > 0 && frame < Math.min(4, ISO_CONFIG.animations.deathFrames)
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
        retryWeakPose: frame < ISO_CONFIG.animations.deathFrames - 1,
        force,
      });
    }
  }
}

export async function generateCorpses(force: boolean): Promise<void> {
  for (let variant = 0; variant < ISO_CONFIG.animations.corpseVariants; variant++) {
    for (const direction of ["southwest", "northwest"] as const) {
      const master = masterForDirection(direction);
      const output = rawPath("corpse", direction, 0, variant);
      const baseSeed =
        direction === "southwest"
          ? SEEDS.corpseSouthwest!
          : SEEDS.corpseNorthwest!;
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
        { bloodAllowed: true, keepHead: false },
      );

      await generateStill({
        prompt,
        seed: baseSeed + variant * 1009,
        output,
        reference: master,
        appearanceReference: master,
        preserveBlood: true,
        force,
      });
    }
  }
}
