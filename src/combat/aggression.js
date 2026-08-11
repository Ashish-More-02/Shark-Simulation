import * as THREE from 'three';
import { BITE, SHARK } from '../config/config.js';
import { playStrike } from '../audio.js';
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
//  NOTHING IN THIS FILE IS ABOUT WHALES. It was written for one and now runs two —
//  the manta ray is the same four beats a third of the size, and adding it cost a
//  `combat` block in config and no code here. Every number comes off `spec.combat`,
//  so the third fighter is another block; the day one of them needs a rule this
//  machine cannot express (a wounded animal that flees, a pack that calls for help)
//  is the day this stops being one function.
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

// ---- HOW FAR THE SHARK IS FROM THE PART OF THIS ANIMAL THAT CAN HIT IT ----------
// `spineDistanceTo` (prey.js) answers this for the WHOLE animal, which is right for a
// bite — every inch of a whale is edible — and wrong for a strike. A ram is a head-first
// commitment, and taking 54 damage off a tail thirty metres behind you, from an animal
// whose head is pointing elsewhere, is the loudest complaint this fight produced.
//
// So a fighter has a `strikeSpan`: the fraction of its length, measured back from the
// nose, that a strike connects with. Two differences from the bite capsule, and the
// second one matters more than the first:
//
//   1. the segment is only that front section, not the full spine
//   2. THERE IS NO REAR CAP. Behind the section, the answer is Infinity — not "the
//      distance to its rearmost striking point". A capsule's end cap is a hemisphere of
//      radius girth + reach, and on a whale that is 7.3 m of strike bleeding backwards
//      past the section it was supposed to be limited to: shortening the span alone
//      moves that boundary without ever removing it. Cutting the cap is what makes
//      "its tail cannot reach you" a true sentence rather than a smaller lie.
//
// The striking end keeps its cap, because water in front of a ram — or behind a fluke —
// is exactly where those arrive.
//
// `dir` is which END of the animal this attack works from: +1 the nose (a ram), −1 the
// tail (a fluke slap). One function for both, because a tail attack is the same
// measurement read backwards, and the two `strikeSpan`s tile the animal between them.
//
// Scratch vectors, so the per-frame path allocates nothing.
const probe = new THREE.Vector3();
const nearest = new THREE.Vector3();

function strikeDistance(c, span, sharkPos, sharkGirth, dir) {
  probe.copy(sharkPos).sub(c.pivot.position);
  const along = probe.dot(c.fwd) * dir;              // + is toward this attack's end
  const tip = c.halfLength;                          // that end, in the same axis
  const back = tip - span * 2 * c.halfLength;        // ...and where the section stops
  if (along < back) return Infinity;                 // past it: nothing to be hit by
  nearest.copy(c.pivot.position).addScaledVector(c.fwd, Math.min(along, tip) * dir);
  return sharkPos.distanceTo(nearest) - c.girth - sharkGirth;
}

// The distance that matters for one particular attack. `k.tail` is read backwards from
// the flukes; everything else is the front section read forwards.
function reachOf(c, atk, sharkPos, sharkGirth) {
  const k = c.spec.combat;
  return atk === k.tail
    ? strikeDistance(c, atk.strikeSpan, sharkPos, sharkGirth, -1)
    : strikeDistance(c, k.strikeSpan ?? 1, sharkPos, sharkGirth, 1);
}

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
  c.atk = null;      // the attack currently committed to (null = none; see begin())
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
  c.atk = null;      // ...including a half-swung fluke, for the reason above
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
export function updateAggression(c, dt, sharkPos, sharkGirth, sharkScale = 1) {
  const k = c.spec.combat;
  // The attack this animal is currently mid-way through: the ram by default, `k.tail`
  // once a fluke slap has been committed to. It lives on the creature because a commit
  // owns everything that follows it — the windup, the swing, the shared cooldown — and
  // an animal that switched attacks halfway through would be telegraphing one thing and
  // landing another.
  const atk = c.atk || k;

  // ---- THE STRIKE'S GEOMETRY FOLLOWS THE SHARK'S ----
  // Not a difficulty dial: a fix for an artefact. bodyD below measures to the shark's
  // PIVOT less a sphere at that pivot, while its jaws work from a mouth
  // BITE.mouthAhead x scale in front of it — so the closest bodyD a shark can ever be at
  // while biting is (mouthAhead − bodyRadius) x scale, which is 1.75 m at 6 m long and
  // 3.7 m at full size. Leave the strike distances flat and a grown shark eventually
  // stands *permanently* outside a range it can still bite from: not an easy fight, a
  // dead mechanic, and one that arrives silently as the player grows.
  //
  // So the correction is ADDITIVE — the growth in that minimum standoff, and nothing
  // more. Multiplying `reach` by the scale was the first attempt and it inflates the
  // absolute distances instead of preserving the relationship: 4 m became 8.4 m on a
  // full-grown shark, which is the "hitting me from miles away" complaint again, and it
  // ate almost all of the dodge margin (`windup x cruise > reach`). Additive keeps the
  // one property that matters — every animal can always reach a shark that closes to
  // within `reach − 1.75` m of touching it, at every size — while the numbers stay the
  // honest metres they were authored as.
  //
  // `reach` is the COMMITTED attack's, which is the only one that can land — but note
  // there is deliberately no `commit` here to match it. Choosing an attack has to test
  // each candidate's own commit distance, and `atk` is still holding the LAST one at that
  // point in the frame; a ram tested against a fluke slap's commit distance is a whale
  // that decides to ram you from wherever its tail happened to reach. See the selection
  // at the bottom of this function.
  const standoff = (BITE.mouthAhead - SHARK.bodyRadius) * (sharkScale - 1);
  const reach = atk.reach + standoff;

  c.speedMul = 1;
  c.turnMul = 1;
  // Ease the rear-back in and out rather than snapping the pitch: this is the tell
  // the player reads, and a tell that pops is a tell that looks like a glitch.
  //
  // `rear` is per ATTACK, and its sign is the whole difference between the two tells:
  // negative pitches the nose up to load a ram, positive pitches it down, which lifts
  // ten metres of tail out of your way before it comes back through the water. The
  // return sweep IS the slap — the bias eases back to zero during the lunge, so the
  // flukes are visibly moving on the frames the hit can land.
  c.pitchBias = THREE.MathUtils.lerp(c.pitchBias, c.windup > 0 ? atk.rear : 0, 1 - Math.pow(0.02, dt));

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

  // ---- a strike already in flight: only the committed attack's geometry matters ----
  if (c.lunging > 0) {
    c.lunging -= dt;
    c.speedMul = atk.lungeMul;
    // A per-attack turn rate, when it has one. The tail slap needs it: the chase above
    // is steering this animal to FACE the shark, which is precisely the motion that
    // takes its flukes off the target, so a slap holds its heading (turnMul ~0.25)
    // instead of turning into the swing it is trying to land.
    if (atk.turnMul != null) c.turnMul = atk.turnMul;
    // First frame inside reach, once per lunge. A strike that misses is a strike
    // that misses; it does not get to keep tracking you until it connects.
    if (!c.hitLanded && reachOf(c, atk, sharkPos, sharkGirth) < reach) {
      c.hitLanded = true;
      damageShark(atk.attack, c.spec.name);
    }
    return;
  }

  if (c.windup > 0) {
    c.windup -= dt;
    c.speedMul = atk.windupMul;
    if (atk.turnMul != null) c.turnMul = atk.turnMul;
    if (c.windup <= 0) {
      c.lunging = atk.lunge;
      c.hitLanded = false;
    }
    return;
  }

  // ---- nothing in flight: pick an attack, if either is in range ----
  // The ram first, always. It is the animal's real answer and the one with the longer
  // reach; the fluke slap exists to cover the ONE place a ram cannot go, which is
  // directly behind a 21 m animal that takes four seconds to turn round. Before it
  // existed, sitting on a whale's tail was free damage forever — a strictly better way
  // to fight a whale than fighting it.
  //
  // Both share `c.cool`, so an animal gets one attack per cooldown and cannot answer a
  // dodged ram with an instant slap.
  //
  // Each candidate is tested against ITS OWN commit distance and its own end of the
  // animal — see the note on `reach` at the top of this function for why that cannot be
  // hoisted out of here.
  if (c.cool > 0) return;

  if (reachOf(c, k, sharkPos, sharkGirth) < k.commit + standoff) return begin(c, k, k);

  if (k.tail && reachOf(c, k.tail, sharkPos, sharkGirth) < k.tail.commit + standoff) {
    return begin(c, k.tail, k);
  }
}

// Commit to one attack. `k` is the species' combat block, which owns the shared
// cooldown clock and is the fallback for anything the attack does not name itself.
function begin(c, atk, k) {
  c.atk = atk;
  c.windup = atk.windup;
  // Counted from the COMMIT, so the windup is inside it — and taken from the ATTACK when
  // it has its own, because a fluke slap is a heavier thing to reset than a ram.
  c.cool = atk.cooldown ?? k.cooldown;
  playStrike(atk.sfx ?? k.sfx);      // the audible half of the tell, per attack
}
