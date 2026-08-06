# 🦈 Deep Ocean Shark

A tiny 3D browser game built with **Three.js** (no build step). Swim through the
deep ocean as a shark, explore, and collect glowing orbs — viewed from a
top-back chase camera.

## future development 

- bundle this into a electron app
- add more features to this simulation.

## Run it

You need a local server (loading `.glb` models fails from a plain `file://` page).

```bash
cd shark-game
npx serve            # then open the printed http://localhost:3000
# or, no install:
python3 -m http.server 8000   # then open http://localhost:8000
```

## Controls

| Key | Action |
|-----|--------|
| `W` / `S` | Swim forward / brake |
| `A` / `D` | Turn left / right |
| `Q` / `E` | Rise / dive |
| `Shift` | Boost |
| Mouse | Look around (click canvas to capture; `Esc` releases) |

## Project layout

```
shark-game/
├── index.html        # page + Three.js import map + HUD markup
├── style.css         # HUD + start screen
├── main.js           # entry point: boot + frame loop, nothing else
├── src/
│   ├── config.js     # every tunable, no logic — start here
│   ├── core.js       # renderer / scene / camera / shared clock / lights
│   ├── materials.js  # caustic shader injection, particle sprites
│   ├── terrain.js    # sand textures, dunes, seabedHeight() + floorAt()
│   ├── water.js      # surface plane + ripples
│   ├── godrays.js    # additive light shafts
│   ├── particles.js  # bubbles, marine snow, shark wake
│   ├── placement.js  # equal-area ring sampling + radial clamp (imports nothing)
│   ├── collision.js  # the rock/mountain solids nothing can swim through
│   ├── loader.js     # GLB load, scale/orientation normalize, mesh merging
│   ├── props.js      # scatter placement + per-instance rock weathering
│   ├── fish.js       # shoaling and fleeing — size classes + animated species
│   ├── creatures.js  # roaming animated wildlife (whale, dolphins, anglerfish)
│   ├── orbs.js       # collectibles
│   ├── shark.js      # rig, handling, swim clip, chase camera
│   ├── input.js      # keyboard + mouse-look, exposed as axes
│   ├── hud.js        # the only module that touches the DOM
│   └── world.js      # composition root: builds scene, drives updates
└── assets/           # .glb models
```

The dependency graph is a DAG with no cycles: `config` imports nothing,
`core` imports only `config`, and `world` is the only module that knows about
all the others. Subsystems never import each other — anything one needs from
another (the shark's position, for instance) is passed in as an argument by
`world.updateWorld()`, which also fixes the update order in one readable place.

## Tweaking

All knobs live at the top of `main.js`:

- `WORLD` — play-area bounds (seabed / surface / plane extent).
- `SAND_COLOR`, `DEEP_COLOR` — sand and fog/water tint.
- `ROCK_PALETTE` / `MOUNTAIN_PALETTE` — natural stone tones (basalt, granite
  grey, sandstone brown, algae green). Every rock instance draws one at random
  and then gets its own hue, saturation, brightness and roughness jitter, so no
  two boulders match. Add or remove entries to shift the reef's character.
- `MODELS` — per-model `targetSize` (auto-scales any source units), `rotY`
  (nose alignment) and `anchorBottom` (sit props on the seabed).
- `PROPS` — one row per kind of scenery. Add a row, get scenery; no code changes.
- `CREATURES` — the roaming animated wildlife. Each entry is a species: how many,
  what depth band it keeps to, how fast and how tightly it turns, and how shy it
  is of the shark.
- `FISH.classes` — the shoal size classes, from fry to lone lunkers.
- `FISH.species` — the named animated shoals (blue fish, clownfish, fish-2). Same
  row shape as a class, plus the `clip`/`rate` that make it swim itself, a
  `schools: [min, max]` count instead of a weighted roll, and an optional
  `band`/`floorClear` for a species that keeps to the bottom rather than mid-water.
- `seabedHeight(x, z)` — the single height field used for **both** the sand mesh
  and prop placement, so nothing floats or sinks. The shark and camera are
  clamped against it too.

### Scene notes

- **Sand** is procedural: a generated colour map (ripples + grain) plus a
  matching normal map, with animated caustics injected into the standard
  material via `onBeforeCompile`.
- **The shark is a skinned rig.** Its baked `Armature|Swim` clip is driven by an
  `AnimationMixer` whose `timeScale` scales with swim speed, so the tail beats
  faster when you boost. If you swap in a model with no clips, the code falls
  back to the old procedural sway.
- **Do not measure a freshly-loaded skinned model with `Box3.setFromObject()`.**
  See the long comment in `loadModel()` — `bindMatrixInverse` is still stale at
  that point, so the mesh node's transform gets applied twice. That bug scaled
  this shark down to a 4 cm invisible speck. `model.updateMatrixWorld(true)`
  first is what fixes it.
- **Scatter radius must be equal-area, not uniform.** `inner + random*(outer-inner)`
  puts the same count in every ring of equal *width*, but a ring's area grows with
  its radius — over `[6, 52]` that made the middle of the map ~9× denser than the
  rim, which is why the plants, shoals, wildlife and orbs all used to huddle around
  the origin. `ringRadius()` in `placement.js` samples
  `sqrt(lerp(inner², outer²))` instead, and every scatter goes through it.
- **Bounds are circular, not square.** `clampRadius()`, not a pair of `clamp()`
  calls on x and z: a box of half-width 74 has corners at r=105, well inside the
  mountain ring, so a creature backed into one would be standing in a mountain.
  Panic targets get clamped too — otherwise a fleeing animal spends the next
  second pressed flat against the bound instead of escaping.
- **`edgeScale` on a `PROPS` row biases size by radius**, so the tall kelp forest
  grows in the quiet water out at the rim and the open middle stays cropped short.
  `1` is a strict gradient; `0.7` is a gradient with visible exceptions.
- **The far band needs its own pass, not just more density.** Seen from a distance
  — foreshortened and washed out by fog — an evenly-dense band still reads as
  empty. What carries through haze is *silhouette*, so `PROPS` runs the same kelp
  models a second time over `r=80..115` at 2–3× scale, standing in and around the
  mountain feet. Nothing there breaks the water surface: the tallest instance is
  25.5 units on a 29-unit column.
- **`WORLD.half` is the master dial, and raising it multiplies AREA, not length.**
  Prop rings, shoal range, god rays and particle spread all size themselves off
  it, so a 40% bump doubles the water. Every count in `PROPS`, `PARTICLES` and
  `GOD_RAYS` has to grow with the band area — `count × (outer² − inner²)` — or the
  same reef ends up spread over twice the space looking half-abandoned. `FISH.roam`
  goes the *other* way: it's a fraction of `half`, so it was cut to hold the
  shoals' absolute range steady rather than scatter 7 schools across the new water.
- The shark is clamped to a **box**, not a circle, so it reaches `half` along an
  axis and `half × √2` on a diagonal. That asymmetry is load-bearing for how far
  out into the mountains you can actually get.
- Adding scenery is close to free — 1486 prop instances currently cost **24 draw
  calls**, because each row is one `InstancedMesh` per source mesh. Only the 16
  swaying ones re-upload their `instanceMatrix` each frame.
- **Rock collision is a cone per instance, not a box or a sphere.** A box is wrong
  because every prop is rotated to a random heading; a sphere is wrong because a
  mountain is 48 units tall and 30 wide, so a sphere containing it would seal off
  a huge ball of open water above the peak. A vertical truncated cone fits a
  blobby boulder (`taper: 0.5`) and a mountain (`taper: 0.1`) with the same three
  numbers. Response is horizontal only — you slide around a rock face instead of
  stopping dead, and you can swim over a boulder because above the peak there's
  nothing left to hit. Currently 84 colliders, brute-forced; the `dy` test is the
  broad phase and rejects most of them in one compare.
- **Long bodies are resolved as three spheres down their length** (`resolveBody`),
  not one at the centre. A 21-unit whale checked only at its middle pushes its
  whole head through a mountain before anything registers.
- **Collision runs LAST, after the world-bound clamps** — in `shark.js`,
  `creatures.js` and `fish.js` alike. The two constraints genuinely disagree where
  a collider straddles a boundary, and whichever runs last is what gets drawn. The
  bound is invisible, so drifting a few units past it costs nothing; a shark with
  its nose in a boulder is the most obvious artefact on screen. Because the clamp's
  output is never rendered, the drawn position stays constant frame to frame — no
  jitter even wedged dead-on a rock axis with nowhere to slide.
- Any horizontal push can slide a body over a taller dune, so **every collision
  site re-clamps to the floor afterward** — otherwise you get shoved into the sand.
- **Orbs retry their placement instead of being pushed out** (`insideSolid`). The
  shark can't enter a solid now, so an orb buried in rock is uncollectable and the
  run unwinnable — and a push could shove it off a peak to somewhere outside
  `WORLD.half`, which is the same bug wearing a hat. ~1.2 draws per orb in practice.
- **Wildlife (`creatures.js`) is cloned with `SkeletonUtils.clone()`, not
  `Object3D.clone()`.** A plain clone copies the mesh but leaves it pointing at
  the *original* skeleton, so every copy would deform in lockstep with the first
  one. Each clone then gets its own `AnimationMixer` rooted on itself, which is
  what keeps the bone-name lookups (`Spine1`, `Tail`, …) resolving inside its own
  subtree instead of colliding across copies.
- **Wildlife is not instanced**, unlike the props — a skeleton per animal costs
  real frame time, so the counts stay low (1 whale, 2 dolphins, 3 anglerfish).
  They're set pieces you come across, not scenery.
- **Shoals vary by size class.** Each school draws one entry from `FISH.classes`,
  which sets member scale, member count, school volume and cruise speed together
  — those all track body size in the same direction. Tail-beat rate divides by
  `√size`, so a fry flickers and a lunker makes slow strokes; without that the
  whole reef looks like one animation played back at N different scales.
- **Shoals keep to a depth band.** `FISH.band` (and per-species overrides) is a
  `[low, high]` pair of water-column fractions, 0 = mean seabed, 1 = surface — the
  same convention `CREATURES` uses. It governs waypoints *and* the panic target, so
  a reef species scatters along the bottom instead of breaking for the surface and
  then sinking home for ten seconds. `floorClear` is the matching floor for the
  formation's centre; the band alone still leaves a "bottom" species hovering three
  units up, above most of the plants it's supposed to live in. Members clamp against
  the dunes individually too, because one hanging at the bottom of the formation with
  its bob at full stretch sits a good unit under the centre.
- **A shoal's flee vector is damped in Y.** Dived on from above, the raw
  away-from-the-shark direction points at the sand, and the shoal spends its escape
  pressed into the floor clamp. Scattering sideways is both what a real shoal does
  and the only thing that actually works.
- **`FISH.species` are shoals of real animated rigs** (`blue_fish`, `clownFish`,
  `fish-2`) on top of those generic classes: same steering, but each fish is a
  skinned clone with its own `AnimationMixer`, so it swims instead of being wagged.
  A skinned mesh can't be merged *or* instanced, so each one costs a draw call per
  material — three each — which is why a species gets only one or two schools of
  three to four. The procedural body roll drops to a slow bank for these: stacked
  on top of a real tail beat, the bait fish's 7 Hz flick reads as a convulsion.
- Static props with more than 3 mesh nodes are merged to one mesh per material
  at load (`mergeByMaterial`). `kelp-tall.glb` ships as 21 nodes, which would
  otherwise cost 21 draw calls on every single clone.
- **`fern.glb` is authored alpha-`BLEND`, which can't work instanced.** An
  `InstancedMesh` is a single draw call, so blended fronds can't be sorted against
  each other and punch holes in themselves and the scene behind them. The `cutout`
  option on its `PROPS` row swaps it to `alphaTest`, which is what leaf cards want
  anyway: hard edges, in the opaque pass, depth-correct from every angle.
- **`loadModel` forces `metalness = 0` on every material.** Several assets came
  through an FBX→glTF conversion that stamped `metallicFactor: 0.4` onto leaves,
  bone, pebbles and fish skin. Nothing here is metal, and in three's PBR that 0.4
  scales diffuse down 60% while adding specular that needs an environment map we
  don't have — so those props rendered flat and dead.
- **Never park an Object3D or AnimationClip in `userData`.** `Object3D.copy()`
  does `userData = JSON.parse(JSON.stringify(userData))`, and both of those types
  implement `toJSON` — so one reference there makes every `clone()` serialize a
  whole model subtree, textures included as base64. `loadModel` hands `clips` /
  `animRoot` back as plain own properties, which `clone()` doesn't touch.
- Rock models that ship their own albedo texture (`rock-boulder`, `mountain`) are
  detected at load (`hasTexture`). Their per-instance tint gets scaled up to a
  mid luminance rather than applied raw, because `material.color` *multiplies*
  the texture and a near-black tint would erase all its baked detail.

**If anything swims tail-first**, flip that model's `rotY`. The shark, dolphin,
whale, anglerfish and the three reef-fish rigs all have their head bone at `+Z` in
bind pose, so they all take `rotY: Math.PI`. If a model renders belly-up, set
`rotGroup.rotation.z = Math.PI` in `loadModel`.

## Asset credits

The bundled `.glb` models are **CC-BY** — free to use with attribution.
Sourced from [Poly Pizza](https://poly.pizza/):

| Asset | Model | Author |
|-------|-------|--------|
| `kelp.glb` | [Kelp](https://poly.pizza/m/4cFllH6Iazk) | Poly by Google |
| `kelp-tall.glb` | [Kelp](https://poly.pizza/m/3VhttTFyADO) | Christopher F |
| `seaweed.glb` | [Seaweed](https://poly.pizza/m/461xlaa6SZW) | Laney XR Labs |
| `rock-boulder.glb` | [Rock](https://poly.pizza/m/dmRuyy1VXEv) | Poly by Google |
| `rock-cluster.glb` | [rocks](https://poly.pizza/m/94w1VXmnB6) | cyprienxld |
| `rock-large.glb` | [Rock](https://poly.pizza/m/2iXnYXZcaIX) | Nerdy Rodent |
| `mountain.glb` | [Mountain](https://poly.pizza/m/099f6GxB1bj) | Poly by Google |

`fish.glb`, `grass.glb`, `log.glb`, `sea-anemone.glb` and the shark were already
in the project — check their original sources for licence terms before shipping.

**Unattributed.** `Dolphin.glb`, `whale.glb`, `anglerfish.glb`, `fern.glb`,
`pebbles.glb`, `fish-bones.glb`, `kelp-2.glb`, `Seaweed-3.glb`, `blue_fish.glb`,
`clownFish.glb` and `fish-2.glb` were dropped into `assets/` without a source
recorded. Fill in their authors and licences
before shipping — the table above is the attribution the CC-BY models require,
and these aren't covered by it.
