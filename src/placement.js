// ============================================================
//  PLACEMENT  — where things go in the world. Imports nothing.
// ============================================================

// A random radius inside the annulus [inner, outer], at EQUAL AREA density.
//
// The obvious `inner + Math.random() * (outer - inner)` is what every scatter in
// this project used to do, and it is quietly wrong: it puts the same number of
// items in every ring of equal WIDTH, but a ring's area grows with its radius.
// Over [6, 52] that leaves the middle of the map roughly 9x denser than the rim
// — which is exactly why the kelp, the shoals, the wildlife and the orbs all
// looked like they were huddled around the origin with bare sand out at the edge.
//
// Sampling r = sqrt(lerp(inner², outer²)) distributes by area instead, so the
// density is flat from the centre all the way out.
export function ringRadius(inner, outer) {
  return Math.sqrt(inner * inner + Math.random() * (outer * outer - inner * inner));
}

// Pull an (x, z) back inside a circle of radius `limit`, preserving its bearing.
//
// Clamping x and z separately — the obvious thing — bounds a SQUARE, and this
// world is round: a box of half-width 74 has corners out at r=105, deep inside
// the mountain ring. A creature backed into one would be standing in a mountain.
export function clampRadius(pos, limit) {
  const r = Math.hypot(pos.x, pos.z);
  if (r <= limit || r < 1e-6) return;
  const k = limit / r;
  pos.x *= k;
  pos.z *= k;
}
