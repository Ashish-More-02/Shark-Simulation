# World reference — how to change anything

The manual. Every knob that controls the world, what it does, and what it breaks.
If you want to change how the ocean looks, this is the page.

- Design *rationale* — why the world is shaped like this — is in
  [world-levels.md](world-levels.md).
- The in-game F4 tool is in [placement-editor.md](placement-editor.md).
- **Almost everything here lives in one file: [`src/config/config.js`](../../src/config/config.js).**

---

## 1. Units, axes, and where things are

**1 unit = 1 metre.** The shark is 6 units nose to tail; a great white is 4.5–6 m.
Every number in the game is directly comparable to the real ocean.

| Axis | Meaning |
|---|---|
| `+Y` | up. `WORLD.surface` (18) is the waterline. Floors are negative. |
| `−Z` | **forward.** The shark's heading is `(0, 0, −1)`, so levels descend in −Z. |
| `+X` | starboard when facing forward. |

Depth shown on the HUD is `WORLD.surface − y`. A floor at `−64` is 82 m deep.

### Where the levels are

| | Centre | Bound `play` | Floor | Column |
|---|---|---|---|---|
| 1 — The Shallows | `(0, 0, 280)` | 95 | −24 | 42 m |
| 2 — The Reef | `(0, 0, 0)` | 105 | −64 | 82 m |

Level 3 would go at `z = −280`. The canyon between them runs `z ∈ [88, 197]`,
`x ∈ ±26`.

### Two coordinate spaces — this trips people up

- **World space** — what the shark's position is in, what the HUD shows.
- **Level-local** — measured from that level's `center`. Everything in `PROPS`,
  `PROPS_PLAIN`, `fixed` entries and `clear` zones is level-local.

A prop at level-local `(0, 50)` in level 1 is at world `(0, 330)`. The F4 editor
always shows you level-local, because that is what you paste.

---

## 2. The seed — what it is and why it matters

```js
WORLD.seed: 20260808
```

**A seed is a starting number for a fake-random sequence.** Computers cannot
produce real randomness; they run a formula that takes a number, scrambles it, and
returns a new one that *looks* unrelated. Feed the result back in and you get a
stream of numbers with no visible pattern — random enough to scatter rocks with.

The catch, and the whole point: **the same starting number always produces the
same stream.** Start at 20260808 and the 1st, 2nd, 500th values are always
identical. So if every prop position is drawn from that stream in a fixed order,
the world is identical on every load — not stored anywhere, just *recomputed the
same way every time*.

`Math.random()` seeds itself from the clock, which is why it can never repeat.
That is what the world used to use, and why the reef was different on every
refresh.

### What this buys you

- **You can iterate.** Change a number, reload, and any difference you see is
  caused by your change — not by a reshuffle. Before, you could never tell.
- **You can point at things.** "That rock" still exists next session.
- **The whole world costs 4 bytes to store.** Nothing is saved to disk; the seed
  plus the code *is* the world.

### Using it

- **Change the seed** for a completely different reef with the same rules — new
  rock positions, new patches, same density and character. Free variety: try a few
  and keep the one you like.
- **Never change it** once you have hand-placed props relative to the scatter, or
  everything around them moves.
- Only *scenery* is seeded (`props.js`, `placement.js`). Fish, creatures and orbs
  still use `Math.random()` — they move anyway, so a fixed start would be wasted,
  and keeping them off the shared stream means their randomness cannot perturb
  where the rocks land.

Order matters: props are built level by level, row by row, each drawing from the
same stream. **Adding a row changes everything built after it.** If you add rows
in the middle of `PROPS` and the reef reshuffles, that is why — append at the end
to leave earlier rows undisturbed.

---

## 3. The terrain

One function answers "where is the floor at (x, z)", and everything uses it —
the seabed mesh, prop placement, the shark, the camera, shoals, creatures. Nothing
can float above the sand or sink into it, because there is only one answer.

```
seabedHeight(x, z) = seabedBase(z) + dunes(x, z) × duneScale(z)
```

| Part | Where | What it does |
|---|---|---|
| `seabedBase(z)` | `levels.js` | The level's mean floor. Flat at −24, flat at −64, one smooth ramp between. A function of **z alone**. |
| `dunes(x, z)` | `terrain.js` | Three sine waves — two short swells and one broad one. Pure local relief. |
| `duneScale(z)` | `levels.js` | Damps the dunes to `CANYON.plainDunes` (0.35) in the shallows so the plain is a plain. |

**The rule that makes it one ocean:** because the base and the damping are both
functions of `z` running through the same smoothstep, the floor is continuous
everywhere. There are no seams to stitch and no per-level terrain to line up. A
level is only a statement about which slice has *content* in it.

### Changing the shape of the floor

| Want | Change |
|---|---|
| A level deeper or shallower | `LEVELS[n].seabed` |
| Where the slope starts and ends | `CANYON.rampBottom` / `rampTop` |
| Bumpier or flatter sand overall | the amplitudes in `dunes()` in `terrain.js` |
| A flatter plain | `CANYON.plainDunes` (lower = flatter) |
| Finer or coarser terrain mesh | `VERTEX_SPACING` in `terrain.js` (4 units) |

**Deepening a level is not free.** The column is what sizes everything in it —
see §5.

---

## 4. Water, sky and light

| Knob | File | Effect |
|---|---|---|
| `WORLD.surface` | config | The waterline, 18. Moving it changes every level's column. |
| `WATER.deep / window / glint` | config | The surface seen from below: grazing mirror, overhead window, sun veins |
| `WATER.opacity` | config | `[grazing, overhead]`. Overhead 0.52 is what lets the sky through |
| `WATER.brightness` | config | Overall luminance of the surface |
| `SKY.horizon / zenith / sun` | config | Above the waterline |
| `SKY.sunDir` | config | **Must match the DirectionalLight in `core.js`** or the sun sits in one place and the shadows point at another |
| `FOG_DENSITY` | config | 0.0135 — visibility ends around 200 units, useful sight ~50 |
| `DEEP_COLOR` | config | Fog colour. Move it with `WATER` and `BACKDROP` or the surface stops matching the water under it |
| `GOD_RAYS.count / fade` | config | Shafts per level, and their distance fade |

The backdrop sphere (`core.js`) splits at `WORLD.surface`: water gradient below,
sky above, blended over ~6 units. That split is the horizon line, and it is the
only reference the player has for how deep they are.

---

## 5. The rule that governs everything vertical

> **Relief cannot exceed the water column.**

A mountain 60 units tall on a floor 42 units below the surface stands out of the
sea. Sometimes that is what you want (the shallows' islands); usually it is a bug.

```
peak = floor + (targetSize − sink) × scale
```

| Level | Floor | Column | Max mountain scale before breaching |
|---|---|---|---|
| Shallows | −24 | 42 | ~0.98 |
| Reef | −64 | 82 | ~1.90 |

`targetSize` for `mountain` is 46. So on the reef, `sMax: 1.7` gives a peak at
`−64 + 43×1.7 = 9` — nine units under the surface.

**Check this whenever you change a level's depth or a mountain's scale.** It is the
single easiest thing to get wrong, and it looks obviously broken.

---

## 6. Placing props — the row format

`PROPS` (the reef) and `PROPS_PLAIN` (the shallows) are arrays of rows. One row =
one model scattered and/or hand-placed, built into instanced, chunked, culled
meshes.

```js
{ model: 'boulder', count: 56, sMin: 0.5, sMax: 2.2, ring: [7, 118],
  tilt: 0.2, palette: ROCK_PALETTE, edgeScale: 0.6,
  solid: 0.85, taper: 0.5, clump: REEF_PATCH },
```

### Every option

| Option | Does | Notes |
|---|---|---|
| `model` | key from `MODELS` | must exist or the row is skipped with a console warning |
| `count` | how many to scatter | `0` = hand-placed only |
| `ring: [inner, outer]` | the annulus it scatters in, **level-local radius** | equal-area, so density is flat from centre to rim |
| `sMin` / `sMax` | size range | multiplied by the model's `targetSize` for the real height |
| `edgeScale` | 0–1, how much size comes from radius rather than chance | 1 = strict gradient, 0.7 = a gradient with exceptions |
| `tilt` | random lean, radians | **use 0 for anything tall** — a tilted peak reads as one falling over |
| `sink` | units buried per unit of scale | hides the gap a flat-bottomed model leaves on a slope |
| `palette` | per-instance rock colour | `ROCK_PALETTE`, `MOUNTAIN_PALETTE`, `PEBBLE_PALETTE` |
| `shade` | grey jitter instead of a palette | for plants |
| `sway` | bend amplitude in the current | radians at the tip; shader-side, costs nothing |
| `cutout` | alpha-test threshold | for leaf cards (ferns) — keeps them in the opaque pass |
| `solid` | collider width as a fraction of the bounding box | **omit it and you can swim through the thing** |
| `taper` | how fast the collider narrows with height | ~0.5 blobby boulder, ~0.12 mountain (swim over a rock, not through a peak) |
| `cull` | draw distance override | default `PERF.propCull` (120). Raise for landmarks |
| `gap` | half-angle of an opening in the ring, aimed at `LEVELS[n].gapDir` | for the mountain wall at the canyon mouth |
| `clump` | patch set (see §7) | |
| `fixed` | hand-placed instances (see §8) | |

### Counts scale with AREA, not radius

If you widen a ring, multiply the count by the band-area ratio or the row thins
out:

```
new count = old count × (outer₂² − inner²) / (outer₁² − inner²)
```

Widening `[7, 104]` to `[7, 118]` is ×1.29. That is exactly what was done when the
reef bound moved out.

---

## 7. Patchiness — why the world doesn't look scattered

Real seabeds are mosaics: meadow, bare sand, outcrop, sand. Uniform density at
*any* density reads as empty, because there is nowhere full to be.

```js
const REEF_PATCH = { key: 'reef', seeds: 14, radius: 15, frac: 0.78 };
```

| Field | Does |
|---|---|
| `key` | **rows sharing a key share their patch centres** |
| `seeds` | how many patches |
| `radius` | how far one patch reaches |
| `frac` | fraction of the row that clumps; the rest scatters so patches fray |

The shared `key` is the substrate rule made mechanical: **kelp needs hard ground
and does not grow out of open sand**, so the kelp rows use the rock rows' seeds and
the forests grow on the outcrops. Seagrass uses `MEADOW` instead — it roots in
sand and wants the gaps.

Four patch sets exist: `REEF_PATCH`, `MEADOW` (reef), `PLAIN_ROCK`,
`PLAIN_MEADOW` (shallows). Add one by declaring another object with a new `key`.

**Fewer, bigger patches** = more dramatic, more open sand between.
**More, smaller patches** = busier, closer to a scatter.

---

## 8. Hand-placing and deleting

Use the **F4 editor** — see [placement-editor.md](placement-editor.md). It writes
both of these for you.

### `fixed` — put one thing somewhere

```js
{ model: 'mountain', count: 0,
  palette: MOUNTAIN_PALETTE, solid: 0.8, taper: 0.1, tilt: 0, sink: 3,
  fixed: [
    { x: -74, z: 84, scale: 1.80 },
    { x: -50, z: 96, scale: 2.4, n: 26, spread: 15, jitter: 0.3 },
  ] },
```

| Field | Does |
|---|---|
| `x`, `z` | **level-local** position |
| `scale` | absolute, not drawn from `sMin`/`sMax` |
| `rotY`, `tilt`, `sink` | per-entry overrides |
| `n` | make it a thicket of `n` instead of one |
| `spread` | radius the thicket fills |
| `jitter` | ± scale variation across the thicket |

The editor records placement only — **you must add the row's `palette`/`solid`/
`taper`/`shade`/`sway` by hand** or it will be white and you will swim through it.

### `clear` — delete scattered props

A scattered prop has no config line to delete; it is one draw from a seeded
sequence. So you declare **bare ground** instead, on the level's `LEVELS` row:

```js
clear: [ { x: -12, z: 41, r: 18 } ],
```

Anything scattered whose centre lands inside is dropped at build time. Hand-placed
`fixed` props ignore it — if you put it there on purpose, clearing the ground
should not remove it. To delete one of those, delete its line.

---

## 9. Where the animals go

### Bands are height above the SEABED

Not a fraction of the water column. `FISH.band` and every `CREATURES` band is a
fraction of `HABITAT` (33 units, `levels.js`), added to the floor — so a band means
the same height at every depth, in every level.

| | Height above floor |
|---|---|
| Bait shoals | 5.9 – 27.1 |
| Blue fish / clownfish | 2.0 – 9.2 / 0.7 – 5.9 |
| Whale / dolphin | 13.9 – 25.7 / 18.2 – 27.1 |
| Anglerfish | 0.7 – 7.3 |
| Manta ray | 2.0 – 13.9 (plus surface trips on the reef — below) |

The upper storey (`FISH.highSchools`) fills water *above* the habitat band, and
only exists in levels with `headroom() > FISH.highMinRoom`. The shallows have 9
units of headroom, below the threshold of 12, so they get none.

### Two species leave their band on a timer

`CREATURES[].surface` — `{ every: [base, jitter], trip, depth, climbPitch }` — makes a
species abandon the *depth* of its waypoint (keeping its heading), climb to `depth`
metres under the surface, patrol up there for the rest of `trip`, and glide back down to
its band. One function, `surfaceTrip()` in `creatures.js`; two very different animals:

| | why | numbers |
|---|---|---|
| Dolphin | it is a mammal and has to breathe | `every` 30–42 s, `trip` 9 s, `depth` 4, `climbPitch` 0.95 |
| Manta ray (**reef only**) | it feeds on what drifts near the top | `every` 32–44 s, `trip` 38 s, `depth` 5, `climbPitch` 1.0 |

The manta's numbers are set so the reef population splits its time **evenly between the
top of the column and the reef floor**, and that split is arithmetic rather than a
percentage anywhere in the code: from the middle of its band to 5 m under the surface is
a 69 m climb, 13 s up at `climbPitch` 1.0 against 23 s back down at the shared 0.5 rad
limit. `trip` 38 s therefore buys 25 s at the surface and `every` ≈ 38 s leaves 15 s on
the reef — 38 s in each half of a 76-second cycle. Raise `trip` for a longer visit up
top and keep `every` near it to hold the split; `depth` decides how close to the
waterline it gets, bounded by the animal's own ceiling clamp (`surface − clearance − 0.4`).

The three reef mantas stagger their first trip from `live` at spawn, so at any moment
roughly one is up top, one is in transit and one is on the reef: the *species* reads as
doing both at once while each animal only ever does one. A chase overrides a trip (the
flee block runs after it) and a **fight cancels it outright**, so nothing about this
happens while the player is involved.

### Ranges

| Knob | Does |
|---|---|
| `FISH.schools` / `centerSchools` | shoals per level; centre ones hold the middle |
| `FISH.roam` | shoal range as a fraction of the level's `play` |
| `FISH.species[].only` | restrict a species to one level id |
| `createSchools(models, level, density)` | `density` in `world.js` thins a level (shallows use 0.5) |
| `CREATURES[].ring / band` | wildlife's swim radius and depth band, measured from its own basin's centre and clamped to that basin's `play − 10` (`roamFor()`) |
| `CREATURES[].levels` | which basins a species lives in, by level **id**, with a count each — `[{level:1,count:2},{level:2,count:3}]`. Absent = the reef with `count` of them, which is every species but the manta ray. Any other field of the row may be overridden per basin. |
| `ORBS.count` | per level; `world.js` gives the shallows a third |

---

## 10. Collision

`solid` + `taper` on a prop row register a **cone** per instance: wide at the
footprint, narrowing with height. That is what lets you swim over a boulder but not
through a peak. Solids go into a 16-unit spatial hash (`collision.js`) built lazily
on the first query.

No `solid` on a row means no collider at all — correct for grass, wrong for rock.

---

## 11. Performance levers

Watch **F3** while you change any of this. The number that matters is ms/frame.

| Knob | Does |
|---|---|
| `PERF.propCull` | draw distance for prop chunks (120). Matched to the fog |
| `PERF.chunkTriangles` | target triangles per chunk (8000). Smaller = better culling, more draw calls |
| `PERF.minPropsPerChunk` | stops a heavy row shattering into one draw call each |
| `PERF.targetFps` | frame cap. The sim is time-based, so frames above 60 are pure heat |
| `PERF.propMaterial` | `'lambert'` swaps Standard for Lambert across all props |
| `VERTEX_SPACING` | terrain mesh density |

Cost intuition:
- **A prop row's draw cost tracks the visibility radius, not the ring size.** A
  bigger ring costs memory, not frame time.
- **Instances are cheap** — 64 bytes of matrix each. 50,000 is ~3 MB.
- **The canopy kelp rows are the heaviest geometry in the game.** Raise those
  counts carefully.
- The seabed is one world-spanning mesh always submitted (~41k tris). It is the
  first thing to split per level when streaming arrives.

---

## 12. Recipes

| I want… | Do this |
|---|---|
| A different-looking reef, same rules | change `WORLD.seed` |
| The reef to feel bigger | raise `LEVELS[1].play`, push `REEF_RING` and every reef row's outer radius out, scale counts by the area ratio |
| A level deeper | `LEVELS[n].seabed` — then re-check every mountain `sMax` against §5 |
| More open sand | fewer `seeds`, bigger `radius`, higher `frac` on the patch set |
| A busier reef | raise counts, or raise `seeds` |
| Mountains further back | raise the ring's inner radius; remember colliders reach inward by `targetSize × 0.5 × solid × scale` |
| A landmark somewhere | F4, place it, paste, add `palette`/`solid`/`taper`/`cull` |
| This area empty | F4, Tab, erase, paste the `clear` array |
| Kelp somewhere specific | a `fixed` entry with `n` and `spread` |
| A new level | add a `LEVELS` row at `z = (2 − id) × 280`, give it a prop table, populate it in `world.js`. Everything sizes itself off `worldBounds()` |
| A species only in one level | `only: <level id>` on its `FISH.species` row |

---

## 13. What will bite you

- **Adding a prop row in the middle reshuffles everything after it** (seeded order).
  Append instead.
- **Deepening a level breaches every mountain in it** unless you re-check §5.
- **Widening a ring without scaling the count** thins the row out.
- **Forgetting `solid`** makes a mountain you swim through.
- **Forgetting `palette`** makes a flat white rock.
- **Moving `SKY.sunDir`** without moving the `DirectionalLight` puts the sun in the
  wrong place.
- **Hand-placed props near the canyon** must stay outside `play` or you can get
  inside them; their colliders must clear `x = ±26` or they block the corridor.
