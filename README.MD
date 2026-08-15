# Iron Arcana — Local AI Asset Generation Pipeline

> Technical specification for AI agents generating visual assets for the **Iron Arcana MMORPG**.

---

# 1. Purpose

This repository contains the local AI-assisted pipeline used to create 2D visual assets for Iron Arcana.

The system is intended to eventually generate and process most visual game content, including:

* mobs;
* bosses;
* NPCs;
* player characters;
* hairstyles;
* faces and character appearance variants;
* armor;
* clothes;
* helmets;
* boots;
* gloves;
* shields;
* weapons;
* bows;
* staffs;
* projectiles;
* spells;
* explosions;
* hit effects;
* environmental effects;
* props;
* buildings;
* vegetation;
* terrain tiles;
* wall tiles;
* cliffs;
* water;
* animated water;
* lava;
* animated environmental tiles;
* resource nodes;
* chests;
* doors;
* interactable objects;
* icons;
* inventory items;
* other 2D MMORPG assets.

The AI generator is **not expected to produce a final production-ready sprite directly**.

The normal workflow is:

```text
AI source artwork
        ↓
identity / view generation
        ↓
animation keyframes
        ↓
background cleanup
        ↓
normalization
        ↓
pixel-art conversion
        ↓
shared palette
        ↓
spritesheet / tileset packing
        ↓
metadata / manifest
        ↓
game asset
```

---

# 2. Infrastructure

## 2.1 Mac — orchestration machine

The Mac is the primary development and automation machine.

Responsibilities:

* Node.js scripts;
* asset specifications;
* prompts;
* API calls;
* receiving generated images;
* post-processing;
* pixel-art conversion;
* validation;
* sheet creation;
* manifest creation;
* integration into the game repository.

The Mac does **not** need to perform AI inference.

Generated results should normally be saved on the Mac.

---

## 2.2 Windows — AI inference machine

Current Windows host:

```text
OS: Windows 10
RAM: 32 GB
GPU: AMD Radeon RX 6600 XT
VRAM: 8 GB
```

The Windows machine runs:

```text
stable-diffusion.cpp
```

using:

```text
Vulkan
```

The GPU is detected and used for diffusion inference.

The Windows machine should be treated as a **local GPU service**, not as the primary asset-storage machine.

Do not require manual copying of generated files from Windows to Mac.

---

# 3. Local network

Current AI server address:

```text
http://192.168.0.14:7861
```

The server is available only inside the local network unless the network configuration changes.

Typical health check:

```bash
curl http://192.168.0.14:7861/v1/models
```

Native capability discovery:

```bash
curl http://192.168.0.14:7861/sdcpp/v1/capabilities
```

## IMPORTANT

An AI agent must **always prefer capability discovery over assumptions**.

Before using advanced features, call:

```text
GET /sdcpp/v1/capabilities
```

The server can report:

* loaded model;
* supported generation modes;
* model-specific defaults;
* output formats;
* supported feature flags;
* available samplers;
* available schedulers;
* LoRA entries;
* upscalers;
* resolution limits;
* queue limits.

The `stable-diffusion.cpp` native API exposes this information specifically for clients and frontends.

---

# 4. Current model

The current primary image server uses:

```text
FLUX.2 Klein 4B
```

with quantized weights.

Current architecture approximately:

```text
FLUX.2 Klein diffusion
        ↓
AMD RX 6600 XT
        ↓
Vulkan

Qwen3 text encoder
        ↓
CPU

VAE
        ↓
CPU
```

The current Klein setup is primarily used for:

* text-to-image;
* reference-image editing;
* character/object consistency;
* pose changes;
* directional view creation;
* asset variations.

FLUX.2 Klein supports both normal generation and reference-image editing in `stable-diffusion.cpp`; the documented Klein 4B configuration uses Qwen3 4B and supports a four-step distilled inference path.

Typical current sampling configuration:

```text
steps: 4
sampler: euler
CFG: 1.0
```

These values are model-specific.

Do **not** assume they are appropriate for a different model.

---

# 5. stable-diffusion.cpp versus the currently loaded model

This distinction is critical.

## stable-diffusion.cpp as software

The software itself supports a large family of image, edit and video models, along with features such as LoRA, IP-Adapter, ControlNet for supported model families, upscaling and multiple compute backends. Current upstream support includes FLUX.2, Qwen Image and several image-edit and video model families.

## Current server instance

The server currently running on port:

```text
7861
```

is loaded with a **FLUX.2 Klein image model**.

Therefore:

> Never assume that every stable-diffusion.cpp capability is available from the currently loaded model.

For example:

* stable-diffusion.cpp may support video models;
* that does not mean the current Klein server can generate video.

The source of truth is:

```text
GET /sdcpp/v1/capabilities
```

Check:

```text
supported_modes
features_by_mode
```

before using a feature.

---

# 6. Server API families

The server exposes several API styles.

---

## 6.1 OpenAI-compatible API

This is the simplest API and is currently used by many project scripts.

### Text-to-image

```text
POST /v1/images/generations
```

Supported request concepts include:

```text
prompt
n
size
output_format
output_compression
```

Images are returned as Base64 in:

```text
data[].b64_json
```

The endpoint is synchronous from the HTTP client's perspective.

---

## 6.2 Reference image editing

```text
POST /v1/images/edits
```

Multipart request.

Important fields:

```text
prompt
image[]
image
mask
n
size
output_format
output_compression
```

Preferred reference field:

```text
image[]
```

This allows image references to be uploaded from the Mac and processed on Windows without placing the input image manually on Windows.

The result again returns Base64 image data.

---

## 6.3 Native parameter injection

When using the OpenAI-compatible API, native `stable-diffusion.cpp` parameters can be embedded in the prompt:

```text
<sd_cpp_extra_args>
{
  ...
}
</sd_cpp_extra_args>
```

For example:

```text
<sd_cpp_extra_args>
{
  "seed": 1000,
  "sample_params": {
    "sample_steps": 4,
    "sample_method": "euler",
    "guidance": {
      "txt_cfg": 1.0
    }
  }
}
</sd_cpp_extra_args>
```

The server removes this block before sending the actual textual prompt to the model.

This is officially supported for compatibility APIs.

---

# 7. Native sdcpp API

For larger automated pipelines, prefer the native API.

Base namespace:

```text
/sdcpp/v1/
```

Advantages:

* asynchronous generation;
* job queue;
* explicit native parameters;
* capability discovery;
* polling;
* cancellation;
* better suited to large asset batches.

---

# 8. Native capability discovery

Endpoint:

```text
GET /sdcpp/v1/capabilities
```

An agent should call this at startup.

Important fields include:

```text
model
current_mode
supported_modes
defaults_by_mode
output_formats_by_mode
features_by_mode
samplers
schedulers
loras
upscalers
limits
```

Possible image-generation feature flags include:

```text
init_image
mask_image
control_image
ip_adapter_image
ref_images
lora
vae_tiling
hires
cache
cancel_queued
cancel_generating
```

These are model/server dependent and must be checked before use.

---

# 9. Native asynchronous image generation

Submit:

```text
POST /sdcpp/v1/img_gen
```

Successful response:

```text
202 Accepted
```

and a job ID.

Example conceptual response:

```json
{
  "id": "job_xxx",
  "kind": "img_gen",
  "status": "queued",
  "poll_url": "/sdcpp/v1/jobs/job_xxx"
}
```

Poll:

```text
GET /sdcpp/v1/jobs/{id}
```

Cancel:

```text
POST /sdcpp/v1/jobs/{id}/cancel
```

Job states:

```text
queued
generating
completed
failed
cancelled
```

Completed jobs return generated images in Base64.

For bulk MMORPG generation this API is preferable to holding many synchronous HTTP connections.

---

# 10. Native image-generation controls

Depending on capability flags, native image jobs can expose:

```text
prompt
negative_prompt
width
height
strength
seed
batch_count

init_image
ref_images[]
mask_image
control_image
ip_adapter_image

control_strength
ip_adapter_strength

sample_params

lora[]

hires

vae_tiling_params

cache_mode
cache_option

output_format
output_compression
```

Reference, init, mask, ControlNet and IP-Adapter inputs are encoded as Base64 or data URLs in the native API.

Again:

> Availability in the request schema does not guarantee that the currently loaded model supports the feature.

Check capabilities first.

---

# 11. Video generation

`stable-diffusion.cpp` itself supports video-generation models and its native API defines:

```text
POST /sdcpp/v1/vid_gen
```

with concepts such as:

```text
init_image
end_image
control_frames[]
video_frames
fps
high_noise_sample_params
VACE strength
LoRA
```

and asynchronous job handling.

## IMPORTANT

The current FLUX.2 Klein server should be treated as an **image-generation server**, not a video server.

Do not call:

```text
/sdcpp/v1/vid_gen
```

unless:

```text
GET /sdcpp/v1/capabilities
```

explicitly reports:

```text
vid_gen
```

in:

```text
supported_modes
```

For current game animation generation, use controlled **frame-by-frame image generation**.

---

# 12. General asset-generation philosophy

The system separates:

```text
SEMANTICS
STYLE
GEOMETRY
ANIMATION
PIXELIZATION
PACKAGING
```

Do not force the AI model to solve all five simultaneously unless necessary.

Preferred pattern:

```text
clean high-resolution source
        ↓
controlled transforms
        ↓
animation frames
        ↓
post-processing
        ↓
pixel-art output
```

---

# 13. Source generation resolution

Typical current source:

```text
512 × 512
```

This is not the final game resolution.

It exists to give the model enough room to create:

* anatomy;
* silhouette;
* paws;
* facial features;
* weapons;
* equipment;
* outlines;
* readable pose changes.

Large bosses or complex props may require a larger generation size if VRAM allows.

The final resolution is decided separately.

---

# 14. Pixel-art strategy

Do not require the AI model to generate perfect final pixel art directly.

Current preferred strategy:

```text
clean 512×512 2D source
        ↓
background removal
        ↓
crop
        ↓
normalize scale
        ↓
high-quality downsample
        ↓
hard alpha
        ↓
palette quantization
        ↓
pixel-art sprite
```

Current creature sprite cell:

```text
96 × 96
```

Current palette target:

```text
24 colors
```

These are project defaults, not universal constants.

---

# 15. Downscaling rules

High-resolution source to final low resolution:

```text
Lanczos
```

is allowed.

Do not use nearest-neighbor for the first high-resolution reduction because it destroys too much source information.

Nearest-neighbor is used for:

```text
96×96
→
large debug preview
```

Example:

```text
96×96
→ nearest x6
→ 576×576 preview
```

This preserves actual pixel boundaries.

---

# 16. Shared palette

All animation frames belonging to the same visual entity should normally use one shared palette.

Example:

```text
rat
 ├ idle
 ├ walk
 └ attack
```

All frames are collected first.

Then:

```text
global palette
```

is calculated.

Then that palette is applied to all frames.

This prevents:

```text
frame 0 brown = #564C44
frame 1 brown = #51483F
frame 2 brown = #594F46
```

from causing visible animation flicker.

Output:

```text
palette.json
```

---

# 17. Absolute cutout rule

For sprites that require transparency, the source-image invariant is:

```text
EVERYTHING OUTSIDE THE ASSET = BACKGROUND
```

Forbidden:

```text
cast shadow
contact shadow
ground shadow
drop shadow
gray ellipse
floor
platform
dust
smoke unless smoke is the asset
motion blur
lighting glow unless glow is the asset
```

For character/mob/weapon/equipment cutouts, there must be no visual grounding underneath the asset.

The background should be:

```text
uniform
flat
easy to segment
```

Current preferred generation background:

```text
solid light gray
```

Postprocessing turns this into transparency.

---

# 18. Asset-specific background policies

The no-shadow rule is **not globally identical for every asset class**.

## Character / mob / equipment

Use:

```text
isolated object
uniform background
no shadow
```

because final result requires transparency.

## Terrain tile

Do not remove the tile background.

The entire frame is the texture.

## VFX

Usually:

```text
isolated effect
uniform background
```

or transparent-compatible composition.

## Environmental props

Usually transparent cutout.

## Large building integrated into ground

Depends on game rendering architecture.

The asset specification must explicitly declare:

```json
{
  "backgroundMode": "transparent"
}
```

or:

```json
{
  "backgroundMode": "opaque"
}
```

---

# 19. Creature canonical-view strategy

For symmetric creatures such as the rat, do **not** independently generate four directions.

Create two canonical masters.

---

## 19.1 Side master

```text
master-side.png
```

Requirements:

```text
strict side profile
facing LEFT
full body
```

---

## 19.2 Top master

```text
master-up.png
```

Requirements:

```text
strict direct overhead dorsal view
head UP
tail DOWN
```

Prefer creating it as an image edit from the side master to preserve character identity.

---

# 20. Derived creature directions

Generate:

```text
LEFT = AI side master
UP   = AI top master
```

Derive:

```text
RIGHT = horizontal mirror of LEFT
DOWN  = 180° rotation of UP
```

Diagram:

```text
       SIDE MASTER
           |
      AI animation
           |
         LEFT
           |
         mirror
           |
         RIGHT
```

and:

```text
        TOP MASTER
            |
       AI animation
            |
           UP
            |
        rotate 180°
            |
          DOWN
```

This substantially improves directional consistency.

---

# 21. Mirroring caveat

Mirroring is safe only when visual semantics allow it.

Safe examples:

```text
rat
wolf
slime
generic spider
symmetric monster
```

Potentially unsafe:

```text
player holding sword in right hand
shield in left hand
one-sided shoulder armor
one-eyed monster
asymmetric scars
one-sided mechanical arm
quiver
holster
badge
single horn
```

Asset specs should include:

```json
{
  "mirrorSafe": true
}
```

or:

```json
{
  "mirrorSafe": false
}
```

If:

```text
mirrorSafe = false
```

LEFT and RIGHT should be generated separately or equipment slots must be remapped intentionally.

---

# 22. Walk animation convention

Current walk cycle:

```text
4 frames
```

Semantic order:

```text
0 = Contact A
1 = Passing A
2 = Contact B
3 = Passing B
```

Playback:

```text
0 → 1 → 2 → 3 → 0
```

Recommended starting speed:

```text
8 FPS
```

Loop:

```text
true
```

The AI must modify:

* limb positions;
* body compression;
* body extension;
* head offset;
* tail phase.

Do not generate four nearly identical poses.

---

# 23. Attack animation convention

Current rat bite/lunge attack:

```text
6 frames
```

Order:

```text
0 = anticipation
1 = wind-up
2 = lunge
3 = impact / bite
4 = recoil
5 = recovery
```

Playback:

```text
0 → 1 → 2 → 3 → 4 → 5
```

Loop:

```text
false
```

Current nominal FPS:

```text
10
```

Gameplay event:

```text
frame 3 = hit
```

This means damage, hitbox activation, hit sound and impact VFX should usually align with attack frame 3.

---

# 24. Animation design rule

Every animation should be described semantically before image generation.

Bad:

```text
make 6 attack frames
```

Good:

```text
frame 0 — anticipation
frame 1 — wind-up
frame 2 — launch
frame 3 — impact
frame 4 — recoil
frame 5 — recovery
```

This rule applies to:

* melee;
* ranged attack;
* spell cast;
* death;
* hurt;
* dodge;
* jump;
* harvesting;
* crafting;
* emotes;
* boss mechanics.

---

# 25. Future animation examples

Possible creature animations:

```text
idle
walk
run
attack
attack_alt
hurt
death
stun
sleep
wake
cast
special
charge
dash
burrow
emerge
eat
roar
```

Animation frame counts are not required to be identical.

Example:

```text
idle:      4
walk:      4
run:       6
attack:    6
hurt:      3
death:     8
special:  10
```

The manifest is the authoritative description.

---

# 26. Sprite direction order

Project direction convention:

```text
0 = DOWN
1 = LEFT
2 = RIGHT
3 = UP
```

Always preserve this order when packing directional animation rows unless a format explicitly declares otherwise.

---

# 27. Frame time direction

Inside an animation row:

```text
TIME MOVES LEFT → RIGHT
```

Example:

```text
W0 W1 W2 W3
```

Never place animation time vertically unless the manifest explicitly uses a different format.

---

# 28. Current creature spritesheet layout

Current maximum animation length:

```text
attack = 6 frames
```

Therefore the combined sheet has:

```text
6 columns
```

Animations:

```text
idle
walk
attack
```

Directions:

```text
down
left
right
up
```

Total:

```text
3 × 4 = 12 rows
```

At:

```text
96 × 96 per cell
```

combined sheet:

```text
width  = 576
height = 1152
```

---

# 29. Exact current spritesheet grid

```text
COL      0    1    2    3    4    5

ROW 0    idle_down
         I0

ROW 1    idle_left
         I0

ROW 2    idle_right
         I0

ROW 3    idle_up
         I0


ROW 4    walk_down
         W0   W1   W2   W3

ROW 5    walk_left
         W0   W1   W2   W3

ROW 6    walk_right
         W0   W1   W2   W3

ROW 7    walk_up
         W0   W1   W2   W3


ROW 8    attack_down
         A0   A1   A2   A3   A4   A5

ROW 9    attack_left
         A0   A1   A2   A3   A4   A5

ROW 10   attack_right
         A0   A1   A2   A3   A4   A5

ROW 11   attack_up
         A0   A1   A2   A3   A4   A5
```

Unused cells remain transparent.

---

# 30. Sprite frame coordinates

For fixed cell size:

```text
CELL = 96
```

Frame:

```text
row = R
column = C
```

Coordinates:

```text
x = C × CELL
y = R × CELL
width = CELL
height = CELL
```

Example:

```text
attack_left
row = 9

impact frame
column = 3
```

Coordinates:

```text
x = 288
y = 864
width = 96
height = 96
```

---

# 31. Do not hardcode sheet positions in game logic

Game code should prefer:

```text
spritesheet.json
```

instead of hardcoded row calculations.

The manifest records:

* animation;
* direction;
* frame index;
* row;
* column;
* x;
* y;
* width;
* height;
* FPS;
* loop;
* animation events.

This allows adding new animations later without rewriting gameplay code.

---

# 32. Generic animation manifest concept

Example:

```json
{
  "animation": "attack",
  "direction": "left",
  "fps": 10,
  "loop": false,
  "frames": [
    {
      "index": 0,
      "x": 0,
      "y": 864,
      "width": 96,
      "height": 96
    }
  ],
  "events": [
    {
      "frame": 3,
      "event": "hit"
    }
  ]
}
```

---

# 33. Player characters

Player generation requires stricter consistency than mobs.

Canonical layers may include:

```text
base body
hair
head equipment
body armor
legs
boots
gloves
weapon
offhand
cape
accessories
effects
```

These layers must share:

* exact cell dimensions;
* exact anchor;
* exact body pose;
* exact direction;
* exact animation timing.

Do not independently invent poses for every equipment layer.

The body animation should be the canonical motion source.

Equipment should conform to the body.

---

# 34. Character anchor system

All layered player assets require a common coordinate system.

Recommended concept:

```text
sprite cell
96 × 96

anchor/body origin
fixed per frame
```

Optional attachment points:

```text
head
left_hand
right_hand
back
chest
waist
weapon_origin
projectile_origin
feet
```

Future manifests should store attachment points explicitly.

Example:

```json
{
  "anchors": {
    "origin": [48, 70],
    "head": [48, 25],
    "rightHand": [62, 55]
  }
}
```

---

# 35. Hairstyles

Hair should not be generated as a completely independent character.

Preferred approach:

```text
canonical body/head frame
        +
hair reference/style
        ↓
hair overlay
```

Hair assets should:

* preserve head position;
* preserve camera;
* preserve direction;
* preserve silhouette constraints;
* expose transparency;
* not redraw the face unless required;
* share body animation timing.

For four directions, hair may require separate UP/DOWN/LEFT/RIGHT views because asymmetry and volume may make simple rotation unsuitable.

---

# 36. Armor and clothing

Equipment should be treated as layers attached to a body animation.

Recommended pipeline:

```text
approved naked/base body frame
        ↓
reference edit
        ↓
same frame wearing armor
        ↓
extract only equipment layer
```

Long-term pipeline should prefer:

```text
body
+
equipment overlay
```

over baking each armor set into an independent complete character.

This allows combinatorial MMORPG customization.

---

# 37. Weapons

Weapons can be:

## Inventory/icon asset

Single clean object.

Example:

```text
strict readable presentation
transparent output
no cast shadow
```

## Equipped weapon

Requires character anchor data.

Must maintain:

```text
position
rotation
hand attachment
direction
frame timing
```

## Projectile source

May also require:

```text
flight orientation
impact animation
trail effect
```

---

# 38. Bosses

Bosses should not be forced into the standard 96×96 creature cell.

Boss spec should declare size class.

Example:

```json
{
  "assetType": "boss",
  "cellSize": 192
}
```

or:

```json
{
  "cellSize": 288
}
```

Boss pipeline may use:

* larger source resolution;
* more animation frames;
* multiple attacks;
* multiple phases;
* separate VFX;
* larger hit frames;
* unique directional rules.

Do not crop bosses to fit normal mob dimensions.

---

# 39. Static props

Examples:

```text
barrel
crate
chest
door
torch
sign
table
rock
ore node
tree
bush
campfire
statue
```

Generate:

```text
single canonical game camera
clean silhouette
transparent background
no unwanted shadow
```

If the world uses a specific camera projection, all props must use the same projection.

---

# 40. Tile generation

Tiles are fundamentally different from character sprites.

A terrain tile must normally fill the entire cell.

No transparent cutout is required for ground tiles unless the layer architecture explicitly needs it.

Possible tile categories:

```text
grass
dirt
sand
stone
snow
mud
wood floor
stone floor
road
water
lava
swamp
cliff
wall
roof
bridge
```

---

# 41. Tile requirements

Tile assets should specify:

```text
tile size
projection
biome
material
edge type
neighbors
animation
collision category
```

Example:

```json
{
  "assetType": "terrain_tile",
  "tileSize": 64,
  "material": "grass",
  "seamless": true
}
```

---

# 42. Seamless tile validation

For a seamless repeating tile:

```text
left edge should match right edge
top edge should match bottom edge
```

The agent must validate tiled repetition.

Recommended validation preview:

```text
3 × 3 repetition
```

A tile that looks good individually but shows visible seams when repeated is rejected.

---

# 43. Terrain transitions

Complex terrain should eventually use adjacency metadata.

Examples:

```text
grass → dirt
grass → water
sand → water
stone → grass
snow → rock
```

A future tileset may use:

* Wang tiles;
* bitmask autotiles;
* transition tiles;
* corner tiles;
* edge tiles.

Do not generate a random sheet without defining adjacency semantics.

---

# 44. Animated water

Animated environmental tiles should use a looping keyframe design.

Example:

```text
water_0
water_1
water_2
water_3
```

Loop:

```text
0 → 1 → 2 → 3 → 0
```

Important invariants:

* tile borders must remain compatible;
* shoreline geometry must not move if it affects collision;
* color palette should remain stable;
* animation should represent surface motion, not tile deformation;
* seamless repeat must be validated for every frame.

Animated water may use image-edit references so each frame retains the same base geometry.

---

# 45. Animated lava

Similar to water, but VFX motion can include:

```text
glowing cracks
surface bubbling
slow convection
sparks
```

Still preserve:

* tile boundaries;
* collision geometry;
* seamless edges.

---

# 46. Magic VFX

Magic is not treated like a character.

Possible VFX asset types:

```text
cast effect
charge effect
projectile
projectile trail
impact
explosion
area effect
buff
debuff
portal
beam
lightning
fire
ice
poison
healing
```

VFX normally uses:

```text
transparent background
centered effect
stable canvas
```

Animations should define semantic phases.

Example explosion:

```text
0 ignition
1 expansion
2 peak
3 fragmentation
4 fade
5 dissipate
```

---

# 47. Projectile animation

Projectile specs should contain:

```text
directionalMode
loop
flightFrames
impactFrames
anchor
speed semantics
```

Simple symmetric projectiles may rotate mathematically.

Examples:

```text
fireball
magic orb
arrow
ice shard
rock
```

Do not waste AI generations if rotation produces a correct result.

---

# 48. Explosion generation

Explosion animations should not use character directional conventions.

A radial explosion may use:

```text
one animation
no directions
```

Sheet:

```text
E0 E1 E2 E3 E4 E5 ...
```

Manifest should describe:

```text
fps
loop = false
impact event
light event
sound event
```

---

# 49. Asset classification must happen first

Before generation, determine:

```text
asset type
```

Possible high-level classes:

```text
creature
boss
player
npc
equipment
weapon
hair
prop
terrain_tile
transition_tile
animated_tile
projectile
vfx
ui_icon
building
```

Generation logic depends on the class.

Never apply the rat pipeline blindly to every asset.

---

# 50. Generic asset specification

Agents should preferably create a specification before generating.

Example:

```json
{
  "id": "mob_rat",
  "assetType": "creature",
  "style": "iron_arcana",
  "cellSize": 96,
  "sourceSize": 512,
  "mirrorSafe": true,
  "backgroundMode": "transparent",

  "directions": [
    "down",
    "left",
    "right",
    "up"
  ],

  "animations": {
    "idle": {
      "frames": 1,
      "fps": 1,
      "loop": true
    },

    "walk": {
      "frames": 4,
      "fps": 8,
      "loop": true
    },

    "attack": {
      "frames": 6,
      "fps": 10,
      "loop": false,
      "events": {
        "3": "hit"
      }
    }
  }
}
```

---

# 51. Recommended asset directory

Generic structure:

```text
assets-generated/
└── <asset-id>/
    │
    ├── spec.json
    │
    ├── masters/
    │
    ├── raw/
    │
    ├── sprites/
    │
    ├── sheets/
    │
    ├── palette.json
    │
    └── generation.json
```

Example:

```text
output/rat/
├── masters/
├── raw/
├── sprites/
├── sheets/
└── palette.json
```

---

# 52. Raw files are valuable

Never delete valid high-resolution RAW frames automatically.

RAW images allow:

```text
changing spriteSize
changing paletteSize
changing pixelizer
changing alpha cleanup
changing spritesheet format
```

without spending GPU time again.

AI generation is expensive.

Post-processing is cheap.

Cache raw results.

---

# 53. Reproducibility

Every generated image should ideally store:

```text
prompt
seed
model
generation size
steps
sampler
CFG
reference image
timestamp
pipeline parameters
```

Save metadata next to outputs or in:

```text
generation.json
```

This allows exact or approximate regeneration.

---

# 54. Seed policy

Use deterministic seeds for production generation.

Example:

```text
masterSide = 101
masterUp   = 202

walkLeftBase   = 1000
walkUpBase     = 2000

attackLeftBase = 3000
attackUpBase   = 4000
```

Frame seed:

```text
baseSeed + frameIndex
```

Retries may use a deterministic offset.

---

# 55. Retry system

Automatically retry images that violate hard constraints.

Examples:

```text
wrong direction
wrong camera
extra creature
cropped body
shadow
ground
identity drift
missing limb
broken silhouette
tile seam
wrong equipment
```

Do not silently accept obviously invalid generations into a final sheet.

---

# 56. Validation levels

Recommended pipeline:

```text
generation
    ↓
structural validation
    ↓
art validation
    ↓
postprocess
    ↓
sheet validation
```

---

# 57. Structural validation examples

Creature:

```text
one subject
full body
correct direction
correct projection
within canvas
```

Tile:

```text
fills cell
correct size
edge constraints
```

VFX:

```text
effect centered
no accidental object
correct alpha
```

---

# 58. Animation validation

Compare neighboring frames.

Reject animation when:

```text
body identity changes too much
body scale changes too much
camera changes
asset teleports across the cell
palette changes dramatically
limbs randomly appear/disappear
background artifact appears
```

Intentional motion is allowed.

Identity drift is not.

---

# 59. Stable anchors

Animations should preserve a stable logical origin.

The asset may bob or lunge, but the cell coordinate system must remain stable.

Movement of the character across the world belongs to game logic.

Example:

A walking sprite should move its legs while remaining approximately centered in the frame.

Do not generate:

```text
frame 0 x=20
frame 1 x=50
frame 2 x=80
```

as simulated walking translation.

The game engine handles world displacement.

---

# 60. Attack displacement

A lunge may shift visually within the cell.

This is acceptable if:

* cell size remains fixed;
* anchor remains known;
* effect does not clip;
* character returns during recovery.

World-position movement should still be controlled by gameplay code.

---

# 61. Transparent canvas

Final sprite frames:

```text
RGBA PNG
```

Background:

```text
alpha = 0
```

Character pixels:

```text
alpha = 255
```

Avoid soft alpha unless a VFX explicitly requires it.

Pixel-art character edges should normally use hard alpha.

---

# 62. Special handling for VFX alpha

VFX may require:

```text
semi-transparent smoke
glow
particles
magic fade
```

Therefore do not force hard alpha on VFX if the asset specification says:

```json
{
  "alphaMode": "soft"
}
```

Character default:

```text
hard
```

VFX default:

```text
soft allowed
```

---

# 63. LoRA

`stable-diffusion.cpp` supports LoRA for supported model setups. The native server API represents LoRAs as structured entries rather than relying on prompt-embedded `<lora:...>` syntax.

Agents must discover available LoRAs through capabilities or compatible discovery endpoints.

Do not invent LoRA paths.

---

# 64. IP-Adapter and ControlNet

The `stable-diffusion.cpp` project supports IP-Adapter for SD 1.5/SDXL and ControlNet support for SD 1.5.

This does **not** mean they should be sent to the current FLUX.2 Klein instance.

Always check:

```text
features_by_mode.img_gen
```

If:

```text
ip_adapter_image = false
```

do not send it.

If:

```text
control_image = false
```

do not send it.

---

# 65. Hires / upscaling

The server API can expose high-resolution processing and upscalers, including built-in modes such as:

```text
Lanczos
Nearest
Latent
Latent nearest variants
Latent bicubic variants
```

and optionally model-backed upscalers when configured.

For pixel assets, however, AI high-resolution upscaling is usually **not** the final pixel-art resize stage.

Pixel-art postprocessing remains separate.

---

# 66. Mask editing

The API schema includes mask inputs for image editing/native image generation where supported.

Potential game uses:

```text
replace helmet
replace weapon
change hairstyle
change damaged section
modify only terrain corner
change banner symbol
repair one animation limb
```

Only use masking when capabilities and model behavior support it reliably.

---

# 67. Multiple reference images

The native image API can expose:

```text
ref_images[]
```

and the OpenAI-compatible edit endpoint accepts preferred multipart:

```text
image[]
```

inputs.

Potential future use:

```text
reference 1 = character identity
reference 2 = armor
reference 3 = weapon
reference 4 = style
```

Do not assume arbitrary multi-reference composition will preserve all references perfectly.

Validate results.

---

# 68. Style consistency

Iron Arcana should eventually define a canonical visual style specification.

It should include:

```text
outline style
palette philosophy
contrast
lighting
detail density
camera projection
sprite size classes
proportions
environment scale
tile scale
VFX intensity
```

Generation prompts should reference the style specification rather than inventing style independently per asset.

---

# 69. Do not bake accidental style into prompts

Avoid relying only on phrases such as:

```text
pixel art
RPG sprite
fantasy game
```

These are too vague.

Explicitly define:

```text
camera
silhouette
outline
lighting
background
color count
detail amount
perspective
scale
```

---

# 70. Recommended generation order for a new mob

```text
1. Create spec
2. Generate SIDE master
3. Validate SIDE
4. Generate TOP master from SIDE
5. Validate TOP
6. Generate canonical LEFT animations
7. Generate canonical UP animations
8. Derive RIGHT
9. Derive DOWN
10. Validate RAW animation
11. Remove background
12. Normalize scale
13. Downsample
14. Build global palette
15. Quantize frames
16. Pack sheets
17. Build manifest
18. Run QA
19. Approve asset
```

---

# 71. Recommended generation order for equipment

```text
1. Load canonical character body frame
2. Load equipment design reference
3. Generate equipment on exact body pose
4. Preserve camera and anchor
5. Extract equipment layer
6. Repeat canonical generated directions
7. Derive mirror-safe directions when allowed
8. Repeat for animations
9. Normalize palette/style
10. Package layer sheet
11. Store body/equipment compatibility metadata
```

---

# 72. Recommended generation order for terrain

```text
1. Define tile size
2. Define biome/material
3. Define adjacency type
4. Generate clean source
5. Normalize perspective
6. Convert to final pixel scale
7. Validate seamless repetition
8. Generate edge/corner transitions
9. Validate 3×3 preview
10. Pack tileset
11. Store terrain metadata
```

---

# 73. Recommended generation order for animated environmental tile

```text
1. Generate approved static tile
2. Use it as reference
3. Define loop phases
4. Generate frame sequence
5. Keep edges locked
6. Apply shared palette
7. Validate every frame tiled 3×3
8. Validate animation loop
9. Pack animation sheet
10. Store FPS and loop metadata
```

---

# 74. Recommended generation order for VFX

```text
1. Define effect semantic phases
2. Generate canonical animation
3. Preserve frame center/origin
4. Preserve effect identity
5. Allow soft alpha if necessary
6. Pixelize appropriately
7. Pack frames left-to-right
8. Define gameplay event frames
```

---

# 75. Current CLI modes in sprite-pipeline

Current mob pipeline supports:

```bash
node sprite-pipeline.mjs masters
```

Creates/validates canonical masters.

```bash
node sprite-pipeline.mjs animate
```

Generates animation RAW frames, pixelizes and creates sheets.

```bash
node sprite-pipeline.mjs pixelize
```

Does not use AI.

Re-processes existing RAW frames.

Use this to tune:

```text
spriteSize
paletteSize
background removal
pixel processing
```

without GPU generation.

```bash
node sprite-pipeline.mjs sheet
```

Only rebuilds sheets/manifests.

```bash
node sprite-pipeline.mjs all
```

Runs the complete pipeline.

Force regeneration:

```bash
node sprite-pipeline.mjs all --force
```

---

# 76. Cache policy

Without:

```text
--force
```

existing valid generations should normally be reused.

This prevents wasting inference time.

Use force only when:

* prompt changed;
* master changed;
* generation bug exists;
* wrong shadow exists;
* wrong anatomy exists;
* animation was rejected.

---

# 77. Server load policy

The Windows GPU is a limited shared resource.

Prefer:

```text
queue
cache
deterministic jobs
```

over uncontrolled parallel generation.

Do not fire dozens of simultaneous synchronous HTTP calls.

For future batch generation, native asynchronous `/sdcpp/v1/img_gen` jobs are preferred because the server exposes queued/generating/completed/failed/cancelled job states and queue limits.

---

# 78. Agent rule: inspect capabilities first

Before starting a generation session:

```text
1. GET /sdcpp/v1/capabilities
2. inspect loaded model
3. inspect supported_modes
4. inspect features_by_mode
5. inspect limits
6. choose API strategy
```

Do not guess.

---

# 79. Agent rule: do not reinstall infrastructure unnecessarily

The AI server is already installed.

Do not:

```text
reinstall stable-diffusion.cpp
replace working binaries
download another model
change Windows configuration
change server port
modify firewall
```

unless explicitly requested.

The normal agent task is to use the existing API.

---

# 80. Agent rule: Mac owns orchestration

Generation requests originate from the Mac.

Outputs should return to the Mac.

Treat Windows as:

```text
GPU inference service
```

not as the main working directory.

---

# 81. Agent rule: separate generation from packaging

Do not mix these concerns unnecessarily.

Generation:

```text
AI / GPU
```

Postprocessing:

```text
Node.js + Sharp
```

Packaging:

```text
Node.js
```

Game integration:

```text
manifest / repository
```

This allows changes to sprite processing without rerunning expensive inference.

---

# 82. Agent rule: never discard masters

Approved masters are canonical identity references.

A change to a master may affect:

```text
all directions
all animations
all equipment
all future variations
```

Treat master replacement as a major asset change.

---

# 83. Agent rule: generated right/down are not new identities

For a mirror-safe creature:

```text
RIGHT
```

must come from:

```text
LEFT
```

and:

```text
DOWN
```

must come from:

```text
UP
```

Do not ask the model to independently reinterpret the character when a deterministic transform is sufficient.

---

# 84. Agent rule: gameplay semantics belong in metadata

The image is not enough.

Examples:

```text
attack hit frame
projectile spawn frame
footstep frame
spell release frame
death completion frame
loop point
```

must be represented in manifest metadata.

Example:

```json
{
  "events": [
    {
      "frame": 3,
      "event": "hit"
    }
  ]
}
```

---

# 85. Future animation event examples

```text
footstep
hit
projectile_spawn
cast_release
sound
particle
camera_shake
invulnerability_start
invulnerability_end
death_complete
```

The pipeline should allow multiple events on one frame.

---

# 86. Quality target

Generated content should prioritize:

```text
consistency
readability
stable silhouette
game usability
animation coherence
repeatability
```

over:

```text
maximum illustration detail
photorealism
random visual novelty
```

This is a game asset factory, not a standalone image gallery.

---

# 87. Known limitations

AI image editing is probabilistic.

Possible failures:

```text
identity drift
wrong view
wrong limbs
camera drift
shadow generation
extra objects
asymmetric mutation
equipment mutation
tile seam
different proportions
palette shift
animation jitter
```

Therefore every generated asset needs validation.

---

# 88. Future improvements

Possible future pipeline upgrades:

```text
ControlNet geometry
pose guides
3D proxy renders
depth conditioning
automatic animation frame scoring
automatic identity similarity scoring
optical-flow consistency checks
automatic tile seam scoring
automatic palette QA
automatic alpha QA
automatic sprite anchor extraction
equipment masks
character skeleton metadata
video-model-assisted motion
LoRA style training
project-wide canonical palette
```

The current architecture intentionally allows these components to be added later without replacing the entire system.

---

# 89. Current source of truth hierarchy

If documentation conflicts:

## 1. Runtime server capabilities

```text
GET /sdcpp/v1/capabilities
```

wins for server feature availability.

## 2. Asset spec

```text
spec.json
```

wins for asset-specific rules.

## 3. Pipeline manifest

```text
spritesheet.json
```

wins for generated frame positions and animation metadata.

## 4. This README

Defines global architecture and conventions.

---

# 90. Minimum startup checklist for an AI agent

Before generating any asset:

* determine asset class;
* read this README;
* locate or create `spec.json`;
* check AI server reachability;
* call `/sdcpp/v1/capabilities`;
* verify required generation mode;
* verify required features;
* inspect existing masters;
* inspect cache;
* determine transparency/background policy;
* determine cell/tile size;
* determine direction strategy;
* determine animation semantics;
* choose deterministic seeds;
* generate only the minimum required AI images;
* use deterministic transforms where possible;
* validate before packaging;
* keep RAW files;
* build manifests;
* never silently accept obviously invalid output.

---

# 91. Core philosophy

The pipeline should always prefer:

```text
AI where creative inference is required
+
deterministic code where deterministic transformation is possible
```

Examples:

Use AI for:

```text
new creature
new pose
new armor design
new animation keyframe
new spell visual
new terrain material
```

Use deterministic code for:

```text
mirror
rotate
crop
resize
palette conversion
alpha cleanup
sheet packing
coordinate calculation
manifest generation
validation
```

Never spend GPU inference on something that can be reproduced exactly with code.

---

# 92. Final architecture

```text
                     ASSET SPEC
                         |
                         v
                GENERATION STRATEGY
                         |
                         v
               LOCAL AI SERVER
           Windows / RX 6600 XT / Vulkan
                         |
              +----------+----------+
              |                     |
              v                     v
         text generation       reference edit
              |                     |
              +----------+----------+
                         |
                         v
                    RAW ASSETS
                         |
                         v
                  VALIDATION / RETRY
                         |
                         v
               BACKGROUND / ALPHA
                         |
                         v
                 SCALE NORMALIZATION
                         |
                         v
                   PIXELIZATION
                         |
                         v
                  SHARED PALETTE
                         |
                         v
              DETERMINISTIC TRANSFORMS
              mirror / rotate / derive
                         |
                         v
               SPRITESHEET / TILESET
                         |
                         v
                    MANIFEST JSON
                         |
                         v
                    IRON ARCANA
```

---

# 93. Summary

The local AI system is not a single “generate sprite” command.

It is a controlled asset-production pipeline.

The Windows machine performs inference.

The Mac orchestrates generation and post-processing.

FLUX.2 Klein currently provides generation and reference editing.

The system builds canonical masters, derives consistent views, generates semantic animation keyframes, removes unwanted backgrounds and shadows, pixelizes high-resolution source artwork, enforces shared palettes, constructs deterministic sprite sheets and emits manifests that gameplay code can consume.

The same architecture should be extended to:

```text
mobs
bosses
players
equipment
weapons
hair
tiles
animated terrain
props
projectiles
spells
explosions
VFX
and other MMORPG content
```

without treating every asset class as if it were a character sprite.

**Capability discovery, reproducibility, consistency, deterministic post-processing, explicit metadata and asset-class-specific generation rules are mandatory parts of the pipeline.**
