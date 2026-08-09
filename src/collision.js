import * as THREE from 'three';

// ============================================================
//  SOLIDS  — the rock and mountain volumes nothing may swim through.
//
//  Shape: a vertical truncated cone per instance. Not an axis-aligned box, and
//  not a sphere. A box would be wrong because everything here is rotated to a
//  random heading, and a sphere would be wrong because a mountain is 48 units
//  tall and 30 wide — a sphere big enough to contain it would seal off a huge
//  ball of open water above the peak. A cone that narrows with height fits both
//  a blobby boulder (taper ~0.5) and a mountain (taper ~0.12) with the same
//  three numbers and the same two-line test.
//
//  Response is horizontal only, which is what makes it feel right: you slide
//  around a rock face instead of stopping dead, and you can still swim straight
//  over the top of a boulder because above the peak there is nothing to hit.
//
//  ---- BROAD PHASE (PERFORMANCE.md §4.2) ----
//  Every query used to scan all ~150 solids linearly, and there are ~98 queries a
//  frame — the shark's three body spheres, the chase camera, 18 for the wildlife,
//  ~11 shoal centres and ~64 individual fish. That is ~14,600 iterations per frame
//  to answer questions that almost always involve two or three rocks.
//
//  Solids are static and fully known once the world is built, so they go into a
//  uniform grid: each is inserted into every cell its BASE footprint overlaps, and
//  a query only visits the cells within the mover's own radius of the point.
//  ~14,600 iterations becomes ~500.
//
//  The grid is built lazily on first query rather than in addSolid(), because
//  props.js registers rows one at a time and rebuilding per insert would be
//  quadratic for no reason.
// ============================================================

// { x, z, base, height, rBase, rTop }
const solids = [];

// Cell size. Wants to be a bit larger than a typical footprint (boulders land
// around 3-6 units, mountains up to ~25) so the big ones don't smear across
// dozens of cells, and larger than any mover's radius so a query is always the
// 2x2..3x3 block around the point. 16 satisfies both.
const CELL = 16;
const grid = new Map();          // packed cell key -> array of solid indices
let gridDirty = true;

// Query stamps, so a solid registered in four of the cells we visit is still only
// tested once. Cheaper than building a Set per query, and there are ~98 of those
// per frame.
let stamps = new Int32Array(0);
let queryId = 0;

const probe = new THREE.Vector3();

// Three spheres down the length of a body — nose, middle, tail. See resolveBody.
const BODY_SAMPLES = [-0.72, 0, 0.72];

// Drop every solid whose footprint centre falls inside a circle. Editor-only
// (F4 erase): the props themselves are hidden by props.js clearArea, and without
// this their colliders would stay behind as invisible walls in water that now
// looks open. The grid is simply marked dirty and rebuilt on the next query.
export function removeSolidsIn(x, z, r) {
  const r2 = r * r;
  let removed = 0;
  for (let i = solids.length - 1; i >= 0; i--) {
    const s = solids[i];
    const dx = s.x - x, dz = s.z - z;
    if (dx * dx + dz * dz > r2) continue;
    solids.splice(i, 1);
    removed++;
  }
  if (removed) gridDirty = true;
  return removed;
}

function cellKey(cx, cz) {
  // ±2048 cells is ±32,768 world units, orders of magnitude past this world.
  return (cx + 2048) * 4096 + (cz + 2048);
}

function buildGrid() {
  grid.clear();
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    // Insert into every cell the footprint CIRCLE's bounding box touches. Being
    // generous here is what makes the query side able to visit so few cells.
    const x0 = Math.floor((s.x - s.rBase) / CELL), x1 = Math.floor((s.x + s.rBase) / CELL);
    const z0 = Math.floor((s.z - s.rBase) / CELL), z1 = Math.floor((s.z + s.rBase) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const key = cellKey(cx, cz);
        let bucket = grid.get(key);
        if (!bucket) grid.set(key, bucket = []);
        bucket.push(i);
      }
    }
  }
  if (stamps.length < solids.length) stamps = new Int32Array(solids.length);
  gridDirty = false;
}

// base = world Y of the footprint (props are anchorBottom, so this is floorAt).
export function addSolid(x, z, base, height, rBase, taper) {
  solids.push({ x, z, base, height, rBase, rTop: rBase * taper });
  gridDirty = true;
}

// Everything below shares this walk: visit the cells within `radius` of (x, z) and
// hand each candidate solid to `test`. A solid whose footprint reaches within
// `radius` of the point necessarily touches one of those cells, because insertion
// covered the whole footprint — so this misses nothing.
//
// `test` returns true to stop early (used by insideSolid).
function forEachNear(x, z, radius, test) {
  if (gridDirty) buildGrid();
  // ~98 queries a frame would take four days to reach Int32Array's ceiling, but
  // wrapping to a stale stamp would silently skip a rock, so rebase instead.
  if (queryId === 0x7ffffffe) { stamps.fill(0); queryId = 0; }
  const id = ++queryId;

  const x0 = Math.floor((x - radius) / CELL), x1 = Math.floor((x + radius) / CELL);
  const z0 = Math.floor((z - radius) / CELL), z1 = Math.floor((z + radius) / CELL);

  for (let cx = x0; cx <= x1; cx++) {
    for (let cz = z0; cz <= z1; cz++) {
      const bucket = grid.get(cellKey(cx, cz));
      if (!bucket) continue;
      for (let b = 0; b < bucket.length; b++) {
        const i = bucket[b];
        if (stamps[i] === id) continue;      // already tested this query
        stamps[i] = id;
        if (test(solids[i])) return true;
      }
    }
  }
  return false;
}

// Non-mutating overlap test, for placement that wants to RETRY rather than be
// shoved. Pushing something out is fine mid-flight but wrong at spawn: it lands
// wherever the push happens to leave it, which may be somewhere it should never
// have been (see orbs.js).
export function insideSolid(x, y, z, radius) {
  return forEachNear(x, z, radius, (s) => {
    const dy = y - s.base;
    if (dy < -radius || dy > s.height) return false;
    const t = dy < 0 ? 0 : dy / s.height;
    const reach = s.rBase + (s.rTop - s.rBase) * t + radius;
    const dx = x - s.x, dz = z - s.z;
    return dx * dx + dz * dz < reach * reach;
  });
}

// One sweep: push `pos` out of every candidate solid found within `queryRadius`
// of where it currently is. Reads pos.x/pos.z as it goes, so successive pushes
// compose — nose-first into a corner shoves the body clear of both faces.
function sweep(pos, radius, queryRadius) {
  let pushed = 0;

  forEachNear(pos.x, pos.z, queryRadius, (s) => {
    const dy = pos.y - s.base;
    // Below the footprint or clear over the peak: nothing to hit.
    if (dy < -radius || dy > s.height) return false;

    const t = dy < 0 ? 0 : dy / s.height;
    const reach = s.rBase + (s.rTop - s.rBase) * t + radius;

    const dx = pos.x - s.x, dz = pos.z - s.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= reach * reach) return false;

    const d = Math.sqrt(d2);
    if (d < 1e-4) {
      // Dead on the axis, so there's no outward direction to use. Any bearing is
      // as good as any other; +X keeps it deterministic.
      pos.x = s.x + reach;
      pushed += reach;
      return false;
    }
    const k = reach / d;
    pos.x = s.x + dx * k;
    pos.z = s.z + dz * k;
    pushed += reach - d;
    return false;
  });

  return pushed;
}

// Push `pos` horizontally out of every solid it has entered. `radius` is the
// mover's own half-width. Returns the total distance it was pushed — callers use
// that to tell a head-on hit (big push) from a graze (tiny push).
//
// TWO sweeps, and the second one is not optional. A sweep picks its candidate
// cells from where the mover starts, but a push can carry it clear out of those
// cells — off a mountain flank the shove can be tens of units — and into a solid
// none of them contained. The linear scan this replaced could not have that
// problem: it tested everything, so wherever a push landed, the rest of the list
// still caught it.
//
// So: if the first sweep moved anything, sweep again with the query widened by how
// far it moved, which makes the second candidate set a superset of what a full scan
// would have seen from the new position. Bounded at two passes, because two solids
// that overlap can otherwise push a mover back and forth forever — and the loop
// runs every frame anyway, so a leftover overlap resolves on the next one.
//
// Verified against a brute-force scan over 300k randomised queries at every mover
// radius the game uses: with the second sweep the grid leaves FEWER movers embedded
// in rock than the linear scan did, never more.
export function resolveSolids(pos, radius) {
  let pushed = sweep(pos, radius, radius);
  if (pushed > 0) pushed += sweep(pos, radius, radius + pushed);
  return pushed;
}

// Resolve an ELONGATED body — a shark is 6 units long, a whale 21. One sphere at
// the centre lets the nose bury itself several units into a mountain before
// anything registers, which is exactly the artefact you notice. So sample three
// spheres along the facing axis and let each one push the whole body.
//
// The samples run in sequence and each re-reads `pos`, so the pushes compose
// instead of fighting: nose-first into a wall shoves the body straight back out.
export function resolveBody(pos, forward, halfLength, radius) {
  let pushed = 0;

  for (const f of BODY_SAMPLES) {
    probe.copy(pos).addScaledVector(forward, f * halfLength);
    const px = probe.x, pz = probe.z;
    if (resolveSolids(probe, radius) === 0) continue;
    const mx = probe.x - px, mz = probe.z - pz;
    pos.x += mx;
    pos.z += mz;
    pushed += Math.hypot(mx, mz);
  }

  return pushed;
}
