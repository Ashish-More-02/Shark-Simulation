import { WORLD } from './config/config.js';

// ============================================================
//  PLACEMENT  — where things go in the world.
// ============================================================

// ---- THE WORLD IS THE SAME EVERY TIME YOU LOAD IT --------------------------
// It used to be a different reef on every refresh: every position came from
// Math.random(), so the layout you had just spent ten minutes liking was gone the
// moment you pressed reload. That makes a world impossible to ITERATE on — you can
// never tell whether a change improved it or merely reshuffled it, and you cannot
// point at anything, because the thing you are pointing at will not be there next
// time.
//
// EVERYTHING the world is built from now comes from ONE number: WORLD.seed. Props,
// shoals, wildlife, orbs, god rays, the particle field and the sand grain. Load the
// same seed twice and you get the same ocean down to the tilt of every pebble.
//
// Mulberry32: 32 bits of state, one multiply-shift round, statistically fine for
// scattering rocks and about as small as a usable generator gets.
export function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The seed actually in force. `?seed=12345` overrides config for one session, which
// is what makes seed-HUNTING practical: deal worlds in the address bar until one is
// worth keeping, then paste the number into config.js. No argument = config's seed.
// Guarded: this module is the root of world generation and has no other reason to
// need a DOM, so it stays importable outside a browser.
const requested = typeof location !== 'undefined'
  ? new URLSearchParams(location.search).get('seed')
  : null;
export const SEED = requested !== null && requested !== '' && Number.isFinite(Number(requested))
  ? Number(requested) >>> 0
  : WORLD.seed >>> 0;

// ---- ONE SEED, MANY STREAMS -------------------------------------------------
// Every subsystem gets its OWN generator, derived from the master seed by name.
//
// A single shared sequence was the obvious design and it is a trap, because a PRNG
// is a STREAM, not a hash of position: whoever draws first decides where everyone
// after them lands. That has two teeth.
//
//   It breaks under variable draw counts. Fish, orbs and creatures draw an amount
//   decided by their own rolls — the school count per species is a range, the orb
//   placement retries until it misses a rock. Level 1's shoals are built between
//   the two scatterAll() calls, so on a shared stream they shifted level 2's entire
//   reef by an unpredictable offset on every single refresh. That was the bug this
//   split exists to make unrepresentable.
//
//   It makes every tuning knob global. Add one orb, or widen a school count by one,
//   and every rock placed after it moves. You could never tune anything without
//   re-rolling the scenery you had already settled.
//
// Named streams fix both: 'props' is unaffected by anything 'fish' does, so the
// reef stays put while you tune the shoals. The name is hashed into the seed
// (FNV-1a, then an avalanche round) so that 'fish' and 'orbs' land far apart rather
// than at adjacent seeds — adjacent Mulberry32 seeds produce visibly correlated
// first draws, which would show up as two subsystems clustering in the same places.
//
// ---- NAMES GO ALL THE WAY DOWN ---------------------------------------------
// The same argument does not stop at the subsystem, and stopping it there is what
// kept the bug alive inside each one. A stream shared by a whole level still means
// whoever draws first decides where everyone after them lands — so a `clear`
// circle, an extra hand-placed rock, or one more prop in the row above re-rolled
// the scenery downstream of it, and level 1 drawing before level 2 re-rolled the
// entire reef.
//
// So the names are hierarchical and go down to the individual object:
//
//   'props'                    the subsystem
//   'L2:rock#0'                one row of one level
//   'L2:rock#0@37'             instance 37 of it              <- props.js
//   'L2:rock#0:fixed:10.3,137.5#0'   a hand-placed one, keyed by WHERE it is
//   'clump:2:reef#3'           patch centre 3 of the reef substrate
//   'fish:1' / 'orbs:2'        one level's shoals / collectibles
//
// A name is an object's ADDRESS in the world, so its placement is a pure function
// of (seed, address) and of nothing that happens to be built near it. That is what
// makes the world editable: you can add, delete, reorder and retune, and only the
// thing you touched moves. Hashing is cheap enough to do per instance — one pass
// over a short string, a few thousand times at load.
export function makeStream(name) {
  let h = SEED;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 0x01000193);
  }
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return makeRandom(h);
}

// There is deliberately no world-wide `rand` here any more. props.js used to import
// one and every prop in the game drew from it in build order — see the note above
// on why that made the world impossible to edit. Ask for a named stream instead.

// ---- ...AND ONE DELIBERATELY UNSEEDED ONE -----------------------------------
// Simulation, not generation. A wander nudge, a school's panic turn, the side an
// animal picks when it scrapes a boulder: these fire at a rate set by the frame
// clock and by where the player swims, so no seed could reproduce them anyway.
//
// It exists as a NAME rather than as bare Math.random so that every call site says
// which of the two it meant. Confusing the two is exactly how the seed broke, and
// `live()` at a call site is a claim that can be checked; Math.random is silent.
export const live = Math.random;

// A random radius inside the annulus [inner, outer], at EQUAL AREA density.
//
// The obvious `inner + rand() * (outer - inner)` is what every scatter in
// this project used to do, and it is quietly wrong: it puts the same number of
// items in every ring of equal WIDTH, but a ring's area grows with its radius.
// Over [6, 52] that leaves the middle of the map roughly 9x denser than the rim
// — which is exactly why the kelp, the shoals, the wildlife and the orbs all
// looked like they were huddled around the origin with bare sand out at the edge.
//
// Sampling r = sqrt(lerp(inner², outer²)) distributes by area instead, so the
// density is flat from the centre all the way out.
//
// The stream is REQUIRED. It used to default to the scenery's, which meant any
// caller that forgot one silently drew from the props sequence and moved the reef
// — the exact failure this module's header is about. There is no default to fall
// through to now, so a missing stream is a TypeError at the call site instead of
// scenery that quietly wanders.
export function ringRadius(inner, outer, rng) {
  return Math.sqrt(inner * inner + rng() * (outer * outer - inner * inner));
}

// Pull an (x, z) back inside a circle of radius `limit`, preserving its bearing.
//
// Clamping x and z separately — the obvious thing — bounds a SQUARE, and this
// world is round: a box of half-width 74 has corners out at r=105, deep inside
// the mountain ring. A creature backed into one would be standing in a mountain.
//
// `cx`/`cz` are the circle's centre. They default to the origin, which is where
// every ring in this game used to be — level 2 still is, so its callers read
// exactly as they did before levels existed.
export function clampRadius(pos, limit, cx = 0, cz = 0) {
  const dx = pos.x - cx, dz = pos.z - cz;
  const r = Math.hypot(dx, dz);
  if (r <= limit || r < 1e-6) return;
  const k = limit / r;
  pos.x = cx + dx * k;
  pos.z = cz + dz * k;
}

// Distance from a level centre, for the same reason clampRadius takes one.
export function radiusFrom(pos, cx = 0, cz = 0) {
  return Math.hypot(pos.x - cx, pos.z - cz);
}

// Shortest signed distance between two angles. Lives here rather than being
// copied into props/fish/creatures a fourth time.
export function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
