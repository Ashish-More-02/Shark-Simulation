// ============================================================
//  CONFIG — every tunable in the game. Data only, no logic.
//  Level definitions and their prop tables live in ./levels/.
// ============================================================

export const WORLD = {
  half: 77, // content radius of one basin — most placement sizes off this
  surface: 18, // water surface plane, one for the whole world
  seed: 2112001399, // one seed for the whole world; ?seed=12345 overrides for a session
  mountainRing: 78, // inner edge of the shallows' mountain range
  margin: 130, // bare sand past the play bound so the seabed fades into fog
};

// The only route between the two basins: a corridor in plan, a ramp in
// elevation. The ramp is a function of z alone, which keeps the seabed
// continuous without special-casing the corridor.
export const CANYON = {
  halfWidth: 26,
  zMin: 88, // level 2 end of the corridor
  zMax: 197, // level 1 end
  rampBottom: 95, // at/below this z the floor is fully at level 2's height
  rampTop: 190, // at/above this z it is fully at level 1's height
  plainDunes: 0.35, // level 1's dunes, as a fraction of level 2's
};

export const DEEP_COLOR = 0x0c3b58; // fog / water tint
export const SAND_COLOR = "#c8ab7d"; // seabed
export const FOG_DENSITY = 0.0135; // loose enough to see the mountains

// Above the waterline. sunDir must match the DirectionalLight in core.js.
export const SKY = {
  horizon: 0xc2dbe8,
  zenith: 0x4f96c8,
  sun: 0xfff2d0,
  sunDir: [0.283, 0.943, 0.189],
};

// The water column you see past the reef.
export const BACKDROP = { top: 0x2c83b2, bottom: 0x020c14 };

// The surface from underneath: a bright Snell's window overhead falling off to a
// dark mirror at grazing angles. DEEP_COLOR, BACKDROP and this move together.
export const WATER = {
  deep: 0x06202f, // grazing — the mirror
  window: 0x2f7ba4, // overhead — sky through the window
  glint: 0xa8dcf5, // sun veins inside the window
  opacity: [0.94, 0.52], // [grazing, overhead]
  brightness: 1.2, // luminance multiplier, applied in the shader
};

// Per-instance rock colouring (props.js). Weighted dark so the reef reads black.
export const ROCK_PALETTE = [
  0x26262a, 0x2e2e31, 0x1e1e21, 0x37373a, // basalt
  0x6a6a6c, 0x7b7871, 0x565859, 0x4d4f50, // granite / weathered grey
  0x6b5643, 0x7a6a52, 0x54483a, 0x453a2f, // sandstone / sediment
  0x49543f, 0x3f4a3c, // algae-covered
];
export const MOUNTAIN_PALETTE = [
  0x4a5560, 0x3d4a52, 0x55606b, 0x46484a, // cold distant rock
  0x5a5245, 0x4e463c, 0x615748, // brown sediment flanks
];
// Pebbles sit on pale sand, so they read as shingle rather than basalt.
export const PEBBLE_PALETTE = [
  0x8d8378, 0x9a9186, 0x7c7468, 0xa39a8c, // sun-bleached shingle
  0x8a7a63, 0x99886d, 0x6f6455, // sandy / sediment
  0x6d726b, 0x5f665e, // damp greenish grey
];

// Per-model setup.
//   targetSize : longest dimension in world units after auto-scaling by bbox
//   rotY       : spin that points the model's nose at -Z (Three.js forward)
//   anchorBottom: seat the model on the sand instead of on its own origin
//   twoSided   : disable backface culling. Only for geometry you can see the
//                inside of — animals (single-sided fins), alpha-cut leaf cards,
//                and kelp-2, whose edges are wound inconsistently. If a prop ever
//                looks hollow, adding this row's flag is the whole fix.
export const MODELS = {
  shark: { url: "assets/shark-animated.glb", targetSize: 6.0, rotY: Math.PI, anchorBottom: false, twoSided: true },
  fish: { url: "assets/fish.glb", targetSize: 1.1, rotY: Math.PI, anchorBottom: false, twoSided: true },

  // Animated reef fish — skinned rigs that shoal (fish.js). targetSize is length
  // against a 6-unit shark, held near 1 so they read at fog distance.
  blueFish: { url: "assets/blue_fish.glb", targetSize: 0.95, rotY: Math.PI, anchorBottom: false, twoSided: true },
  clownFish: { url: "assets/clownFish.glb", targetSize: 0.8, rotY: Math.PI, anchorBottom: false, twoSided: true },
  fish2: { url: "assets/fish-2.glb", targetSize: 1.15, rotY: Math.PI, anchorBottom: false, twoSided: true },

  // Animated wildlife — one AnimationMixer each (creatures.js).
  dolphin: { url: "assets/Dolphin.glb", targetSize: 5.0, rotY: Math.PI, anchorBottom: false, twoSided: true },
  whale: { url: "assets/whale.glb", targetSize: 21, rotY: Math.PI, anchorBottom: false, twoSided: true },
  angler: { url: "assets/anglerfish.glb", targetSize: 2.4, rotY: Math.PI, anchorBottom: false, twoSided: true },

  // Seabed flora
  grass: { url: "assets/grass.glb", targetSize: 2.6, rotY: 0, anchorBottom: true },
  kelp: { url: "assets/kelp.glb", targetSize: 8.5, rotY: 0, anchorBottom: true },
  kelpBush: { url: "assets/kelp-tall.glb", targetSize: 5.5, rotY: 0, anchorBottom: true },
  kelpFrond: { url: "assets/kelp-2.glb", targetSize: 4.6, rotY: 0, anchorBottom: true, twoSided: true },
  seaweed: { url: "assets/seaweed.glb", targetSize: 4.5, rotY: 0, anchorBottom: true },
  seagrass: { url: "assets/Seaweed-3.glb", targetSize: 3.0, rotY: 0, anchorBottom: true },
  anemone: { url: "assets/sea-anemone.glb", targetSize: 2.6, rotY: 0, anchorBottom: true },
  fern: { url: "assets/fern.glb", targetSize: 3.4, rotY: 0, anchorBottom: true, twoSided: true },

  // Rock — coloured per instance from ROCK_PALETTE / MOUNTAIN_PALETTE
  boulder: { url: "assets/rock-boulder.glb", targetSize: 6.0, rotY: 0, anchorBottom: true },
  rockPile: { url: "assets/rock-cluster.glb", targetSize: 8.0, rotY: 0, anchorBottom: true },
  rockSpire: { url: "assets/rock-large.glb", targetSize: 4.8, rotY: 0, anchorBottom: true },
  mountain: { url: "assets/mountain.glb", targetSize: 46, rotY: 0, anchorBottom: true },
  pebbles: { url: "assets/pebbles.glb", targetSize: 1.7, rotY: 0, anchorBottom: true },

  // Seabed litter
  log: { url: "assets/log.glb", targetSize: 3.2, rotY: 0, anchorBottom: true },
  bones: { url: "assets/fish-bones.glb", targetSize: 1.9, rotY: 0, anchorBottom: true },
};

// Roaming wildlife — one skinned rig per instance, not instanced, so counts stay
// small. All of it lives in level 2 (the reef).
//   band   : [low, high] fraction of the water column, 0 = seabed, 1 = surface
//   ring   : [inner, outer] radius its waypoints are drawn from, equal-area
//   clip   : animation clip name; falls back to the file's first clip
//   rate   : clip timeScale at cruise speed
//   turn   : max yaw rate, rad/s — big animals arc, small ones dart
//   shy    : how hard it veers off when the shark closes in (0 = ignores you)
//   glow   : { material, color, intensity } — material name must match EXACTLY
//   bites  : snaps to eat it (prey.js);  points : growth, read against SHARK.growthFull
export const CREATURES = [
  {
    model: "whale",
    count: 2,
    sMin: 0.92,
    sMax: 1.06,
    band: [0.42, 0.78],
    ring: [30, 68],
    clip: "Armature|Swim",
    rate: 0.34,
    speed: 2.4,
    turn: 0.28,
    dwell: [10, 8],
    shy: 0,
    name: "Whale",
    bites: 10,
    points: 70,
  },
  {
    model: "dolphin",
    count: 4,
    sMin: 0.85,
    sMax: 1.08,
    band: [0.5, 0.95],
    ring: [8, 52],
    clip: "Armature|Swim",
    rate: 1.15,
    speed: 5.4,
    turn: 1.5,
    dwell: [3, 3],
    shy: 0.35,
    name: "Dolphin",
    bites: 3,
    points: 14,
  },
  {
    model: "angler",
    count: 5,
    sMin: 0.7,
    sMax: 1.35,
    band: [0.02, 0.22],
    ring: [10, 54],
    clip: "Fish_Armature|Swimming_Normal",
    rate: 0.85,
    speed: 1.4,
    turn: 0.8,
    dwell: [6, 6],
    shy: 0.5,
    glow: { material: "Light", color: 0x9df0ff, intensity: 2.6 },
    name: "Anglerfish",
    bites: 1,
    points: 3,
  },
];

// Shark handling, plus the timeScale multipliers for its baked swim clip.
// Drag pins cruise speed at accel/drag ≈ 12.2; boostAccelMul is what pushes the
// equilibrium past boostSpeed, which then hard-clamps it there.
//
// One world unit is one metre (see depthMetres/sharkLength in shark.js), so these
// are m/s and convert to real speeds directly: cruise 12.2 m/s = 27 mph, sprint
// 15.2 m/s = 34 mph. Both sit in the band a real shark runs — ~25-35 mph cruising,
// 35-45 in a burst.
export const SHARK = {
  maxSpeed: 14,
  accel: 22,
  drag: 1.8,
  turn: 1.6,
  pitchRate: 1.2,
  pitchLimit: 1.15,
  boostSpeed: 15.2,   // 34 mph
  // Has to keep the boosted equilibrium (accel x this / drag) clear of boostSpeed
  // or the clamp stops governing and the sprint creeps up to its asymptote over
  // several seconds instead of arriving. 1.35 puts it at 16.5, so 15.2 is reached
  // about two thirds of a second after Shift goes down.
  boostAccelMul: 1.35,
  reverseFrac: 0.4,
  reverseAccelMul: 1.2,
  tailRateIdle: 0.55,
  tailRateFast: 2.3,
  tailNormalMul: 0.8, // flat multipliers on top of the idle -> fast ramp, so
  tailSprintMul: 1.2, // cruise and sprint read as two distinct gaits
  camOffset: [0, 2.6, 8.5], // behind (+Z) and above the head
  startPos: [0, -2, 280], // middle of level 1; the floor clamp seats it on frame one
  floorClearance: 1.8,
  wakeAtSpeed: 3.5, // bubble trail kicks in above this
  mouseSensitivity: 0.0022,
  bodyRadius: 1.15, // resolved as three spheres down the body (collision.js)
  bodyHalfLength: 2.3,

  // Growth. Every length above is multiplied by the current scale at use
  // (shark.js) — collider, floor clearance, camera offset, bite reach.
  maxScale: 2.1, // 6.0 x 2.1 = 12.6 units, against the whale's 21
  camGrowth: 0, // how much of the growth the camera follows. 0 = growth is visible
  growthFull: 400, // points for maxScale; clearing the reef once is ~348
  growthLag: 1.2, // seconds for the scale to catch up — cosmetic damping
};

// Boost as a resource, measured in seconds of boost so the bar means something.
// Bottoming out LATCHES (shark.js): Shift does nothing until it refills fully,
// or an exhausted shark stutters in and out of boost one frame at a time.
export const STAMINA = {
  boostSeconds: 6, // a full bar, held down
  refillSeconds: 3.5, // empty -> full
};

// Biting. One sphere-vs-body query per click against the prey registry
// (prey.js) — no per-frame cost, which is why the reach can be generous.
export const BITE = {
  cooldown: 0.4, // seconds between snaps
  snap: 0.22, // head-snap animation length
  lunge: 3.2, // forward impulse, so a bite is also a pounce
  mouthAhead: 2.9, // puts the bite sphere at the nose; scales with the shark
  reach: 3.4, // hit radius, plus the prey's own girth
  coneCos: 0.45, // prey must be roughly ahead — ~63° half-angle
  gape: 1.8, // ...except inside this distance, where angle stops mattering
  respawn: 60, // seconds until an eaten animal returns, well away from the shark
  orbPoints: 6, // orbs are pure bonus growth: no bites, no chase
};

// Shoaling fish. Each school picks one size class (weighted), then every member
// jitters inside that class, so the variety reads as species rather than noise.
export const FISH = {
  schools: 6, // generic bait schools, spread by area
  centerSchools: 4, // extra schools pinned near the start point...
  centerRoam: 0.34, // ...with a roam radius this fraction of the usual one

  // Two panic states: ALARMED is sustained flight while the shark is inside
  // fleeRadius; SPRINT is the extra gear on top, in bursts. The escape heading
  // is picked once per burst and held, so a shoal runs a line instead of
  // pivoting with the shark.
  fleeRadius: 26,
  fleeSpeedMul: 2.0, // burst multiplier
  alarmSpeedMul: 1.6, // sustained-flight multiplier between bursts
  sprintTime: 2.2,
  sprintCooldown: 3.2, // from the START of one burst to the next
  escapeTurn: 0.45, // fraction of the turn away from the shark a burst takes
  escapeCone: 1.2, // ...but never end up within this many rad of facing it
  burstSpread: 1.5, // formation flash-expands during a burst
  // Hard ceiling on shoal speed, whatever the multipliers work out to. Must stay
  // under the shark's own top speed or fish become uncatchable — this is what
  // stops the next cruise-speed raise reintroducing that bug.
  sprintCap: 13.2,
  beatMax: 2.2, // tail beat scales with speed/cruise, capped here
  roam: 0.85, // schools range this x WORLD.half

  // Steering: a school holds a HEADING and always swims forward along it.
  wanderDwell: [4, 4], // [min, extra] seconds between course nudges
  wanderTurn: 0.9, // max nudge, radians — curves, never doubles back
  turnRate: [1.1, 0.7], // [min, extra] rad/s, divided down by formation width
  alarmTurnMul: 1.9,
  speedEase: 0.002, // fraction of the speed gap remaining after one second
  climbRate: 2.2, // max vertical speed, units/s
  edgeMargin: 0.78, // fraction of roam radius where the turn-back pressure starts
  edgeTurn: 3.0, // ...and how hard it builds

  // Depth band, as HEIGHT ABOVE THE SEABED expressed as a fraction of levels.js
  // HABITAT (33 units) — so it means the same height at every depth.
  band: [0.18, 0.82],
  // Extra schools riding the water above the habitat band, where a deeper level
  // has headroom. Level 1's column IS the reference span, so it gets none.
  highSchools: 4,
  highBand: [0.05, 0.85], // fraction of the headroom, top of habitat -> surface
  highMinRoom: 12, // below this much spare column, don't bother
  floorClear: 3, // how far the school's CENTRE stays off the dunes
  bites: 1, // a class or species row may override either
  points: 1,

  //   scale  : [min, max] multiplier on the normalized fish model
  //   count  : [min, extra] members per school
  //   spread : school volume the members hold station in
  //   speed  : [base, extra] cruise speed — both halves move together
  //   weight : relative odds of a school drawing this class
  classes: [
    { scale: [0.6, 1.0], count: [6, 5], spread: [4.5, 2.0, 4.5], speed: [5.0, 2.8], weight: 2 }, // fry
    { scale: [1.0, 1.6], count: [8, 6], spread: [7.0, 3.2, 7.0], speed: [4.8, 3.0], weight: 4 }, // mid-water
    { scale: [2.1, 3.0], count: [4, 4], spread: [9.0, 4.2, 9.0], speed: [4.2, 2.6], weight: 4 }, // large
    { scale: [3.8, 5.0], count: [1, 2], spread: [11, 5.5, 11], speed: [3.6, 2.2], weight: 3 }, // lunkers
  ],

  // Named species — real skinned rigs playing their own clip, at three draw
  // calls each, so they come in ones and twos. `schools` is [min, max] here, not
  // the [min, extra] pair `count` uses. band/floorClear override the defaults
  // above: the clownfish and blue fish are bottom-dwellers layered just apart,
  // fish-2 keeps the mid-water band and is the one deliberately common species.
  species: [
    {
      model: "blueFish",
      schools: [1, 2],
      count: [3, 1],
      scale: [1.0, 1.4],
      spread: [3.4, 1.6, 3.4],
      speed: [4.2, 2.6],
      clip: "Armature|Swim.001",
      rate: 2.2,
      band: [0.06, 0.28],
      floorClear: 1.8,
      name: "Blue fish",
    },
    {
      model: "clownFish",
      schools: [1, 2],
      count: [3, 1],
      scale: [0.9, 1.3],
      spread: [3.0, 1.4, 3.0],
      speed: [4.6, 2.8],
      clip: "Armature|Swim",
      rate: 2.6,
      band: [0.02, 0.18],
      floorClear: 1.6,
      name: "Clownfish",
    },
    {
      model: "fish2",
      schools: [2, 3],
      count: [4, 2],
      scale: [1.0, 1.4],
      spread: [4.4, 2.0, 4.4],
      speed: [4.6, 2.8],
      clip: "Armature|Swim",
      rate: 2.0,
      name: "Reef fish",
    },
  ],
};

export const ORBS = { count: 12, collectRadius: 2.2 };

// In-game placement editor (F4). The brush cycles `models`, ordered big-to-small
// so the things worth hand-placing come first.
export const EDITOR = {
  models: [
    "mountain",
    "rockPile",
    "boulder",
    "rockSpire",
    "kelp",
    "kelpBush",
    "kelpFrond",
    "seaweed",
    "seagrass",
    "fern",
    "grass",
    "anemone",
    "log",
    "bones",
    "pebbles",
  ],
  distance: 26, // how far ahead of the shark the brush starts
  eraseRadius: 15, // starting size of the erase circle (Tab switches to it)
};

// Bubbles and marine snow, spread over a box sized off WORLD.half. One draw call
// each, so the real cost is FILL — alpha-blended sprites a tile GPU cannot cull.
export const PARTICLES = {
  bubbles: { count: 350, size: 0.55, opacity: 0.6 },
  snow: { count: 700, size: 0.16, opacity: 0.42 },
  wake: { count: 150, size: 0.3, opacity: 0.5 },
};

// One InstancedMesh, billboarded in the vertex shader — so `count` costs fill,
// not draw calls. The camera lives inside the volume and each shaft covers a big
// slab of screen, which is why 10 and not 30.
export const GOD_RAYS = {
  count: 10,
  fade: [70, 135], // [near, far] world units from the camera
};

// ---- PERFORMANCE DIALS -----------------------------------------------------
// Everything here trades image quality for frame time. Hand-set to Medium/High.
export const PERF = {
  targetFps: 60, // 0 = uncapped. The sim is time-based, so extra frames buy nothing.

  // Prop chunking: each PROPS row is split into a grid of InstancedMeshes with
  // tight bounding spheres, so frustum culling stops being all-or-nothing.
  // Target TRIANGLES per chunk, not instances — 8000 is where the curve flattens
  // (~119 draw calls, ~57% fewer triangles submitted). Cheap rows stay one chunk.
  chunkTriangles: 8000,
  minPropsPerChunk: 5, // ...floored here, so heavy rows can't shatter per-instance
  // Hard distance cull, matched to the fog, measured to a chunk's NEAR EDGE —
  // which is why the mountains (one big chunk) always survive it.
  propCull: 120,
  // 'lambert' | 'standard'. Lambert is a large fragment-ALU saving across ~1.4M
  // triangles of fogged rock. Flip to 'standard' if the rock looks too flat.
  propMaterial: "lambert",

  // Animation mixers: full rate inside mixerNear, mixerFarHz beyond it, frozen
  // past mixerFar. The shark always runs full rate.
  mixerNear: 45,
  mixerFar: 100,
  mixerFarHz: 20,
};

// Three always-on loops plus a fourth whose volume/rate track the shark's speed;
// the rest are one-shot SFX. volume/rate are [atRest, atMaxSpeed] pairs for the
// swim loop, a flat number elsewhere. A `rate` pair on a one-shot is per-play
// pitch jitter. Note HTMLAudioElement.volume is hard capped at 1.0.
export const AUDIO = {
  ambience: { url: "assets/audio/deep-ocean-ambience.mp3", volume: 1.0 },
  bubbles: { url: "assets/audio/bubbles-ambience.ogg", volume: 0.224 },
  whale: { url: "assets/audio/whale_sound.mp3", volume: 0.644 },
  swim: {
    url: "assets/audio/shark_movement.mp3",
    volume: [0.05, 0.45],
    rate: [0.8, 1.5],
  },
  collect: { url: "assets/audio/orb-collect.mp3", volume: 0.3 },
  splash: { url: "assets/audio/shark_drop_into_ocean.wav", volume: 0.36 },
  bite: { url: "assets/audio/shark_bite.mp3", volume: 0.45, rate: [0.92, 1.08] },
  eat: { url: "assets/audio/orb-collect.mp3", volume: 0.17, rate: 0.75 },
};
