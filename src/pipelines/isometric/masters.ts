import path from "node:path";
import { ISO_CONFIG } from "./config.ts";
import {
  MASTER_FRONT_LEFT_PROMPT,
  MASTER_BACK_LEFT_PROMPT,
  SEEDS,
} from "./prompts.ts";
import {
  exists,
  ensureDir,
} from "./fs.ts";
import { isoPaths, masterForDirection } from "./paths.ts";
import {
  runNativeImageJob,
  normalizeChroma,
  saveGeneratedBuffer,
  sourceAIPath,
  relativeLabel,
} from "./api.ts";
import { log, warn } from "./log.ts";
import {
  validateMasterEarQA,
  earAnalysisString,
} from "./validation.ts";
import {
  calculateImageDifference,
  differenceString,
  backMasterTooSimilar,
} from "./difference.ts";

const P = isoPaths();
const AI_CTX = { outputDir: ISO_CONFIG.outputDir };

function backMasterRetryPrompt(attempt: number, useReference: boolean): string {
  if (attempt === 0) return MASTER_BACK_LEFT_PROMPT;
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

export async function generateFrontMaster(force: boolean): Promise<void> {
  const cache = sourceAIPath(P.masterFrontLeft, ISO_CONFIG.outputDir);
  if (!force && (await exists(cache))) {
    await normalizeChroma(cache, P.masterFrontLeft, {}, AI_CTX);
    const earQA = await validateMasterEarQA(P.masterFrontLeft);
    log(
      "MASTER QA",
      `front cached ears ${earAnalysisString(earQA.analysis)} ${earQA.pass ? "PASS" : "REJECT"}`,
    );
    if (earQA.pass) return;
  }

  for (let attempt = 0; attempt < ISO_CONFIG.master.maxAttempts; attempt++) {
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
      seed: SEEDS.masterFrontLeft! + attempt * ISO_CONFIG.generation.retrySeedOffset,
      reference: null,
      output: P.masterFrontLeft,
    });
    await saveGeneratedBuffer(buffer, P.masterFrontLeft, AI_CTX, {});

    const earQA = await validateMasterEarQA(P.masterFrontLeft);
    log(
      "MASTER QA",
      `front attempt=${attempt + 1}/${ISO_CONFIG.master.maxAttempts} ears ${earAnalysisString(earQA.analysis)} ${earQA.pass ? "PASS" : "REJECT"}`,
    );

    if (earQA.pass) return;
    if (attempt + 1 < ISO_CONFIG.master.maxAttempts) {
      warn("MASTER QA", "front master ear QA failed; regenerating");
    }
  }
  throw new Error("Could not generate valid front master without extra ears.");
}

export async function generateBackMaster(force: boolean): Promise<void> {
  const cache = sourceAIPath(P.masterBackLeft, ISO_CONFIG.outputDir);
  if (!force && (await exists(cache))) {
    await normalizeChroma(
      cache,
      P.masterBackLeft,
      { appearanceReference: P.masterFrontLeft },
      AI_CTX,
    );
    const perspective = await calculateImageDifference(
      P.masterFrontLeft,
      P.masterBackLeft,
    );
    const earQA = await validateMasterEarQA(P.masterBackLeft);
    const perspectiveFail = backMasterTooSimilar(perspective);
    log(
      "MASTER QA",
      `back cached perspective ${differenceString(perspective)} ${perspectiveFail ? "REJECT" : "PASS"} | ears ${earAnalysisString(earQA.analysis)} ${earQA.pass ? "PASS" : "REJECT"}`,
    );
    if (!perspectiveFail && earQA.pass) return;
  }

  for (let attempt = 0; attempt < ISO_CONFIG.master.maxAttempts; attempt++) {
    const useReference = attempt < ISO_CONFIG.master.referenceAttempts;
    const reference = useReference ? P.masterFrontLeft : null;
    const prompt = backMasterRetryPrompt(attempt, useReference);

    const buffer = await runNativeImageJob({
      prompt,
      seed: SEEDS.masterBackLeft! + attempt * ISO_CONFIG.generation.retrySeedOffset,
      reference,
      output: P.masterBackLeft,
    });
    await saveGeneratedBuffer(
      buffer,
      P.masterBackLeft,
      AI_CTX,
      { appearanceReference: P.masterFrontLeft },
    );

    const perspective = await calculateImageDifference(
      P.masterFrontLeft,
      P.masterBackLeft,
    );
    const earQA = await validateMasterEarQA(P.masterBackLeft);
    const perspectiveFail = backMasterTooSimilar(perspective);
    const earFail = !earQA.pass;
    log(
      "MASTER QA",
      `back attempt=${attempt + 1}/${ISO_CONFIG.master.maxAttempts} ref=${reference ? "front-master" : "none"} perspective ${differenceString(perspective)} ${perspectiveFail ? "REJECT" : "PASS"} | ears ${earAnalysisString(earQA.analysis)} ${earFail ? "REJECT" : "PASS"}`,
    );

    if (!perspectiveFail && !earFail) return;

    if (attempt + 1 < ISO_CONFIG.master.maxAttempts) {
      const reasons: string[] = [];
      if (perspectiveFail) reasons.push("perspective");
      if (earFail) reasons.push("ears");
      const nextAttempt = attempt + 1;
      const nextUsesReference = nextAttempt < ISO_CONFIG.master.referenceAttempts;
      warn(
        "MASTER QA",
        `back master retry: ${reasons.join("+")}; next ref=${nextUsesReference ? "front-master" : "none"}`,
      );
    }
  }
  throw new Error(
    "Could not generate valid northwest master: perspective/ear QA failed.",
  );
}

export async function generateMasters(force: boolean): Promise<void> {
  await generateFrontMaster(force);
  await generateBackMaster(force);
}

export async function ensureMasters(): Promise<void> {
  if (
    (await exists(P.masterFrontLeft)) &&
    (await exists(P.masterBackLeft))
  ) {
    return;
  }
  await generateMasters(false);
}
