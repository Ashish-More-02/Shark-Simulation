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
// ============================================================

// { x, z, base, height, rBase, rTop }
const solids = [];

const probe = new THREE.Vector3();

// Three spheres down the length of a body — nose, middle, tail. See resolveBody.
const BODY_SAMPLES = [-0.72, 0, 0.72];

// base = world Y of the footprint (props are anchorBottom, so this is floorAt).
export function addSolid(x, z, base, height, rBase, taper) {
  solids.push({ x, z, base, height, rBase, rTop: rBase * taper });
}

// Non-mutating overlap test, for placement that wants to RETRY rather than be
// shoved. Pushing something out is fine mid-flight but wrong at spawn: it lands
// wherever the push happens to leave it, which may be somewhere it should never
// have been (see orbs.js).
export function insideSolid(x, y, z, radius) {
  for (const s of solids) {
    const dy = y - s.base;
    if (dy < -radius || dy > s.height) continue;
    const t = dy < 0 ? 0 : dy / s.height;
    const reach = s.rBase + (s.rTop - s.rBase) * t + radius;
    const dx = x - s.x, dz = z - s.z;
    if (dx * dx + dz * dz < reach * reach) return true;
  }
  return false;
}

// Push `pos` horizontally out of every solid it has entered. `radius` is the
// mover's own half-width. Returns the total distance it was pushed — callers use
// that to tell a head-on hit (big push) from a graze (tiny push).
export function resolveSolids(pos, radius) {
  let pushed = 0;

  for (const s of solids) {
    const dy = pos.y - s.base;
    // Below the footprint or clear over the peak: nothing to hit. This is also
    // the broad phase — most solids fail here for the cost of one compare.
    if (dy < -radius || dy > s.height) continue;

    const t = dy < 0 ? 0 : dy / s.height;
    const reach = s.rBase + (s.rTop - s.rBase) * t + radius;

    const dx = pos.x - s.x, dz = pos.z - s.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= reach * reach) continue;

    const d = Math.sqrt(d2);
    if (d < 1e-4) {
      // Dead on the axis, so there's no outward direction to use. Any bearing is
      // as good as any other; +X keeps it deterministic.
      pos.x = s.x + reach;
      pushed += reach;
      continue;
    }
    const k = reach / d;
    pos.x = s.x + dx * k;
    pos.z = s.z + dz * k;
    pushed += reach - d;
  }

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
