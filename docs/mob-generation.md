# Mob Generation System

This document describes how the pipeline generates game-ready isometric creature (mob)
sprites from AI source artwork, end to end. It is the authoritative reference for the
current implementation.

---

## 1. Overview

The system takes a **mob template** (a JSON description of a creature) and produces a
complete set of pixel-art animation sprites and spritesheets, ready for a 2D isometric
MMORPG engine (Phaser 4).

The flow is:

```text
mob template (base + mob JSON)
        ↓
CLI (bun run src/cli.ts isometric ... --mob <name>)
        ↓
master images (front-left + back-left)  ← AI generation + QA
        ↓
animation frames (walk/attack/hit/death/corpse)  ← AI generation + QA
        ↓
chroma cleanup + appearance stabilization
        ↓
pixel-art reduction + shared palette
        ↓
mirrored directions + spritesheets + manifest
        ↓
game asset
```

Everything runs on the Mac (orchestration). AI inference happens on a remote
Windows GPU server running `stable-diffusion.cpp`.

---

## 2. How to run

```bash
bun run src/cli.ts isometric base <mode> --mob <name> [--force]
```

| Part | Meaning |
|------|---------|
| `isometric` | the isometric pipeline |
| `base` | the shared base template name (resolved to `templates/isometric/base.json`) |
| `<mode>` | which stage(s) to run (see below) |
| `--mob <name>` | which mob to generate (e.g. `rat`, `spider`, `slime`) |
| `--force` | ignore cached AI results and regenerate |

Available mobs: `rat`, `spider`, `slime` (files in `templates/isometric/mobs/`).

### Modes

| Mode | Generates |
|------|-----------|
| `masters` | front-left + back-left master images, idle sprites, idle sheet |
| `walk` | 4-frame walk cycle |
| `attack` | 6-frame attack |
| `hit` | hit reactions (variants × frames) |
| `death` | death animation |
| `corpses` | corpse variants |
| `combat` | attack + hit + death + corpses |
| `all` | everything (masters → walk → attack → hit → death → corpses → pixelize → sheets) |
| `pixelize` | re-run pixel-art conversion only (no AI) |
| `sheet` | re-build sheets + manifest only (no AI) |

Example — generate the whole spider set:

```bash
bun run src/cli.ts isometric base all --mob spider
```

---

## 3. Templates: base + mob

The prompt system is split into two layers.

### 3.1 Base template (`templates/isometric/base.json`)

Holds the **shared, species-agnostic** blocks. These are the same for every mob:

- `ISOMETRIC_CAMERA` — fixed three-quarter isometric camera, orthographic dimetric,
  2-to-1 projection, no perspective.
- `CHROMA_BACKGROUND` — uniform chroma-key matte, no floor/shadow/debris.
- `NO_SYMBOLS` — forbid arrows, labels, text, UI, motion lines.
- `ART_STYLE` — grim dark-fantasy 2D game asset, strong outlines, flat colors,
  sized for later pixel reduction.
- `IDENTITY_LOCK` — reference is the canonical appearance (species, proportions,
  palette, line-art) but NOT a pose template.
- `COLOR_LOCK_PROMPT` — reference is the color authority; keep material color stable.

None of these mention a specific creature.

### 3.2 Mob template (`templates/isometric/mobs/<name>.json`)

Holds the **species-specific** blocks:

- `MOB_NAME` — lowercase creature name, e.g. `"spider"`. Used to inject the creature
  name into orientation and motion phrases at runtime.
- `MOB_STYLE` — full CHARACTER block: body, colors, head, distinctive parts, mood.
- `MOB_ANATOMY` — anatomy hard requirements (limb count, forbidden duplicates, etc.).
- `MASTER_FRONT_LEFT_PROMPT` / `MASTER_BACK_LEFT_PROMPT` — full assembled master prompts.
- `WALK_SW` — 4 walk frames (Contact A / Passing A / Contact B / Passing B).
- `ATTACK_SW` — 6 attack frames.
- `HIT_VARIANTS` — `[variant][frame]` damage reactions.
- `DEATH_PROMPTS` — death frames.
- `CORPSE_PROMPTS` — corpse variants.

### 3.3 Merging

`src/cli.ts` loads `base.json`, then (for isometric + `--mob`) loads
`templates/isometric/mobs/<name>.json` and shallow-merges it **on top** of base
(mob keys win). The merged template is passed to `runIsometric`, which calls
`applyTemplateConfig` to mutate the module-level prompt constants.

### 3.4 NW derivation

The mob template only defines the **southwest (SW)** frames. The **northwest (NW)**
frames are derived in code by string replacement:

- `WALK_NW` = `WALK_SW` with `SCREEN LOWER-LEFT → SCREEN UPPER-LEFT` and
  `SCREEN UPPER-RIGHT → SCREEN LOWER-RIGHT`.
- `ATTACK_NW` = `ATTACK_SW` with `SCREEN LOWER-LEFT → SCREEN UPPER-LEFT`.

This keeps the template DRY: define one facing, get the opposite facing for free.

---

## 4. Directions and output layout

### 4.1 Direction model

There are **4 directions** but only **2 are AI-generated** (the "canonical" ones):

| Direction | Source |
|-----------|--------|
| `southwest` (SW) | AI — front-left master |
| `northwest` (NW) | AI — back-left master |
| `southeast` (SE) | mirror of SW |
| `northeast` (NE) | mirror of NW |

The mirrored directions are produced by horizontally flipping (`sharp.flop()`) the
canonical sprite. This halves the number of AI jobs.

### 4.2 Output directory

Output is scoped per mob:

```text
output/isometric/<mob>/
├── source-ai/          # raw AI PNGs (the cache; never re-requested unless --force)
│   ├── masters/
│   └── raw/<animation>/<direction>/...
├── masters/
│   ├── master-front-left.png
│   └── master-back-left.png
├── raw/                # chroma-cleaned, appearance-stabilized full-res frames
│   ├── walk/<direction>/<frame>.png
│   ├── attack/...
│   ├── hit/variant-<v>/<direction>/<frame>.png
│   ├── death/...
│   └── corpse/variant-<v>/<direction>/<frame>.png
├── sprites/            # pixel-art sprites (96×96)
│   ├── idle/<direction>/0.png
│   ├── walk/<direction>/<frame>.png
│   └── ... (mirrors included)
├── sheets/             # spritesheets + manifest
│   ├── idle-sheet.png
│   ├── walk-sheet.png
│   ├── attack-sheet.png
│   ├── hit-<v>-sheet.png
│   ├── death-sheet.png
│   ├── corpse-<v>-sheet.png
│   ├── spritesheet.png
│   └── spritesheet.json
└── palette.json        # the shared global palette
```

The mob name comes from `MOB_NAME`, which is set by `applyTemplateConfig` from the
mob template **before** any path is computed, so each mob gets its own folder.

---

## 5. The full algorithm

### Stage 0 — Setup

1. `src/cli.ts` parses args, resolves `templates/isometric/base.json`, loads the mob
   template, merges them.
2. `runIsometric` calls `applyTemplateConfig(template)` — this mutates the module-level
   `let` constants (prompts, directions, seeds, mob name/style/anatomy).
3. `prepareDirectories()` creates the whole per-mob folder tree.
4. `checkServer()` verifies the AI server (`/sdcpp/v1/capabilities`) supports `img_gen`
   and reference images.

### Stage 1 — Masters

`generateMasters()` produces the two canonical reference images that anchor identity.

**Front-left master** (`generateFrontMaster`):
- Prompt: `MASTER_FRONT_LEFT_PROMPT` (from mob template).
- Seed: `SEEDS.masterFrontLeft` + attempt × retry offset.
- QA: **ear QA** — counts pink "ear-like" components in the upper region; must be
  ≤ `maxEarComponents` (2). On failure, retries with a corrective ear-fix prompt.
- Cached: if `source-ai/masters/master-front-left.png` exists and passes QA, reuse it.

**Back-left master** (`generateBackMaster`):
- Prompt: `MASTER_BACK_LEFT_PROMPT`.
- Reference: the front master (first `referenceAttempts` attempts), then no reference.
- QA: **perspective QA** (`backMasterTooSimilar`) — the back must differ enough from
  the front — plus **ear QA**. On failure, retries with a corrective prompt.

Both masters are then chroma-cleaned and appearance-stabilized.

### Stage 2 — Animation frames

Each animation is generated **sequentially** (frame N references frame N−1, or the
master for the first frame) so identity stays consistent. The server is weak, so jobs
run one at a time (no parallelism — deliberate).

Every motion frame goes through `generateMotionFrame`:

1. If cached and `!force`, reuse (chroma-clean + validate).
2. Else build the prompt via `animationPrompt(pose, direction)`:
   `IDENTITY_LOCK + COLOR_LOCK + MOB_ANATOMY + ISOMETRIC_CAMERA + orientation + keepHead + POSE + "<MOB> BODY must move" + MOB_ANATOMY + blood-rule + ART_STYLE + NO_SYMBOLS + CHROMA_BACKGROUND`.
3. Submit an AI job with the previous frame as reference.
4. **Motion QA** (`validateFrameDifferences`): compare against the reference frame
   using `calculateImageDifference`; require mean / changed-fraction / silhouette
   thresholds to be met. If too weak, retry with a "move limbs much farther" prompt.

#### Walk

`generateWalkDirection` produces 4 frames with **pairwise** validation:
- Frame 0 (Contact A) vs master — contact thresholds.
- Frame 2 (Contact B) vs master — contact thresholds.
- Frame 1 (Passing A) vs frames 0 and 2 — walk-passing thresholds.
- Frame 3 (Passing B) vs frames 2 and 0 — walk-passing thresholds.

Then a final `WALK QA` log prints all pairwise differences.

#### Attack / Hit / Death / Corpse

- **Attack**: sequential 6 frames; frames 2–3 (lunge/impact) use stronger contact
  thresholds.
- **Hit**: for each variant, 3 frames (impact → peak → recovery); first 2 use contact
  thresholds, last uses normal.
- **Death**: 5 frames; middle frames use contact thresholds; blood allowed, head may
  move.
- **Corpse**: 1 frame per variant, generated from the master with blood allowed.

### Stage 3 — Chroma cleanup + appearance

Every generated image is post-processed:

- **`createChromaMask`** — flood-fill from the borders to find the chroma-key matte
  (HSV-based), then a spill pass to catch edge bleed.
- **`normalizeChroma`** — replace matte pixels with the exact chroma color (so the
  key is uniform).
- **`stabilizeAppearanceToReference`** — match the candidate's mean/std RGB to the
  master's (per channel), so color stays consistent across frames. Blood pixels are
  excluded when `preserveBlood` is set.

### Stage 4 — Pixel-art conversion

`pixelizeSelection` turns the cleaned full-res frames into 96×96 pixel art:

1. **`rasterize`** — transparentize (chroma → alpha), resize to 96×96 (lanczos3),
   harden alpha, apply a per-animation vertical bob offset.
2. **`buildGlobalPalette`** — build ONE shared palette (default 28 colors) across all
   selected frames: frequency-weighted farthest-point initialization + k-means.
3. **`applyPalette`** — snap every pixel to its nearest palette color.
4. **`writeSprite`** — write the sprite + a nearest-neighbor preview.
5. **`mirrorSprite`** — flip to produce the SE/NE mirrored directions.

The palette is saved to `palette.json` (with hex values) for the game.

### Stage 5 — Sheets + manifest

`buildSheets` packs the sprites into spritesheets:
- Per-animation sheets (`walk-sheet.png`, `attack-sheet.png`, `hit-<v>-sheet.png`, …).
- A combined `spritesheet.png`.
- `spritesheet.json` — the manifest (`schemaVersion: 8`, `projection: isometric-2to1`,
  `engineTarget: Phaser 4`). It records per-animation frame rects, fps, loop flags,
  events (attack `hit`, death `dead`, hit `damage-reaction-start`, corpse `corpse`),
  direction order, canonical/mirror mapping, and anatomy/damage policies.

---

## 6. Key config (`.env` / defaults)

All knobs are environment variables with defaults in `src/pipelines/isometric/config.ts`.
The most important:

| Variable | Default | Purpose |
|----------|---------|---------|
| `IRON_ARCANA_AI_SERVER` | `http://192.168.0.16:7861` | AI server |
| `IRON_ARCANA_GENERATION_SIZE` | `384` | AI output size |
| `IRON_ARCANA_GENERATION_STEPS` | `4` | diffusion steps |
| `IRON_ARCANA_SAMPLER` | `euler` | sampler |
| `IRON_ARCANA_CFG` | `1.0` | guidance |
| `IRON_ARCANA_SPRITE_SIZE` | `96` | final pixel-art size |
| `IRON_ARCANA_PALETTE_SIZE` | `28` | global palette colors |
| `IRON_ARCANA_MASTER_MAX_ATTEMPTS` | `3` | master retries |
| `IRON_ARCANA_MASTER_EAR_QA` | `true` | ear-count QA on masters |
| `IRON_ARCANA_MOTION_MAX_ATTEMPTS` | `2` | motion frame retries |
| `IRON_ARCANA_RETRY_WEAK_POSE` | `true` | retry weak motion |
| `IRON_ARCANA_CHROMA_COLOR` | `#00FF00` | chroma key color |
| `IRON_ARCANA_HIT_VARIANTS` | `2` | hit variants |
| `IRON_ARCANA_HIT_FRAMES` | `3` | hit frames |
| `IRON_ARCANA_DEATH_FRAMES` | `5` | death frames |
| `IRON_ARCANA_CORPSE_VARIANTS` | `3` | corpse variants |
| `IRON_ARCANA_POLL_INTERVAL_MS` | `750` | job poll interval |
| `IRON_ARCANA_GENERATION_COOLDOWN_MS` | `150` | pause between jobs |
| `IRON_ARCANA_JOB_TIMEOUT_MS` | `15m` | max job wait |

---

## 7. Adding a new mob

To add a new creature (e.g. `wolf`):

1. Create `templates/isometric/mobs/wolf.json`.
2. Set `MOB_NAME: "wolf"`.
3. Write `MOB_STYLE` (character) and `MOB_ANATOMY` (limb/anatomy rules).
4. Write `MASTER_FRONT_LEFT_PROMPT` and `MASTER_BACK_LEFT_PROMPT`.
5. Write `WALK_SW` (4 frames), `ATTACK_SW` (6 frames), `HIT_VARIANTS`,
   `DEATH_PROMPTS`, `CORPSE_PROMPTS` (SW-facing only — NW is derived).
6. Run: `bun run src/cli.ts isometric base all --mob wolf`.

The base template and all code stay unchanged — the mob template is the only new file.

---

## 8. Module map

| File | Responsibility |
|------|----------------|
| `src/cli.ts` | arg parsing, template resolution, base+mob merge, dispatch |
| `src/templates.ts` | template loading + type guards |
| `isometric/config.ts` | `ISO_CONFIG` (env-driven) + seed/phase helpers |
| `isometric/prompts.ts` | prompt constants + `applyTemplateConfig` |
| `isometric/animation.ts` | `orientationPrompt` / `animationPrompt` composition |
| `isometric/masters.ts` | master generation + QA |
| `isometric/animations.ts` | walk/attack/hit/death/corpse generation |
| `isometric/api.ts` | sdcpp native job submit/poll, chroma normalize, save |
| `isometric/chroma.ts` | chroma mask, HSV, blood/pink detection |
| `isometric/appearance.ts` | appearance stabilization to reference |
| `isometric/difference.ts` | frame-difference scoring + thresholds |
| `isometric/validation.ts` | connected components, ear QA |
| `isometric/pixelize.ts` | rasterize, palette, sprite writing, mirroring |
| `isometric/sheets.ts` | spritesheets + manifest |
| `isometric/paths.ts` | per-mob output paths |
| `isometric/log.ts` | logging + timing summary |
| `isometric/fs.ts` | fs helpers |

The older **sprite** pipeline (`src/pipelines/sprite/`) is a simpler, non-isometric
variant (side/up views only) and is not covered here.
