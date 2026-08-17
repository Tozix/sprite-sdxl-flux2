import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const masterPath = "output/isometric/spider/masters/master-front-left.png";
const masterBuf = await sharp(masterPath).png().toBuffer();
const masterB64 = masterBuf.toString("base64");

const spiderPrompt = `Isometric front-left 3/4 view of an eight-legged dark charcoal spider, clean black outline, single red eye visible on the front leg, no tail, no wings, body and legs fully connected, sharp pixel-art look, full body visible, four legs on each side, green chroma background.`;

const walkPose = `WALK PASSING A — STRONG MID-SWING FRAME.
THIS MUST NOT LOOK LIKE CONTACT A.
Near-side FRONT leg:
- lift the ENTIRE claw clearly OFF the ground
- create a visible chroma-green gap beneath the leg
- bend joint
Far-side FRONT leg:
- swing the ENTIRE leg clearly forward toward SCREEN LOWER-LEFT
- extend joint
- claw approaches next contact
Near-side MIDDLE leg:
- lift and pass beneath abdomen
Far-side MIDDLE leg:
- recover forward beneath the body
Near-side REAR leg:
- lift and pass beneath abdomen
Far-side REAR leg:
- recover forward
BODY:
- body rises clearly above contact pose
- abdomen rises
CRITICAL 96x96 READABILITY:
The lifted leg MUST remain visibly separated from the ground after reduction.
Move the WHOLE limb.`;

const fullPrompt = spiderPrompt + "\n\n" + walkPose;

for (const steps of [4, 8, 12, 20]) {
  console.log(`\nTesting steps=${steps}...`);
  const body = {
    prompt: fullPrompt,
    negative_prompt: "",
    width: 384,
    height: 384,
    seed: 1037,
    batch_count: 1,
    auto_resize_ref_image: true,
    increase_ref_index: false,
    ref_images: [`data:image/png;base64,${masterB64}`],
    denoising_strength: 0.7,
    sample_params: {
      sample_method: "euler",
      sample_steps: steps,
      guidance: { txt_cfg: 1.0 },
    },
    output_format: "png",
    output_compression: 100,
  };
  const resp = await fetch("http://192.168.0.16:7861/sdcpp/v1/img_gen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await resp.json();
  const jobId = j.id;
  const pollUrl = "http://192.168.0.16:7861" + (j.poll_url || `/sdcpp/v1/jobs/${jobId}`);

  for (let i = 0; i < 180; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const p = await fetch(pollUrl);
    const ps = await p.json();
    if (ps.status === "completed") {
      const b64 = ps.result.images[0].b64_json;
      await writeFile(`/tmp/test_steps_${steps}.png`, Buffer.from(b64, "base64"));
      console.log(`  steps=${steps}: saved`);
      break;
    }
    if (ps.status === "failed") { console.log(`  steps=${steps}: failed`, ps.error); break; }
  }
}
