# Performance Optimisation Plan — Deep Ocean Shark

**Goal:** locked 60 fps with substantial GPU/CPU headroom on a baseline M1 MacBook Air
(8-core CPU, 7-core GPU), and a graceful floor on weaker integrated GPUs.

**Current state:** GPU pegged at ~100%, all CPU cores loaded. For a scene of this
size that is 5–10× more work than it should cost.

Everything below was measured against the current `src/` tree, not estimated from
feel. Numbers are per frame unless stated.

---

## 0. Measured baseline

Extracted by parsing every `assets/*.glb` header and cross-referencing
[config.js](src/config/config.js):

| Metric | Now | Reasonable target |
|---|---|---|
| Triangles submitted / frame | **1,456,157** | 250k–400k |
| Triangles *rasterised* / frame | **~2.9 M** (everything is `DoubleSide`) | ~300k |
| Draw calls | ~204 | 60–90 |
| Frustum-culled objects | **~0** (culling is disabled almost everywhere) | all of them |
| Instance matrices rebuilt on CPU / frame | **1,574** | 0 |
| `InstancedMesh` buffer re-uploads / frame | **16** | 0 |
| Collision iterations / frame | **~14,625** (98 queries × 150 solids, linear) | ~600 |
| `AnimationMixer`s ticked / frame | 22 | 4–8 (distance-gated) |
| Blended (transparent) full-screen-ish layers | 30 god rays + water + 2,300 points + 12 halos | 4–8 rays + water |
| Render target | 2880×1800 (DPR 2) **× 4× MSAA** | dynamic, ~1.2–1.5× DPR, FXAA |
| Asset payload | 26 MB (19.7 MB is one audio file) | < 6 MB |

### Where the triangles actually are

The seabed props are 94% of the whole frame. Five rows account for 1.05 M of it:

| Row | Count | Tris each | Total | Note |
|---|---:|---:|---:|---|
| `kelpBush` (canopy, r=82..115) | 84 | 3,440 | **288,960** | outside fog range, still swaying |
| `kelpBush` (reef) | 49 | 3,440 | 168,560 | `kelp-tall.glb` is 21 nodes / 3.4k tris |
| `seagrass` (`Seaweed-3.glb`) | 165 | 1,832 | **302,280** | ground cover at 1.8k tris a blade |
| `anemone` | 41 | 2,617 | 107,297 | 2.6k tris for a 2.6-unit prop |
| `kelp` (both rows) | 220 | 784 | 172,480 | |
| everything else | — | — | 335,925 | |

Three source models are wildly over-budget for their on-screen size:
`Seaweed-3.glb` (1,832 tris), `sea-anemone.glb` (2,617 tris) and
`kelp-tall.glb` (3,440 tris across 21 primitives).

### Why the M1 in particular is suffering

Apple GPUs are **tile-based deferred renderers**. Opaque overdraw is nearly free
because hidden-surface removal discards occluded fragments before shading. But
**alpha-blended geometry defeats HSR entirely** — every blended fragment must be
rasterised and shaded in submission order. This scene currently stacks:

- a 400×400 `DoubleSide` **transparent** `MeshStandardMaterial` water plane ([water.js:16-19](src/water.js#L16-L19))
- **30** additive `DoubleSide` god-ray quads, each 24–36 units tall, with the camera *inside* the volume ([godrays.js:13-47](src/godrays.js#L13-L47))
- **2,300** blended, depth-write-off point sprites with size attenuation ([particles.js](src/particles.js))
- 12 additive orb halos ([orbs.js:50-54](src/orbs.js#L50-L54))

…all at 2880×1800 with 4× MSAA. That is the single worst-case workload you can
hand an Apple GPU, and it is almost certainly the top cost right now.

---

## 1. Instrument before you change anything

Do this first. Every fix below should be accepted or rejected on a number.

1. **`stats.js`** panel (ms/frame, not just fps) plus a `renderer.info` readout —
   `render.calls`, `render.triangles`, `programs.length`, `memory.geometries`.
2. **Split CPU vs GPU.** Time `updateWorld()` with `performance.now()` around it.
   If `updateWorld` is 3 ms and the frame is 22 ms, you are GPU-bound and no
   amount of JS tuning helps.
3. **`EXT_disjoint_timer_query_webgl2`** for real GPU pass timings, or Safari's
   Web Inspector → Graphics timeline (best GPU visibility on macOS).
4. **The decisive experiment:** set `renderer.setPixelRatio(0.5)` for one run.
   - fps recovers → **fill-rate bound** → §2 is your whole problem.
   - fps unchanged → vertex/CPU bound → §3 and §4 are your problem.

Run that experiment before reading further; it tells you which half of this
document matters most.

---

## 2. Tier 1 — fill rate and pixel budget (biggest wins, smallest diffs)

### 2.1 Stop rendering 20.7 M samples per frame

[core.js:11-13](src/core.js#L11-L13) currently does:

```js
new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

On the M1 Air that is a 2880×1800 buffer with 4× MSAA — 20.7 M colour+depth
samples, every frame, before a single triangle is drawn.

**Fix:**
- Cap pixel ratio at **1.5** (visually near-indistinguishable underwater, **44% fewer pixels**).
- Drop `antialias: true`. MSAA on a 1.5× buffer buys little in a fogged scene and
  costs bandwidth on every blended layer. If you want edge AA back, add a single
  FXAA pass — but try without first.
- Add `powerPreference: 'high-performance'`, `stencil: false`, `depth: true`,
  `alpha: false`. `stencil: false` alone saves a byte per sample.

**Expected: 40–60% GPU reduction on its own.** This is the highest-ROI change in
the document and it is four lines.

### 2.2 Dynamic resolution scaling

The proper version of 2.1: keep a rolling average of frame time and adjust
`setPixelRatio` between ~0.75 and 2.0 to hold a 16.6 ms budget. Adjust in steps,
with hysteresis and a ~0.5 s cooldown so it does not oscillate visibly.

```js
// sketch — core.js
let scale = 1.25;
function adaptResolution(frameMs) {
  if (frameMs > 19 && scale > 0.75) scale -= 0.1;
  else if (frameMs < 13 && scale < 2.0) scale += 0.05;
  else return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, scale));
}
```

This is what makes "runs smoothly on any hardware" actually true: a weak GPU
drops resolution instead of dropping frames.

### 2.3 Cut the god rays from 30 to 6–10, and merge them

[godrays.js:28-47](src/godrays.js#L28-L47) creates 30 separate meshes, each with
its own **cloned `ShaderMaterial`** (30 material instances → 30 uniform-block
uploads and state changes), `DoubleSide`, additive, spread across a ±65 box the
camera lives inside.

Three problems, three fixes:

1. **Count.** 6–10 shafts read the same underwater as 30 once fog and additive
   falloff are applied. Test it — this is nearly free to try (`GOD_RAYS.count`).
2. **`DoubleSide` is pointless** on a camera-facing billboard. `FrontSide` halves
   the fragment work immediately.
3. **One `InstancedMesh`, one material.** Move `uSeed` to an instanced attribute
   and do the Y-billboard in the vertex shader against `cameraPosition`. 30 draw
   calls + 30 materials → 1 + 1, and `updateGodRays()` disappears from the CPU
   loop entirely.

Also add a soft distance fade so shafts behind the camera's fog horizon
contribute nothing.

### 2.4 The water plane

[water.js](src/water.js): originally a 400×400 `DoubleSide`, transparent
`MeshStandardMaterial` with `roughness`/`metalness` — full PBR lighting evaluated
per blended fragment.

- The camera is always **below** it ([shark.js:140](src/shark.js#L140) clamps to
  `WORLD.surface - 0.6`). Use `side: THREE.BackSide`, not `DoubleSide`. This does
  not change the lighting — three flips the shading normal for back faces exactly
  as `DoubleSide` already did.
- ~~Swap `MeshStandardMaterial` → `MeshLambertMaterial`.~~ **Superseded.** Lambert
  was the right first move (Phase 1) but it was still solving the wrong problem.
  The surface is only ever seen from *one side*, from *below*, which admits a much
  cheaper and much more accurate answer than any general-purpose lit material —
  see §2.4a.
- **Do not shrink the plane.** ~~200×200 is plenty~~ — this was wrong on closer
  inspection. It looks like free triangles (8,192 → 2,048) but that is 0.5% of
  the frame's geometry, and the camera can sit ~118 units from the origin
  (shark clamped to a ±77 box → 109 on the diagonal, plus an 8.5-unit chase
  offset). Pull the edge in to r=100 and the water visibly *stops* ten units from
  the camera, well inside fog range. The win here is entirely fragment-side.

### 2.4a Why the water read as fresh water — and why the fix is also faster

The Phase 1 water was `MeshLambertMaterial`, colour `0x63c6ee`, evenly lit in
every direction. That is a *swimming pool*: bright cyan, uniform, lit from all
sides, white floor two metres down, nothing dark to reflect. No colour tweak
fixes it, because the tell is not the colour — it is the **evenness**.

An open-ocean surface seen from underneath is governed by two things:

| | |
|---|---|
| **Snell's window** | Light from the entire sky refracts into a cone ~48.6° wide directly overhead. Inside it you see through the surface. |
| **Total internal reflection** | Outside that cone the surface is a **mirror**, and the only thing down here to reflect is the dark deep. |

So a real surface is a bright, shimmering patch overhead that falls off to
near-black toward the horizon. Both terms come out of *one* number — the angle
between the surface normal and the direction to the camera — which makes the
honest version **cheaper than the Lambert it replaces**: no light loop, no PBR
includes, one dot product.

The ripple detail is normal-only. Two extra sine octaves perturb the shading
normal without displacing a single vertex, and because the window/mirror falloff
is driven entirely by that normal, ripple you can actually *see* costs two sines
rather than a denser mesh.

Also shifted off cyan, since these three set the mood far more than the surface
plane does: `DEEP_COLOR` 0x0d3b52 → **0x0a3149** (hue 200° → 207°, darker), and
the backdrop gradient 0x3f9fcc/0x03121e → **0x256d94/0x020a11**.

### 2.5 Particle sprite fill cost

2,300 blended points ([config.js:339-343](src/config/config.js#L339-L343)). The count
itself is cheap (3 draw calls, GPU-animated — that part is already well done).
The cost is **fill**: a bubble at `size: 0.55` with attenuation, one metre from
the camera, covers a large screen area, blended, with no depth write.

- Cut `bubbles` 800 → ~350 and `snow` 1350 → ~700 and compare screenshots. The
  particles that matter are the near ones; the far ones are fog.
- Consider fading particle alpha to zero within ~1.5 m of the camera in the
  vertex shader — the near ones are the expensive ones *and* the ones that read
  as screen dirt.
- These should be part of the quality tier system (§7).

### 2.6 Sand texture anisotropy

[terrain.js:66](src/terrain.js#L66) uses `getMaxAnisotropy()` = **16** on both the
albedo *and* the normal map of a plane that fills the lower half of the screen.
That is up to 32 texture taps per fragment at grazing angles.

Drop to **4**. On a fogged seabed the difference is not visible; the bandwidth
saving is real.

### 2.7 Cheaper materials

Every prop, fish and creature material comes out of GLTFLoader as
`MeshStandardMaterial` — full Cook-Torrance PBR against 3 lights
([core.js:48-59](src/core.js#L48-L59)), with `metalness` forced to 0 anyway
([loader.js:65](src/loader.js#L65)) and no environment map.

For the seabed props specifically, converting to **`MeshLambertMaterial`**
(vertex lighting) or `MeshPhongMaterial` cuts fragment ALU substantially for a
difference you will struggle to see through fog on rock and foliage. Keep
`MeshStandardMaterial` for the shark and the seabed (which carries the caustics
shader); downgrade the ~1.4 M triangles of scenery.

Worth prototyping on one row (`seagrass`) and A/B-ing a screenshot.

---

## 3. Tier 2 — geometry, culling, draw calls

### 3.1 Re-enable frustum culling

[loader.js:56](src/loader.js#L56) sets `o.frustumCulled = false` on **every mesh
of every model**, and [props.js:192](src/props.js#L192) does the same for every
`InstancedMesh`. Net effect: **the entire world is submitted every frame,
including everything behind the camera.** With a 60° FOV you are drawing roughly
4× what you can see.

The comments give real reasons, but both are over-broad:

- **Skinned meshes** (loader.js) genuinely deform outside their bind-pose bounds —
  but the fix is `mesh.geometry.boundingSphere.radius *= 1.5` once at load, not
  disabling culling forever. Apply the blanket `frustumCulled = false` **only when
  `o.isSkinnedMesh`**, and even then prefer an inflated sphere.
- **`InstancedMesh`** (props.js) spans the world, so its bounding sphere really
  does cover everything — which is why the answer is chunking (§3.3), not
  disabling culling.

**Expected: 40–70% fewer triangles and draw calls submitted**, purely from not
drawing what is behind you.

### 3.2 Backface culling — `DoubleSide` on everything

[loader.js:58](src/loader.js#L58) forces `mat.side = THREE.DoubleSide` on every
material of every loaded model. Every one of the 1.4 M prop triangles is
rasterised twice, and on a TBDR every one is binned twice.

Which models genuinely need it is a question with a real answer, not a guess.
Auditing the `.glb` index buffers — **welded by position first**, because these
models are flat-shaded and split vertices at every hard edge, which makes a naive
index-based test report 80% "boundary edges" on a solid boulder — gives:

| Model | Boundary edges | Where the holes are | Verdict |
|---|---|---|---|
| `kelp-tall`, `seaweed`, `rock-cluster`, `rock-large`, `pebbles`, `fish-bones` | 0% | — | closed, `FrontSide` |
| `mountain`, `rock-boulder`, `grass`, `kelp`, `Seaweed-3` | 2–12% | **100% in the bottom 10% of height** | open *base*, buried in sand → `FrontSide` |
| `log` | 2.1% | log ends, 10 edges | `FrontSide` |
| `sea-anemone` | 2.0% | mid-height (tentacle tips) | `FrontSide`, low risk |
| `fern` | 31.6% | everywhere | genuine alpha cards → `DoubleSide` |
| `kelp-2` | 0% but **47% inconsistent winding** | — | culling punches holes → `DoubleSide` |
| all animals | 5–31% | fins | fins are cards → `DoubleSide` |

The surprise is that `grass`, `kelp`, `seaweed` and `Seaweed-3` are *not* cards —
they are modelled solids with an open bottom. Only `fern` really is foliage
geometry. The animals keep `DoubleSide` regardless: they total ~40k triangles, so
there is nothing to win and a visibly finless dolphin to lose.

Make it a per-model flag in `MODELS`, defaulting to `false`:

```js
boulder: { url: '…', targetSize: 6.0, rotY: 0, anchorBottom: true },
fern:    { url: '…', targetSize: 3.4, rotY: 0, anchorBottom: true, twoSided: true },
```

**Measured result: 1,287,814 of the 2,751,004 rasterised prop triangles removed —
a 47% cut, from four lines of config.**

### 3.3 Chunk the instanced props spatially

Right now each `PROPS` row is one `InstancedMesh` covering r=0..115, so culling
can only ever be all-or-nothing (hence §3.1's workaround).

Split each row into a **grid of ~40×40-unit cells**, one `InstancedMesh` per
non-empty cell, and let three's normal frustum culling do its job. Each cell has
a tight bounding sphere, so with a 60° FOV and ~100 units of fog visibility you
draw maybe 20–30% of the cells.

Draw calls go up (~24 → ~80–120) but each is tiny, and submitted triangles fall
by 3–5×. On a modern GPU that is a very good trade. Combine with §3.4 so distant
cells are dropped entirely.

### 3.4 Distance culling matched to the fog

`FOG_DENSITY = 0.0135` ([config.js:26](src/config/config.js#L26)). `FogExp2` transmittance
is `exp(-(d·density)²)`:

| Distance | Visible contribution |
|---|---|
| 75 u | 36% |
| 100 u | 16% |
| 120 u | 7.6% |
| 150 u | 1.6% |

Anything past ~130 units is contributing under 5% of its colour and is not worth
a single triangle. Yet the canopy rows sit at **r=80..115**
([config.js:178-180](src/config/config.js#L178-L180)) — 293 instances, 417k triangles,
mostly invisible, *and* they are in the per-frame CPU sway rebuild.

Options, cheapest first:
- **Hard-cull cells beyond ~130 units** from the camera (falls out of §3.3 for free).
- ~~Set `camera.far` from 500 → ~200.~~ **Do not do this** — it was a depth-precision
  aside, not a performance win, and as written it breaks the sky. The backdrop
  sphere is world-centred at radius 320, and the camera can sit ~118 units from
  the origin, so the far side of the backdrop is ~438 units away. Any `far` below
  ~450 clips a hole in the water column. Nothing in the scene is beyond the
  current far plane anyway, so it culls nothing and costs nothing to leave at 500.
  Reducing it *would* require making the backdrop camera-following and retuning
  its gradient (which is calibrated to radius 320) — a visual change with no
  measurable payoff. Skipped deliberately.
- The canopy rows exist for **silhouette through haze**. Replace them with a
  cheap billboard/impostor band — a handful of textured quads — instead of 293
  full kelp meshes. Same read, ~1% of the cost.

### 3.5 Decimate the three over-budget source models

Not code — asset work, in Blender or `gltf-transform`:

| Model | Now | Target | Saves |
|---|---:|---:|---:|
| `kelp-tall.glb` | 3,440 tris, **21 primitives**, 2 materials | ~600 | ~390k tris |
| `Seaweed-3.glb` | 1,832 tris, 3 primitives/materials | ~350 | ~245k tris |
| `sea-anemone.glb` | 2,617 tris | ~500 | ~87k tris |

Collapsing `Seaweed-3` and `grass` to **one material each** also matters: the
loader only merges when `meshNodes > 3` ([loader.js:49](src/loader.js#L49)), so
`Seaweed-3` (3 nodes) and `grass` (2 nodes) skip merging and cost 3× and 2× the
draw calls *and* 3× and 2× the per-frame sway matrix writes.

**Combined saving: ~720k triangles — roughly half the frame.**

Pipeline: `gltf-transform weld → simplify → dedup → prune`, then Draco or
meshopt compression.

### 3.6 LOD for the mountains and large props

23 mountains × 779 tris is only 18k, so this is low priority for triangles — but
`THREE.LOD` (or a simple two-tier instanced swap at ~60 units) is the standard
answer once §3.3 chunking is in place, and it generalises to the rock rows.

### 3.7 Small draw-call cleanups

- **Orbs** ([orbs.js:23-58](src/orbs.js#L23-L58)): 12 meshes each with their own
  `MeshStandardMaterial` + 12 sprites each with their own `SpriteMaterial`.
  Share one material for all orbs and one for all halos → 24 draw calls with 24
  materials becomes 24 draw calls with 2 materials (fewer state changes), or 2
  draw calls if you instance them. `SphereGeometry(0.5, 16, 16)` → `(0.5, 12, 8)`
  saves 4k tris for no visible difference at that scale.
- **Backdrop sphere** ([core.js:31](src/core.js#L31)): radius 320 with
  `camera.far = 500`. If `far` drops to 200 (§3.4), this must shrink too.
  `SphereGeometry(180, 16, 12)` is ample for a two-colour gradient.

---

## 4. Tier 3 — CPU work per frame

### 4.1 Move the foliage sway to the GPU (the big one)

[props.js:215-224](src/props.js#L215-L224) — `updateSway()` rebuilds
**1,574 instance matrices every frame** and flags **16 `instanceMatrix` buffers
for re-upload**. Each matrix is an Euler→quaternion→`Matrix4` compose plus a 4×4
multiply plus a `setMatrixAt`.

This is pure waste. The sway is a closed-form function of `(time, phase, amp)` —
exactly like the water ripple and the particles, which you have **already** moved
to the vertex shader ([water.js:21-31](src/water.js#L21-L31),
[particles.js:42-53](src/particles.js#L42-L53)). Apply the same technique here.

**Plan:**
1. Bake `phase` and `amp` into two `InstancedBufferAttribute`s, uploaded once.
2. Write the instance matrix once at build time with sway = 0.
3. Inject into the material's vertex shader via `onBeforeCompile`, bending
   `transformed` around the instance origin, weighted by height above the base
   (so the root stays planted and the tip moves most — which will actually look
   *better* than the current rigid-body rotation):

```glsl
// after #include <begin_vertex>, inside the instanced vertex shader
float h = clamp(transformed.y / uPropHeight, 0.0, 1.0);
float bend = h * h * aAmp;
transformed.x += sin(uTime * 0.80 + aPhase)       * bend;
transformed.z += cos(uTime * 0.62 + aPhase * 1.3) * bend * 0.7;
```

**Result: 1,574 matrix composes and 16 buffer uploads per frame → zero.**
`updateSway()` is deleted from `updateWorld()`. Also set
`inst.instanceMatrix.setUsage(THREE.StaticDrawUsage)` once the matrices stop
changing.

Estimated 2–4 ms/frame of main-thread time recovered, plus the GL sync stalls
from re-uploading buffers mid-frame.

### 4.2 Spatial hash for collision

[collision.js:51-82](src/collision.js#L51-L82) — `resolveSolids()` linearly scans
**all 150 solids** on every call. Callers per frame:

| Caller | Queries |
|---|---:|
| Shark body ([shark.js:98](src/shark.js#L98)) | 3 (`BODY_SAMPLES`) |
| Chase camera ([shark.js:145](src/shark.js#L145)) | 1 |
| Creatures ([creatures.js:236](src/creatures.js#L236)) | 6 × 3 = 18 |
| Shoal centres ([fish.js:195](src/fish.js#L195)) | ~11 |
| Every individual fish ([fish.js:219](src/fish.js#L219)) | ~64 |
| **Total** | **~98 × 150 = 14,625 iterations** |

Solids are static and known at build time. Bucket them into a **uniform grid**
(cell ≈ 16 units, keyed `x|z`, each solid inserted into every cell its base
radius touches). A query then tests ~4 cells' worth — typically 2–6 solids
instead of 150.

**~14,600 iterations → ~500.** Roughly 1–2 ms/frame.

Cheap partial win if you want it in five minutes: sort `solids` by `base` and
early-out, or precompute `rBase²` to skip the per-iteration multiply. But the
grid is the right answer and is maybe 30 lines.

### 4.3 Throttle and gate the AnimationMixers

22 `AnimationMixer`s tick every frame ([fish.js:235](src/fish.js#L235),
[creatures.js:242](src/creatures.js#L242), [shark.js:119](src/shark.js#L119)).
Each does keyframe interpolation, writes bone transforms, then
`Skeleton.update()` recomputes every bone matrix and uploads a bone texture.

Two gates:
- **Distance gate.** Skip `mixer.update()` for anything beyond ~50 units — you
  cannot see a clownfish's tail beat through fog at 50 m. Skip entirely beyond
  fog range.
- **Rate gate.** Update distant rigs at 20–30 Hz instead of 60 by accumulating
  `dt` and calling `mixer.update(accumulated)` every 2nd or 3rd frame. Skinning
  interpolation hides the stutter completely at distance.

Only the shark needs a guaranteed every-frame update.

**Realistically 22 mixers → 4–8 active.**

### 4.4 Reduce scene-graph traversal cost

`renderer.render()` calls `scene.updateMatrixWorld()`, which walks every node.
Current node count is high: ~64 fish, each a cloned wrapper → rotGroup →
centerGroup → model → mesh (5+ nodes), and the 15 skinned species fish each drag
a full bone hierarchy behind them.

- Set `matrixAutoUpdate = false` on everything static (all `InstancedMesh`es, the
  seabed, water, backdrop, god rays) and call `updateMatrix()` once at build.
- Flatten the fish clone hierarchy. The loader's wrapper→rot→center→model chain
  ([loader.js:91-101](src/loader.js#L91-L101)) exists to normalise scale and
  orientation — bake that transform **into the geometry** at load
  (`geometry.applyMatrix4`) so each fish is one node instead of five.
- Set `scene.matrixWorldAutoUpdate = false` and drive updates yourself if you
  want full control (advanced; do the two above first).

### 4.5 The generic bait fish should be instanced

~49 of the 64 fish are the same untextured `fish.glb` at different scales
([fish.js:135](src/fish.js#L135)), animated by a **procedural roll**
([fish.js:232-234](src/fish.js#L232-L234)) — no skeleton involved.

They are perfect `InstancedMesh` candidates: **49 draw calls and 49 scene nodes →
1 draw call and 1 node.** Write their matrices from the existing shoal maths into
one `instanceMatrix` (or, better, push position+heading into instanced attributes
and do the tail-flick roll in the vertex shader, so even the matrix writes go
away).

Only the 15 skinned species fish must stay as individual nodes.

### 4.6 Avoid re-allocating `Audio` elements

[audio.js:24-29](src/audio.js#L24-L29) — `playOnce()` constructs a **new `Audio()`
per shot**, which re-decodes the file each time and leaves the element for GC.
Pool 2–3 elements per sound and rewind them (`el.currentTime = 0; el.play()`).

Minor for frame time, but each decode spins up a browser audio thread — and you
reported *all* cores loaded, which multi-threaded decode contributes to.

### 4.7 Frame-loop hygiene

[main.js:30-38](main.js#L30-L38) is already clean (clamped `dt`, single
shared `uTime`). Two additions:

- **Pause when hidden.** `document.visibilitychange` → stop the RAF loop and
  pause audio. A backgrounded tab currently still runs the full simulation.
- Consider an optional fixed-timestep cap for the simulation on very fast
  displays, though at 60 Hz this is not currently an issue.

---

## 5. Tier 4 — load time and memory

None of this affects steady-state fps, but "runs smoothly on any hardware"
includes not stalling for 30 seconds on a slow connection.

### 5.1 `whale_sound.mp3` is 19.7 MB — 76% of your entire payload

616 seconds (10:17) of 256 kbps stereo, used as a background ambience loop
([config.js:358](src/config/config.js#L358)).

- Trim to a 30–45 s seamless loop.
- Re-encode mono at 96 kbps (it is ambient, positioned nowhere).
- **19.7 MB → ~0.4 MB.**

### 5.2 `shark_drop_into_ocean.wav` is 1.2 MB of 24-bit PCM

A 4.2-second one-shot at 2.3 Mbps. Encode to mp3/ogg at 128 kbps → ~65 KB.

Combined, §5.1 + §5.2 take the audio folder from 23 MB to under 1.5 MB.

### 5.3 Compress the geometry

24 uncompressed GLBs, 2.9 MB. Run everything through `gltf-transform`:

```
gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp
```

Add `DRACOLoader` to [loader.js](src/loader.js). Expect 60–80% smaller, and Draco
decode runs off-thread in a worker.

### 5.4 Textures

`fern.glb` carries 0.65 MB of texture for a 288-triangle leaf card. Convert all
GLB textures to **KTX2/Basis** (`KTX2Loader`) — GPU-native compressed formats
stay compressed in VRAM, unlike PNG/JPEG which decompress to full RGBA.

### 5.5 Bundle the app

[pages/game/game.html](pages/game/game.html) pulls three from jsDelivr via importmap, and
`src/` ships as 18 unminified ES modules. That is ~20 sequential-ish HTTP requests
before the first frame. A Vite build (tree-shaken, minified, single chunk) cuts
both the request count and the parse time meaningfully.

### 5.6 Sand texture generation blocks the main thread

[terrain.js:44-62](src/terrain.js#L44-L62) runs a 512×512 double loop with a
`Math.random()` per pixel, twice (albedo + normal) — 262,144 iterations of
trigonometry and `Math.hypot`. That is a visible hitch during load.

Either move it to an `OffscreenCanvas` in a worker, generate it in a fragment
shader to a render target, or just ship it as a small pre-baked KTX2 texture.

---

## 6. Additional wins worth checking

- **Shader program count.** `customProgramCacheKey` is used correctly
  ([materials.js:49](src/materials.js#L49), [water.js:31](src/water.js#L31),
  [particles.js:54](src/particles.js#L54)), but each prop row clones its material
  ([props.js:173](src/props.js#L173)), so verify `renderer.info.programs.length`
  is not larger than you expect. Every unique program is a compile stall the
  first time it is drawn.
- **Shader warm-up.** Call `renderer.compile(scene, camera)` after `buildWorld()`,
  before the start screen is dismissed. Otherwise the first few seconds of
  gameplay stutter as each material compiles on first use.
- **Tone mapping.** `ACESFilmicToneMapping` ([core.js:15](src/core.js#L15)) adds a
  matrix multiply and a rational polynomial per fragment. Cheap in isolation, not
  cheap multiplied by every blended layer. Test `LinearToneMapping` with the
  exposure retuned once §2 is done.
- **Light count.** 3 lights ([core.js:48-57](src/core.js#L48-L57)) against
  `MeshStandardMaterial` means 3 full BRDF evaluations per fragment. The `fill`
  directional at 0.35 intensity is a candidate to fold into the hemisphere
  light's ground colour.
- **Sprite scaling.** [orbs.js:72](src/orbs.js#L72) calls `orb.scale.setScalar()`
  each frame, which propagates to the child halo sprite. Harmless but worth
  knowing when reading the profile.

---

## 7. Quality tiers — the actual "runs on any hardware" answer

Once the above lands, expose a settings object driven by a startup benchmark
(render 30 frames, measure, pick a tier) with a manual override in the HUD.

| Setting | Low | Medium | High |
|---|---|---|---|
| Pixel ratio cap | 0.75 | 1.25 | 2.0 |
| Antialiasing | off | FXAA | FXAA |
| God rays | 0 | 6 | 12 |
| Bubbles / snow | 150 / 300 | 350 / 700 | 800 / 1350 |
| Prop draw distance | 70 u | 100 u | 130 u |
| Canopy rows (r>80) | off | impostors | impostors |
| Fish schools | 4 | 7 | 10 |
| Skinned species fish | 0 | 9 | 24 |
| Mixer update rate | 15 Hz | 30 Hz | 60 Hz |
| Prop materials | Lambert | Lambert | Standard |
| Sand anisotropy | 1 | 4 | 8 |

Layer dynamic resolution (§2.2) **on top** of the tier, so even a mistuned tier
holds 60 fps.

---

## 8. Recommended order of work

Ordered by (impact ÷ effort). Measure after each step — several of these overlap,
and you may hit target before finishing.

### Phase 1 — ✅ IMPLEMENTED

| # | Change | Files | Status |
|---|---|---|---|
| 0 | F3 perf readout (fps / ms / CPU ms / draw calls / tris / dpr; Phase 2 added visible-chunk count) — **§1** | [main.js](main.js), [hud.js](src/hud.js), [game.html](pages/game/game.html), [game.css](pages/game/game.css) | added |
| 1 | Pixel ratio cap 2.0 → **1.5**, `antialias: false`, `stencil: false`, `powerPreference` — **§2.1** | [core.js](src/core.js#L11) | done |
| 2 | `DoubleSide` → per-model `twoSided` flag, default `FrontSide` — **§3.2** | [config.js](src/config/config.js), [loader.js](src/loader.js#L58) | done |
| 3 | Frustum culling re-enabled for all non-skinned meshes — **§3.1** | [loader.js](src/loader.js#L56) | done |
| 4 | God rays 30 → **10**, `DoubleSide` → `FrontSide` — **§2.3** | [config.js](src/config/config.js), [godrays.js](src/godrays.js#L14) | done |
| 5 | Water `DoubleSide` → `BackSide`, Standard → **Lambert** — **§2.4** | [water.js](src/water.js#L16) | done (size unchanged, see §2.4) |
| 6 | Sand anisotropy 16 → **4** — **§2.6** | [terrain.js](src/terrain.js#L66) | done |
| 7 | Bubbles 800 → **350**, snow 1350 → **700** — **§2.5** | [config.js](src/config/config.js) | done |
| 8 | ~~`camera.far` 500 → 200, backdrop 320 → 180~~ — **§3.4** | — | **skipped — would clip the sky, see §3.4** |

Measured effect of the above:

| | Before | After |
|---|---:|---:|
| Pixel samples / frame (1440×900 logical) | 20.7 M | **2.9 M** (−86%) |
| Prop triangles *rasterised* | 2,751,004 | **1,463,190** (−47%) |
| Blended god-ray layers | 30 | **10** |
| Blended particle sprites | 2,300 | **1,200** |
| Frustum-culled objects | ~0 | all non-skinned (49 bait fish, orbs, props excepted) |
| Sand texture taps / fragment | up to 32 | up to 8 |

Note that **prop triangles *submitted* are unchanged at 1.38 M** — the props are
still one world-spanning `InstancedMesh` per row with culling off, which only
§3.3 chunking fixes. Phase 1 is overwhelmingly a *fill-rate* fix.

### Phase 2 — ✅ IMPLEMENTED

Phase 1 was a fill-rate fix and it worked: CPU dropped a long way. But the GPU
was still pegged, and the reason was the metric Phase 1 explicitly did *not*
move — **prop triangles submitted stayed at 1.38M**, because every row was one
world-spanning `InstancedMesh` with culling switched off. So Phase 2 pulled §3.3
and §2.7 forward out of Phase 3 (they are the actual GPU wins) and left the
asset-pipeline work behind.

| # | Change | Files | Status |
|---|---|---|---|
| 9 | GPU vertex-shader sway; `updateSway()` deleted — **§4.1** | [props.js](src/props.js) | done |
| 10 | Uniform-grid spatial hash for collision — **§4.2** | [collision.js](src/collision.js) | done |
| 11 | Distance + rate gating on AnimationMixers — **§4.3** | [mixers.js](src/mixers.js), [fish.js](src/fish.js), [creatures.js](src/creatures.js) | done |
| 12 | Spatial chunking of the instanced props — **§3.3** (was Phase 3) | [props.js](src/props.js) | done |
| 13 | Distance culling matched to the fog — **§3.4** (was Phase 3) | [props.js](src/props.js), [config.js](src/config/config.js) | done |
| 14 | God rays → one `InstancedMesh`, vertex billboard, distance fade — **§2.3** (was Phase 3) | [godrays.js](src/godrays.js) | done |
| 15 | Prop materials Standard → Lambert — **§2.7** (was Phase 3) | [props.js](src/props.js) | done |
| 16 | Water → single-sided ocean shader — **§2.4a** | [water.js](src/water.js) | done |
| 17 | Orb + halo material sharing, sphere 16×16 → 12×8 — **§3.7** | [orbs.js](src/orbs.js) | done |
| 18 | `renderer.compile()` warm-up before the start screen — **§6** | [world.js](src/world.js) | done |
| 19 | Pause the loop + audio when the tab is hidden — **§4.7** | [main.js](main.js), [audio.js](src/audio.js) | done |
| 19a | Hard 60 fps cap (`PERF.targetFps`) — **§4.7** | [main.js](main.js), [config.js](src/config/config.js) | done |
| 20 | Pooled one-shot `Audio` elements — **§4.6** | [audio.js](src/audio.js) | done |
| 21 | `matrixAutoUpdate = false` on all static scenery — **§4.4** | [terrain.js](src/terrain.js), [water.js](src/water.js), [core.js](src/core.js), [props.js](src/props.js) | done |
| — | Decimate `kelp-tall` / `Seaweed-3` / `sea-anemone` — **§3.5** | — | **not done** — asset work, see below |
| — | Instance the 49 generic bait fish — **§4.5** | — | **not done**, see below |
| — | Trim `whale_sound.mp3`, re-encode the splash WAV — **§5.1, §5.2** | — | whale re-encoded by hand (19.7 MB → 9.9 MB); splash WAV untouched |

#### Measured effect

Prop geometry was measured by parsing the real `.glb` accessors and replaying
`props.js`'s own chunking over 20,000 randomised camera poses:

| | Phase 1 | Phase 2 |
|---|---:|---:|
| Prop triangles **submitted** / frame | 1,375,502 | **578,696** (−58%) |
| Prop draw calls | 24 (uncullable) | 118 of 311 chunks (cullable) |
| God-ray draw calls / materials | 10 / 10 | **1 / 1** |
| CPU sway matrices / frame | 1,574 | **0** |
| `instanceMatrix` re-uploads / frame | 16 | **0** |
| Collision candidate tests / frame | 14,550 | **1,551** (9.4× fewer) |
| Mixers ticked at 60 Hz | 22 | 1 + whatever is within 45 u |
| Orb materials | 24 | **2** |
| Backdrop triangles | 1,024 | 528 |

Measured in-game after the above, mid-reef on an M1 Air at 1.5× DPR:

```
208 fps   4.8 ms/frame
cpu 0.2 ms (updateWorld)
187 draw calls   0.60M tris
props 111/314 chunks
dpr 1.5   20 programs   318 geo
```

That is the goal met and then some — 4.8 ms against a 16.67 ms budget, so the GPU
went from pegged to roughly a quarter loaded, and `updateWorld` is 0.2 ms (it was
the 1,574 matrix composes). 0.60M triangles and 111 of 314 chunks drawn both land
within a few percent of the offline model, which is the useful part: the model can
now be trusted to predict the effect of the Phase 3 items.

**Hence the 60 fps cap** (item 19a). Running at 208 fps on a 120 Hz panel is a
full GPU frame of work per callback for zero benefit — the simulation is
time-based, so extra frames buy no responsiveness, only heat and battery.

Two numbers deserve a note, because both are *worse* than this document
originally projected and the projections were the optimistic ones:

- **Collision: 1,551 candidate tests, not the ~500 projected.** The projection
  assumed uniform footprints. It ignored the mountains, whose colliders reach 25
  units and therefore occupy ~4×4 cells each, and the shoal-centre queries, whose
  5-unit radius spans a 3×3 block. Still a 9.4× cut, verified against a
  brute-force scan over 300k randomised queries.
- **Props: 58%, not the 3–5× (70–80%) projected.** The projection assumed culling
  would remove everything outside a 60° frustum. Real horizontal FOV at 16:9 is
  **91°**, not 60 — that alone is a quarter of the world rather than a sixth — and
  a chunk sphere is admitted whenever it *touches* the frustum, so the boundary
  chunks all get drawn. The `chunkTriangles` budget was swept rather than guessed;
  the curve and the chosen point are tabulated in [config.js](src/config/config.js).

#### Two Phase 2 items deliberately not done

**§3.5 asset decimation** (~720k triangles, half the frame) is the single largest
remaining win and it is not code — it needs `gltf-transform weld → simplify →
dedup → prune` on three models, then eyeballing the result. Worth doing next.

**§4.5 instancing the bait fish** is a draw-call and scene-node win (49 → 1), not
a fill or vertex win, and this scene is not draw-call bound: 118 prop chunks are
already cheap. It restructures `fish.js` around a shared matrix buffer for a
metric that is not currently hurting, so it was skipped in favour of §3.3.

### Phase 3 — polish and scalability

22. Decimate the three over-budget models — **§3.5** ← *do this first*
23. Dynamic resolution scaling — **§2.2**
24. Canopy rows → billboard impostors — **§3.4**
25. Instance the 49 generic bait fish — **§4.5**
26. Draco + KTX2 + Vite build — **§5.3, §5.4, §5.5**
27. Quality tier system + startup benchmark — **§7**
28. `LinearToneMapping` A/B now that the blended layers are thinner — **§6**

---

## 9. Where things stand

Measured, not projected, except the last column:

| Metric | Baseline | After Phase 1 | After Phase 2 | Phase 3 target |
|---|---:|---:|---:|---:|
| Pixels shaded / frame | 5.2 M × 4 MSAA | 2.9 M × 1 | 2.9 M × 1 | adaptive 1.3–5.2 M |
| Prop triangles submitted | 1.38 M | 1.38 M | **579 k** | ~250 k |
| Prop triangles rasterised | 2.75 M | 1.46 M | **~610 k** | ~270 k |
| Prop draw calls | 24 (uncullable) | 24 (uncullable) | 118 (cullable) | ~90 |
| God-ray draw calls | 30 | 10 | **1** | 1 |
| CPU sway matrices / frame | 1,574 | 1,574 | **0** | 0 |
| Collision tests / frame | 14,550 | 14,550 | **1,551** | 1,551 |
| Mixers at 60 Hz | 22 | 22 | **1–8** | 1–8 |
| Payload | 26 MB | 26 MB | 16 MB | ~5 MB |

Phase 1 was a pure fill-rate fix (−86% samples). Phase 2 is the geometry and
CPU-structure fix: the two things Phase 1 explicitly left on the table were prop
triangles submitted and the 1,574 per-frame matrix composes, and both are now
gone. Everything left in Phase 3 is either asset work (§3.5, §5.3–5.5) or
scalability rather than raw speed (§2.2, §7).

**If the GPU is still pegged after Phase 2**, the next measurement to take is §1
step 4 again — `setPixelRatio(0.5)` for one run:

- **fps recovers** → still fill-bound. That points at the blended layers, which
  Phase 2 barely touched: 1,200 particle sprites, 10 god-ray shafts and the water
  plane. Turn each off in isolation (`PARTICLES` counts, `GOD_RAYS.count`, comment
  out `createWater()`) and watch the ms/frame on the F3 readout. Then §2.2.
- **fps unchanged** → now vertex/CPU bound, and §3.5 is the whole answer: three
  models account for ~720k of the remaining triangles.
