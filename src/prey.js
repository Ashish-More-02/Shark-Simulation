import * as THREE from 'three';
import { BITE } from './config.js';

// ============================================================
//  PREY  — every animal the shark can bite, in one flat registry.
//
//  fish.js and creatures.js keep their own simulation state and know nothing
//  about biting; each one just hands a record over here at spawn:
//
//    pos          live Vector3 reference — the animal's own position object, so
//                 this registry never has to be told anything moved
//    radius       body girth, added to the bite reach
//    axis / half  optional: for an elongated animal, a live forward vector and
//                 half its length, which turns the hit volume into a CAPSULE
//    bites        snaps to eat it, points  growth credited when it dies
//    hide / show  the owning module's callbacks — it decides what "gone" means
//                 for its own kind of animal, and where one comes back
//    track        show up in the HUD's NEAREST readout. Set by creatures.js only:
//                 shoaling fish are everywhere and pointing at one is noise
//
//  Cost: nothing per frame except a countdown over the animals currently dead
//  (usually none, at most a couple of dozen). The hit test runs on a CLICK, over
//  ~90 records, which is not worth a spatial index — the whole scan is a few
//  microseconds and happens at most 2.5 times a second.
// ============================================================

const prey = [];        // every registered animal, alive or not
const dead = [];        // the ones counting down to respawn

// Read by shark.js (scale) and hud.js. Mutated in place rather than returned, so
// the frame loop reads it without allocating.
export const preyStats = { points: 0, eaten: 0 };

const probe = new THREE.Vector3();

export function registerPrey(entry) {
  entry.hp = entry.bites;
  entry.alive = true;
  entry.timer = 0;
  prey.push(entry);
  return entry;
}

// Orbs feed the same growth curve without being biteable — see BITE.orbPoints.
export function addPoints(n) {
  preyStats.points += n;
}

// Distance from `p` to the animal's body surface... or rather to its SPINE; the
// caller subtracts the girth. A sphere for a fish; for anything long, the closest
// point on the segment through its length. A 21-unit whale tested as a sphere at
// its pivot is either unbiteable at the tail or a 21-unit ball of hittable water,
// and there is no radius that is both.
function spineDistance(e, p) {
  if (!e.half) return p.distanceTo(e.pos);
  probe.copy(p).sub(e.pos);
  const t = THREE.MathUtils.clamp(probe.dot(e.axis), -e.half, e.half);
  probe.copy(e.pos).addScaledVector(e.axis, t);
  return p.distanceTo(probe);
}

// One snap of the jaws. Returns null on a miss, otherwise what was hit and how
// it's doing. `mouth` is a point at the nose; `forward` the shark's heading.
export function tryBite(mouth, forward, reach) {
  let best = null, bestD = Infinity;

  for (const e of prey) {
    if (!e.alive) continue;
    const d = spineDistance(e, mouth) - e.radius;
    // `>= bestD` also short-circuits the cone test for anything we already beat.
    if (d > reach || d >= bestD) continue;
    // In front of the jaws — unless it's already between them (BITE.gape).
    if (d > BITE.gape) {
      probe.copy(e.pos).sub(mouth);
      const len = probe.length();
      if (len > 1e-4 && probe.dot(forward) / len < BITE.coneCos) continue;
    }
    best = e;
    bestD = d;
  }

  if (!best) return null;

  best.hp--;
  const killed = best.hp <= 0;
  if (killed) {
    best.alive = false;
    best.hide();
    best.timer = BITE.respawn;
    dead.push(best);
    preyStats.points += best.points;
    preyStats.eaten++;
  }
  return { name: best.name, taken: best.bites - Math.max(best.hp, 0), of: best.bites, killed };
}

// ---- TRACKING --------------------------------------------------------------
// Nearest LIVE tracked animal to `from`, or null if every one of them is currently
// eaten. The wildlife is 11 rigs scattered over the whole basin and you can see
// about 50 units through the fog, so without a bearing "hunt the whale" is a
// random walk. This is what the HUD's NEAREST row reads.
//
// Filled into a shared object rather than returned fresh: this runs every frame.
const nearest = { name: '', dist: 0, pos: null };

export function nearestTracked(from) {
  let best = null, bestD = Infinity;
  for (const e of prey) {
    if (!e.track || !e.alive) continue;
    const d = from.distanceTo(e.pos);
    if (d >= bestD) continue;
    bestD = d;
    best = e;
  }
  if (!best) return null;
  nearest.name = best.name;
  nearest.dist = bestD;
  nearest.pos = best.pos;
  return nearest;
}

// Respawn countdown. Iterates only what is actually dead, so this is a no-op walk
// over an empty array for most of a run.
export function updatePrey(dt) {
  for (let i = dead.length - 1; i >= 0; i--) {
    const e = dead[i];
    e.timer -= dt;
    if (e.timer > 0) continue;
    e.hp = e.bites;
    e.alive = true;
    e.show();
    dead.splice(i, 1);
  }
}
