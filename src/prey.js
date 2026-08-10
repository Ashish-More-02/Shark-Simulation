import * as THREE from 'three';
import { BITE, PLAYER } from './config/config.js';

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
//    bites        snaps to eat it AT THE BASE BITE DAMAGE — see HIT POINTS below;
//                 points  what eating it pays (growth + the upgrade currency)
//    hide / show  the owning module's callbacks — it decides what "gone" means
//                 for its own kind of animal, and where one comes back
//    track        show up in the HUD's NEAREST readout. Set by creatures.js only:
//                 shoaling fish are everywhere and pointing at one is noise
//    onHit        optional: told (damage, killed) after every landed bite. This is
//                 how a neutral animal learns it has been attacked — see
//                 src/combat/aggression.js
//    danger       optional: returns true while this animal is hostile, so the HUD's
//                 NEAREST row can mark it
//
//  ---- HIT POINTS ----
//  An animal's health is measured in DAMAGE, not in snaps, so that an upgraded shark
//  kills faster and so the whale can have a real health bar to fight down. But
//  `bites` stays the number every config row is authored in, and the bridge is one
//  multiplication: maxHp = bites x PLAYER.attack. A ten-bite whale is 240 hp and an
//  unupgraded shark, hitting for 24, still kills it in ten.
//
//  Note the BASE attack, deliberately, and never the upgraded biteDamage(): the whale
//  is 240 hp forever, and what an Attack level buys is fewer bites to get through it.
//  Scale prey hp with the player's damage and the upgrade cancels itself out.
//
//  Cost: nothing per frame except a countdown over the animals currently dead
//  (usually none, at most a couple of dozen). The hit test runs on a CLICK, over
//  ~90 records, which is not worth a spatial index — the whole scan is a few
//  microseconds and happens at most 1.25 times a second (3.3 with attack speed fully
//  upgraded, which is still nothing).
// ============================================================

const prey = [];        // every registered animal, alive or not
const dead = [];        // the ones counting down to respawn

// Read by shark.js (scale) and hud.js. Mutated in place rather than returned, so
// the frame loop reads it without allocating.
export const preyStats = { points: 0, eaten: 0 };

const probe = new THREE.Vector3();

export function registerPrey(entry) {
  entry.maxHp = entry.bites * PLAYER.attack;
  entry.hp = entry.maxHp;
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
  return spineDistanceTo(e.pos, e.axis, e.half, p);
}

// The same measurement, taken against a capsule described directly rather than
// against a prey record. Exported because the whale needs it for its OWN strike
// (src/combat/aggression.js): a whale defends itself by throwing twenty metres of
// animal around, so "how far is the shark from its body" is the question there
// too, and there is no sense in two versions of this arithmetic.
export function spineDistanceTo(pos, axis, half, p) {
  probe.copy(p).sub(pos);
  const t = THREE.MathUtils.clamp(probe.dot(axis), -half, half);
  probe.copy(pos).addScaledVector(axis, t);
  return p.distanceTo(probe);
}

// One snap of the jaws, worth `damage` hit points. Returns null on a miss,
// otherwise what was hit and how it's doing. `mouth` is a point at the nose;
// `forward` the shark's heading.
export function tryBite(mouth, forward, reach, damage) {
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

  best.hp -= damage;
  const killed = best.hp <= 0;
  if (killed) {
    best.hp = 0;
    best.alive = false;
    best.hide();
    best.timer = BITE.respawn;
    dead.push(best);
    preyStats.points += best.points;
    preyStats.eaten++;
  }
  // AFTER the kill bookkeeping, so an animal that fights back is told the outcome
  // and not just the damage: a whale that died has nothing left to be angry about.
  best.onHit?.(damage, killed);

  // `points` rides along because eating heals (COMBAT.healPerPoint) and the caller
  // is the only place that knows both halves of a bite.
  return { name: best.name, hp: best.hp, maxHp: best.maxHp, points: best.points, killed };
}

// ---- TRACKING --------------------------------------------------------------
// Nearest LIVE tracked animal to `from`, or null if every one of them is currently
// eaten. The wildlife is 11 rigs scattered over the whole basin and you can see
// about 50 units through the fog, so without a bearing "hunt the whale" is a
// random walk. This is what the HUD's NEAREST row reads.
//
// Filled into a shared object rather than returned fresh: this runs every frame.
const nearest = { name: '', dist: 0, pos: null, hostile: false };

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
  // Whether this animal is currently angry at you — the HUD marks the row with a ⚠.
  // Cheap enough to ask every frame: it is one flag read behind a callback.
  nearest.hostile = best.danger ? best.danger() : false;
  return nearest;
}

// Respawn countdown. Iterates only what is actually dead, so this is a no-op walk
// over an empty array for most of a run.
export function updatePrey(dt) {
  for (let i = dead.length - 1; i >= 0; i--) {
    const e = dead[i];
    e.timer -= dt;
    if (e.timer > 0) continue;
    e.hp = e.maxHp;
    e.alive = true;
    e.show();
    dead.splice(i, 1);
  }
}
