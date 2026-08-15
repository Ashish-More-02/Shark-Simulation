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
    { x: 46.8, z: 6.4, r: 33 },
    { x: 10.8, z: 31.9, r: 15 },
    { x: -5.5, z: 27.4, r: 15 },
    { x: -22.3, z: 1.5, r: 15 },
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
      { x: 10.2, z: 48.0, scale: 3.90, rotY: -2.34, pitch: -0.13, sink: -0.13 },   // level 1
      { x: 69.3, z: 51.3, scale: 3.90, rotY: -2.34, pitch: -0.13, sink: -0.13 },   // level 1
      { x: 63.1, z: 48.3, scale: 2.48, rotY: -2.34, pitch: -0.13, sink: -0.20 },   // level 1
      { x: 66.8, z: 35.0, scale: 2.48, rotY: -2.34, pitch: -0.13, sink: -0.20 },   // level 1
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
      { x: 34.3, z: -29.8, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: 32.6, z: -64.3, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: 9.4, z: -43.4, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: 19.6, z: -37.4, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: -37.1, z: -11.5, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: -38.0, z: 44.2, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: -60.2, z: -2.0, scale: 3.90, rotY: -2.34, pitch: -0.13, sink: -0.13 },   // level 1
      { x: -60.5, z: 5.6, scale: 3.90, rotY: -2.34, pitch: -0.13, sink: -0.13 },   // level 1
      { x: -51.7, z: 0.4, scale: 3.90, rotY: -2.34, pitch: -0.13, sink: -0.13 },   // level 1
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
   { model: 'reefRocks', count: 0,
    fixed: [
      { x: 72.2, z: -21.5, scale: 3.48 },   // level 1
      { x: 64.3, z: 66.9, scale: 3.48 },   // level 1
      { x: 4.4, z: -34.9, scale: 3.48 },   // level 1
      { x: -90.0, z: 10.5, scale: 3.48 },   // level 1
      { x: -92.9, z: 30.6, scale: 3.48 },   // level 1
      { x: 51.7, z: 46.9, scale: 1.76, sink: 0.28 },   // level 1
      { x: 60.8, z: 51.9, scale: 1.57, sink: 0.32 },   // level 1
      { x: 40.5, z: 53.5, scale: 1.57, sink: 0.32 },   // level 1
      { x: 43.3, z: -10.3, scale: 1.57, pitch: -0.13, sink: -0.32 },   // level 1
      { x: 49.7, z: -2.2, scale: 1.57, pitch: -0.13, sink: -0.32 },   // level 1
      { x: 58.4, z: -35.0, scale: 1.57, pitch: -0.13, sink: -0.32 },   // level 1
      { x: -39.3, z: -2.5, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: 15.4, z: 2.3, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: 8.7, z: 11.8, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: 29.3, z: 5.6, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: 30.0, z: 21.7, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: -7.5, z: 33.1, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: -20.6, z: 6.6, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: 37.0, z: -33.2, scale: 1.40, rotY: -2.34, pitch: -0.13, sink: -0.36 },   // level 1
      { x: 29.5, z: -20.7, scale: 1.76, rotY: -2.34, pitch: -0.13, sink: -0.28 },   // level 1
    ] },
  { model: 'coralGroup', count: 0,
    fixed: [
      { x: 14.8, z: -40.8, scale: 1.97 },   // level 1
      { x: 6.2, z: -47.2, scale: 1.97 },   // level 1
      { x: -9.9, z: -28.1, scale: 1.97 },   // level 1
      { x: 35.9, z: 30.9, scale: 1.97 },   // level 1
      { x: 28.7, z: 33.1, scale: 1.97 },   // level 1
      { x: 37.8, z: 36.8, scale: 1.97, sink: 0.25 },   // level 1
      { x: 4.8, z: -61.5, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: 19.8, z: -56.2, scale: 1.76, pitch: -0.13, sink: -0.28 },   // level 1
    ] },
  { model: 'coralPurple', count: 0,
    fixed: [
      { x: 45.2, z: 32.6, scale: 1.97, sink: 0.25 },   // level 1
      { x: 35.6, z: 42.6, scale: 1.97, sink: 0.25 },   // level 1
      { x: 1.1, z: -27.8, scale: 1.97, sink: 0.25 },   // level 1
      { x: 16.5, z: -33.3, scale: 1.97, sink: 0.25 },   // level 1
      { x: 13.7, z: -46.9, scale: 1.97, sink: 0.25 },   // level 1
      { x: 24.1, z: 31.5, scale: 1.97, sink: 0.25 },   // level 1
      { x: -3.0, z: -38.4, scale: 3.48, pitch: -0.13, sink: -0.14 },   // level 1
      { x: 22.1, z: -44.3, scale: 3.48, pitch: -0.13, sink: -0.14 },   // level 1
      { x: -7.2, z: -59.7, scale: 3.90, pitch: -0.13, sink: -0.13 },   // level 1
      { x: -8.3, z: -50.2, scale: 1.97, pitch: -0.13, sink: -0.25 },   // level 1
    ] },
  { model: 'coralYellow', count: 0,
    fixed: [
      { x: 57.1, z: -57.4, scale: 4.36, sink: 0.11 },   // level 1
      { x: 59.3, z: -52.9, scale: 3.48, sink: 0.14 },   // level 1
      { x: 50.1, z: -56.2, scale: 3.11, sink: 0.16 },   // level 1
      { x: 54.4, z: 50.9, scale: 3.48, sink: 0.14 },   // level 1
      { x: 52.0, z: 55.3, scale: 3.90, sink: 0.13 },   // level 1
      { x: 49.3, z: 51.0, scale: 2.77, sink: 0.18 },   // level 1
      { x: 47.5, z: 55.0, scale: 2.21, sink: 0.23 },   // level 1
      { x: 16.9, z: 8.7, scale: 5.47, rotY: -2.34, pitch: -0.13, sink: -0.09 },   // level 1
      { x: 23.9, z: 10.9, scale: 4.89, rotY: -2.34, pitch: -0.13, sink: -0.10 },   // level 1
      { x: 11.6, z: 16.4, scale: 4.89, rotY: -2.34, pitch: -0.13, sink: -0.10 },   // level 1
      { x: 16.2, z: 14.4, scale: 3.11, rotY: -2.34, pitch: -0.13, sink: -0.16 },   // level 1
      { x: 26.0, z: 14.8, scale: 3.11, rotY: -2.34, pitch: -0.13, sink: -0.16 },   // level 1
      { x: 24.2, z: 1.6, scale: 3.11, rotY: -2.34, pitch: -0.13, sink: -0.16 },   // level 1
      { x: 18.8, z: 0.9, scale: 3.90, rotY: -2.34, pitch: -0.13, sink: -0.13 },   // level 1
      { x: 9.7, z: 5.7, scale: 3.11, rotY: -2.34, pitch: -0.13, sink: -0.16 },   // level 1
      { x: 17.4, z: 74.3, scale: 3.11, rotY: -2.34, pitch: -0.13, sink: -0.16 },   // level 1
      { x: 14.9, z: 80.5, scale: 4.36, rotY: -2.34, pitch: -0.13, sink: -0.11 },   // level 1
      { x: 23.0, z: 81.1, scale: 4.36, rotY: -2.34, pitch: -0.13, sink: -0.11 },   // level 1
      { x: -14.7, z: 76.9, scale: 4.36, rotY: -2.34, pitch: -0.13, sink: -0.11 },   // level 1
      { x: -13.3, z: 71.4, scale: 3.11, rotY: -2.34, pitch: -0.13, sink: -0.16 },   // level 1
      { x: -10.5, z: 74.5, scale: 2.77, rotY: -2.34, pitch: -0.13, sink: -0.18 },   // level 1
      { x: -43.4, z: -27.0, scale: 2.77, rotY: -2.34, pitch: -0.13, sink: -0.18 },   // level 1
      { x: -42.0, z: -30.2, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: -40.2, z: -26.1, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
    ] },
  { model: 'starfish', count: 0,
    fixed: [
      { x: -7.4, z: 21.0, scale: 3.90, sink: 0.13 },   // level 1
      { x: -40.9, z: -29.0, scale: 3.90, sink: 0.13 },   // level 1
      { x: -34.3, z: -16.3, scale: 1.40, pitch: -0.13, sink: -0.36 },   // level 1
      { x: 53.0, z: -48.8, scale: 1.40, pitch: -0.13, sink: -0.36 },   // level 1
    ] },
  { model: 'anemone2', count: 0,
    fixed: [
      { x: -20.8, z: 15.1, scale: 3.48, pitch: -0.13, sink: -0.14 },   // level 1
      { x: -15.1, z: 20.2, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: -13.7, z: 12.3, scale: 2.48, pitch: -0.13, sink: -0.20 },   // level 1
      { x: -13.5, z: 27.6, scale: 2.48, pitch: -0.13, sink: -0.20 },   // level 1
      { x: -19.6, z: 23.9, scale: 4.89, pitch: -0.13, sink: -0.10 },   // level 1
      { x: 75.7, z: 7.7, scale: 3.90, pitch: -0.13, sink: -0.13 },   // level 1
      { x: 74.7, z: 13.6, scale: 3.11, pitch: -0.13, sink: -0.16 },   // level 1
      { x: 72.6, z: 9.8, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: -8.0, z: 17.6, scale: 2.21, pitch: -0.13, sink: -0.23 },   // level 1
      { x: -11.2, z: 21.4, scale: 2.21, pitch: -0.13, sink: -0.23 },   // level 1
    ] },
  { model: 'seaUrchin', count: 0,
    fixed: [
      { x: 29.5, z: 29.4, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: 34.2, z: 35.0, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: 24.5, z: 37.3, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: 45.0, z: 55.9, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: 44.7, z: 59.2, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: 73.4, z: -14.0, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: 76.5, z: -16.6, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: 72.9, z: -17.7, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: -68.5, z: 7.5, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: -69.3, z: 13.2, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: -73.7, z: 8.4, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: -72.3, z: 5.3, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
    ] },
  { model: 'coralRed', count: 0,
    fixed: [
      { x: 50.3, z: -10.0, scale: 2.77, pitch: -0.13, sink: -0.18 },   // level 1
      { x: 47.2, z: -11.2, scale: 2.21, pitch: -0.13, sink: -0.23 },   // level 1
      { x: 48.6, z: -6.1, scale: 5.47, pitch: -0.13, sink: -0.09 },   // level 1
      { x: 60.0, z: -26.2, scale: 6.13, pitch: -0.13, sink: -0.08 },   // level 1
      { x: 59.3, z: -30.7, scale: 3.48, pitch: -0.13, sink: -0.14 },   // level 1
      { x: -16.1, z: 16.2, scale: 1.97, rotY: -2.34, pitch: -0.13, sink: -0.25 },   // level 1
      { x: -13.9, z: 16.8, scale: 1.40, rotY: -2.34, pitch: -0.13, sink: -0.36 },   // level 1
      { x: -17.5, z: 14.2, scale: 1.12, rotY: -2.34, pitch: -0.13, sink: -0.45 },   // level 1
    ] },
  { model: 'coralSet', count: 0,
    fixed: [
      { x: -47.6, z: 44.5, scale: 1.12, rotY: -2.34, pitch: -0.13, sink: -0.45 },   // level 1
      { x: -26.3, z: 74.1, scale: 1.12, rotY: -2.34, pitch: -0.13, sink: -0.45 },   // level 1
      { x: 28.2, z: 71.5, scale: 1.12, rotY: -2.34, pitch: -0.13, sink: -0.45 },   // level 1
    ] },
  { model: 'clam', count: 0,
    fixed: [
      { x: -20.8, z: 61.4, scale: 2.21, rotY: -2.34, pitch: -0.13, sink: -0.23 },   // level 1
      { x: -18.7, z: 64.2, scale: 1.40, rotY: -2.34, pitch: -0.13, sink: -0.36 },   // level 1
      { x: -17.1, z: 60.5, scale: 1.25, rotY: -2.34, pitch: -0.13, sink: -0.40 },   // level 1
      { x: -27.6, z: 47.7, scale: 1.76, rotY: -2.34, pitch: -0.13, sink: -0.28 },   // level 1
      { x: -35.2, z: -20.9, scale: 1.76, rotY: -2.34, pitch: -0.13, sink: -0.28 },   // level 1
      { x: -31.4, z: -20.4, scale: 1.25, rotY: -2.34, pitch: -0.13, sink: -0.40 },   // level 1
      { x: -31.4, z: -9.6, scale: 1.25, rotY: -2.34, pitch: -0.13, sink: -0.40 },   // level 1
      { x: -37.1, z: -6.4, scale: 1.00, rotY: -2.34, pitch: -0.13, sink: -0.50 },   // level 1
      { x: -35.9, z: -4.3, scale: 0.89, rotY: -2.34, pitch: -0.13, sink: -0.56 },   // level 1
      { x: 59.8, z: -43.4, scale: 3.48, rotY: -2.34, pitch: -0.13, sink: -0.14 },   // level 1
      { x: 56.4, z: -38.9, scale: 3.11, rotY: -2.34, pitch: -0.13, sink: -0.16 },   // level 1
      { x: 52.4, z: -52.5, scale: 3.11, rotY: -2.34, pitch: -0.13, sink: -0.16 },   // level 1
      { x: 30.9, z: -25.4, scale: 1.97, rotY: -2.34, pitch: -0.13, sink: -0.25 },   // level 1
      { x: 31.2, z: -28.9, scale: 1.40, rotY: -2.34, pitch: -0.13, sink: -0.36 },   // level 1
    ] },
];
