import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ISO_CONFIG } from "./config.ts";
import { createChromaMask, CHROMA_RGB } from "./chroma.ts";
import { stabilizeAppearanceToReference } from "./appearance.ts";
import { exists, ensureDir } from "./fs.ts";
import { formatDuration, log, warn, metrics } from "./log.ts";

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function abortSignalAfter(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

export async function fetchJsonOnce(
  url: string,
  options: RequestInit = {},
  timeoutMs = 20_000,
): Promise<{ response: Response; json: unknown }> {
  const timeout = abortSignalAfter(timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: timeout.signal,
    });
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }
    return { response, json };
  } finally {
    timeout.cancel();
  }
}

export async function fetchJsonRetry(
  url: string,
  options: RequestInit = {},
  allowStatuses: number[] = [],
): Promise<{ response: Response; json: unknown }> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= ISO_CONFIG.network.requestAttempts; attempt++) {
    try {
      const { response, json } = await fetchJsonOnce(url, options);
      if (response.ok || allowStatuses.includes(response.status)) {
        return { response, json };
      }
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(json)}`);
      }
      lastError = new Error(`HTTP ${response.status}: ${JSON.stringify(json)}`);
    } catch (error) {
      lastError = error as Error;
      warn(
        "NET",
        `attempt ${attempt}/${ISO_CONFIG.network.requestAttempts}`,
        (error as Error).message,
      );
    }
    if (attempt < ISO_CONFIG.network.requestAttempts) {
      await sleep(Math.min(8000, 1000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError ?? new Error("Network request failed");
}

export async function checkServer(): Promise<void> {
  const { response, json } = await fetchJsonRetry(
    `${ISO_CONFIG.server}/sdcpp/v1/capabilities`,
    { method: "GET" },
  );
  if (!response.ok || !(json as { supported_modes?: string[] })?.supported_modes?.includes("img_gen")) {
    throw new Error("Server img_gen unavailable");
  }
  const features = (json as { features_by_mode?: { img_gen?: { ref_images?: boolean } } })?.features_by_mode;
  if (features?.img_gen?.ref_images === false) {
    throw new Error("Loaded model/server reports ref_images=false");
  }
  log("SERVER", `OK model=${(json as { model?: { name?: string } })?.model?.name ?? "unknown"}`);
}

async function fileToDataUrl(filePath: string): Promise<string> {
  const buffer = await sharp(filePath).removeAlpha().png().toBuffer();
  return "data:image/png;base64," + buffer.toString("base64");
}

export function makeNativeRequestBody({
  prompt,
  seed,
  refImages = [],
}: {
  prompt: string;
  seed: number;
  refImages?: string[];
}) {
  return {
    prompt,
    negative_prompt: "",
    width: ISO_CONFIG.generation.size,
    height: ISO_CONFIG.generation.size,
    seed,
    batch_count: 1,
    auto_resize_ref_image: true,
    increase_ref_index: false,
    ref_images: refImages,
    sample_params: {
      sample_method: ISO_CONFIG.generation.sampler,
      sample_steps: ISO_CONFIG.generation.steps,
      guidance: {
        txt_cfg: ISO_CONFIG.generation.cfg,
      },
    },
    output_format: "png",
    output_compression: 100,
  };
}

export async function runNativeImageJob({
  prompt,
  seed,
  reference = null,
  output,
}: {
  prompt: string;
  seed: number;
  reference?: string | null;
  output: string;
}): Promise<Buffer> {
  const refImages = reference ? [await fileToDataUrl(reference)] : [];
  const body = makeNativeRequestBody({ prompt, seed, refImages });

  const jobNumber = metrics.aiJobs + metrics.aiFailures + 1;
  const started = performance.now();

  const outLabel = path.basename(output);

  log(
    "AI",
    `#${String(jobNumber).padStart(3, "0")} START ${outLabel} seed=${seed} ref=${reference ? path.basename(reference) : "none"}`,
  );

  try {
    const { response, json } = await fetchJsonRetry(
      `${ISO_CONFIG.server}/sdcpp/v1/img_gen`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      [202],
    );

    if (response.status !== 202 || !(json as { id?: string })?.id) {
      throw new Error(`Native job submission failed: ${JSON.stringify(json)}`);
    }

    const jobId = (json as { id: string }).id;
    const pollUrl = (json as { poll_url?: string })?.poll_url
      ? ISO_CONFIG.server + (json as { poll_url: string }).poll_url
      : `${ISO_CONFIG.server}/sdcpp/v1/jobs/${jobId}`;

    const deadline = Date.now() + ISO_CONFIG.network.jobTimeoutMs;

    while (Date.now() < deadline) {
      const { response: pollResponse, json: pollJson } = await fetchJsonRetry(
        pollUrl,
        { method: "GET" },
        [404, 410],
      );

      if (pollResponse.status === 404 || pollResponse.status === 410) {
        throw new Error(`Native job ${jobId} disappeared from server`);
      }

      const status = (pollJson as { status?: string })?.status;
      if (status === "completed") {
        const base64 = (pollJson as { result?: { images?: Array<{ b64_json?: string }> } })?.result?.images?.[0]?.b64_json;
        if (!base64) throw new Error("Completed job contains no image");
        const elapsed = performance.now() - started;
        metrics.aiJobs++;
        metrics.aiMs += elapsed;
        log(
          "AI",
          `#${String(jobNumber).padStart(3, "0")} DONE  ${outLabel} ${formatDuration(elapsed)}`,
        );
        if (ISO_CONFIG.network.cooldownMs) {
          await sleep(ISO_CONFIG.network.cooldownMs);
        }
        return Buffer.from(base64, "base64");
      }

      if (status === "failed" || status === "cancelled") {
        throw new Error(
          `Generation ${status}: ${(pollJson as { error?: { message?: string } })?.error?.message ?? "no message"}`,
        );
      }

      await sleep(ISO_CONFIG.network.pollIntervalMs);
    }

    throw new Error("Generation job timeout");
  } catch (error) {
    metrics.aiFailures++;
    throw error;
  }
}

export function sourceAIPath(cleanPath: string, outputDir: string): string {
  return path.join(outputDir, "source-ai", path.relative(outputDir, cleanPath));
}

export function relativeLabel(file: string, outputDir: string): string {
  return path.relative(outputDir, file).replaceAll(path.sep, "/");
}

export async function normalizeChroma(
  sourcePath: string,
  outputPath: string,
  {
    appearanceReference = null,
    preserveBlood = false,
  }: { appearanceReference?: string | null; preserveBlood?: boolean } = {},
  ctx: { outputDir: string },
): Promise<{ mattePixels: number; color: { before: number; target: number } | null }> {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const rgba = Buffer.from(data);
  const mask = createChromaMask(rgba, info.width, info.height, info.channels);

  let replaced = 0;
  for (let pixel = 0; pixel < mask.length; pixel++) {
    if (!mask[pixel]) continue;
    const offset = pixel * info.channels;
    rgba[offset] = CHROMA_RGB.r;
    rgba[offset + 1] = CHROMA_RGB.g;
    rgba[offset + 2] = CHROMA_RGB.b;
    rgba[offset + 3] = 255;
    replaced++;
  }

  await ensureDir(path.dirname(outputPath));
  await sharp(rgba, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toFile(outputPath);

  const color = await stabilizeAppearanceToReference(
    outputPath,
    appearanceReference,
    preserveBlood,
  );

  return {
    mattePixels: replaced,
    color: color
      ? { before: color.before, target: color.target }
      : null,
  };
}

export async function saveGeneratedBuffer(
  buffer: Buffer,
  output: string,
  ctx: { outputDir: string },
  {
    appearanceReference = null,
    preserveBlood = false,
  }: { appearanceReference?: string | null; preserveBlood?: boolean } = {},
): Promise<{ mattePixels: number; color: { before: number; target: number } | null }> {
  const cache = sourceAIPath(output, ctx.outputDir);
  await ensureDir(path.dirname(cache));
  await fs.writeFile(cache, buffer);
  return normalizeChroma(
    cache,
    output,
    { appearanceReference, preserveBlood },
    ctx,
  );
}
