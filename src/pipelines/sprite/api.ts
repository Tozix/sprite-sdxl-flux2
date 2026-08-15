import fs from "node:fs/promises";
import path from "node:path";
import { SPRITE_CONFIG } from "./config.ts";
import { buildPrompt } from "./animation.ts";

export type ServerScore = {
  ok: boolean;
  reason?: string;
};

export async function checkServer(): Promise<void> {
  console.log("Checking FLUX server...");

  const response = await fetch(`${SPRITE_CONFIG.server}/v1/models`);

  if (!response.ok) {
    throw new Error(`FLUX server unavailable: ${response.status}`);
  }

  console.log("FLUX server OK");
}

function extraPrompt(prompt: string, seed: number): string {
  const args = {
    seed,
    sample_params: {
      sample_steps: SPRITE_CONFIG.steps,
      sample_method: SPRITE_CONFIG.sampler,
      guidance: {
        txt_cfg: SPRITE_CONFIG.cfg,
      },
    },
  };

  return prompt + `\n<sd_cpp_extra_args>${JSON.stringify(args)}</sd_cpp_extra_args>`;
}

async function saveApiImage(
  response: Response,
  output: string,
): Promise<void> {
  const text = await response.text();

  if (!response.ok) {
    console.error(text);
    throw new Error(`API failed: HTTP ${response.status}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    console.error(text);
    throw new Error("Server returned invalid JSON");
  }

  const base64 =
    json && typeof json === "object" && "data" in json
      ? (json as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json
      : undefined;

  if (!base64) {
    console.error(JSON.stringify(json, null, 2));
    throw new Error("No image returned by server");
  }

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, Buffer.from(base64, "base64"));
}

export async function requestGenerate(args: {
  prompt: string;
  seed: number;
  output: string;
}): Promise<void> {
  const response = await fetch(
    `${SPRITE_CONFIG.server}/v1/images/generations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: extraPrompt(buildPrompt(args.prompt), args.seed),
        size: SPRITE_CONFIG.generationSize,
        n: 1,
        output_format: "png",
      }),
    },
  );

  await saveApiImage(response, args.output);
}

export async function requestEdit(args: {
  reference: string;
  prompt: string;
  seed: number;
  output: string;
}): Promise<void> {
  const buffer = await fs.readFile(args.reference);
  const form = new FormData();

  form.append(
    "image[]",
    new Blob([buffer], { type: "image/png" }),
    path.basename(args.reference),
  );

  form.append("prompt", extraPrompt(args.prompt, args.seed));
  form.append("size", SPRITE_CONFIG.generationSize);
  form.append("n", "1");
  form.append("output_format", "png");

  const response = await fetch(
    `${SPRITE_CONFIG.server}/v1/images/edits`,
    {
      method: "POST",
      body: form,
    },
  );

  await saveApiImage(response, args.output);
}

export async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}
