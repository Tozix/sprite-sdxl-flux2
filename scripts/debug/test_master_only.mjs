import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Use full MASTER_FRONT_LEFT_PROMPT (from spider.json) — long character description
const masterPrompt = await readFile("templates/isometric/mobs/spider.json", "utf8");
const masterObj = JSON.parse(masterPrompt);
const charPrompt = masterObj.MASTER_FRONT_LEFT_PROMPT;

// WALK CONTACT A prompt
const walkPose = `
WALK CONTACT A — STRONG READABLE STRIDE.

EIGHT LEGS — DIAGONAL TRIPOD:

Near-side FRONT leg (closest to viewer):
- extend clearly toward SCREEN LOWER-LEFT
- claw projects well past the head
- leg fully extended, planted firmly

Far-side FRONT leg (opposite diagonal):
- pull backward beneath the cephalothorax
- joint bent

Near-side MIDDLE leg:
- extend forward and outward
- claw well past the body edge

Far-side MIDDLE leg:
- extend backward toward SCREEN UPPER-RIGHT
- claw well past the body edge

Near-side REAR leg:
- step forward
- visible bend

Far-side REAR leg:
- extend backward toward SCREEN UPPER-RIGHT
- claw well past the body edge

Two additional middle legs:
- one extended forward, one backward
- diagonal tripod gait

BODY:
- cephalothorax shifts forward slightly
- abdomen counter-shifts
- weight on planted legs

MOVE THE LEGS — DO NOT just move eyes, body texture, or facial details.
The eight legs must be in clearly DIFFERENT positions.
`.trim();

const fullPrompt = charPrompt + "\n\nPOSE:\n\n" + walkPose;

const body = {
  prompt: fullPrompt,
  negative_prompt: "",
  width: 384,
  height: 384,
  seed: 1000,
  batch_count: 1,
  auto_resize_ref_image: true,
  increase_ref_index: false,
  ref_images: [],  // NO REFERENCE
  sample_params: {
    sample_method: "euler",
    sample_steps: 4,
    guidance: { txt_cfg: 1.0 },
  },
  output_format: "png",
  output_compression: 100,
};

console.log(`Prompt length: ${fullPrompt.length} chars`);

const resp = await fetch("http://192.168.0.16:7861/sdcpp/v1/img_gen", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const j = await resp.json();
const jobId = j.id;
const pollUrl = "http://192.168.0.16:7861" + (j.poll_url || `/sdcpp/v1/jobs/${jobId}`);

for (let i = 0; i < 90; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const p = await fetch(pollUrl);
  const ps = await p.json();
  if (ps.status === "completed") {
    const b64 = ps.result.images[0].b64_json;
    await writeFile("/tmp/test_master_only.png", Buffer.from(b64, "base64"));
    console.log("saved /tmp/test_master_only.png");
    break;
  }
  if (ps.status === "failed") { console.log("failed", ps.error); break; }
}
