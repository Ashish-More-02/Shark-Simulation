# Graphics performance from first principles

No jargon until it is earned. Every term is defined the first time it appears, and
every section ends with **what this means for this game**, pointing at real numbers
from [PERFORMANCE.md](../../PERFORMANCE.md) and real lines in `src/`.

Read it top to bottom once. After that it is a reference — §11 is a one-page
cheat sheet you can come back to.

---

## 1. The only rule: a frame is a deadline

Your game draws a picture, throws it at the screen, and starts the next one. At
60 frames per second you get:

```
1 second / 60 frames = 16.7 milliseconds per frame
```

**16.7 ms is the entire budget.** Everything has to fit inside it: reading input,
moving the shark, running the fish AI, checking collisions, animating 22 creatures,
*and* drawing 1.4 million triangles. Go over and you don't get "slightly slower" —
you miss the deadline, the screen shows the old picture again, and the player sees
a stutter. 17 ms of work gives you 30 fps, not 59.

That's why performance work is *budgeting*, not "making things fast". You have
16.7 ms to spend. Every effect has a price. The job is knowing the prices.

> At 30 fps the budget is 33 ms. Consoles often target that. For a game where you
> steer a shark with a mouse, 60 is the right target — camera motion is where low
> frame rates feel worst.

---

## 2. Two computers, not one

Your game runs on two completely different processors that have to cooperate.

**The CPU** is the manager. It runs your JavaScript: where the shark is, which fish
is scared, what collided with what. It is smart, flexible, and does one thing at a
time (per core).

**The GPU** is the factory. It does one dumb thing — colour in pixels — but does
thousands of them simultaneously. It cannot run your game logic. It only draws.

They talk through a narrow channel. The CPU sends **work orders**; the GPU fills
them. The technical name for one work order is a **draw call**.

```
   CPU (your JS)                          GPU (the factory)
   ┌──────────────────┐   draw calls      ┌────────────────────┐
   │ move shark       │ ────────────────► │ transform vertices │
   │ update fish AI   │  "draw this mesh  │ rasterise triangles│
   │ collision checks │   with that       │ shade every pixel  │
   │ decide what to   │   material"       │ blend, write out   │
   │ draw             │ ◄──────────────── └────────────────────┘
   └──────────────────┘   (almost nothing
                           comes back)
```

Three consequences that explain almost everything:

1. **They run at the same time, but out of step.** The CPU is usually building
   frame N+1 while the GPU is still drawing frame N. Your real frame time is
   `max(CPU time, GPU time)`, not the sum.
2. **Whichever is slower sets your frame rate.** If the GPU takes 20 ms and the CPU
   takes 4 ms, you are **GPU-bound** — and optimising JavaScript changes nothing at
   all. Reverse it and you are **CPU-bound**. *Fixing the wrong one is the single
   most common wasted week in graphics work.*
3. **Asking the GPU a question is poison.** Anything that makes the CPU wait for an
   answer (reading pixels back, some `getParameter` calls) forces the two back into
   lockstep and can cost milliseconds.

**What this means for this game:** [PERFORMANCE.md](../../PERFORMANCE.md#L5) measured
"GPU pegged at ~100%". You are GPU-bound. That is why the roadmap's C++/WebAssembly
notes in [optimisation.md](../systems/optimisation.md) — all CPU-side ideas — would not have
moved your frame rate at all *at that moment*. They matter later, when streaming ten
levels puts real load on the CPU.

---

## 3. What the GPU actually does with a draw call

One draw call is a small assembly line. Five stations, in order.

```
 vertices ──► [1 vertex shader] ──► [2 assemble triangles] ──► [3 rasterise]
                                                                    │
                    screen ◄── [5 blend & write] ◄── [4 fragment shader]
```

**1. Vertex shader** — a tiny program that runs **once per corner point**. Its job
is to take a vertex in the model's own space and work out where it lands on screen.
Anything you can compute per-corner belongs here, because there are far fewer
corners than pixels. Your water ripple lives here on purpose
([water.js](../../src/water.js) — it used to be a CPU loop rewriting 4,225 vertices
every frame), and so does the god-ray billboarding
([godrays.js](../../src/godrays.js)).

**2. Triangle assembly** — corners get grouped into triangles. Everything in
real-time 3D is triangles. A "1,832-triangle seaweed blade" means 1,832 of these.

**3. Rasterisation** — the GPU works out which screen pixels each triangle covers.
Each covered pixel becomes a **fragment**: a candidate colour for that pixel.

**4. Fragment shader** (also called the pixel shader) — a tiny program that runs
**once per fragment** to decide its colour. Lighting, texture lookups, fog, all of
it. This is where the vast majority of GPU time goes in most games, because there
are so many fragments.

**5. Blend and write** — the fragment either replaces what's in that pixel, or gets
mixed with it (see §5), or gets thrown away because something is already in front of
it.

### The two ends of the pipe

That gives you the two ways a scene can be expensive, and they are different problems
with different fixes:

| | Called | Scales with | You fix it by |
|---|---|---|---|
| **Geometry cost** | vertex-bound | how many triangles you submit | fewer/simpler models, LOD, culling |
| **Fill-rate cost** | fragment-bound | how many pixels you paint | lower resolution, less overdraw, cheaper shaders |

A single triangle covering the whole screen is nearly free on geometry and brutal on
fill. A million triangles on a distant, ten-pixel-wide object is the reverse. Knowing
which one is hurting you is the entire diagnosis.

**What this means for this game:** you are **fill-rate bound**, mostly. 2880×1800
pixels, painted several times over by transparent layers. §5 is your section.

---

## 4. The four budgets

Everything you'll ever tune falls into one of four buckets.

### Budget 1 — Draw calls (a CPU cost)

Each draw call costs the CPU a fixed amount of setup: validate state, bind buffers,
talk to the driver. That cost is paid **whether the object is one triangle or a
million**. A thousand tiny rocks as a thousand draw calls is far worse than one rock
with a thousand times the geometry.

Two tools reduce them:

- **Instancing** — "draw this one kelp mesh 220 times, here are 220 positions". One
  work order, 220 kelp. Three.js calls this `InstancedMesh`, and it is why
  [props.js](../../src/props.js) and [godrays.js](../../src/godrays.js) use it.
- **Batching / sharing materials** — objects that share the same material can often
  be merged. Every distinct material is at minimum a separate draw call, because
  switching material means reconfiguring the factory.

Rough scale, browser: a few hundred draw calls is comfortable, ~1,000–2,000 is where
you start feeling it, 5,000+ is a problem.

**This game: ~204 draw calls.** Comfortable. This budget is not your problem, and
that single fact is why the WebGPU answer in §9 comes out the way it does.

### Budget 2 — Triangles (a GPU geometry cost)

Every triangle runs the vertex shader on its corners and gets rasterised. The number
that matters is not what's in your `.glb` files — it is what you **submit per
frame**, after culling.

**Culling** means "don't draw what can't be seen", and there are three kinds:

- **Frustum culling** — the *frustum* is the pyramid-shaped volume the camera can
  actually see. Anything outside it is skipped entirely, on the CPU, before a draw
  call is even issued. This is nearly free and enormously effective.
- **Backface culling** — a triangle facing away from you is skipped. On by default,
  and it roughly halves the fill cost of any closed object.
- **Occlusion culling** — skipping things hidden *behind* other things. Harder;
  usually handled implicitly by the depth buffer (§5).

**This game:** 1,456,157 triangles submitted per frame, against a sane target of
250k–400k. Seabed props are **94%** of that, and three source models are wildly
over-budget for their on-screen size — `kelp-tall.glb` is 3,440 triangles for a
plant, `Seaweed-3.glb` is 1,832 for a single blade. Worse, frustum culling is off in
the hot paths ([props.js:698](../../src/props.js#L698),
[godrays.js:139](../../src/godrays.js#L139),
[particles.js:77](../../src/particles.js#L77)), so you draw the entire world every
frame including everything behind you. Those `frustumCulled = false` lines have real
reasons — when a vertex shader moves geometry, Three.js's precomputed bounding sphere
no longer describes where the object actually is, so the culler would wrongly delete
it — but the fix is to give those objects a correct manual bounding volume, not to
leave culling off forever.

### Budget 3 — Fill rate (a GPU pixel cost)

**The big one for you.** Fill rate is: how many fragments get shaded and written per
frame. Three multipliers stack:

**a) Resolution.** Cost scales with pixel *area*, so it grows as the square. This is
what **DPR** (device pixel ratio) is about: a Retina display reports DPR 2, meaning
every CSS pixel is 2×2 real pixels — **4× the work** for the same window. A
1440×900 window at DPR 2 is a 2880×1800 render.

**b) Anti-aliasing.** *Aliasing* is the jagged staircase on a diagonal edge.
**MSAA** (multi-sample anti-aliasing) fixes it by storing 4 (or 8) depth+colour
samples per pixel and averaging them. It doesn't multiply your shading work much,
but it multiplies your framebuffer **memory and bandwidth** by 4 — and bandwidth is
exactly what's scarce. **FXAA** is the cheap alternative: a post-process pass that
just finds edges in the finished image and smudges them. Slightly softer, a fraction
of the cost.

**c) Overdraw** — how many times a single screen pixel gets painted in one frame.
This is §5, and it's where your frames are actually going.

**This game:** the baseline was 2880×1800 with 4× MSAA = **20.7 million samples per
frame before a single triangle was drawn**. This one is already fixed —
[core.js:32-39](../../src/core.js#L32-L39) now caps DPR at 1.5 and turns MSAA off, and
the comment there explains exactly why. That was a four-line change worth an
estimated 40–60% of GPU time. **Note the shape of it: the biggest win in the whole
document was four lines of config, not an architecture change.** That's typical.

### Budget 4 — Memory and bandwidth

The GPU has its own memory (VRAM). Textures, meshes and buffers live there.

- Moving data from CPU to GPU **every frame** is the expensive version. Uploading a
  buffer mid-frame can stall the pipeline.
- Textures usually dominate VRAM, not geometry. A 2048×2048 texture is ~16 MB
  uncompressed — roughly 100× a detailed mesh.
- **Mipmaps** are pre-shrunk copies of each texture (half size, quarter, …). Without
  them, a distant object samples scattered pixels from a huge texture, which thrashes
  the cache and shimmers when you move. They cost 33% more memory and are almost
  always worth it.
- Browsers have a real ceiling around 2–4 GB, which is why the roadmap's streaming
  design exists.

**This game:** 1,574 instance matrices rebuilt on the CPU per frame and 16 buffer
re-uploads per frame. Both should be 0 for anything that isn't actually moving.
Asset payload is 26 MB — of which **19.7 MB is one audio file**, which is a loading
problem, not a frame problem, but it's the first thing a player experiences.

---

## 5. Overdraw and transparency — read this one twice

This is the single most important concept for your specific game, so it gets its own
section.

### The depth buffer, and why opaque is cheap

Alongside the colour image, the GPU keeps a **depth buffer**: for every pixel, how
far away the nearest thing drawn there is. When a new fragment arrives, the GPU
compares depths — if something nearer is already there, the fragment is discarded
**before the fragment shader runs**. This is called **early-Z**, and it means opaque
objects hidden behind other opaque objects are close to free.

So drawing a rock behind a cliff costs you almost nothing. Good.

### Why transparency destroys that

A transparent fragment has to be **mixed** with whatever is already in that pixel.
Which means:

1. It **must** be shaded — you can't blend with a colour you never computed.
2. It must be drawn **after** everything behind it, in the correct back-to-front
   order, or the result is wrong.
3. It usually doesn't write depth, so it can't hide anything behind *it* either.

Early-Z is dead. **Every transparent layer costs its full pixel area, every frame,
no matter what's in front of or behind it.** Ten transparent layers over the same
pixel = ten times the shading, ten times the bandwidth.

**Additive blending** (used for glows, god rays, light shafts) is the same story:
`result = existing + new`, order-independent and pretty, but every fragment is still
fully paid for.

### Tile-based GPUs make it sharper

Apple silicon (and every phone GPU) is a **tile-based deferred renderer**: it chops
the screen into small tiles, works out *up front* which surfaces are actually visible
in each tile, and only then shades them. Opaque overdraw becomes nearly free — better
than a desktop GPU. But blended geometry cannot be sorted out ahead of time, so it
falls back to painting in submission order, one layer on top of the next.

**A tile-based GPU is unusually good at opaque scenes and unusually punished by
transparent ones.** Your target machine is an M1 MacBook Air.

### The cost formula

Before the inventory, the thing to internalise — because it kills the two most
common wrong intuitions at once:

```
cost of a blended layer  ≈  screen area it covers  ×  how many layers overlap
```

**Count and size are the dials. The alpha value is not.** A sprite at `opacity 0.2`
and the same sprite at `opacity 0.9` cost *exactly the same*: the GPU shades the
fragment, reads the existing pixel, does the arithmetic, writes it back. That work
is identical at every alpha. And a transparent object covering four pixels is free
no matter how many of them there are.

So: a transparent thing is expensive **only** in proportion to how much of the
screen it paints, and how many other transparent things are painting the same
pixels.

### Every transparent object in this game, ranked

| # | Object | Count | Blend | Screen coverage | Verdict |
|---|---|---:|---|---|---|
| 1 | **Water surface** — 400×400 plane, `BackSide` | 1 | alpha | The entire upper half of the screen, constantly | **Biggest single blended area in the game.** Unavoidable — it's the ceiling of the world |
| 2 | **God rays** — 5–14 wide × 24–36 tall shafts | 10/level | additive | Huge when near, and the camera can be **inside** one, so a single shaft can fill the screen | **Worst overdraw multiplier.** They overlap each other, and additive means no shaft ever hides another |
| 3 | **Bubbles** — sprites, size 0.55 | 350 | alpha | 350 × 0.55² ≈ **106 units² of sprite area** | **~6× the fill of snow despite half the count.** Size is squared; this is the non-obvious one |
| 4 | **Snow** — sprites, size 0.16 | 700 | alpha | 700 × 0.16² ≈ **18 units²** | Cheap. The big count is misleading — each fleck is tiny |
| 5 | **Wake** — sprites, size 0.3 | 150 | alpha | 150 × 0.3² ≈ **14 units²**, and only while sprinting | Cheap, and self-limiting (ring buffer, recycled on demand) |
| 6 | **Orb halos** — sprites | 12/level | additive | A few dozen pixels each | Negligible |
| 7 | **Editor overlays** — ghost + collision boxes | varies | alpha | Large, but F4 only | Irrelevant to shipped frames |
| — | *(Backdrop sphere — opaque, `depthWrite: false`)* | 1 | none | Full screen | Not blended, but it is a guaranteed full-screen paint under everything else. The floor of your fill budget |

Sprite areas above are world-space, pre-attenuation — a bubble two metres from the
camera covers vastly more screen than one at forty. They are for **ranking the rows
against each other**, not for predicting milliseconds.

**Reading the table:** rows 1 and 2 are where the money goes. Row 3 is the
surprise — bubbles cost several times what snow does, because doubling a sprite's
size quadruples its area, and 0.55 is 3.4× the size of 0.16. If you ever want to cut
particle fill, **the bubbles are the row to touch, not the snow.**

Everything from row 4 down is rounding error. Don't spend a day there.

### What actually reduces the cost (and what doesn't)

| Change | Effect |
|---|---|
| Raise `opacity` 0.4 → 0.9 | ❌ **Zero.** Same shading, same blend, same bandwidth |
| Lower `opacity` | ❌ Zero, same reason — and it makes the effect weaker for free-of-charge nothing |
| Make it genuinely opaque (`transparent: false`, alpha 1) | ✅ **Huge** — early-Z comes back and it can be hidden by things in front. Only viable where the look survives it |
| Use `alphaTest` (cutout) instead of blending | ✅ **Large** for hard-edged things like foliage cards: fragments are `discard`ed, depth still writes, early-Z still works. The right tool for any prop using an `alphaMap` |
| Reduce **count** | ✅ Linear saving |
| Reduce **size** | ✅ **Quadratic** saving — halving a sprite's size quarters its fill |
| Fade to 0 with distance | ✅ The fragment is discarded outright — [godrays.js](../../src/godrays.js) does exactly this |
| `FrontSide`/`BackSide` instead of `DoubleSide` | ✅ Halves the fill for nothing visible — already done on water and god rays |
| Draw fewer overlapping layers | ✅ The most reliable win of all |

There is one indirect way opacity helps, and it's worth knowing: **a more opaque
sprite reads more strongly, so you need fewer of them for the same visual density.**
350 bubbles at 0.6 and 200 bubbles at 0.85 look comparably busy — but the second one
costs 43% less. The saving comes from deleting 150 sprites, not from the alpha
number. **Trade opacity for count. Never expect opacity alone to buy you anything.**

**The transferable rule: `DoubleSide` on any transparent object doubles its fill cost
for nothing, and a transparent object you can't see still costs full price unless you
fade it to zero and let the GPU discard it.** That distance fade in `godrays.js` isn't
a visual polish — it's a fill-rate optimisation wearing a costume, and the comments in
[godrays.js:29-37](../../src/godrays.js#L29-L37) and
[water.js:31-36](../../src/water.js#L31-L36) explain both fixes at the source.

---

## 6. The jargon decoder

Everything you'll hit in Three.js docs, translated.

| Term | What it actually is |
|---|---|
| **Mesh** | One drawable object = geometry + material |
| **Geometry** | The raw shape: a list of vertex positions, normals, UVs, and how they form triangles |
| **Material** | The recipe for colouring it: which shader, which textures, which settings |
| **Shader** | A small program that runs on the GPU. Vertex shader = per corner. Fragment shader = per pixel |
| **Uniform** | A value passed from CPU to shader that is the *same* for the whole draw call (e.g. `uTime`) |
| **Attribute** | A value that differs *per vertex* (position, normal, UV) |
| **Instanced attribute** | A value that differs *per copy* in an `InstancedMesh` (e.g. each god ray's lean) |
| **Draw call** | One work order from CPU to GPU. See §4 |
| **Pipeline state** | The GPU's full configuration for a draw. Changing it (new material, new blend mode) costs time — this is why material count drives draw calls |
| **Frustum** | The pyramid of space the camera can see |
| **Bounding sphere / box** | A cheap stand-in shape used to test visibility fast. If a shader moves the real geometry, this becomes a lie — hence the `frustumCulled = false` lines |
| **LOD** (level of detail) | Swap in a simpler mesh when an object is far away |
| **Billboard** | A flat quad rotated to always face the camera. Cheap fake volume; used for god rays and particles |
| **Skinned mesh** | A mesh deformed by a bone skeleton. Animated creatures. Expensive: per-bone matrices every frame, and hard to instance |
| **AnimationMixer** | Three.js's per-object animation player. CPU cost, per object, per frame — you tick 22 of them |
| **Texture atlas** | Many small textures packed into one image, so many objects can share one material |
| **Mipmap** | Pre-shrunk texture copies for distant objects. See §4 |
| **DPR** | Device pixel ratio. 2 on Retina = 4× the pixels |
| **MSAA / FXAA** | Hardware anti-aliasing (accurate, bandwidth-hungry) vs post-process anti-aliasing (cheap, softer) |
| **Overdraw** | Painting the same pixel more than once in a frame. §5 |
| **Early-Z / HSR** | Discarding hidden fragments before shading them |
| **Alpha blend / additive** | Mixing with what's behind (`a*src + (1-a)*dst`) vs adding to it (`src + dst`) |
| **Tone mapping** | Squashing the wide range of computed brightness into what a screen can show. `ACESFilmicToneMapping` in [core.js:43](../../src/core.js#L43) is what stops your bright sand blowing out to white |
| **Colour space** | sRGB vs linear. Lighting maths must happen in linear, output must be sRGB. Get it wrong and everything looks washed out or crushed |
| **Fog** | Fading to a colour with distance. Cheap, and it *saves* you money — it justifies drawing less far away |
| **VSync** | The screen refreshes at a fixed rate; your frame waits for it. Why frame times snap to 16.7 / 33.3 ms rather than sliding smoothly |
| **GC pause** | JavaScript garbage collection stopping the world for a few ms. Caused by allocating objects every frame — which is why the code reuses vectors instead of making new ones in the loop |

---

## 7. Finding your bottleneck (never guess)

The whole discipline is: **measure, change one thing, measure again.** Numbers, not
feel. Here's the order.

**Step 1 — Is it CPU or GPU?** Wrap your update logic in a timer:

```js
const t0 = performance.now();
updateWorld(dt);
const cpuMs = performance.now() - t0;
```

Compare against total frame time. `updateWorld` at 3 ms inside a 22 ms frame = you
are GPU-bound, and no JavaScript tuning will help.

**Step 2 — If GPU-bound: is it fill or geometry?** The decisive one-line experiment:

```js
renderer.setPixelRatio(0.5);   // render at quarter the pixels, for one run
```

- **fps recovers → fill-rate bound.** Your problem is pixels: resolution, overdraw,
  transparency, expensive fragment shaders.
- **fps unchanged → geometry- or CPU-bound.** Your problem is triangles, draw calls,
  or JS.

That single test tells you which half of [PERFORMANCE.md](../../PERFORMANCE.md)
matters, and it takes thirty seconds.

**Step 3 — Get the counters.** `renderer.info` gives you `render.calls`,
`render.triangles`, `programs.length`, `memory.geometries`. A `stats.js` panel showing
**ms per frame, not fps** — fps is a misleading scale, because 60→50 fps and 20→17 fps
are the same 3 ms of extra work.

**Step 4 — Bisect.** Comment out the god rays. Then the particles. Then the water.
Whatever restores your frame rate was the cost. Crude, fast, and it never lies.

---

## 8. The fixes, in the order they pay

Roughly ordered by return-on-effort, which is *not* the order they seem important.

1. **Render fewer pixels.** DPR cap, drop MSAA. Minutes of work, tens of percent of
   GPU. Always try this first. ✅ done — [core.js:32](../../src/core.js#L32)
2. **Kill overdraw.** Fewer transparent layers, no `DoubleSide` on blended things,
   fade distant blended geometry to zero so it's discarded. ✅ largely done
3. **Turn frustum culling back on** with correct bounding volumes. Free triangles,
   free draw calls, free fill. ⬜ still off in the hot paths
4. **Fix over-budget source models.** A 3,440-triangle kelp that covers 40 pixels is
   pure waste — decimate it in Blender once and it's fixed forever. ⬜
5. **Instance anything repeated**, and stop rebuilding instance matrices for things
   that aren't moving. ⬜ 1,574 rebuilds/frame
6. **Distance-gate expensive CPU work** — animation mixers, AI, collision. A fish
   80 units away in dense fog does not need its skeleton updated at 60 Hz. ⬜
7. **Add LOD** for the props that survive all of the above. ⬜
8. **Only then** consider a different renderer, WebAssembly, or workers.

The pattern: the cheap config-level fixes at the top are worth more than the
expensive architectural ones at the bottom. That ordering is not a coincidence, and
it's true on most projects.

---

## 9. So where do WebGL and WebGPU fit in?

Back to §2's picture: the CPU sends work orders to the GPU. **WebGL and WebGPU are
the two available formats for those work orders.** They are the phone line between
manager and factory — not the factory itself.

- **WebGL2** is the older format. It's stateful and chatty: each work order carries a
  lot of validation overhead. It's what you use today
  ([core.js:34](../../src/core.js#L34)), and it runs everywhere.
- **WebGPU** is the modern one, modelled on what native engines use. Work orders are
  much cheaper to issue, and it adds **compute shaders** — the ability to run general
  parallel maths on the GPU, so things like "which of these 1,574 props are visible?"
  could happen on the GPU instead of in your JavaScript loop.

**But look at what WebGPU makes cheaper: sending the orders.** It does not make a
pixel cheaper to shade. The factory is the same silicon either way. A transparent
god ray costs exactly the same under both.

So:

| Your actual problem | Does WebGPU fix it? |
|---|---|
| 20.7 M samples/frame from DPR + MSAA | ❌ identical |
| Blended overdraw on a tile-based GPU | ❌ identical |
| 2.9 M rasterised triangles, culling off | ❌ identical |
| ~204 draw calls | ❌ nothing to fix — WebGL2 handles this easily |
| 1,574 CPU instance-matrix rebuilds/frame | ✅ a compute shader could do this |

One row out of five, and that row also has a perfectly good WebGL-side fix (stop
rebuilding matrices for static objects).

**Verdict: stay on WebGL2 now.** Revisit when — and only when — you measure one of:

- draw calls above ~1,500–2,000 (plausible around Stage 4, ten streamed levels), or
- CPU-side culling / instance updates showing up as a real slice of frame time, or
- you reach Stage 6 (Electron + Steam), where you ship a bundled Chromium, so WebGPU
  is guaranteed present and consistent — [ROADMAP.md:367](../ROADMAP.md#L367) already
  makes that argument for Electron over Tauri.

The port is not small: every custom shader in [water.js](../../src/water.js),
[godrays.js](../../src/godrays.js), [particles.js](../../src/particles.js) and
[materials.js](../../src/materials.js) would need rewriting, on top of jumping Three
from r160 to current. Two risky migrations at once, for a bottleneck you don't have.

---

## 10. "Good graphics" is an art-pipeline problem, not a code problem

Worth saying plainly, because it's where the leverage actually is: most games that
look great and run great got there through **asset discipline**, not clever rendering.

- **Budget triangles by screen size, not by importance.** A prop that covers 40 pixels
  should be a few hundred triangles. Yours are 1,800–3,440 —
  10–50× over. Nobody can see the difference; everybody pays for it.
- **Share materials aggressively.** Ten props on one atlas texture can batch. Ten props
  with ten materials cannot, ever.
- **Texture resolution by screen size too.** A rock nobody gets closer than 5 m to
  does not need a 2K texture.
- **Fake it in the shader.** Fog, gradients, vertex-shader motion and normal maps buy
  enormous perceived quality for almost nothing. Your water is the model case: two
  pieces of real physics (Snell's window, total internal reflection) computed from
  **one dot product**, and it both looks better *and* costs less than the flat
  Lambert material it replaced ([water.js:11-30](../../src/water.js#L11-L30)).
- **Coherence beats fidelity.** [ROADMAP.md:377-381](../ROADMAP.md#L377-L381) already
  flags this — a clownfish and a whale from different CC-BY authors will read as
  wrong however many triangles you spend. One unifying shader treatment is worth more
  than any amount of geometry, and costs less.

---

## 11. Cheat sheet

**The five numbers to know at all times**

| Number | Where | Healthy | Yours (baseline) |
|---|---|---|---|
| Frame time (ms) | `stats.js` | < 16.7 | over |
| Draw calls | `renderer.info.render.calls` | < 500 | ~204 ✅ |
| Triangles/frame | `renderer.info.render.triangles` | 250k–400k | 1.46 M ❌ |
| Render resolution | DPR × window | ≤ 1.5× DPR | 1.5 ✅ |
| Blended full-screen layers | count them yourself | 4–8 | ~15 ⚠️ |

**The reflexes**

- Slow? **Measure first.** CPU or GPU (§7 step 1), then fill or geometry (§7 step 2).
- Anything transparent costs full price, always. Count your blended layers.
- `DoubleSide` doubles fill. Use it only when you genuinely see both faces.
- Resolution cost scales as the *square*. It's the biggest single dial you own.
- Culling off = drawing the world behind your back. Bounding volumes are the price of
  moving geometry in a vertex shader.
- One draw call for 220 kelp beats 220 draw calls for 220 kelp, every time.
- Don't allocate in the frame loop. Reuse vectors, avoid GC pauses.
- Fog is your friend: it's cheap, it sells depth, and it *licenses you to draw less*.
- The API (WebGL/WebGPU) is the phone line, not the factory. Changing it does not
  make pixels cheaper.

---

## 12. Where to go next in this repo

- [PERFORMANCE.md](../../PERFORMANCE.md) — the measured audit and the concrete fix
  list. Everything here is the *why* behind that document's *what*.
- [optimisation.md](../systems/optimisation.md) — the CPU-side long game (Wasm, workers,
  disposal). Correct, but for later: it addresses the half of the machine that isn't
  currently your bottleneck.
- [ROADMAP.md §9](../ROADMAP.md#L350) — "Can JavaScript carry this?" Yes, and §2 of
  this doc is why: the language issues the work orders, it doesn't fill them.
- The comment blocks at the top of [core.js](../../src/core.js),
  [water.js](../../src/water.js) and [godrays.js](../../src/godrays.js) are the best
  worked examples in the codebase — each one is a real decision with the reasoning
  and the numbers attached.
