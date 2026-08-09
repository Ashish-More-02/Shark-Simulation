import {
  WORLD,
  ROCK_PALETTE,
  MOUNTAIN_PALETTE,
  PEBBLE_PALETTE,
} from "../config.js";

// ---- LEVEL 1: THE SHALLOWS -------------------------------------------------
// The open plain you start on, up-Z from the reef, joined to it by the canyon at
// -Z. Deliberately thin: it is the tutorial, and it is the contrast that makes
// level 2 land. See Docs/systems/world-levels.md.
export const LEVEL_1 = {
  id: 1,
  name: "The Shallows",
  center: [0, 0, 280],
  play: 95,
  seabed: -24,
  gapDir: -Math.PI / 2,
  clear: [
    { x: -25.6, z: -31.4, r: 15 },
    { x: -43.4, z: -18.2, r: 21 },
    { x: -0.0, z: -100.4, r: 21 },
    { x: -5.9, z: -136.6, r: 3 },
  ],
};

// Patch sets. Fewer and wider than the reef's — a plain is mostly open ground
// with occasional structure, but it still has to be patches: an even sprinkle
// over 28,000 square units is what read as empty rather than as open.
const PLAIN_ROCK = { key: "plainrock", seeds: 7, radius: 17, frac: 0.8 };
const PLAIN_MEADOW = { key: "plainmeadow", seeds: 8, radius: 26, frac: 0.8 };

// Roughly a fifth of the reef's props, no mid-storey canopy, no bones, flora kept
// low. The mountain ring stays at full strength — it is the wall that makes the
// canyon mouth the obvious way on. See ./index.js for the row-key legend.
export const PROPS_PLAIN = [
  // These are MEANT to breach the surface. In 42 m of water a seamount whose top
  // clears the waterline is an island, and a rim of sea stacks against a visible
  // surface is what tells you how deep you are with no HUD. At sMin a peak stops
  // 16 units under it; at sMax it stands 20 above.
  { model: "mountain", count: 18, sMin: 0.6, sMax: 1.45, ring: [WORLD.mountainRing, 120], tilt: 0, sink: 3, palette: MOUNTAIN_PALETTE, solid: 0.8, taper: 0.1, gap: 0.5 },

  // Outcrops, gathered into a few rubble fields, so the plain has somewhere to be
  // as well as somewhere to cross.
  { model: "boulder", count: 34, sMin: 0.5, sMax: 1.7, ring: [26, 96], tilt: 0.2, palette: ROCK_PALETTE, edgeScale: 0.7, solid: 0.85, taper: 0.5, clump: PLAIN_ROCK },
  { model: "rockSpire", count: 20, sMin: 0.5, sMax: 1.9, ring: [30, 96], tilt: 0.15, palette: ROCK_PALETTE, edgeScale: 0.7, solid: 0.8, taper: 0.4, clump: PLAIN_ROCK },
  { model: "rockPile", count: 14, sMin: 0.7, sMax: 1.9, ring: [28, 96], tilt: 0.12, palette: ROCK_PALETTE, edgeScale: 0.6, solid: 0.8, taper: 0.55, clump: PLAIN_ROCK },
  { model: "pebbles", count: 190, sMin: 0.5, sMax: 1.4, ring: [4, 104], tilt: 0.12, palette: PEBBLE_PALETTE, clump: PLAIN_ROCK },

  // Hand-placed landmark boulders. `cull` is raised past the default 120 because
  // a landmark that vanishes before you can steer toward it is not a landmark.
  {
    model: "boulder",
    count: 0,
    palette: ROCK_PALETTE,
    solid: 0.85,
    taper: 0.5,
    sink: 2,
    cull: 190,
    fixed: [{ x: -36.8, z: 56.3, scale: 4.89, rotY: 0.52 }],
  },
  {
    model: "boulder",
    count: 0,
    palette: ROCK_PALETTE,
    solid: 0.85,
    taper: 0.5,
    cull: 190,
    fixed: [
      { x: -47.1, z: -14.0, scale: 4.36, rotY: 2.08 },
      { x: -52.8, z: -29.8, scale: 3.11, rotY: 8.06 },
    ],
  },

  // Seagrass meadows in the sand and a little low weed on the rubble. No canopy
  // in the middle — the tall stuff is what level 2 opens with.
  { model: "seagrass", count: 175, sMin: 0.5, sMax: 1.3, ring: [6, 104], shade: 0.22, sway: 0.12, clump: PLAIN_MEADOW },
  { model: "grass", count: 110, sMin: 0.6, sMax: 1.5, ring: [8, 104], shade: 0.2, sway: 0.05, clump: PLAIN_MEADOW },
  { model: "seaweed", count: 60, sMin: 0.6, sMax: 1.5, ring: [20, 100], shade: 0.22, sway: 0.14, clump: PLAIN_ROCK },
  { model: "anemone", count: 26, sMin: 0.7, sMax: 1.5, ring: [22, 98], shade: 0.2, sway: 0.06, clump: PLAIN_ROCK },

  // The rim forest: pure silhouette through fog, and what tells you from the
  // middle of the plain that the world has an edge. Shorter than the reef's.
  { model: "kelp", count: 88, sMin: 1.3, sMax: 2.1, ring: [82, 115], shade: 0.16, sway: 0.08, edgeScale: 0.45 },
  { model: "kelpFrond", count: 56, sMin: 1.4, sMax: 2.2, ring: [84, 115], shade: 0.18, sway: 0.07, edgeScale: 0.4 },

  { model: "log", count: 10, sMin: 0.8, sMax: 1.4, ring: [16, 92], tilt: 0.25, clump: PLAIN_ROCK },

  // ---- THIS LEVEL'S END OF THE GATE ----
  // Smaller peaks than the reef's, because there is half the water to stand them
  // in, and kelp on the shoulders so the way on is signposted by the scenery
  // changing rather than by a hole in a fence. Level-local: -Z is the canyon.
  {
    model: "mountain",
    count: 0,
    palette: MOUNTAIN_PALETTE,
    solid: 0.8,
    taper: 0.1,
    tilt: 0,
    sink: 3,
    fixed: [
      { x: -70, z: -86, scale: 1.35 },
      { x: 70, z: -86, scale: 1.28 },
      { x: -60, z: -104, scale: 1.15 },
      { x: 60, z: -104, scale: 1.2 },
    ],
  },
  {
    model: "kelp",
    count: 0,
    shade: 0.16,
    sway: 0.08,
    fixed: [
      { x: -46, z: -94, scale: 1.9, n: 22, spread: 14, jitter: 0.3 },
      { x: 46, z: -94, scale: 1.9, n: 22, spread: 14, jitter: 0.3 },
    ],
  },

  // ---- THE APPROACH TO THE CANYON (F4-placed) ----
  // Dressing laid by eye down the -Z run to the gate, so the way on is signposted
  // by the scenery thickening. The oversized ferns are the far markers you pick
  // out through fog; the seagrass, pebbles and rubble confirm you are on the path.
  {
    model: "kelpBush",
    count: 0,
    shade: 0.18,
    sway: 0.07,
    fixed: [
      { x: 23.9, z: -135.2, scale: 2.48, rotY: 1.04 },
      { x: -30.1, z: -126.0, scale: 2.21, rotY: -0.52 },
      { x: -23.7, z: -118.3, scale: 1.97, rotY: -0.52 },
    ],
  },
  {
    model: "seagrass",
    count: 0,
    shade: 0.22,
    sway: 0.12,
    fixed: [
      { x: 16.3, z: -113.5, scale: 1.97, rotY: -0.52 },
      { x: 10.5, z: -109.0, scale: 1.97, rotY: -0.52 },
    ],
  },
  {
    model: "fern",
    count: 0,
    shade: 0.24,
    sway: 0.08,
    cutout: 0.5,
    cull: 190,
    fixed: [
      { x: 9.2, z: -106.0, scale: 1.25, rotY: -0.52 },
      { x: 14.5, z: -110.8, scale: 1.25, rotY: -0.52 },
      { x: -22.2, z: -112.1, scale: 1.25, rotY: -0.52 },
      { x: -19.6, z: -106.2, scale: 1.25, rotY: -0.52 },
      { x: -23.5, z: -100.6, scale: 4.36, rotY: -0.52 },
      { x: 26.2, z: -87.9, scale: 4.36, rotY: -0.52 },
      { x: 31.2, z: -76.9, scale: 4.36, rotY: -0.52 },
    ],
  },
  {
    model: "pebbles",
    count: 0,
    palette: PEBBLE_PALETTE,
    tilt: 0,
    fixed: [
      { x: 5.8, z: -115.8, scale: 1.76, rotY: -0.52 },
      { x: 9.1, z: -112.2, scale: 1.76, rotY: -0.52 },
      { x: 13.6, z: -118.5, scale: 1.76, rotY: -0.52 },
      { x: -7.2, z: -135.9, scale: 1.76, rotY: -0.52 },
      { x: 1.6, z: -85.6, scale: 1.76, rotY: -0.52 },
      { x: 2.0, z: -82.5, scale: 1.4, rotY: -0.52 },
      { x: 3.0, z: -73.4, scale: 1.4, rotY: -3.12 },
      { x: -18.5, z: -71.1, scale: 1.4, rotY: -3.12 },
      { x: -21.0, z: -70.7, scale: 1.4, rotY: -3.12 },
      { x: -5.7, z: -104.8, scale: 1.4, rotY: -3.12 },
    ],
  },
  // Rubble, so it gets a collider — the one row here you cannot swim through.
  {
    model: "rockPile",
    count: 0,
    palette: ROCK_PALETTE,
    solid: 0.8,
    taper: 0.55,
    tilt: 0,
    sink: 1,
    fixed: [
      { x: -30.0, z: -132.8, scale: 2.21, rotY: -3.12 },
      { x: -8.5, z: -76.1, scale: 1.4, rotY: -3.12 },
      { x: 29.6, z: -99.3, scale: 1.4, rotY: -0.91 },
    ],
  },
];
