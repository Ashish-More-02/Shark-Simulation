import * as THREE from 'three';
import { spineDistanceTo } from '../prey.js';
import { playWhaleStrike } from '../audio.js';
import { health, damageShark } from './health.js';

// ============================================================
//  AGGRESSION  — what a NEUTRAL animal does once you attack it.
//
//  Roadmap §5 puts the whale in the neutral row: ignores you at distance, flips
//  when provoked. That is the only disposition that can be built before the rest of
//  the disposition system exists, because it has exactly one trigger (you bit it)
//  and one exit (you left), and neither needs detection ranges, line of sight or
//  blood in the water to feel fair.
//
//  Kept out of creatures.js for the same reason bite.js is kept out of shark.js:
//  creatures.js is steering and animation, and it should stay readable as that. It
//  calls four functions from here and never learns what hostility is.
//
//  WHAT THIS OWNS  the hostile flag, the strike clock, the leash timer, and three
//                  per-frame multipliers it hands back on the creature record.
//  WHAT IT DOESN'T  moving the animal. creatures.js still does every bit of the
//                   steering; this only ever writes `target` and the multipliers,
//                   so a hostile whale is subject to exactly the same rock
//                   collision, floor clearance and roam bound as a calm one.
//
//  Full design, and every number: Docs/systems/attack-and-health.md
// ============================================================

// Called from creatures.js spawn(), for a species with a `combat` block in config.
// Everything is on the creature record rather than in a table here: it is that
// animal's state, it has to die with it, and the steering code reads two of these
// fields every frame anyway.
export function armCombat(c) {
  c.hostile = false;
  c.windup = 0;      // seconds of rear-back left. > 0 = loading a strike
  c.lunging = 0;     // seconds of ram left
  c.cool = 0;        // seconds until it may commit again
  c.calmFor = 0;     // seconds spent outside the leash
  c.hitLanded = false;
  // Read by creatures.js's steering every frame, for every creature, combat block
  // or not — which is why they are initialised here AND defaulted there.
  c.speedMul = 1;
  c.turnMul = 1;
  c.pitchBias = 0;
}

// One landed bite. This is the whole trigger: no aggro radius, no alert state, no
// warning growl. A whale you have not touched will swim past you at two metres
// exactly as it always did.
export function provoke(c) {
  if (!c.spec.combat || c.hostile) return;
  c.hostile = true;
  c.calmFor = 0;
  c.cool = c.spec.combat.cooldown * 0.5;   // a beat to turn around, not an instant strike
}

// Back to being a whale. Called on disengage, on being eaten, and on the player's
// death — a whale does not get to still be angry at a shark that respawned 280 m
// away. Clears the strike mid-swing on purpose: coming out of hostility with a
// windup still counting down would land a hit from an animal that had given up.
export function calm(c) {
  if (!c.spec.combat) return;
  c.hostile = false;
  c.windup = 0;
  c.lunging = 0;
  c.cool = 0;
  c.calmFor = 0;
  c.pitchBias = 0;
  c.speedMul = 1;
  c.turnMul = 1;
  // ...and go somewhere. Without this it keeps swimming at wherever the shark was
  // standing when it lost interest, for the rest of its dwell time.
  c.retarget = 0;
}

export function isHostile(c) {
  return !!c.hostile;
}

// Per frame, for one creature, BEFORE creatures.js steers it. Writes c.target and
// the three multipliers; never touches the position.
export function updateAggression(c, dt, sharkPos, sharkGirth) {
  const k = c.spec.combat;
  c.speedMul = 1;
  c.turnMul = 1;
  // Ease the rear-back in and out rather than snapping the pitch: this is the tell
  // the player reads, and a tell that pops is a tell that looks like a glitch.
  c.pitchBias = THREE.MathUtils.lerp(c.pitchBias, c.windup > 0 ? k.rear : 0, 1 - Math.pow(0.02, dt));

  if (!c.hostile) return;

  // ---- the leash: far enough away, for long enough, and it forgets you ----
  // Measured to the pivot rather than to the body, which is the cheap answer and
  // runs every frame for every hostile animal. Worth knowing that it is not a free
  // approximation on a 21 m whale: half its length is 10 m, so at a 35 m leash the
  // shark can be a third closer to the animal than this number says.
  const range = c.pivot.position.distanceTo(sharkPos);
  if (range > k.leash) {
    c.calmFor += dt;
    if (c.calmFor >= k.forget) { calm(c); return; }
  } else {
    c.calmFor = 0;      // came back inside the leash: the clock restarts, in full
  }

  // Chase. The target is the shark itself rather than a waypoint, and `retarget` is
  // held up so creatures.js's dwell timer cannot pull the animal off mid-fight.
  // Note this ignores the species' depth band entirely — a whale defending itself
  // follows you up and down — while the floor, ceiling and roam bound in
  // creatures.js still apply, so it can never leave the reef basin to do it.
  c.target.copy(sharkPos);
  c.retarget = 1;
  c.speedMul = k.chaseMul;
  c.turnMul = k.turnMul;

  if (c.cool > 0) c.cool -= dt;
  // Nothing to fight: a dead shark is drifting, and hitting it again would only
  // stack banners. The leash timer above keeps running.
  if (health.dead) return;

  // How far the shark is from this animal's BODY, not from its pivot or its nose.
  // A whale strikes by throwing twenty metres of itself at you — see the doc for
  // why a nose-only strike makes a 0.48 rad/s animal unable to hit anything.
  const bodyD = spineDistanceTo(c.pivot.position, c.fwd, c.halfLength, sharkPos)
    - c.girth - sharkGirth;

  // ---- the strike: commit -> windup -> lunge -> cooldown ----
  if (c.lunging > 0) {
    c.lunging -= dt;
    c.speedMul = k.lungeMul;
    // First frame inside reach, once per lunge. A strike that misses is a strike
    // that misses; it does not get to keep tracking you until it connects.
    if (!c.hitLanded && bodyD < k.reach) {
      c.hitLanded = true;
      damageShark(k.attack, c.spec.name);
    }
    return;
  }

  if (c.windup > 0) {
    c.windup -= dt;
    c.speedMul = k.windupMul;
    if (c.windup <= 0) {
      c.lunging = k.lunge;
      c.hitLanded = false;
    }
    return;
  }

  if (c.cool <= 0 && bodyD < k.commit) {
    c.windup = k.windup;
    c.cool = k.cooldown;      // counted from the COMMIT, so the windup is inside it
    playWhaleStrike();        // the audible half of the tell
  }
}
