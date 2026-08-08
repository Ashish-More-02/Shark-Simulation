// ============================================================
//  CONFIG  — every tunable in the game lives here.
//  No imports, no logic: just data other modules read.
// ============================================================

export const WORLD = {
  // Play area bounds — the shark is clamped to a BOX of this half-width, so it
  // reaches `half` along an axis and half*sqrt(2) (~109) on a diagonal. That
  // diagonal reach is past mountainRing, which is the point: you can swim out
  // among the outer peaks and circle them rather than being fenced off inside.
  // Almost everything else in the scene sizes itself off this one number —
  // prop rings, shoal range, god rays, particle spread — so raising it
  // multiplies the world's AREA (by ~2 for this 40% bump), and the counts below
  // had to grow with it or the whole reef thins out.
  half: 77,
  seabed: -15,     // mean seabed height
  surface: 18,     // water surface
  floor: 400,      // seabed / surface plane extent (room for the mountains)
  // Inner edge of the mountain range. One source of truth: the PROPS row places
  // the peaks here and creatures.js keeps its wildlife just inside it.
  mountainRing: 78,
};

// Fog / water tint. Pulled off cyan and darkened: 0x0d3b52 sat at hue 200° with
// a lot of green in it, which is the colour of a lit swimming pool or a shallow
// lagoon. Open ocean past the shelf scatters out the green long before it reaches
// you — what's left is hue ~207 and considerably deeper.
// Brightened 20% from 0x0a3149 — see the WATER.brightness note below, which
// explains why all three water tints move together.
export const DEEP_COLOR  = 0x0c3b58;
export const SAND_COLOR  = '#c8ab7d';  // seabed
export const FOG_DENSITY = 0.0135;     // loose enough to see the mountains

// The water column you see when you look past the reef. Same shift off cyan as
// DEEP_COLOR — the original top colour (0x3f9fcc) was a bright pool cyan, and
// because the backdrop fills every gap in the scenery it set the mood more than
// anything else did — then the same 20% brightening (from 0x256d94 / 0x020a11).
export const BACKDROP = { top: 0x2c83b2, bottom: 0x020c14 };

// ---- THE SURFACE, SEEN FROM UNDERNEATH -------------------------------------
// Looking up from open ocean, the surface is not a pane of pale blue glass. Two
// pieces of physics define it, and neither of them is colour:
//
//   SNELL'S WINDOW — light from the entire sky is refracted into a cone about
//     48.6° wide directly overhead. Inside that cone you see the world above.
//
//   TOTAL INTERNAL REFLECTION — outside the cone the surface is a MIRROR, and
//     the only thing down here for it to reflect is the dark water below.
//
// So a real surface reads as a bright, shimmering patch overhead that falls away
// to near-black as your eye slides toward the horizon. The old water was a flat
// 0x63c6ee at 30% opacity — evenly bright in every direction, no window, no
// mirror. That evenness is the tell: it's what a pool looks like, lit from all
// sides with a white floor two metres down and nothing dark to reflect.
export const WATER = {
  deep:   0x06202f,       // grazing: the mirror, reflecting the deep itself
  window: 0x2f7ba4,       // overhead: sky through the window, still ocean-blue
  glint:  0xa8dcf5,       // sun veins shimmering inside the window
  opacity: [0.94, 0.52],  // [grazing, overhead] — a dark ceiling, a bright hole
  // Overall luminance of the surface, applied in the shader. A multiplier rather
  // than brighter hex values above, because `glint` is already at 245/255 blue and
  // scaling it directly would clip it to flat white and throw away the tint.
  //
  // Three separate tints describe the water — this surface, BACKDROP's column, and
  // DEEP_COLOR's fog — and they have to move together or the surface stops matching
  // the water it sits on top of. All three are currently +20% over the values that
  // came out of the deep-ocean pass; DEEP_COLOR and BACKDROP carry it baked into
  // their hex, this one carries it here.
  brightness: 1.2,
};

// Real rock is never one flat colour. Each instance draws from a palette of
// natural tones — volcanic basalt, granite grey, sandstone brown, algae-dulled
// green — then gets its own brightness / hue / roughness jitter on top, so no
// two boulders match. Weighted toward the dark end so the reef still reads black.
export const ROCK_PALETTE = [
  0x26262a, 0x2e2e31, 0x1e1e21, 0x37373a,   // basalt
  0x6a6a6c, 0x7b7871, 0x565859, 0x4d4f50,   // granite / weathered grey
  0x6b5643, 0x7a6a52, 0x54483a, 0x453a2f,   // sandstone / sediment brown
  0x49543f, 0x3f4a3c,                       // algae-covered
];
export const MOUNTAIN_PALETTE = [
  0x4a5560, 0x3d4a52, 0x55606b, 0x46484a,   // cold distant rock
  0x5a5245, 0x4e463c, 0x615748,             // brown sediment flanks
];
// Pebbles sit ON the pale sand, so they read as shingle rather than basalt —
// same per-instance jitter machinery, a much lighter set of tones.
export const PEBBLE_PALETTE = [
  0x8d8378, 0x9a9186, 0x7c7468, 0xa39a8c,   // sun-bleached grey shingle
  0x8a7a63, 0x99886d, 0x6f6455,             // sandy / sediment
  0x6d726b, 0x5f665e,                       // damp greenish grey
];

// Per-model setup. targetSize = longest dimension in world units after
// auto-scaling (source units differ wildly, so we normalize by bbox).
// rotY aligns each model's nose to -Z (Three.js "forward").
// shark-animated.glb is a skinned rig whose head (the "Face" bone) points +Z,
// so it needs a full 180° spin — not the ±90° the old static model wanted. The
// dolphin, whale and anglerfish rigs share that convention (their head bone sits
// at +Z of the root in bind pose), so they all take the same Math.PI.
// Rock colouring is per-instance and lives in props.js — see ROCK_PALETTE.
//
// twoSided : render BOTH faces of every triangle (THREE.DoubleSide).
//   The loader used to force this on EVERYTHING, which meant all ~1.37 million
//   seabed-prop triangles were rasterised twice — backface culling was simply
//   switched off for the entire world. It is only actually needed for geometry
//   you can see the inside of, and an audit of the .glb index buffers (welded by
//   POSITION first — these models are flat-shaded and split vertices at every
//   hard edge, so a naive index-based test calls a solid boulder 97% "open")
//   says that is far fewer models than assumed:
//
//     - mountain, boulder, grass, kelp, Seaweed-3 look open, but 100% of their
//       boundary edges sit in the bottom 10% of the model — they are closed
//       shells with an open BASE, and the base is buried in the sand. Notably
//       grass/kelp/Seaweed-3 are NOT the flat cards they look like.
//     - kelp-tall, seaweed, rock-cluster, rock-large, pebbles, fish-bones are
//       fully closed manifolds with consistent winding.
//     - fern is genuine alpha-cut leaf cards (32% boundary edges) -> two-sided.
//     - kelp-2 is closed but 47% of its edges are wound inconsistently, so
//       culling would punch holes straight through it -> two-sided.
//     - Every ANIMAL keeps it. Their fins are single-sided cards, and all the
//       creatures together are only ~40k triangles, so there is nothing to win
//       and a visibly finless dolphin to lose.
//
//   Net: 1.29M of the 2.75M rasterised prop triangles removed.
//   If a prop ever looks hollow from some angle, add `twoSided: true` to its row
//   here — that is the entire fix, no other file needs to change.
export const MODELS = {
  shark:    { url: 'assets/shark-animated.glb', targetSize: 6.0, rotY: Math.PI, anchorBottom: false, twoSided: true },
  fish:     { url: 'assets/fish.glb',         targetSize: 1.1,  rotY: Math.PI, anchorBottom: false, twoSided: true },

  // Animated reef fish — skinned rigs that SHOAL (fish.js), one AnimationMixer per
  // fish. Same Root/Spine/Tail/Face rig family as the shark and the dolphin, head
  // bone at +Z in bind pose, so they take the same Math.PI.
  // targetSize is the fish's LENGTH in world units next to a 6-unit shark. Held
  // near 1 deliberately: true-to-life a clownfish would be a tenth of that and
  // simply invisible in the fog, so these sit in the same visual register as the
  // mid-water bait shoals — big enough to read as a species, small enough that the
  // shark still dwarfs them.
  blueFish: { url: 'assets/blue_fish.glb',    targetSize: 0.95, rotY: Math.PI, anchorBottom: false, twoSided: true },
  clownFish:{ url: 'assets/clownFish.glb',    targetSize: 0.8,  rotY: Math.PI, anchorBottom: false, twoSided: true },
  fish2:    { url: 'assets/fish-2.glb',       targetSize: 1.15, rotY: Math.PI, anchorBottom: false, twoSided: true },

  // animated wildlife — skinned rigs, one AnimationMixer each (see creatures.js)
  dolphin:  { url: 'assets/Dolphin.glb',      targetSize: 5.0,  rotY: Math.PI, anchorBottom: false, twoSided: true },
  whale:    { url: 'assets/whale.glb',        targetSize: 21,   rotY: Math.PI, anchorBottom: false, twoSided: true },
  angler:   { url: 'assets/anglerfish.glb',   targetSize: 2.4,  rotY: Math.PI, anchorBottom: false, twoSided: true },

  // seabed flora
  grass:    { url: 'assets/grass.glb',        targetSize: 2.6,  rotY: 0, anchorBottom: true },
  kelp:     { url: 'assets/kelp.glb',         targetSize: 8.5,  rotY: 0, anchorBottom: true },
  kelpBush: { url: 'assets/kelp-tall.glb',    targetSize: 5.5,  rotY: 0, anchorBottom: true },
  // kelp-2 is a closed mesh, but 47% of its edges are wound inconsistently, so
  // backface culling would punch holes straight through it.
  kelpFrond:{ url: 'assets/kelp-2.glb',       targetSize: 4.6,  rotY: 0, anchorBottom: true, twoSided: true },
  seaweed:  { url: 'assets/seaweed.glb',      targetSize: 4.5,  rotY: 0, anchorBottom: true },
  seagrass: { url: 'assets/Seaweed-3.glb',    targetSize: 3.0,  rotY: 0, anchorBottom: true },
  anemone:  { url: 'assets/sea-anemone.glb',  targetSize: 2.6,  rotY: 0, anchorBottom: true },
  // genuine alpha-cut leaf cards — the one plant that really is flat geometry
  fern:     { url: 'assets/fern.glb',         targetSize: 3.4,  rotY: 0, anchorBottom: true, twoSided: true },

  // rock — coloured per instance from ROCK_PALETTE / MOUNTAIN_PALETTE
  boulder:  { url: 'assets/rock-boulder.glb', targetSize: 6.0,  rotY: 0, anchorBottom: true },
  rockPile: { url: 'assets/rock-cluster.glb', targetSize: 8.0,  rotY: 0, anchorBottom: true },
  rockSpire:{ url: 'assets/rock-large.glb',   targetSize: 4.8,  rotY: 0, anchorBottom: true },
  mountain: { url: 'assets/mountain.glb',     targetSize: 46,   rotY: 0, anchorBottom: true },
  pebbles:  { url: 'assets/pebbles.glb',      targetSize: 1.7,  rotY: 0, anchorBottom: true },

  // seabed litter
  log:      { url: 'assets/log.glb',          targetSize: 3.2,  rotY: 0, anchorBottom: true },
  bones:    { url: 'assets/fish-bones.glb',   targetSize: 1.9,  rotY: 0, anchorBottom: true },
};

// How the seabed gets populated. `model` keys into MODELS; everything else is
// read by props.js, which turns each row into InstancedMeshes.
// Add a row to add scenery — no code changes.
//   palette : recolour every instance from this list of natural stone tones
//   shade   : brightness jitter (flora, which keeps its own colour)
//   sway    : bend amplitude in the current, in radians
//   tilt    : random lean off vertical, in radians
//   ring    : [innerRadius, outerRadius] placement band from world centre.
//             Placement inside it is EQUAL-AREA (see placement.js), and the
//             default band runs out past WORLD.half to the mountain skirt so the
//             reef carries on into the haze instead of ending at a hard edge.
//   edgeScale: 0..1 — how much of an instance's size comes from how far out it
//             is. The tall kelp forests belong in the quiet water at the rim;
//             the middle, where the shark patrols, stays cropped short.
//   cutout  : alphaTest threshold — for foliage authored as alpha-BLEND
//   solid   : make every instance a collision volume nothing can swim through
//             (collision.js). The number trims the collider's radius against the
//             prop's measured footprint — a little under 1, so you can brush the
//             visible surface instead of stopping short against thin air.
//   taper   : fraction of the base radius the collider still has at its top.
//             ~0.5 for a blobby boulder, ~0.12 for a mountain: a cone that
//             narrows with height is what lets you swim over a rock but not
//             through a peak. Only read when `solid` is set.
// Every outer radius below grew with WORLD.half, and every count grew with the
// BAND AREA that radius implies — count x (outer² - inner²). Extending the rings
// without also raising the counts would have spread the same reef over twice the
// water and left it looking half-abandoned, which is the opposite of the point.
export const PROPS = [
  // mountains: the range you can now swim out to and around. Count raised with the
  // ring's area for the same reason as everything else — 13 peaks scattered over
  // 42,000 square units read as a few lonely lumps, not a mountain range.
  // Outer radius pulled from 140 to 120. At FOG_DENSITY 0.0135 you can see maybe
  // 75 units, so peaks beyond ~150 from the shark were never once rendered
  // visibly — they were paying for themselves in nothing. Tightening the band also
  // roughly doubles how much of the range sits inside the reachable box.
  { model: 'mountain',  count: 18, sMin: 0.6, sMax: 1.35, ring: [WORLD.mountainRing, 120], tilt: 0.1,  palette: MOUNTAIN_PALETTE, solid: 0.8, taper: 0.1 },
  // Inner landmarks, out to 60 now that the play area reaches 77. Their collider
  // radius tops out near 10, so the farthest reaches r=70 — still comfortably
  // inside the bound, which is what stops the world clamp and the rock from
  // taking turns shoving the shark back and forth at the very edge.
  { model: 'mountain',  count: 5,  sMin: 0.4, sMax: 0.6,  ring: [32, 60],  tilt: 0.12, palette: MOUNTAIN_PALETTE, solid: 0.8, taper: 0.1 },

  // rock: basalt / granite / sandstone, a different mix every instance. Biggest
  // outcrops out by the mountain feet, where they read as fallen debris.
  { model: 'rockPile',  count: 26, sMin: 0.8, sMax: 2.4, ring: [8, 104],  tilt: 0.12, palette: ROCK_PALETTE, edgeScale: 0.6,  solid: 0.8, taper: 0.55 },
  { model: 'boulder',   count: 56, sMin: 0.5, sMax: 2.2, ring: [7, 104],  tilt: 0.2,  palette: ROCK_PALETTE, edgeScale: 0.6,  solid: 0.85, taper: 0.5 },
  { model: 'rockSpire', count: 45, sMin: 0.6, sMax: 2.6, ring: [7, 104],  tilt: 0.15, palette: ROCK_PALETTE, edgeScale: 0.55, solid: 0.8, taper: 0.4 },

  // shingle: small, plentiful, and cheap — it's what makes the sand read as
  // seabed instead of a bare plane. Lighter tones than the reef rock.
  { model: 'pebbles',   count: 260, sMin: 0.5, sMax: 1.6, ring: [4, 106], tilt: 0.12, palette: PEBBLE_PALETTE },

  // flora: the tall stuff sways with the current. Kelp gets the strongest edge
  // bias — a proper forest at the rim thinning to stragglers in the open middle.
  { model: 'kelp',      count: 87, sMin: 0.6, sMax: 2.3, ring: [10, 104], shade: 0.18, sway: 0.11, edgeScale: 0.8 },
  { model: 'kelpBush',  count: 49, sMin: 0.6, sMax: 2.0, ring: [9, 104],  shade: 0.18, sway: 0.07, edgeScale: 0.7 },
  { model: 'seaweed',   count: 97, sMin: 0.6, sMax: 2.0, ring: [7, 105],  shade: 0.22, sway: 0.14, edgeScale: 0.6 },
  { model: 'grass',     count: 82, sMin: 0.7, sMax: 2.0, ring: [5, 105],  shade: 0.2,  sway: 0.05, edgeScale: 0.5 },
  { model: 'fern',      count: 97, sMin: 0.5, sMax: 1.8, ring: [5, 105],  shade: 0.24, sway: 0.08, edgeScale: 0.55, cutout: 0.5 },
  { model: 'anemone',   count: 41, sMin: 0.7, sMax: 1.7, ring: [6, 101],  shade: 0.2,  sway: 0.06, edgeScale: 0.4 },

  // kelp-2: the mid-storey. Fills the gap between ankle-high seagrass and the
  // giant canopy, right across the map.
  { model: 'kelpFrond', count: 118, sMin: 0.8, sMax: 2.0, ring: [6, 106], shade: 0.2,  sway: 0.1,  edgeScale: 0.5 },

  // Seaweed-3: small-to-medium ground cover, deliberately NOT edge-biased and
  // running the full radius — it's the one plant that reads the same close to the
  // start point as it does out at the rim, which is what ties the two together.
  { model: 'seagrass',  count: 165, sMin: 0.6, sMax: 1.7, ring: [3, 107], shade: 0.22, sway: 0.12 },

  // ---- THE MOUNTAIN CANOPY ----
  // This band used to sit at r=56..82: past the old r=55 bound, so it could only
  // ever be seen from a distance, and it existed because at that angle uniform
  // density reads as empty and only SILHOUETTE carries through fog. The bound has
  // moved out to 77, so it has moved with it — now a towering forest standing in
  // and around the mountain feet. It still does the silhouette job from anywhere
  // inside, and it's the payoff for swimming all the way out.
  { model: 'kelp',      count: 133, sMin: 2.0, sMax: 3.0, ring: [80, 115], shade: 0.16, sway: 0.08, edgeScale: 0.45 },
  { model: 'kelpBush',  count: 84,  sMin: 1.9, sMax: 2.9, ring: [82, 115], shade: 0.16, sway: 0.05, edgeScale: 0.45 },
  { model: 'kelpFrond', count: 76,  sMin: 2.0, sMax: 3.0, ring: [82, 115], shade: 0.18, sway: 0.07, edgeScale: 0.4 },

  // litter: driftwood and picked-clean carcasses. Bones stay sparse — a skeleton
  // every few metres would read as a graveyard, not a reef.
  { model: 'log',       count: 17, sMin: 0.8, sMax: 1.5, ring: [8, 98], tilt: 0.25 },
  { model: 'bones',     count: 30, sMin: 0.6, sMax: 1.5, ring: [8, 98], tilt: 0.3, shade: 0.16 },
];

// Animated wildlife that roams the water column on its own — one skinned rig per
// instance, each with its own AnimationMixer (creatures.js). Not instanced, so
// keep the counts small: these are set pieces, not scenery.
//   count   : how many to spawn
//   sMin/sMax: extra size jitter on top of the model's targetSize
//   band    : [low, high] fraction of the water column, 0 = seabed, 1 = surface
//   ring    : [inner, outer] radius its waypoints are drawn from, equal-area.
//             An inner radius is how you keep something OUT of the middle — the
//             whale belongs in the open water off the reef, not circling the
//             origin where the shark starts.
//   clip    : animation clip name; falls back to the first clip in the file
//   rate    : clip timeScale at cruise speed
//   speed   : cruise speed, world units/second
//   turn    : max yaw rate in rad/s — big animals arc, small ones dart
//   shy     : how hard it veers off when the shark closes in (0 = ignores you)
//   glow    : { material, color, intensity } — make one named material self-lit.
//             Match the material EXACTLY: anglerfish.glb has both "Light" (the
//             bioluminescent bulb) and "Anglerfish_Light" (the dark brown stalk
//             holding it), and a substring match would set the stalk alight too.
//   name    : what the bite readout calls it
//   bites   : how many snaps it takes to eat (prey.js). Mass, essentially — a
//             whale is not something you swallow on the first pass.
//   points  : growth credited when it finally goes down. Read against
//             SHARK.growthFull, so these are shares of the whole size curve.
//
// ---- COUNTS AND RINGS ARE SIZED FOR HUNTING, NOT FOR SCENERY ----------------
// These rows were originally tuned as set pieces: one whale, kept deliberately
// out past the reef at r=48..72, was "a silhouette you notice in the blue rather
// than something crossing the middle of the play area". That is the right call
// for background wildlife and the wrong one the moment the whale is worth 10
// bites and 70 growth points — one animal in a 9,000-square-unit annulus, seen
// through fog you cannot see 50 units through, is a needle the player is being
// asked to find. Same story for 2 fleeing dolphins over 13,500 square units and
// 3 anglerfish 2.4 units long down in the dark.
//
// So the counts are up and the rings are pulled in toward the water the shark
// actually patrols. SIZES ARE UNTOUCHED — sMin/sMax here and targetSize in
// MODELS are exactly what they were; this is about where they are and how many,
// not how big.
//
// Cost: 6 skinned rigs becomes 11. Each one is an AnimationMixer, but they are
// distance-gated (PERF.mixerNear/Far), so the ones out in the fog are frozen and
// the extras are close to free until you swim up to them.
export const CREATURES = [
  { model: 'whale',   count: 2, sMin: 0.92, sMax: 1.06, band: [0.42, 0.78],
    ring: [30, 68], clip: 'Armature|Swim',
    rate: 0.34, speed: 2.4, turn: 0.28, dwell: [10, 8], shy: 0,
    name: 'Whale', bites: 10, points: 70 },

  { model: 'dolphin', count: 4, sMin: 0.85, sMax: 1.08, band: [0.5, 0.95],
    ring: [8, 52], clip: 'Armature|Swim',
    rate: 1.15, speed: 5.4, turn: 1.5, dwell: [3, 3], shy: 0.35,
    name: 'Dolphin', bites: 3, points: 14 },

  { model: 'angler',  count: 5, sMin: 0.7, sMax: 1.35, band: [0.02, 0.22],
    ring: [10, 54], clip: 'Fish_Armature|Swimming_Normal',
    rate: 0.85, speed: 1.4, turn: 0.8, dwell: [6, 6], shy: 0.5,
    glow: { material: 'Light', color: 0x9df0ff, intensity: 2.6 },
    name: 'Anglerfish', bites: 1, points: 3 },
];

// Shark handling + the baked swim clip. tailRate* are timeScale multipliers for
// the "Armature|Swim" clip: idle glide → full sprint.
export const SHARK = {
  maxSpeed: 14, accel: 22, drag: 1.8,
  turn: 1.6, pitchRate: 1.2, pitchLimit: 1.15,
  // Boost only kicks in holding Shift while thrusting forward. drag pins
  // normal cruise speed well under maxSpeed (accel/drag ≈ 12.2), so a plain
  // higher ceiling alone never gets touched — boostAccelMul is what actually
  // pushes the equilibrium up, past boostSpeed, which then hard-clamps it
  // there. Releasing Shift drops the ceiling straight back to maxSpeed.
  boostSpeed: 15, boostAccelMul: 1.25,
  reverseFrac: 0.4, reverseAccelMul: 1.2,
  tailRateIdle: 0.55, tailRateFast: 2.3,
  // Flat multipliers on top of the idle→fast interpolation below, so the two
  // states read as distinctly different gaits rather than points on one ramp.
  tailNormalMul: 0.8, tailSprintMul: 1.2,
  camOffset: [0, 2.6, 8.5],   // behind (+Z) and above → "top-back over the head"
  startPos: [0, 2, 0],
  floorClearance: 1.8,        // how far the shark stays off the sand
  wakeAtSpeed: 3.5,           // bubble trail kicks in above this
  mouseSensitivity: 0.0022,
  // Rock collision. The shark is 6 units long, so it's resolved as three spheres
  // down its length (collision.js) rather than one at the middle — otherwise the
  // nose visibly buries itself before anything pushes back.
  bodyRadius: 1.15,
  bodyHalfLength: 2.3,

  // ---- GROWTH -------------------------------------------------------------
  // Eating scales the shark up. EVERY length in the block above is multiplied by
  // the current scale at use (shark.js): body radius, half length, floor
  // clearance, the surface ceiling, the camera offset, the bite reach. Growing
  // the model without growing those would put a 12-unit shark's nose inside the
  // rock its collider still thinks is 6 units away, and leave the chase camera
  // buried in its own dorsal fin.
  //
  // maxScale is set FROM the whale: MODELS.shark.targetSize (6.0) x 2.1 = 12.6
  // world units against the whale's targetSize of 21 — so a fully grown shark is
  // 40% shorter than the biggest thing in the ocean, and stays that way.
  maxScale: 2.1,
  // ---- WHY THE CAMERA IS NOT IN THAT LIST ----
  // How much of the shark's growth the chase camera follows. This started at 1
  // (offset scaled with the animal, "or a fully grown shark fills the screen with
  // its own back") and that was flatly wrong: scaling the camera by the SAME
  // factor as the shark holds its SCREEN size constant, which is the one thing
  // that cannot stay constant if growth is going to read as growth. With nothing
  // else to compare against, the eye concludes the fish got smaller — you can't
  // see your own scale, only the ratio between you and the frame.
  //
  //   0    the offset never moves. A 2.1x shark is 2.1x bigger on screen, and the
  //        kelp and the boulders it now dwarfs sell it. This is the default.
  //   0.3  a compromise: the camera drifts back to 1.33x while the shark goes to
  //        2.1x, so it still grows 1.6x on screen but leaves more view ahead.
  //   1    the old behaviour — the shark appears never to change size at all.
  //
  // At 0 and full size the geometry still works: the tail tip reaches 6.3 units
  // behind the pivot and the camera sits 8.5 back, so there is 2.2 units of
  // clearance and nothing clips. It IS a lot of shark in frame — that's the point
  // — so raise this if it crowds the view.
  camGrowth: 0,
  // Points for maxScale. Clearing the entire reef once — ~65 shoaling fish, the
  // 5 anglers, 4 dolphins, both whales and all 12 orbs — comes to 348, which is
  // 87% of this: the last stretch has to come from the 60-second respawns, so
  // maxing out means hunting the reef through a second pass rather than
  // vacuuming it up once.
  //
  // Moved 280 -> 400 when the CREATURES counts went up for findability. The
  // wildlife carries 211 of those 348 points, so leaving this at 280 would have
  // meant hitting maximum size well before you had seen most of the reef.
  //
  // What matters more than the total is the per-fish step it implies: a 1-point
  // bait fish moves the scale by 1/400 of the 1.1 range, which is 0.003 — 1.7 cm
  // on a 6-metre shark. Invisible per fish, exactly as intended; you only notice
  // it when the kelp you used to swim through starts brushing your flank.
  growthFull: 400,
  // Seconds for the scale to catch up to the points. Purely cosmetic damping, so
  // a whale's 70 points swell in over a moment instead of snapping.
  growthLag: 1.2,
};

// ---- BITING ----------------------------------------------------------------
// Left click snaps the jaws. The hit test is a single sphere-vs-body query per
// click against the prey registry (prey.js) — no per-frame cost at all, which is
// why the reach can afford to be generous.
export const BITE = {
  cooldown: 0.4,        // seconds between snaps
  snap: 0.22,           // head-snap animation length
  lunge: 3.2,           // forward speed impulse, so a bite is also a pounce
  // Both scale with the shark. mouthAhead puts the bite sphere at the nose
  // rather than at the pivot in the middle of the body.
  mouthAhead: 2.9,
  reach: 3.4,           // hit radius around the mouth, plus the prey's own girth
  // Prey has to be roughly in front of the jaws: cos of the cone's half-angle.
  // 0.45 is ~63°, wide enough that fish fleeing sideways are still catchable.
  coneCos: 0.45,
  // ...except inside this distance, where it's simply in your mouth and the
  // angle stops mattering. Without it, a fish pressed against the shark's cheek
  // is unbiteable because the direction to it is nearly perpendicular.
  gape: 1.8,
  // Every eaten animal comes back exactly this many seconds later — fish at
  // their school's centre, wildlife at a fresh waypoint well away from the shark
  // so nothing pops into existence in front of you.
  respawn: 60,
  // The blobs are pure bonus growth: no bites, no chase, just points.
  orbPoints: 6,
};

// Shoaling fish. A reef isn't one size of fish repeated — it's clouds of fry,
// mid-water shoals, and a handful of big slow loners. Each school picks ONE size
// class (weighted), then every member jitters inside that class's range, so the
// scale variety reads as species rather than as random noise.
//   scale  : [min, max] multiplier on the normalized fish model
//   count  : [min, extra] members per school
//   spread : school volume the members hold station in
//   speed  : [base, extra] cruise speed. BOTH halves of the pair move together, so
//            the mean (base + extra/2) is what changes and the spread inside a class
//            widens with it — scaling only `base` would quietly squeeze the variety
//            out of a class as it got faster.
//
//            "Mass costs acceleration, so big is slow" was the original rule, and
//            taken literally it put the two larger classes at means of 1.6 and 2.15
//            — which does not read as a heavy fish, it reads as a dying one. The
//            whole population now sits in a 3.2-4.6 band: size still orders them,
//            but across a ~1.4x spread rather than a ~2.9x one. Cumulative change
//            from the original values:
//
//              fry        3.65 -> 6.40   +75%
//              mid-water  2.85 -> 6.30  +121%
//              large      2.15 -> 5.50  +156%
//              lunkers    1.60 -> 4.70  +194%
//
//            Worth knowing where this stops being the answer: the shark's own cruise
//            equilibrium is accel/drag = 12.2, so bait fish at a 6.4 mean are already
//            over half the speed of the thing hunting them. Past roughly here, more
//            speed makes them un-huntable rather than livelier — which is why the
//            tail beat (FISH.beatMax) is doing the rest of the work.
//
//            Every raise here has to be checked against FISH.sprintCap, which is
//            the shark's top speed less a margin: cruise x fleeSpeedMul must stay
//            under it or the fish become uncatchable. That is why fleeSpeedMul has
//            come down 2.8 -> 2.4 -> 2.0 as these went up — the burst is expressed
//            as a multiple of cruise, so raising cruise raises the burst too.
//   weight : relative odds of a school drawing this class
export const FISH = {
  // Schools spread across the whole reef, by AREA (see wanderPoint). ~7 bait fish
  // per school on average, and each fish is its own draw call, so this number is
  // not free — `species` below adds another 14-30 on top at three draw calls each.
  //
  // Came down 9 -> 6. Not for cost: with 13 generic schools against one or two of
  // each named species, nearly every shoal you swam into was the same untextured
  // salmon, and the reef read as one fish repeated rather than as a mix. The three
  // schools removed here are handed to fish-2 below, which lives in the same
  // mid-water band and so replaces them where you actually meet them. The swap is
  // near-neutral on draw calls — ~21 single-material bait fish out, ~7 skinned
  // fish at three calls each in.
  schools: 6,
  // ---- AND SCHOOLS HELD TO THE MIDDLE ----
  // Equal-area spawning is correct — it is what stops every shoal bunching at the
  // origin — but it has a consequence: the inner 22-unit circle is only 11% of the
  // roam area, so it statistically held well under one school. That is precisely
  // where the shark starts, and where it spends most of its time patrolling, so the
  // emptiest water in the game was the water you look at most.
  //
  // These schools spawn there AND stay there: their roam radius is centerRoam x the
  // usual one, so they hold the middle ground instead of dispersing across the reef
  // within a minute. Four of them in ~1,500 square units is dense — fish are always
  // in sight of the start point.
  centerSchools: 4,
  centerRoam: 0.34,
  // ---- SPRINTING AWAY FROM THE SHARK ------------------------------------
  // A shoal used to recompute its escape vector off the shark's CURRENT bearing
  // every single frame it was inside fleeRadius. That is why it read as a series
  // of sharp direction changes: circle a school and its target swings round with
  // you, so it pivots on the spot instead of going anywhere. Now the heading is
  // computed ONCE when the burst starts and held for the whole thing — the shoal
  // picks a line and runs it.
  fleeRadius: 26,        // shark this close and the shoal is ALARMED
  // ---- WHY THE FISH LOOKED LIKE THEY WERE "JUST CHILLING" ----
  // There used to be exactly one panic state — a 1.5s burst, once per 5s — and
  // between bursts a shoal went straight back to cruise speed. So for 70% of the
  // time the shark was among them they were sauntering. The timing was worse than
  // the ratio: they triggered at 20 units, sprinted 1.5s while the shark covered 21,
  // so the burst reliably ENDED just as it arrived on them.
  //
  // Now there are two states, and the shark being nearby is enough for the first:
  //
  //   ALARMED  shark inside fleeRadius. Sustained flight at alarmSpeedMul, holding
  //            the escape line, for as long as it is there. No cruising with a
  //            predator in the shoal.
  //   SPRINT   the extra gear on top, in bursts of sprintTime every sprintCooldown.
  //            Each burst re-aims the escape line and flash-expands the formation.
  //
  // The long cooldown existed because a sprint used to be faster than the shark
  // (2.8x on the old speeds = 15.8 against a 14 top speed), so tiring them out was
  // the only way to make them catchable. sprintCap below makes that structural
  // instead, which is what allows the panic to be near-continuous.
  fleeSpeedMul: 2.0,     // burst multiplier
  alarmSpeedMul: 1.6,    // sustained-flight multiplier between bursts
  sprintTime: 2.2,       // seconds of burst
  sprintCooldown: 3.2,   // from the START of one burst to the next — a ~1s lull
  // How much of the turn toward straight-away-from-the-shark a burst actually takes.
  // A fraction, so a school already running keeps its line and just puts on speed —
  // that reads as fleeing; taking the whole turn reads as wheeling on the spot.
  escapeTurn: 0.45,
  // ...but never keep a heading that still points INTO the shark. This is how close
  // to straight-away the result must end up at worst, in radians, so a school
  // swimming right at it does come about. 1.2 rad = 69°, i.e. it ends up heading at
  // least 111° away from the shark rather than executing a flat 180.
  escapeCone: 1.2,
  // How far the formation blows outward during a burst. Real shoals "flash expand"
  // when something hits them and re-form afterwards; this is one multiplier on the
  // slot offsets, eased in and out, so it costs nothing and is the single clearest
  // read that the school is frightened rather than swimming.
  burstSpread: 1.5,
  // Absolute ceiling on a shoal's speed, whatever the multipliers work out to. The
  // shark tops out at SHARK.maxSpeed 14 (boost 15), so anything a shoal can sustain
  // above that is not a burst, it is an escape — you would never land a bite. This
  // is belt-and-braces over fleeSpeedMul: cruise speeds have been raised three times
  // now, and each time the multiplier silently pushed the sprint past the shark. A
  // hard cap means the next raise cannot reintroduce that bug.
  sprintCap: 13.2,
  // ---- TAIL BEAT vs. SPEED ----
  // The other half of "they look slow", and arguably the bigger half. A bait fish's
  // body flick was a fixed 7 Hz and an animated species' clip ran at a fixed
  // timeScale, no matter how fast the fish was actually travelling — so a shoal
  // sprinting for its life beat its tail at exactly the rate it used while drifting.
  // Nothing on screen said "effort" except the scenery going past, and speed you
  // can't see reads as slow.
  //
  // Both now scale with speed / cruise speed, capped here. At cruise that ratio is
  // 1, so cruising looks exactly as it did; flat out the tail moves twice as fast.
  beatMax: 2.2,
  // Shoals range this × WORLD.half. Cut from 1.1 when the world grew: as a
  // FRACTION it would have scaled with the bound and scattered the same 7 schools
  // across twice the water, so you'd almost never run into one. 0.85 × 77 ≈ 65 is
  // close to the old absolute 60, which keeps encounters as frequent as before and
  // leaves the far water to the mountains and the kelp canopy — which is where
  // shoals belong anyway. Bait fish hold to the reef, not the open ocean.
  roam: 0.85,
  // ---- STEERING ---------------------------------------------------------
  // There are no waypoints. A school holds a HEADING and always swims forward along
  // it; steering is turning that heading. See the long note at the top of fish.js for
  // why every waypoint version of this stalled and left the fish spinning in place.
  //
  // Wander: every `wanderDwell` seconds, pick a new heading within ±`wanderTurn` of
  // the current one and a new depth inside the band. Because the school never stops
  // travelling, a nudge this size reads as a long sweeping traverse that eases a few
  // degrees at a time — the motion that repeated waypoint schemes kept failing to
  // produce.
  wanderDwell: [4, 4],      // [min, extra] seconds between course nudges
  wanderTurn: 0.9,          // max nudge, radians. ±52°: curves, never doubles back
  // Turn rate in rad/s, [min, extra], jittered per school and then divided down by
  // the formation's width — so a wide school of big fish arcs and a tight cloud of
  // fry can flick round. This is the dial for how agile shoals feel.
  turnRate: [1.1, 0.7],
  alarmTurnMul: 1.9,        // frightened fish turn harder
  // How fast the school's speed chases the gear it wants, as the fraction remaining
  // after one second. Much tighter than a heading turn: a startled fish is at full
  // speed almost immediately, and the burst is meant to be a visible kick.
  speedEase: 0.002,
  climbRate: 2.2,           // max vertical speed, units/s, easing toward its band depth

  // ---- BOUNDARY ----
  // Where the pressure to come about starts, as a fraction of the school's roam
  // radius, and how hard it builds. This replaces steering at a target clamped to
  // the rim — the school arcs round while still swimming instead of pressing into an
  // invisible wall, which is what produces the sweep along the mountain line.
  // clampRadius still backstops the position, but a school should never reach it.
  edgeMargin: 0.78,
  edgeTurn: 3.0,

  // Default depth band, as [low, high] fractions of the water column — 0 = mean
  // seabed, 1 = surface, the same convention CREATURES uses. This pair reproduces
  // the seabed+6 .. surface-6 range these shoals have always had: mid-water, which
  // is where generic bait fish belong. A species row can override it.
  band: [0.18, 0.82],
  // How far a school's CENTRE stays off the dunes. Members hang below it and clamp
  // individually against their own body radius, so this is the formation's floor,
  // not the fish's.
  floorClear: 3,
  // Biting (prey.js). Every shoaling fish, generic or named, goes down in one
  // snap and is worth one point — they're the bread-and-butter of the size curve,
  // and anything that took two bites at this size would just feel unresponsive.
  // A class or species row may override either.
  bites: 1,
  points: 1,
  // Scale bumped up across the three larger classes, and weight shifted toward
  // those same classes, so bigger fish are both individually larger and more
  // common. The fry class was then doubled too (0.3-0.5 -> 0.6-1.0): at the old
  // size they were a few pixels of drifting speckle at any real distance, which
  // read as dirt on the screen rather than as a cloud of small fish.
  //
  // That does put the top of the fry range (1.0) at the bottom of the next class
  // (1.0-1.6), so the two now abut rather than leaving a gap. They still read as
  // different: fry come 6-11 to a school in a tight 4.5-unit volume and flick their
  // tails nearly twice as fast (`wobble` scales with 1/sqrt(size)), where the next
  // class up is 8-14 fish spread over 7 units.
  classes: [
    { scale: [0.6,  1.0], count: [6,  5], spread: [4.5, 2.0, 4.5], speed: [5.0, 2.8], weight: 2 },
    { scale: [1.0,  1.6], count: [8,  6], spread: [7.0, 3.2, 7.0], speed: [4.8, 3.0], weight: 4 },
    { scale: [2.1,  3.0], count: [4,  4], spread: [9.0, 4.2, 9.0], speed: [4.2, 2.6], weight: 4 },
    { scale: [3.8,  5.0], count: [1,  2], spread: [11,  5.5, 11 ], speed: [3.6, 2.2], weight: 3 },
  ],
  // ---- NAMED SPECIES ----
  // The `classes` above are all the same untextured salmon at N scales, moved by a
  // procedural tail flick. These rows are real skinned rigs playing their own swim
  // clip, so the school genuinely swims. That costs an AnimationMixer per fish and
  // one draw call per material (three each, and they can't be merged or instanced —
  // a skinned mesh has to keep its own node), which is exactly why the reef rows
  // come in ones and twos of three or four: a species you happen upon is an
  // encounter, a species that's everywhere is wallpaper. fish-2 is deliberately
  // commoner than that — see its row.
  //   model   : MODELS key
  //   schools : [min, max] schools of this species, inclusive — NOT the [min, extra]
  //             pair `count` uses
  //   clip    : clip name in the GLB; falls back to the file's first clip
  //   rate    : clip timeScale, jittered per fish. The source clips are all ~1.3 s
  //             per tail cycle, which is a whale's tempo — small fish need >2 to
  //             beat at anything like their own frequency.
  //   band    : overrides FISH.band — where in the column this species lives
  //   floorClear: overrides FISH.floorClear — a bottom species needs a small one,
  //             or the band still leaves it hovering above the plants it lives in
  //   scale / count / spread / speed all read exactly as in `classes`, except
  //   `count` is deliberately tiny: these are tight little shoals, not clouds.
  //
  // The clownfish and the blue fish are REEF fish: they hold to the bottom few
  // metres, in among the seagrass, the ferns and the boulders, rather than crossing
  // open mid-water like the bait shoals. They're layered rather than sharing one
  // slab — the clownfish lowest, down at anemone height, the blue fish just above
  // it — so meeting both doesn't read as one mixed school. Fleeing keeps them in
  // that band too (fish.js), so they scatter along the reef instead of breaking for
  // the surface. fish-2 keeps the default mid-water band, which leaves a visible
  // difference in habit between the three.
  species: [
    { model: 'blueFish',  schools: [1, 2], count: [3, 1], scale: [1.0, 1.4],
      spread: [3.4, 1.6, 3.4], speed: [4.2, 2.6], clip: 'Armature|Swim.001', rate: 2.2,
      band: [0.06, 0.28], floorClear: 1.8, name: 'Blue fish' },
    { model: 'clownFish', schools: [1, 2], count: [3, 1], scale: [0.9, 1.3],
      spread: [3.0, 1.4, 3.0], speed: [4.6, 2.8], clip: 'Armature|Swim',     rate: 2.6,
      band: [0.02, 0.18], floorClear: 1.6, name: 'Clownfish' },
    // fish-2 is the exception to the "ones and twos" rule above: 2-3 schools of
    // 4-6, taken out of FISH.schools rather than added on top. It shares the
    // generic bait fish's mid-water band, so those schools turn up in the same
    // water the plain salmon used to own — which is the whole point, the reef
    // needed a second common fish out there, not a third rare one down on the
    // bottom. Spread widened with the count so 5 fish still read as a shoal
    // rather than a clump.
    { model: 'fish2',     schools: [2, 3], count: [4, 2], scale: [1.0, 1.4],
      spread: [4.4, 2.0, 4.4], speed: [4.6, 2.8], clip: 'Armature|Swim',     rate: 2.0,
      name: 'Reef fish' },
  ],
};

export const ORBS = { count: 12, collectRadius: 2.2 };

// Bubbles and marine snow are spread over a box sized off WORLD.half. Both are
// one draw call each no matter the count — GPU-animated Points fields — and the
// wake is emitted at the shark and doesn't care how big the world is.
//
// These counts USED to be scaled off world area (800 / 1350) on the reasoning
// that one draw call and no CPU work makes them "close to free". That measured
// the wrong thing. A particle field's cost is FILL: every sprite is alpha-blended
// with depth-write off, which a tile-based GPU cannot occlusion-cull, and a
// bubble a metre from the camera covers a large slab of screen. Area is the wrong
// scaling law anyway — the particles that sell the water are the near ones, and
// how many of those you see doesn't depend on how big the world is.
//
// Halved to 350 / 700. Tune freely: this is the most subjective number in the
// Phase 1 pass, and it is one edit away from being restored.
export const PARTICLES = {
  bubbles: { count: 350, size: 0.55, opacity: 0.6 },
  snow:    { count: 700, size: 0.16, opacity: 0.42 },
  wake:    { count: 150, size: 0.3,  opacity: 0.5 },
};

// Also spread off WORLD.half, but unlike the particles each shaft is its own mesh,
// so this count IS the draw-call count — AND its own cloned ShaderMaterial.
//
// Cut 30 -> 10. Draw calls were never the problem: each shaft is a 24-36 unit tall
// additive quad and the camera lives INSIDE the volume, so a shaft routinely
// covers a big fraction of the screen. Thirty of them stack thirty layers of
// blended fill that no tile-based GPU can occlusion-cull. At 0.16 peak alpha the
// difference between 10 and 30 is mostly invisible; the fill cost is 3x.
export const GOD_RAYS = {
  count: 10,
  // Shafts are now ONE InstancedMesh with the billboard done in the vertex
  // shader, so `count` no longer costs draw calls or materials — only fill. It
  // also means a shaft can fade itself out by distance, which the 10 separate
  // meshes could not: [fadeNear, fadeFar] in world units from the camera. Past
  // fadeFar a shaft contributes literally nothing, and at FOG_DENSITY 0.0135 it
  // was contributing about 2% of its colour anyway.
  fade: [70, 135],
};

// ============================================================
//  PERFORMANCE DIALS
//  Everything here trades image quality for frame time. These are the knobs a
//  quality-tier system (PERFORMANCE.md §7) would eventually drive; for now they
//  are hand-set to the "Medium/High" values.
// ============================================================
export const PERF = {
  // ---- frame cap ----
  // Hard ceiling on rendered frames per second (0 = uncapped, run as fast as the
  // display allows). There is nothing to gain above 60 here: the simulation is
  // time-based, so extra frames buy no responsiveness, and every one of them is a
  // full GPU frame — on a 120 Hz panel an uncapped loop draws twice the work for a
  // difference nobody is looking for, which on a laptop is just heat and battery.
  targetFps: 60,

  // ---- prop chunking (§3.3) ----
  // Each PROPS row used to be ONE InstancedMesh spanning r=0..115, so its
  // bounding sphere covered the whole world and frustum culling could only ever
  // be all-or-nothing — which is why it was switched off, and why 1.38M prop
  // triangles were submitted every frame including everything behind the camera.
  // Rows are now split into a grid of cells, each its own InstancedMesh with a
  // tight bounding sphere. Draw calls go up; submitted triangles fall by 3-5x.
  //
  // Target TRIANGLES per chunk, not instances — those give very different answers.
  // 17 driftwood logs and 84 canopy kelp bushes are both "a row", but the logs are
  // 5k triangles and the kelp is 289k: chunking the logs buys nothing and costs 8
  // draw calls, while chunking the kelp is the biggest geometry win on the table.
  // So the cell size is derived from this budget and the row's own ring area, and
  // cheap rows stay a single chunk. Lower = better culling, more draw calls.
  //
  // Swept against the real GLB triangle counts over 6,000 randomised camera poses
  // (mean prop triangles submitted per frame, out of 1.375M in the world):
  //
  //     budget   chunks   calls/frame   tris/frame   cut
  //     none         24            24        1.37M    0%
  //     25000       170            78         783k   43%
  //     12000       260           107         636k   54%
  //      8000       311           119         591k   57%   <- here
  //      5000       357           131         553k   60%
  //      3000       428           144         489k   64%
  //
  // 8000 is where the curve flattens: everything past it buys a couple of percent
  // per 15 extra draw calls. 119 draw calls is nothing on any GPU this targets —
  // the metric that was actually hurting is triangles submitted.
  chunkTriangles: 8000,
  // ...floored at this many instances per chunk, so a row of a few heavy props
  // can't shatter into one draw call each.
  minPropsPerChunk: 5,
  // Hard distance cull, matched to the fog. FogExp2 transmittance is exp(-(d·ρ)²),
  // so at 120 units a prop is showing 7% of its colour through the haze and is not
  // worth a triangle. Measured to the NEAR EDGE of a chunk's sphere, never its
  // centre — which is also why this never touches the mountains: their row is a
  // single chunk 128 units in radius, so its near edge is always within range and
  // the range silhouette survives. Only the small, numerous, far rows get cut.
  propCull: 120,
  // 'lambert' | 'standard'. Every prop material arrives from GLTFLoader as
  // MeshStandardMaterial — a full Cook-Torrance BRDF against 3 lights, per
  // fragment, with metalness forced to 0 and no environment map to reflect. On
  // ~1.4M triangles of fogged rock and foliage, Lambert's diffuse-only lighting
  // is a large fragment-ALU saving for a difference that is genuinely hard to
  // see. Flip to 'standard' if the rock looks too flat.
  propMaterial: 'lambert',

  // ---- animation mixers (§4.3) ----
  // Each AnimationMixer does keyframe interpolation, writes every bone transform,
  // then Skeleton.update() rebuilds every bone matrix and re-uploads a bone
  // texture. 22 of those ran every frame. You cannot see a clownfish's tail beat
  // through fog at 50 metres, so: full rate inside `mixerNear`, `mixerFarHz`
  // beyond it, frozen entirely past `mixerFar`. The shark always runs full rate.
  mixerNear: 45,
  mixerFar: 100,
  mixerFarHz: 20,
};

// Three always-on loops (deep ambience, a bubbling texture, and a distant
// whale) plus a fourth loop whose volume/rate track the shark's speed, so
// "swimming" has a sound. The rest are one-shot SFX. volume/rate are
// [atRest, atMaxSpeed] pairs for the swim loop; a flat number for everything
// else.
export const AUDIO = {
  // Both ambient beds came up: the deep-ocean layer by ~30% (0.65 -> 0.85) and the
  // distant whale by ~60% (0.29 -> 0.46). They were mixed against each other rather
  // than against the room, and at the old levels the whale in particular was under
  // the threshold where you notice it at all.
  //
  // Then all three beds went up another 40%... except the deep-ocean layer, which
  // could not. HTMLAudioElement.volume is HARD CAPPED at 1.0, and that layer was
  // already at 0.85, so 0.85 x 1.4 = 1.19 is simply not expressible: it lands at
  // 1.0, which is +18%, not +40%. The other two had the headroom and got the full
  // amount. If the bed still needs to be louder than the element ceiling allows,
  // that takes routing it through a Web Audio GainNode (gain > 1 is legal there) —
  // which is the one thing this module was written to avoid, so it is a deliberate
  // decision rather than a line to add casually.
  ambience: { url: 'assets/audio/deep-ocean-ambience.mp3', volume: 1.0 },
  bubbles:  { url: 'assets/audio/bubbles-ambience.ogg',    volume: 0.224 },
  whale:    { url: 'assets/audio/whale_sound.mp3',         volume: 0.644 },
  swim:     { url: 'assets/audio/shark_movement.mp3', volume: [0.05, 0.45], rate: [0.8, 1.5] },
  collect:  { url: 'assets/audio/orb-collect.mp3', volume: 0.3 },
  splash:   { url: 'assets/audio/shark_drop_into_ocean.wav', volume: 0.36 },
  // A bubble gush, not a jaw snap. The snap was the obvious read for "bite" and
  // it was wrong: a dry mouth-close has no water in it, so underwater it lands as
  // a person chewing in air. What actually sells a bite at depth is the volume of
  // water the jaws displace — a muffled impact, then a burst of bubbles churning
  // and rising. So this is three layers: water impact under 2.2kHz for the chomp,
  // a continuous gush behind it, and discrete bubble pops on top for texture.
  // The global low-pass sits at 7kHz, NOT lower: small bubbles resonate up around
  // 2-6kHz, so filtering down to a "murky" 3kHz kills the exact band that makes
  // them read as bubbles and leaves a dull whump. 0.5s, spent by 460ms.
  // The [min,max] rate spread is per-play pitch jitter — identical chomps back to
  // back are what made the old one grating, and +/-8% is enough to break that up.
  bite:     { url: 'assets/audio/shark_bite.mp3', volume: 0.45, rate: [0.92, 1.08] },
  // And the swallow reuses the orb chime, pitched down so eating a whale doesn't
  // sound identical to picking up a blob. Halved from 0.34: it fires on every
  // single fish, so anything that reads as a "ping" the first time reads as
  // nagging by the fiftieth.
  eat:      { url: 'assets/audio/orb-collect.mp3', volume: 0.17, rate: 0.75 },
};
