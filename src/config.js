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

export const DEEP_COLOR  = 0x0d3b52;   // fog / water tint
export const SAND_COLOR  = '#c8ab7d';  // seabed
export const FOG_DENSITY = 0.0135;     // loose enough to see the mountains

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
export const MODELS = {
  shark:    { url: 'assets/shark-animated.glb', targetSize: 6.0, rotY: Math.PI, anchorBottom: false },
  fish:     { url: 'assets/fish.glb',         targetSize: 1.1,  rotY: Math.PI, anchorBottom: false },

  // Animated reef fish — skinned rigs that SHOAL (fish.js), one AnimationMixer per
  // fish. Same Root/Spine/Tail/Face rig family as the shark and the dolphin, head
  // bone at +Z in bind pose, so they take the same Math.PI.
  // targetSize is the fish's LENGTH in world units next to a 6-unit shark. Held
  // near 1 deliberately: true-to-life a clownfish would be a tenth of that and
  // simply invisible in the fog, so these sit in the same visual register as the
  // mid-water bait shoals — big enough to read as a species, small enough that the
  // shark still dwarfs them.
  blueFish: { url: 'assets/blue_fish.glb',    targetSize: 0.95, rotY: Math.PI, anchorBottom: false },
  clownFish:{ url: 'assets/clownFish.glb',    targetSize: 0.8,  rotY: Math.PI, anchorBottom: false },
  fish2:    { url: 'assets/fish-2.glb',       targetSize: 1.15, rotY: Math.PI, anchorBottom: false },

  // animated wildlife — skinned rigs, one AnimationMixer each (see creatures.js)
  dolphin:  { url: 'assets/Dolphin.glb',      targetSize: 5.0,  rotY: Math.PI, anchorBottom: false },
  whale:    { url: 'assets/whale.glb',        targetSize: 21,   rotY: Math.PI, anchorBottom: false },
  angler:   { url: 'assets/anglerfish.glb',   targetSize: 2.4,  rotY: Math.PI, anchorBottom: false },

  // seabed flora
  grass:    { url: 'assets/grass.glb',        targetSize: 2.6,  rotY: 0, anchorBottom: true },
  kelp:     { url: 'assets/kelp.glb',         targetSize: 8.5,  rotY: 0, anchorBottom: true },
  kelpBush: { url: 'assets/kelp-tall.glb',    targetSize: 5.5,  rotY: 0, anchorBottom: true },
  kelpFrond:{ url: 'assets/kelp-2.glb',       targetSize: 4.6,  rotY: 0, anchorBottom: true },
  seaweed:  { url: 'assets/seaweed.glb',      targetSize: 4.5,  rotY: 0, anchorBottom: true },
  seagrass: { url: 'assets/Seaweed-3.glb',    targetSize: 3.0,  rotY: 0, anchorBottom: true },
  anemone:  { url: 'assets/sea-anemone.glb',  targetSize: 2.6,  rotY: 0, anchorBottom: true },
  fern:     { url: 'assets/fern.glb',         targetSize: 3.4,  rotY: 0, anchorBottom: true },

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
export const CREATURES = [
  // The whale keeps to the open water beyond the reef — a silhouette you notice
  // out in the blue, not something crossing the middle of the play area.
  { model: 'whale',   count: 1, sMin: 0.92, sMax: 1.06, band: [0.42, 0.78],
    ring: [48, 72], clip: 'Armature|Swim',
    rate: 0.34, speed: 2.4, turn: 0.28, dwell: [10, 8], shy: 0 },

  { model: 'dolphin', count: 2, sMin: 0.85, sMax: 1.08, band: [0.5, 0.95],
    ring: [8, 66], clip: 'Armature|Swim',
    rate: 1.15, speed: 5.4, turn: 1.5, dwell: [3, 3], shy: 0.35 },

  { model: 'angler',  count: 3, sMin: 0.7, sMax: 1.35, band: [0.02, 0.22],
    ring: [12, 70], clip: 'Fish_Armature|Swimming_Normal',
    rate: 0.85, speed: 1.4, turn: 0.8, dwell: [6, 6], shy: 0.5,
    glow: { material: 'Light', color: 0x9df0ff, intensity: 2.6 } },
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
};

// Shoaling fish. A reef isn't one size of fish repeated — it's clouds of fry,
// mid-water shoals, and a handful of big slow loners. Each school picks ONE size
// class (weighted), then every member jitters inside that class's range, so the
// scale variety reads as species rather than as random noise.
//   scale  : [min, max] multiplier on the normalized fish model
//   count  : [min, extra] members per school
//   spread : school volume the members hold station in
//   speed  : [base, extra] cruise speed — mass costs acceleration, so big is slow
//   weight : relative odds of a school drawing this class
export const FISH = {
  // ~54 fish, and each one is its own draw call — don't overdo it. `species` below
  // adds another 9-24 fish on top, at three draw calls each.
  schools: 7,
  fleeRadius: 20, fleeSpeedMul: 2.8, fleeDistance: 30,
  // Shoals range this × WORLD.half. Cut from 1.1 when the world grew: as a
  // FRACTION it would have scaled with the bound and scattered the same 7 schools
  // across twice the water, so you'd almost never run into one. 0.85 × 77 ≈ 65 is
  // close to the old absolute 60, which keeps encounters as frequent as before and
  // leaves the far water to the mountains and the kelp canopy — which is where
  // shoals belong anyway. Bait fish hold to the reef, not the open ocean.
  roam: 0.85,
  // Default depth band, as [low, high] fractions of the water column — 0 = mean
  // seabed, 1 = surface, the same convention CREATURES uses. This pair reproduces
  // the seabed+6 .. surface-6 range these shoals have always had: mid-water, which
  // is where generic bait fish belong. A species row can override it.
  band: [0.18, 0.82],
  // How far a school's CENTRE stays off the dunes. Members hang below it and clamp
  // individually against their own body radius, so this is the formation's floor,
  // not the fish's.
  floorClear: 3,
  // Scale bumped up across the three larger classes (fry stay fry — a bigger
  // "cloud of fry" isn't the ask) and weight shifted toward those same
  // classes, so bigger fish are both individually larger and more common.
  classes: [
    { scale: [0.3,  0.5], count: [6,  5], spread: [4.5, 2.0, 4.5], speed: [2.8, 1.7], weight: 2 },
    { scale: [1.0,  1.6], count: [8,  6], spread: [7.0, 3.2, 7.0], speed: [2.1, 1.5], weight: 4 },
    { scale: [2.1,  3.0], count: [4,  4], spread: [9.0, 4.2, 9.0], speed: [1.6, 1.1], weight: 4 },
    { scale: [3.8,  5.0], count: [1,  2], spread: [11,  5.5, 11 ], speed: [1.2, 0.8], weight: 3 },
  ],
  // ---- NAMED SPECIES ----
  // The `classes` above are all the same untextured salmon at N scales, moved by a
  // procedural tail flick. These rows are real skinned rigs playing their own swim
  // clip, so the school genuinely swims. That costs an AnimationMixer per fish and
  // one draw call per material (three each, and they can't be merged or instanced —
  // a skinned mesh has to keep its own node), which is exactly why they come in
  // ones and twos of three or four: a species you happen upon is an encounter, a
  // species that's everywhere is wallpaper.
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
      spread: [3.4, 1.6, 3.4], speed: [2.4, 1.3], clip: 'Armature|Swim.001', rate: 2.2,
      band: [0.06, 0.28], floorClear: 1.8 },
    { model: 'clownFish', schools: [1, 2], count: [3, 1], scale: [0.9, 1.3],
      spread: [3.0, 1.4, 3.0], speed: [2.6, 1.4], clip: 'Armature|Swim',     rate: 2.6,
      band: [0.02, 0.18], floorClear: 1.6 },
    { model: 'fish2',     schools: [1, 2], count: [3, 1], scale: [1.0, 1.4],
      spread: [3.6, 1.7, 3.6], speed: [2.2, 1.2], clip: 'Armature|Swim',     rate: 2.0 },
  ],
};

export const ORBS = { count: 12, collectRadius: 2.2 };

// Bubbles and marine snow are spread over a box sized off WORLD.half, so their
// counts had to grow with its AREA (~2x) or the water would have gone visibly
// clearer everywhere. Both are one draw call each no matter the count — these are
// GPU-animated Points fields — so this is close to free. The wake is emitted at
// the shark and doesn't care how big the world is.
export const PARTICLES = {
  bubbles: { count: 800, size: 0.55, opacity: 0.6 },
  snow:    { count: 1350, size: 0.16, opacity: 0.42 },
  wake:    { count: 150, size: 0.3,  opacity: 0.5 },
};

// Also spread off WORLD.half, but unlike the particles each shaft is its own mesh,
// so this count IS the draw-call count. 30 is still nothing next to the ~24 the
// entire seabed costs.
export const GOD_RAYS = { count: 30 };

// Three always-on loops (deep ambience, a bubbling texture, and a distant
// whale) plus a fourth loop whose volume/rate track the shark's speed, so
// "swimming" has a sound. The rest are one-shot SFX. volume/rate are
// [atRest, atMaxSpeed] pairs for the swim loop; a flat number for everything
// else.
export const AUDIO = {
  ambience: { url: 'assets/audio/deep-ocean-ambience.mp3', volume: 0.65 },
  bubbles:  { url: 'assets/audio/bubbles-ambience.ogg',    volume: 0.16 },
  whale:    { url: 'assets/audio/whale_sound.mp3',         volume: 0.29 },
  swim:     { url: 'assets/audio/shark_movement.mp3', volume: [0.05, 0.45], rate: [0.8, 1.5] },
  fishFlee: { url: 'assets/audio/fish-flee.mp3', volume: 0.35, cooldown: 4 },   // min seconds between plays
  collect:  { url: 'assets/audio/orb-collect.mp3', volume: 0.3 },
  splash:   { url: 'assets/audio/shark_drop_into_ocean.wav', volume: 0.36 },
};
