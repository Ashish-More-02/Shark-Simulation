import { CANYON, WORLD } from './config/config.js';
import { LEVELS } from './config/levels/index.js';

// ============================================================
//  LEVELS  — the shape of the world. Imports config only.
//
//  Everything about "where is the floor", "where is the player allowed to be"
//  and "which basin is this point in" lives here, so that terrain, props, fish,
//  orbs and the shark all agree without any of them knowing about each other.
//
//  THE ONE RULE THIS MODULE EXISTS TO ENFORCE (Docs/systems/world-levels.md §1):
//  a level is a BUILD AND RENDER partition, not a world partition. The floor is
//  one continuous function over the whole chain — `seabedBase` below — and a
//  "level" is only a statement about which slice of it currently has content in
//  it. Nothing is stitched, so there is no seam to see, and adding level 3 means
//  adding a row to LEVELS rather than joining anything up.
// ============================================================

// Smooth 0..1 ramp. Used for both the floor height and the dune damping so the
// two always agree — a floor that ramped on a different curve than its dunes
// would pinch or bulge somewhere in the middle of the canyon.
function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

const SHALLOW = LEVELS[0].seabed;    // level 1's mean floor
const DEEP    = LEVELS[1].seabed;    // level 2's

// MEAN floor height at this z, before dunes. A pure function of z: flat at one
// level's height, flat at the other's, and a single smooth ramp between them.
export function seabedBase(z) {
  return DEEP + (SHALLOW - DEEP) * smoothstep(CANYON.rampBottom, CANYON.rampTop, z);
}

// How much of the dune displacement applies here — level 1 is a plain, level 2 is
// a reef. Same ramp, so the plain flattens out exactly as the floor rises.
export function duneScale(z) {
  return 1 + (CANYON.plainDunes - 1) * smoothstep(CANYON.rampBottom, CANYON.rampTop, z);
}

// ---- WHERE ANIMALS LIVE ----------------------------------------------------
// A band used to be a fraction of the WATER COLUMN, and that broke the moment the
// column stopped being the same everywhere. Level 2's column went from 33 units
// to 68, so every band row put its animals twice as far off the sand: shoals
// floating above the kelp and the boulders instead of moving through them, whales
// and dolphins up near the surface, anglerfish hovering over the reef they are
// supposed to be sitting in.
//
// Animals live at a height above the SEABED, not at a fraction of the water above
// it. So a band is read against this fixed reference span instead. 33 is the
// column the whole game was tuned in (seabed -15, surface 18), which means every
// band row in config.js keeps exactly the height it was authored for — at any
// depth, in every level that will ever be added.
export const HABITAT = 33;

export function habitatY(frac, z) {
  return seabedBase(z) + frac * HABITAT;
}

// The open water ABOVE the habitat band. A level no deeper than the reference has
// none of it; level 2 has 35 units. `frac` walks from the top of the habitat to
// just under the surface, and it is what stops a deeper level's upper water
// reading as dead space with everything alive huddled on the floor.
export function openWaterY(frac, z) {
  const lo = seabedBase(z) + HABITAT;
  return lo + frac * Math.max(WORLD.surface - 3 - lo, 0);
}

// How much water this level has above the habitat band. <= 0 means no upper
// storey to populate.
export function headroom(seabed) {
  return WORLD.surface - seabed - HABITAT;
}

// The deepest floor anywhere, for anything that needs one global bottom (the
// particle field bakes it into a shader constant).
export const DEEPEST = Math.min(...LEVELS.map((l) => l.seabed));

// ---- WHICH LEVEL AM I IN ---------------------------------------------------

// Nearest basin centre. In the canyon this returns whichever end is closer, which
// is the right answer for everything that asks (fog tint, music, the HUD).
export function levelAt(x, z) {
  let best = LEVELS[0], bestD = Infinity;
  for (const L of LEVELS) {
    const dx = x - L.center[0], dz = z - L.center[2];
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = L; }
  }
  return best;
}

// ---- THE PLAY BOUND --------------------------------------------------------
// The union of every basin's disc plus the canyon corridor. A disc rather than a
// box for the same reason clampRadius exists (placement.js): a box of half-width
// 95 has corners out at r=134, well past the mountains, and a shark backed into
// one would be standing inside a peak.

const cw = CANYON.halfWidth;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// True if (x, z) is somewhere the shark is allowed to be.
export function insideWorld(x, z) {
  for (const L of LEVELS) {
    const dx = x - L.center[0], dz = z - L.center[2];
    if (dx * dx + dz * dz <= L.play * L.play) return true;
  }
  return z >= CANYON.zMin && z <= CANYON.zMax && x >= -cw && x <= cw;
}

// Pull a position back inside the world, to the NEAREST legal point across every
// region. Returns true if it had to move.
//
// Nearest-across-all rather than first-match: a shark leaving the canyon mouth
// sideways is outside both the corridor and the disc, and clamping it to whichever
// region happened to be tested first would teleport it across the canyon mouth.
export function clampToWorld(pos) {
  if (insideWorld(pos.x, pos.z)) return false;

  let bx = pos.x, bz = pos.z, best = Infinity;

  for (const L of LEVELS) {
    const dx = pos.x - L.center[0], dz = pos.z - L.center[2];
    const r = Math.hypot(dx, dz) || 1e-6;
    const k = L.play / r;
    const px = L.center[0] + dx * k, pz = L.center[2] + dz * k;
    const d = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
    if (d < best) { best = d; bx = px; bz = pz; }
  }

  const px = clamp(pos.x, -cw, cw);
  const pz = clamp(pos.z, CANYON.zMin, CANYON.zMax);
  const d = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
  if (d < best) { bx = px; bz = pz; }

  pos.x = bx;
  pos.z = bz;
  return true;
}

// The box the PLAYER can actually reach — every basin's disc, no haze margin.
// Distinct from worldBounds because the backdrop only has to enclose where the
// camera can go, and sizing it off the sand margin as well would make it far
// larger than it needs to be.
export function playBounds() {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const L of LEVELS) {
    minX = Math.min(minX, L.center[0] - L.play);
    maxX = Math.max(maxX, L.center[0] + L.play);
    minZ = Math.min(minZ, L.center[2] - L.play);
    maxZ = Math.max(maxZ, L.center[2] + L.play);
  }
  const midX = (minX + maxX) / 2, midZ = (minZ + maxZ) / 2;
  return {
    midX, midZ,
    // Half-diagonal: the furthest the camera can get from the middle.
    reach: Math.hypot(maxX - midX, maxZ - midZ),
  };
}

// ---- WORLD EXTENT ----------------------------------------------------------
// The axis-aligned box every basin, the canyon and the surrounding haze margin
// fit inside. The seabed and water planes are built from this, so adding a level
// grows both automatically.
export function worldBounds() {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const L of LEVELS) {
    minX = Math.min(minX, L.center[0] - L.play);
    maxX = Math.max(maxX, L.center[0] + L.play);
    minZ = Math.min(minZ, L.center[2] - L.play);
    maxZ = Math.max(maxZ, L.center[2] + L.play);
  }
  const m = WORLD.margin;
  return {
    minX: minX - m, maxX: maxX + m,
    minZ: minZ - m, maxZ: maxZ + m,
    get width()  { return this.maxX - this.minX; },
    get depth()  { return this.maxZ - this.minZ; },
    get midX()   { return (this.minX + this.maxX) / 2; },
    get midZ()   { return (this.minZ + this.maxZ) / 2; },
  };
}
