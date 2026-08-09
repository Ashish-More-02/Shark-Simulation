import { ROCK_PALETTE, MOUNTAIN_PALETTE, PEBBLE_PALETTE } from "../config.js";

// ---- LEVEL 2: THE REEF -----------------------------------------------------
// The reef this game started as, still centred on the origin, one canyon down-Z
// from the shallows. Its play bound is wider than level 1's on purpose — it is
// the level you spend time in. See Docs/systems/world-levels.md.
export const LEVEL_2 = {
  id: 2,
  name: "The Reef",
  center: [0, 0, 0],
  play: 105,
  seabed: -64,
  gapDir: Math.PI / 2,
  clear: [
    { x: 10.3, z: 137.5, r: 21 },
    { x: -0.2, z: 119.3, r: 12 },
    { x: 3.1, z: 112.0, r: 12 },
    { x: 111.1, z: -41.2, r: 24 },
    { x: 108.2, z: -65.3, r: 24 },
    { x: 114.6, z: -96.6, r: 15 },
    { x: 100.5, z: -103.3, r: 15 },
    { x: 54.2, z: -65.9, r: 15 },
    { x: 46.8, z: -79.7, r: 15 },
    { x: -48.0, z: 3.0, r: 15 },
    { x: 44.4, z: 5.9, r: 15 },
    { x: 81.9, z: 12.2, r: 15 },
    { x: 10.5, z: 49.2, r: 15 },
    { x: -40.8, z: 31.9, r: 6 },
    { x: -37.6, z: 32.1, r: 6 },
    { x: -35.5, z: 29.8, r: 6 },
    { x: -27.6, z: 24.5, r: 6 },
    { x: 7.2, z: 78.8, r: 6 },
    { x: 6.9, z: 77.0, r: 6 },
    { x: 6.8, z: 68.0, r: 6 },
    { x: -51.0, z: 60.7, r: 6 },
    { x: -56.1, z: 57.4, r: 6 },
    { x: -53.3, z: 61.4, r: 6 },
    { x: -44.3, z: 60.4, r: 6 },
    { x: -68.8, z: -9.1, r: 3 },
    { x: -50.2, z: -36.9, r: 6 },
    { x: -56.8, z: -29.1, r: 12 },
    { x: -48.5, z: -32.5, r: 12 },
    { x: -48.8, z: -22.1, r: 12 },
    { x: -6.9, z: 1.4, r: 6 },
    { x: -16.8, z: -0.7, r: 6 },
    { x: -23.2, z: -3.5, r: 6 },
    { x: -23.6, z: -7.0, r: 6 },
    { x: -4.1, z: -83.9, r: 6 },
    { x: -0.2, z: -86.0, r: 6 },
    { x: 0.4, z: -86.2, r: 6 },
    { x: 0.4, z: -86.2, r: 6 },
    { x: -3.8, z: -85.1, r: 6 },
    { x: -3.8, z: -85.2, r: 6 },
    { x: -0.3, z: -86.3, r: 15 },
    { x: -12.0, z: -105.9, r: 15 },
    { x: -14.1, z: -111.0, r: 15 },
    { x: -14.7, z: -112.6, r: 15 },
    { x: -15.2, z: -113.9, r: 15 },
    { x: -15.7, z: -115.1, r: 15 },
    { x: -13.3, z: -129.6, r: 15 },
    { x: -13.3, z: -129.6, r: 15 },
    { x: -13.4, z: -129.6, r: 15 },
    { x: -5.0, z: -129.1, r: 15 },
    { x: -5.0, z: -129.1, r: 15 },
    { x: -5.0, z: -129.1, r: 15 },
    { x: 17.3, z: -92.1, r: 15 },
    { x: 17.6, z: -93.7, r: 15 },
    { x: 17.9, z: -94.7, r: 15 },
    { x: 18.5, z: -97.1, r: 21 },
    { x: 18.5, z: -97.2, r: 27 },
    { x: 14.7, z: -123.0, r: 18 },
    { x: 10.2, z: -129.9, r: 18 },
    { x: 12.8, z: -58.0, r: 3 },
    { x: -1.9, z: 104.0, r: 3 },
    { x: 2.1, z: 88.2, r: 3 },
    { x: -2.4, z: 88.2, r: 3 },
    { x: 121.2, z: -2.4, r: 3 },
    { x: 119.0, z: -2.2, r: 3 },
    { x: 115.7, z: -3.0, r: 3 },
    { x: 106.7, z: -9.2, r: 3 },
    { x: 107.6, z: -14.0, r: 3 },
    { x: 119.0, z: -16.8, r: 3 },
    { x: 119.4, z: -17.1, r: 3 },
    { x: 119.9, z: -17.4, r: 3 },
    { x: 120.9, z: -18.1, r: 3 },
    { x: 121.6, z: -18.6, r: 3 },
    { x: 122.3, z: -19.1, r: 3 },
    { x: 122.6, z: -19.7, r: 3 },
    { x: 122.6, z: -20.3, r: 3 },
    { x: 121.3, z: -17.9, r: 9 },
    { x: 15.0, z: 1.8, r: 12 },
    { x: 47.4, z: 0.0, r: 12 },
    { x: -60.2, z: 43.7, r: 15 },
    { x: -75.2, z: 68.2, r: 15 },
    { x: -83.4, z: -48.8, r: 6 },
    { x: -80.8, z: -47.9, r: 6 },
    { x: -80.9, z: -46.6, r: 6 },
  ],
};

// Two substrates, because the real seabed has two. Rows sharing a `key` share
// their patch centres (props.js), so the outcrops, their rubble aprons and the
// kelp growing on them all land together with bare sand between.
//   REEF_PATCH  hard ground — rock, kelp, ferns, anemones
//   MEADOW      soft ground — seagrass, which roots in open sand and does not
//               want the rock, so its patches are bigger and land in the gaps
// `frac` under 1 leaves a quarter of each row still scattering, so a patch frays
// into the sand instead of stopping at a circle.
const REEF_PATCH = { key: "reef", seeds: 14, radius: 15, frac: 0.78 };
const MEADOW = { key: "meadow", seeds: 9, radius: 22, frac: 0.72 };

// How far back the reef's mountain wall stands. At 96 the nearest peak centre
// sits outside the play bound, so the wall is something you can swim up to and
// touch rather than scenery pressing in on the middle of the basin.
const REEF_RING = 96;

// See ./index.js for the row-key legend.
export const PROPS = [
  // The range you can swim out to and around. `gap` leaves a ~52° mouth aimed at
  // LEVEL_2.gapDir, or the peaks wall off the one route between levels. tilt is 0
  // because a tilted peak reads as one falling over. sMax 1.7 on a floor at -64
  // stops the tallest peaks ~9 units under the surface: nothing on the reef
  // breaks the waterline — that is the shallows' job.
  { model: "mountain", count: 18, sMin: 0.75, sMax: 1.7, ring: [REEF_RING, 152], tilt: 0, sink: 3, palette: MOUNTAIN_PALETTE, solid: 0.8, taper: 0.1, gap: 0.75 },

  // ---- THE GATE AND THE CANYON WALLS ----
  // Hand-placed, because a landmark is the one thing a random ring cannot give
  // you. The headlands frame the mouth, staggered in z so each side reads as a
  // headland with depth; the walls run back up the corridor so the passage has
  // continuous rock either side of it. All of it sits outside the play disc, and
  // clear of the canyon's ±26, while their feet reach into the water at the mouth.
  // Scales shrink up the ramp because the water gets shallower.
  {
    model: "mountain",
    count: 0,
    palette: MOUNTAIN_PALETTE,
    solid: 0.8,
    taper: 0.1,
    tilt: 0,
    sink: 3,
    fixed: [
      { x: -74, z: 84, scale: 1.8 },
      { x: -58, z: 104, scale: 1.45 },
      { x: 74, z: 84, scale: 1.72 },
      { x: 58, z: 104, scale: 1.5 },
      { x: -56, z: 130, scale: 1.3 },
      { x: 56, z: 130, scale: 1.25 },
      { x: -54, z: 158, scale: 1.0 },
      { x: 54, z: 158, scale: 1.05 },
    ],
  },

  // Kelp on the headlands — it needs hard ground to hold onto, and a stand of it
  // at the mouth is the difference between a gate and a gap. `n`/`spread` turn
  // one line into a thicket.
  {
    model: "kelp",
    count: 0,
    shade: 0.16,
    sway: 0.08,
    fixed: [
      { x: -50, z: 96, scale: 2.4, n: 26, spread: 15, jitter: 0.3 },
      { x: 50, z: 96, scale: 2.4, n: 26, spread: 15, jitter: 0.3 },
      { x: -46, z: 132, scale: 2.0, n: 16, spread: 12, jitter: 0.3 },
      { x: 46, z: 132, scale: 2.0, n: 16, spread: 12, jitter: 0.3 },
    ],
  },
  {
    model: "kelpFrond",
    count: 0,
    shade: 0.18,
    sway: 0.07,
    fixed: [
      { x: -38, z: 110, scale: 2.2, n: 22, spread: 14, jitter: 0.3 },
      { x: 38, z: 110, scale: 2.2, n: 22, spread: 14, jitter: 0.3 },
      { x: 30.3, z: -17.5, scale: 4.36, rotY: 0.39 },
      { x: 25.9, z: -19.4, scale: 2.77, rotY: 0.39 },
      { x: -31.9, z: 2.1, scale: 3.9, rotY: 0.39 },
      { x: -45.8, z: -11.3, scale: 2.48, rotY: 0.39 },
      { x: -32.6, z: 4.1, scale: 2.48, rotY: 0.39 },
      { x: -27.3, z: 2.4, scale: 3.48, rotY: 0.39 },
    ],
  },

  // ---- THE FLOOR OF THE CANYON MOUTH (F4-placed) ----
  // Ground dressing laid by eye along the route out of the reef. The gate above
  // is the silhouette; this is what you swim over on the way through it. Fixed
  // props ignore `clear` zones, which is why these read as planting — the ground
  // around them is bare on purpose.
  {
    model: "kelpBush",
    count: 0,
    shade: 0.18,
    sway: 0.07,
    fixed: [{ x: 25.0, z: 138.9, scale: 2.21, rotY: 1.04 }],
  },
  {
    model: "seagrass",
    count: 0,
    shade: 0.22,
    sway: 0.12,
    fixed: [
      { x: 10.3, z: 137.6, scale: 1.97, rotY: -0.52 },
      { x: -8.7, z: 131.1, scale: 1.97, rotY: -0.52 },
      { x: 10.0, z: 133.2, scale: 1.25, rotY: -0.52 },
      { x: -5.9, z: 127.2, scale: 1.25, rotY: -0.52 },
      { x: -23.7, z: 133.9, scale: 1.25, rotY: -0.52 },
    ],
  },
  {
    model: "fern",
    count: 0,
    shade: 0.24,
    sway: 0.08,
    cutout: 0.5,
    fixed: [
      { x: 9.7, z: 138.4, scale: 1.25, rotY: -0.52 },
      { x: -6.1, z: 130.8, scale: 1.25, rotY: -0.52 },
      { x: -11.5, z: 133.4, scale: 1.25, rotY: -0.52 },
      { x: 83.3, z: 3.1, scale: 3.48, rotY: -9.23 },
      { x: 86.5, z: 9.5, scale: 3.48, rotY: -9.23 },
      { x: 64.0, z: 6.5, scale: 3.48, rotY: -9.23 },
      { x: 37.4, z: 54.1, scale: 4.36, rotY: -9.23 },
      { x: 39.5, z: 47.2, scale: 2.48, rotY: -9.23 },
      { x: 29.3, z: 74.4, scale: 3.9, rotY: -9.23 },
      { x: 26.0, z: 64.2, scale: 7.69, rotY: -9.23 },
      { x: -18.5, z: 82.8, scale: 3.48, rotY: -9.23 },
      { x: -21.6, z: 96.0, scale: 3.48, rotY: -9.23 },
      { x: -33.6, z: 63.9, scale: 6.13 },
      { x: -36.2, z: 53.8, scale: 4.36 },
      { x: -28.3, z: 57.0, scale: 4.36 },
      { x: -20.1, z: 109.6, scale: 6.87 },
      { x: -55.2, z: 7.1, scale: 4.36 },
      { x: -52.9, z: 13.7, scale: 3.11 },
      { x: -10.1, z: -67.9, scale: 7.69 },
      { x: -3.9, z: -79.7, scale: 6.13 },
      { x: 43.1, z: -88.5, scale: 6.13 },
      { x: 38.8, z: -107.6, scale: 4.89 },
      { x: 55.7, z: 30.7, scale: 4.89 },
      { x: 34.3, z: -2.1, scale: 4.89 },
      { x: 45.0, z: -10.0, scale: 2.77 },
    ],
  },
  {
    model: "pebbles",
    count: 0,
    palette: PEBBLE_PALETTE,
    tilt: 0,
    fixed: [
      { x: -3.7, z: 137.7, scale: 1.76, rotY: -0.52 },
      { x: -15.9, z: 133.7, scale: 1.76, rotY: -0.52 },
      { x: 10.3, z: 135.7, scale: 1.76, rotY: -0.52 },
      { x: 10.2, z: 130.8, scale: 1.76, rotY: -0.52 },
      { x: -1.5, z: 103.4, scale: 1.76, rotY: -0.52 },
      { x: 6.5, z: 106.4, scale: 1.76, rotY: -0.52 },
      { x: 8.2, z: 103.3, scale: 1.76, rotY: -0.52 },
    ],
  },
  {
    model: "boulder",
    solid:0.9,
    count: 0,
    fixed: [
      { x: 112.3, z: -45.6, scale: 10.8 },
      { x: 103.5, z: -108.2, scale: 9.65 },
      { x: 60.3, z: -154.6, scale: 13.55, rotY: 7.15 },
      { x: 83.4, z: -74.2, scale: 6.13, rotY: 7.15 },
      { x: 56.7, z: -73.4, scale: 6.13, rotY: 7.15 },
      { x: 149.3, z: -22.5, scale: 6.13, rotY: 7.15 },
      { x: 144.2, z: 61.6, scale: 9.65, rotY: 7.15 },
      { x: 128.4, z: 105.4, scale: 8.61, rotY: 4.29 },
      { x: -44.7, z: 2.3, scale: 3.9, rotY: 0.65 },
      { x: -46.0, z: 12.7, scale: 1.76, rotY: 0.65 },
      { x: -54.2, z: -9.9, scale: 2.77, rotY: 0.65 },
      { x: -57.9, z: -1.8, scale: 1.4, rotY: 0.65 },
    ],
  },
  {
    model: "log",
    count: 0,
    fixed: [
      { x: 81.1, z: 15.2, scale: 9.65, rotY: -0.78 },
      { x: 76.0, z: 21.9, scale: 6.87, rotY: -0.26 },
      { x: 63.1, z: 13.8, scale: 4.36, rotY: -2.6 },
      { x: -37.1, z: 14.1, scale: 4.36, rotY: -2.6 },
      { x: -30.5, z: 4.9, scale: 3.11, rotY: -5.2 },
      { x: 20.0, z: -13.6, scale: 4.89, rotY: -6.63 },
    ],
  },

  // Inner landmarks. Their collider radius tops out near 10, so the farthest
  // reaches r=70 — well inside the bound, which is what stops the world clamp and
  // the rock taking turns shoving the shark back and forth at the edge.
  { model: "mountain", count: 5, sMin: 0.4, sMax: 0.6, ring: [32, 60], tilt: 0, sink: 3, palette: MOUNTAIN_PALETTE, solid: 0.8, taper: 0.1 },

  // ---- THE REEF IS A MOSAIC, NOT A SPRINKLE ----
  // Every row below shares one clump key, so the outcrops, the rubble around them
  // and the kelp growing on them land together with bare rippled sand between.
  // Nothing here is denser than it was; the same props are gathered instead of
  // spread. Uniform density at ANY density reads as empty, because there is
  // nowhere full to be and so nowhere looks like somewhere.
  { model: "rockPile", count: 34, sMin: 0.8, sMax: 2.4, ring: [8, 118], tilt: 0.12, palette: ROCK_PALETTE, edgeScale: 0.6, solid: 0.8, taper: 0.55, clump: REEF_PATCH },
  { model: "boulder", count: 72, sMin: 0.5, sMax: 2.2, ring: [7, 118], tilt: 0.2, palette: ROCK_PALETTE, edgeScale: 0.6, solid: 0.85, taper: 0.5, clump: REEF_PATCH },
  { model: "rockSpire", count: 58, sMin: 0.6, sMax: 2.6, ring: [7, 118], tilt: 0.15, palette: ROCK_PALETTE, edgeScale: 0.55, solid: 0.8, taper: 0.4, clump: REEF_PATCH },

  // Shingle: small, plentiful and cheap — it is what makes the sand read as
  // seabed rather than as a bare plane.
  { model: "pebbles", count: 335, sMin: 0.5, sMax: 1.6, ring: [4, 120], tilt: 0.12, palette: PEBBLE_PALETTE },

  // Flora. Kelp gets the strongest edge bias — a proper forest at the rim
  // thinning to stragglers in the open middle where the shark patrols.
  { model: "kelp", count: 112, sMin: 0.6, sMax: 2.3, ring: [10, 118], shade: 0.18, sway: 0.11, edgeScale: 0.8, clump: REEF_PATCH },
  { model: "kelpBush", count: 63, sMin: 0.6, sMax: 2.0, ring: [9, 118], shade: 0.18, sway: 0.07, edgeScale: 0.7, clump: REEF_PATCH },
  { model: "seaweed", count: 125, sMin: 0.6, sMax: 2.0, ring: [7, 119], shade: 0.22, sway: 0.14, edgeScale: 0.6, clump: REEF_PATCH },
  { model: "grass", count: 106, sMin: 0.7, sMax: 2.0, ring: [5, 119], shade: 0.2, sway: 0.05, edgeScale: 0.5, clump: MEADOW },
  { model: "fern", count: 125, sMin: 0.5, sMax: 1.8, ring: [5, 119], shade: 0.24, sway: 0.08, edgeScale: 0.55, cutout: 0.5, clump: REEF_PATCH },
  { model: "anemone", count: 53, sMin: 0.7, sMax: 1.7, ring: [6, 115], shade: 0.2, sway: 0.06, edgeScale: 0.4, clump: REEF_PATCH },

  // kelp-2: the mid-storey, filling the gap between ankle-high seagrass and the
  // giant canopy, right across the map.
  { model: "kelpFrond", count: 152, sMin: 0.8, sMax: 2.0, ring: [6, 120], shade: 0.2, sway: 0.1, edgeScale: 0.5, clump: REEF_PATCH },

  // Seagrass: deliberately NOT edge-biased and running the full radius, so it
  // reads the same at the start point as at the rim. MEADOW, not REEF_PATCH —
  // it is the one plant that does not want the rock.
  { model: "seagrass", count: 213, sMin: 0.6, sMax: 1.7, ring: [3, 121], shade: 0.22, sway: 0.12, clump: MEADOW },

  // The mountain canopy: a towering forest standing in and around the peaks'
  // feet. Pure silhouette from inside the basin, and the payoff for swimming out.
  { model: "kelp", count: 172, sMin: 2.0, sMax: 3.0, ring: [98, 150], shade: 0.16, sway: 0.08, edgeScale: 0.45 },
  { model: "kelpBush", count: 108, sMin: 1.9, sMax: 2.9, ring: [100, 150], shade: 0.16, sway: 0.05, edgeScale: 0.45 },
  { model: "kelpFrond", count: 98, sMin: 2.0, sMax: 3.0, ring: [100, 150], shade: 0.18, sway: 0.07, edgeScale: 0.4 },

  // Litter. Bones stay sparse — a skeleton every few metres reads as a graveyard.
  { model: "log", count: 22, sMin: 0.8, sMax: 1.5, ring: [8, 112], tilt: 0.25 },
  { model: "bones", count: 39, sMin: 0.6, sMax: 1.5, ring: [8, 112], tilt: 0.3, shade: 0.16 },
];
