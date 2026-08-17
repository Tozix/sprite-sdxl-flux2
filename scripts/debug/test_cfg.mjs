import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const masterPath = "output/isometric/spider/masters/master-front-left.png";
const masterBuf = await sharp(masterPath).png().toBuffer();
const masterB64 = masterBuf.toString("base64");

const spiderPrompt = `Isometric front-left 3/4 view of an eight-legged dark charcoal spider, clean black outline, single red eye visible on the front leg, no tail, no wings, body and legs fully connected, sharp pixel-art look, full body visible, four legs on each side, green chroma background.`;

const walkPose = `WALK CONTACT A — STRONG READABLE STRIDE.
Near-side FRONT leg: extend clearly toward SCREEN LOWER-LEFT
Far-side FRONT leg: pull backward beneath the chest
Near-side HIND leg: move forward, bend visibly
Far-side HIND leg: extend clearly backward toward SCREEN UPPER-RIGHT
This limb arrangement must remain obvious after 160x160 reduction.`;

const fullPrompt = spiderPrompt + "\n\n" + walkPose;

for (const cfg of [1.0, 3.0, 5.0, 7.0]) {
  console.log(`\nTesting cfg=${cfg}...`);
  const body = {
    prompt: fullPrompt,
    negative_prompt: "",
    width: 384,
    height: 384,
    seed: 1000,
    batch_count: 1,
    auto_resize_ref_image: true,
    increase_ref_index: false,
    ref_images: [`data:image/png;base64,${masterB64}`],
    denoising_strength: 0.7,
    sample_params: {
      sample_method: "euler",
      sample_steps: 4,
      guidance: { txt_cfg: cfg },
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

  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const p = await fetch(pollUrl);
    const ps = await p.json();
    if (ps.status === "completed") {
      const b64 = ps.result.images[0].b64_json;
      await writeFile(`/tmp/test_cfg_${cfg}.png`, Buffer.from(b64, "base64"));
      console.log(`  cfg=${cfg}: saved`);
      break;
    }
    if (ps.status === "failed") { console.log(`  cfg=${cfg}: failed`, ps.error); break; }
  }
}
