import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { WORLD, CREATURES, FLEE } from './config/config.js';
import { LEVELS } from './config/levels/index.js';
import { scene } from './core.js';
import { floorAt } from './terrain.js';
import { ringRadius, clampRadius, makeStream, live } from './placement.js';
import { habitatY } from './levels.js';
import { resolveBody } from './collision.js';
import { tickMixer } from './mixers.js';
import { registerPrey } from './prey.js';
import { armCombat, provoke, calm, isHostile, updateAggression } from './combat/aggression.js';

// ============================================================
//  WILDLIFE  — animated skinned rigs that roam on their own.
//
//  These are NOT instanced (props.js) and NOT slaved to a shoal centre (fish.js):
//  each one is a full skeleton with its own AnimationMixer, so it costs real
//  frame time. That's why CREATURES counts are small — a whale you meet once is a
//  set piece; twelve of them are wallpaper.
//
//  Steering is the same model for every species, only the numbers differ: pick a
//  waypoint, turn toward it at a capped yaw rate, bank into the turn, swim. Big
//  animals get a low `turn` so they arc through the water; small ones get a high
//  one so they dart.
//
//  A species with a `combat` block in config fights back once bitten. This file
//  does not know what that means: src/combat/aggression.js decides where such an
//  animal wants to be and hands back three multipliers, and the steering below is
//  the same code either way — same collision, same clearances, same roam bound. A
//  hostile whale is a whale with a different target and a heavier throttle.
// ============================================================

const creatures = [];

// This subsystem's slice of the world seed (placement.js). Spawn draws from it, so
// the same seed puts the same whale in the same place at the same size facing the
// same way; the roaming afterwards draws from `live`, because where a dolphin is
// two minutes in depends on where the player chased it.
//
// One stream PER SPECIES PER BASIN, set in createCreatures() below, rather than one
// for the whole subsystem. A PRNG is a stream and not a hash of position, so whoever
// draws first decides where everyone after them lands: on a shared sequence, giving
// the shallows two manta rays would have moved every whale, dolphin and anglerfish on
// the reef. Named per row, only the row you touched moves. Same argument and the same
// convention as fish.js's `fish:<id>` — see the long note at the top of placement.js.
let rng = makeStream('creatures');

// How far out a creature may roam: its OWN basin, stopping just short of the bound.
// Kept out of the peaks deliberately — the wildlife does have rock collision, but an
// animal that spends its life bouncing off mountain flanks and re-routing looks broken
// rather than alive, so collision stays the backstop it is meant to be rather than the
// thing that steers.
//
// Enforced as a CIRCLE around that basin's centre, not a box: see clampRadius() in
// placement.js for why.
//
// A function of the level rather than one module constant, which is what it was while
// every creature lived on the reef. A species that lives in both basins (the manta
// ray) has to be bounded by the one it is actually in, or the shallows' pair would
// spend their lives ground against a circle drawn around the other level.
function roamFor(level) {
  return level.play - 10;
}

// How steeply anything here may climb or dive, in radians off level. Deliberately
// shallow: these are big animals and a steep pitch reads as a missile. A species going
// to the surface may raise it for the climb only — see `climbPitch` and surfaceTrip().
const PITCH_LIMIT = 0.5;

// scratch — allocated once, reused every frame
const tmp = new THREE.Vector3();
const away = new THREE.Vector3();

// Where the shark was last frame. Only used to place a respawning animal well away
// from it, so nothing materialises in front of the player.
const lastShark = new THREE.Vector3();

// Band fraction -> world Y. Read as HEIGHT ABOVE THE SEABED against levels.js
// HABITAT, not as a fraction of the water column — see the long note there. When
// level 2's floor dropped to -50 the column doubled, and a column-relative band
// took the whales and dolphins with it: they ended up near the surface with the
// whole reef abandoned beneath them. Seabed-relative holds them exactly where
// they were tuned to be, at any depth.
//
// The floor is sampled at the animal's OWN basin centre, which is what makes one
// `band` row mean the same height above the sand in the 42 m shallows as in the 82 m
// reef column. It used to be hard-coded to z = 0 because every creature lived on the
// reef; the manta ray is the one species that does not (CREATURES `levels`).
//
// Most wildlife is still deliberately absent from the shallows: a plain you can see
// across with a whale in it is not a plain, and "the big animals live deeper" is the
// first thing the descent should teach. The manta is the exception, and it is the
// smallest rig with a temper for exactly that reason — see its row in config.js.
function columnY(frac, homeZ) {
  return habitatY(frac, homeZ);
}

// Shortest signed distance between two angles, so a creature crossing ±π turns
// the short way round instead of unwinding the long way.
function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

// ---- TRIPS TO THE SURFACE (species with a `surface` block) ---------------------
// Two species use this and they use it for opposite reasons, which is why it is called
// a trip and not a breath: a DOLPHIN is a mammal and has to breathe, a MANTA RAY feeds
// on what drifts near the top and then goes back down to the reef. Mechanically they
// are the same animal — spend part of your life in a different part of the column —
// and the numbers in each species' `surface` block are the whole difference.
//
// Overrides the DEPTH of whatever waypoint the animal is heading for, and nothing else:
// it keeps its horizontal target, so a trip is a long climb along the course it was
// already swimming rather than a lift ride, and it keeps picking fresh waypoints while
// it is up there — so it patrols the surface instead of parking at a point. That is
// both easier to look at and less code than a second kind of waypoint.
//
// `surfacing` is a hard budget for the whole trip, climb included, so this can never
// get stuck holding an animal against the ceiling — see the note on `surface` in
// config.js for why the budget has to comfortably exceed the climb time.
//
// Runs BEFORE the flee block, which means a chase overrides a trip and the trip is
// simply lost. That is the right precedence: nothing about being hunted should wait for
// an animal to finish exhaling. It will try again on the next timer. A FIGHT cancels it
// outright at the call site, for the same reason and more bluntly — see updateCreatures.
function surfaceTrip(c, dt) {
  const s = c.spec.surface;

  if (c.surfacing > 0) {
    c.surfacing -= dt;
    // Re-asserted every frame: the dwell timer can hand out a fresh in-band waypoint
    // mid-climb, and this has to keep winning until the trip is over.
    c.target.y = WORLD.surface - s.depth;
    // Steep for the climb, normal for everything else — the reason this is a per-animal
    // field and not a constant. See the note on `climbPitch` in config.js: at the shared
    // 0.5 rad limit the round trip is longer than the interval between trips.
    c.pitchMax = s.climbPitch;
    // Back down to the reef the moment the budget is spent. retarget = 0 rather than a
    // fresh waypoint here, so the normal path at the top of the loop picks it next
    // frame and there is only one place that ever calls newWaypoint(). The pitch limit
    // goes back to normal with it, which is what makes the return a long glide.
    if (c.surfacing <= 0) { c.retarget = 0; c.pitchMax = PITCH_LIMIT; }
    return;
  }

  c.surfaceIn -= dt;
  if (c.surfaceIn <= 0) {
    c.surfacing = s.trip;
    c.surfaceIn = s.every[0] + live() * s.every[1];
  }
}

// `draw` is the stream to use: the seeded one for the waypoint an animal is BORN
// on (that is its spawn position — part of the world), `live` for every waypoint it
// picks afterwards.
function newWaypoint(c, draw) {
  const a = draw() * Math.PI * 2;
  const [inner, outer] = c.spec.ring;
  // min() so a `ring` widened in config — or authored for the wider basin of the two
  // a species lives in — can never place a waypoint outside the circle this
  // individual is actually allowed to reach. See roamFor().
  const r = ringRadius(Math.min(inner, c.roam * 0.9), Math.min(outer, c.roam * 0.95), draw);
  const [lo, hi] = c.spec.band;
  // Offset by its own basin's centre: the reef's is the origin, so the reef's
  // wildlife lands exactly where it always did.
  c.target.set(
    c.home.x + Math.cos(a) * r,
    columnY(lo + draw() * (hi - lo), c.home.z),
    c.home.z + Math.sin(a) * r,
  );
  c.retarget = c.spec.dwell[0] + draw() * c.spec.dwell[1];
}

// SkinnedMesh.updateMatrixWorld() is what refreshes bindMatrixInverse — see the
// long comment in loader.js. Call it before measuring or the box comes back
// wildly wrong. We measure the wrapper (post-scale), so this is already in world
// units: half the height is how far the animal's belly hangs below its origin
// (the seabed clearance it needs), and half the length is how far its nose
// reaches ahead of its origin (what rock collision has to account for).
function measureBody(proto) {
  proto.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(proto).getSize(new THREE.Vector3());
  // These rigs are all normalized nose-to--Z, so length is the Z extent.
  return { halfHeight: size.y * 0.5, halfLength: size.z * 0.5 };
}

// The anglerfish ships a dedicated material for its lure bulb, but plain diffuse —
// which down here in the dark is simply invisible. Make it self-lit, so the lure
// is the thing you spot before the fish. Runs once on the prototype: the clones
// share these materials.
function lightUpLure(proto, { material, color, intensity }) {
  let found = false;
  proto.traverse((o) => {
    if (!o.isMesh) return;
    for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (mat.name !== material) continue;      // exact — see the note in config.js
      mat.emissive = new THREE.Color(color);
      mat.emissiveIntensity = intensity;
      mat.toneMapped = false;    // let it clip to white instead of being rolled off
      found = true;
    }
  });
  if (!found) console.warn(`glow material "${material}" not found`);
}

function spawn(proto, spec, level) {
  const size = spec.sMin + rng() * (spec.sMax - spec.sMin);
  const dims = measureBody(proto);      // NOT `body` — that's the roll group below

  // rig: pivot (world position + heading + pitch) -> body (bank) -> model.
  // Same split as the shark: roll must not feed back into the heading.
  const pivot = new THREE.Group();
  pivot.rotation.order = 'YXZ';
  const body = new THREE.Group();

  const model = cloneSkinned(proto);     // plain clone() would not rebind the skeleton
  model.scale.multiplyScalar(size);
  body.add(model);
  pivot.add(body);
  scene.add(pivot);

  const c = {
    spec, pivot, body,
    // The basin this individual belongs to: every waypoint, the roam clamp and the
    // depth band are measured from here. Two mantas of the same species row can sit
    // 280 m apart because each one carries its own home rather than reading a
    // module-level constant. y is unused — the band supplies it.
    home: new THREE.Vector3(level.center[0], 0, level.center[2]),
    roam: roamFor(level),
    target: new THREE.Vector3(),
    yaw: rng() * Math.PI * 2,
    pitch: 0,
    roll: 0,
    // Per-individual jitter, then an optional hard ceiling. `speedCap` exists because
    // the jitter can push a fast species past the SHARK's top speed, and prey that
    // cannot be caught is not hard prey — it is scenery. Same guard, and the same
    // reasoning, as FISH.sprintCap; see the dolphin's row in config.js.
    speed: Math.min(spec.speed * (0.85 + rng() * 0.3), spec.speedCap ?? Infinity),
    // keep the belly off the sand and the dorsal fin under the surface
    clearance: dims.halfHeight * size + 0.6,
    // Rock collision: three spheres down the animal's length. A 21-unit whale
    // resolved as one sphere at its middle would push its whole head through a
    // mountain before the centre ever registered contact.
    halfLength: dims.halfLength * size,
    // Body radius, for the bite capsule (prey.js) and rock collision. Measured off
    // the animal's HEIGHT by default, which is the right answer for everything built
    // like a tube — and the wrong one for a ray: a manta is 4 m across and 60 cm
    // thick, so its measured girth would be 30 cm and a wing you were sitting on
    // would not be biteable. `girth` in config overrides it, in world units at
    // scale 1. Note `clearance` below deliberately stays MEASURED, because how far
    // its belly hangs below its origin really is half its height — which is why a
    // manta can glide a metre off the sand and a whale cannot.
    girth: (spec.girth ?? dims.halfHeight) * size,
    retarget: 0,
    fleeFor: 0,        // seconds left on a committed escape line (FLEE below)
    // Air. Staggered from `live` rather than the seeded stream on purpose: when a
    // dolphin first takes a breath is not something a world seed describes, and drawing
    // from `rng` here would shift every creature spawned after it for a given seed.
    surfaceIn: spec.surface ? live() * spec.surface.every[0] : 0,
    surfacing: 0,      // seconds left of a trip to the surface (surfaceTrip())
    pitchMax: PITCH_LIMIT,   // raised by surfaceTrip() for a climb, and only for that
    mixer: null,
    // Own heading vector rather than a shared scratch: prey.js holds onto this as
    // the axis of the animal's capsule hit volume, so it has to stay valid between
    // frames instead of being whatever the last creature in the loop wrote.
    fwd: new THREE.Vector3(0, 0, -1),
    alive: true,
    // Written by combat/aggression.js, read by the steering below. Defaulted here
    // as well as in armCombat() so every creature carries them, which is what lets
    // the steering multiply unconditionally instead of branching per species.
    speedMul: 1,
    turnMul: 1,
    pitchBias: 0,
  };

  if (spec.combat) armCombat(c);

  newWaypoint(c, rng);      // where it starts IS world generation — seeded
  pivot.position.copy(c.target);
  pivot.rotation.y = c.yaw;
  c.fwd.set(0, 0, -1).applyQuaternion(pivot.quaternion);

  // Each rig gets its own mixer rooted on its own clone, so bone-name lookups
  // resolve inside that subtree and the copies never share a playhead.
  const clips = proto.clips;
  if (clips && clips.length) {
    const clip = THREE.AnimationClip.findByName(clips, spec.clip) || clips[0];
    c.mixer = new THREE.AnimationMixer(model);
    const action = c.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.timeScale = spec.rate * (0.9 + rng() * 0.2);
    action.play();
    // Kept only for the fighters: a whale that rears back and then rams at 3.4x
    // speed has to beat its tail like it means it, and the clip rate is the only
    // thing that sells the effort. Stored per animal because the jitter above means
    // no two of them share a base rate.
    if (spec.combat) { c.action = action; c.baseRate = action.timeScale; }
    action.time = rng() * clip.duration;   // stagger, or they beat in lockstep
  } else {
    console.warn(`${spec.model}: no animation clips found`);
  }

  // Biteable. Unlike a fish, these are LONG — the whale is 21 units nose to tail —
  // so the hit volume is a capsule down the spine (prey.js) rather than a sphere.
  // `pos` and `axis` are live references into the rig, so it tracks the animal for
  // free; 0.9 keeps the caps just inside the nose and the tail fluke.
  registerPrey({
    pos: pivot.position,
    axis: c.fwd,
    half: c.halfLength * 0.9,
    radius: c.girth + 0.6,
    name: spec.name,
    bites: spec.bites,
    points: spec.points,
    respawn: spec.respawn,   // undefined = the world default, BITE.respawn
    track: true,        // wildlife shows up in the HUD's NEAREST bearing
    // The whole trigger for a neutral animal turning on you: it was bitten and it
    // survived. Species without a `combat` block ignore this (provoke() early-outs),
    // which is every species but the whale and the manta ray.
    onHit(damage, killed) { if (!killed) provoke(c); },
    danger() { return isHostile(c); },
    hide() { c.alive = false; pivot.visible = false; calm(c); },
    show() { c.alive = true; pivot.visible = true; reseat(c); },
  });

  creatures.push(c);
}

// Put a respawning animal back somewhere the player is not looking. A whale that
// blinks into existence twenty units off your nose undoes the whole illusion, and
// unlike a fish rejoining its school there is nothing to hide behind out here.
function reseat(c) {
  // `live`, not the seed: this fires when the player has eaten the animal and the
  // respawn timer runs out, which is not something a seed describes. The retry
  // count varies too, so a seeded stream here would be drawn from an unpredictable
  // number of times — the exact hazard makeStream exists to contain.
  for (let i = 0; i < 8; i++) {
    newWaypoint(c, live);
    if (c.target.distanceTo(lastShark) > 55) break;
  }
  c.pivot.position.copy(c.target);
  c.yaw = live() * Math.PI * 2;
  c.pitch = 0;
  c.roll = 0;
  c.pivot.rotation.set(0, c.yaw, 0);
  c.body.rotation.z = 0;   // roll lives on the inner group, and it damps in slowly
  // Eaten mid-breath: come back holding depth, not still climbing with a steep pitch
  // limit left over from a trip that ended in the shark's jaws.
  c.surfacing = 0;
  c.pitchMax = PITCH_LIMIT;
  c.fwd.set(0, 0, -1).applyQuaternion(c.pivot.quaternion);
  newWaypoint(c, live);   // ...and now somewhere to actually swim
}

// Build every species, in every basin it lives in. Called ONCE for the whole world
// rather than once per level (which is how fish and orbs are built): a species row is
// the unit of authorship here, and one animal wanting to be in two places is a fact
// about the animal, not about the levels.
export function createCreatures(models) {
  for (const spec of CREATURES) {
    const proto = models[spec.model];
    if (!proto) { console.warn(`creature model "${spec.model}" not loaded`); continue; }
    if (spec.glow) lightUpLure(proto, spec.glow);

    // Which basins this species lives in, by level ID. Absent = the reef with `count`
    // of them, which is every row but the manta ray's and is where all the wildlife
    // lived before one species wanted to be in two places at once.
    const homes = spec.levels ?? [{ level: LEVELS[1].id, count: spec.count }];

    for (const home of homes) {
      const level = LEVELS.find((L) => L.id === home.level);
      if (!level) { console.warn(`creature "${spec.model}": no level with id ${home.level}`); continue; }
      // Per-basin fields win over the species row, so an entry can carry its own
      // count, band, ring or scale range without restating the whole animal — and a
      // row with no overrides reads as just a count.
      const local = { ...spec, ...home };
      // Addressed by level and species, so retuning one population leaves the other
      // exactly where it was. See the note on `rng` above.
      rng = makeStream(`creatures:${level.id}:${spec.model}`);
      for (let i = 0; i < local.count; i++) spawn(proto, local, level);
    }
  }
  return creatures;
}

// `sharkGirth` is its hull radius and `sharkScale` its current growth — both only ever
// used by the fighters (combat/aggression.js), which measures its strike against the
// shark's hull and sizes that strike against how far the shark's own jaws now reach.
export function updateCreatures(dt, sharkPos, sharkGirth, sharkScale) {
  lastShark.copy(sharkPos);      // for reseat(), when one of these respawns

  for (const c of creatures) {
    if (!c.alive) continue;      // eaten: hidden, and not simulated until it's back
    const { spec, pivot, body } = c;
    const pos = pivot.position;

    c.retarget -= dt;
    if (c.retarget <= 0) newWaypoint(c, live);

    // A fighting animal picks its own target (the shark) and its own throttle.
    // FIRST, so the dwell timer above cannot overwrite the chase and the flee
    // below cannot argue with it.
    if (spec.combat) updateAggression(c, dt, sharkPos, sharkGirth, sharkScale);

    // ...then the surface trip, which only rewrites the target's DEPTH — so it stacks
    // with the waypoint above rather than replacing it, and is itself overridden by the
    // flee below. See surfaceTrip().
    //
    // A FIGHT cancels it outright rather than merely overriding it, and that guard is
    // needed because this runs AFTER updateAggression() and writes the same target: a
    // hostile manta mid-trip would otherwise chase the shark in x/z while holding its
    // depth 5 m under the surface, which is an animal attacking you sideways. Clearing
    // `surfacing` also puts the steep climb pitch back, so a fight is fought at the
    // normal 0.5 rad limit. calm() picks a fresh waypoint, and the next trip comes
    // round on the usual timer.
    if (spec.surface) {
      if (isHostile(c)) { c.surfacing = 0; c.pitchMax = PITCH_LIMIT; }
      else surfaceTrip(c, dt);
    }

    // ---- FLEEING: A COMMITTED ESCAPE LINE ----
    // Shy species break off and put distance between themselves and the shark. The
    // whale (shy: 0) keeps its course — nothing down here worries it — and a hostile
    // one skips this outright — and the MANTA RAY is both shy and a fighter, so this
    // guard is now load-bearing rather than defensive. This block runs after the chase
    // above and writes the same `target`: without it a provoked manta would flee and
    // attack on alternate frames and do neither. (The whale, `shy: 0`, never gets
    // here at all.)
    //
    // The heading is picked ONCE and held for FLEE.hold seconds. It used to be
    // recomputed every frame from wherever the shark currently was, and that is what
    // made a dolphin nauseating to chase: the target swung around the animal as the
    // player circled it, so a creature with a high `turn` spent the whole pursuit
    // pivoting on the spot. fish.js already solved this for shoals — "the escape
    // heading is picked once per burst and held, so a shoal runs a line instead of
    // pivoting with the shark" — and this is the same fix for the wildlife.
    //
    // `fleeFor` counts down for every shy animal whether or not it is currently
    // running, so it is a genuine cooldown: leaving and re-entering the radius earns
    // a fresh line rather than extending the old one.
    if (c.fleeFor > 0) c.fleeFor -= dt;

    if (spec.shy && !isHostile(c) && c.fleeFor <= 0 && pos.distanceTo(sharkPos) < FLEE.radius) {
      away.copy(pos).sub(sharkPos);
      // MOSTLY LEVEL. The full vertical component is the other half of the dizziness:
      // a shark chasing from below pushes the animal up, from above pushes it down,
      // and the player's camera pitches with it the whole way. Keeping a quarter of it
      // still reads as evasion without turning the chase into a rollercoaster.
      away.y *= FLEE.rise;
      // Straight above or below, there is no horizontal escape to pick — so keep the
      // heading it already has instead of fleeing vertically.
      if (away.x * away.x + away.z * away.z < 1e-4) { away.x = c.fwd.x; away.z = c.fwd.z; }
      if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
      away.normalize().multiplyScalar(FLEE.distance * spec.shy);
      c.target.copy(pos).add(away);
      // Keep the panic target inside the roam circle and the species' depth band.
      // Without this the flee vector can point at a spot outside the bounds, and
      // the creature spends the next few seconds grinding along the clamp instead
      // of swimming — a dolphin pinned flat against an invisible wall. Ignore
      // `ring`'s inner radius here: fleeing across the middle beats not fleeing.
      clampRadius(c.target, c.roam * 0.95, c.home.x, c.home.z);
      c.target.y = THREE.MathUtils.clamp(
        c.target.y,
        columnY(spec.band[0], c.home.z),
        columnY(spec.band[1], c.home.z),
      );
      c.fleeFor = FLEE.hold;
      // MAX, not min: the dwell timer must not interrupt the run it just committed to.
      // The old code shortened it instead, which re-picked a random waypoint two
      // seconds into every escape — the second source of the jitter.
      c.retarget = Math.max(c.retarget, FLEE.hold);
    }

    // --- steer: yaw at a capped rate, pitch damped toward the waypoint ---
    tmp.copy(c.target).sub(pos);
    const flat = Math.hypot(tmp.x, tmp.z);
    let yawRate = 0;
    if (flat > 0.5) {
      const wantYaw = Math.atan2(-tmp.x, -tmp.z);     // model forward is -Z
      const step = spec.turn * c.turnMul * dt;
      const applied = THREE.MathUtils.clamp(angleDelta(c.yaw, wantYaw), -step, step);
      c.yaw += applied;
      yawRate = applied / dt;
    }
    // Bank off the yaw RATE, not off the angle still to go. Off the remaining
    // angle, a whale with a low `turn` would hold a hard 25° lean for the ten
    // seconds its turn takes — it just looks capsized. Off the rate, bank falls
    // out of how fast the animal can actually turn: the dolphin rolls into its
    // corners, the whale barely leans at all.
    const wantRoll = THREE.MathUtils.clamp(-yawRate * 0.35, -0.6, 0.6);
    c.roll = THREE.MathUtils.lerp(c.roll, wantRoll, 1 - Math.pow(0.06, dt));

    const wantPitch = THREE.MathUtils.clamp(Math.atan2(tmp.y, Math.max(flat, 0.001)), -c.pitchMax, c.pitchMax);
    c.pitch = THREE.MathUtils.lerp(c.pitch, wantPitch, 1 - Math.pow(0.15, dt));

    // --- move along the new heading ---
    // pitchBias is the whale's rear-back before it strikes (combat/aggression.js):
    // nose up, the whole animal visibly loading. It is added to the heading rather
    // than to the model's rotation on purpose — the tell has to move the animal, or
    // a shark watching the body instead of the pose gets no warning at all.
    pivot.rotation.y = c.yaw;
    pivot.rotation.x = c.pitch + c.pitchBias;
    body.rotation.z = c.roll;
    c.fwd.set(0, 0, -1).applyQuaternion(pivot.quaternion);
    pos.addScaledVector(c.fwd, c.speed * c.speedMul * dt);

    // --- bounds: off the dunes, under the surface, inside the roam circle ---
    clampRadius(pos, c.roam, c.home.x, c.home.z);
    // max() because clearance scales with the animal: give something a big enough
    // targetSize and its floor rises above its ceiling, and MathUtils.clamp
    // returns `min` when min > max — which would pin it to the sand for good.
    const floor = floorAt(pos.x, pos.z, c.clearance);
    const ceiling = Math.max(floor, WORLD.surface - c.clearance - 0.4);
    pos.y = THREE.MathUtils.clamp(pos.y, floor, ceiling);

    // --- rock collision ---
    // LAST, after the bounds, so the rock always wins. A collider can straddle the
    // roam boundary, and then the two constraints disagree: whichever runs last is
    // the position that gets rendered. The bound is invisible — drifting a couple
    // of units past it costs nothing — whereas a whale with its head inside a
    // mountain is the most obvious artefact in the scene.
    //
    // On real contact, pick a fresh waypoint soon. Without that the animal keeps
    // pushing toward a target on the far side of the peak and grinds along its
    // flank for the rest of its dwell time.
    if (resolveBody(pos, c.fwd, c.halfLength, c.girth) > 0.01) {
      c.retarget = Math.min(c.retarget, 0.6);
      // The push is horizontal, so re-seat above the dunes at the new x/z.
      pos.y = Math.max(pos.y, floorAt(pos.x, pos.z, c.clearance));
    }

    // Tail beat follows the throttle, for the fighters only — see the note where
    // `action` is stored. Nothing else ever changes speedMul, so nothing else pays
    // for this.
    if (c.action) c.action.timeScale = c.baseRate * c.speedMul;

    // Distance-gated (mixers.js). halfLength is passed as slack so the whale —
    // 21 units nose to tail — is judged by how close its BODY is, not its pivot.
    tickMixer(c, dt, pos, c.halfLength);
  }
}

// Every fighting animal forgets the player. Called by world.js when the shark
// respawns: an animal that killed you does not get to still be angry at a shark
// that woke up 280 m away in another basin.
export function calmCreatures() {
  for (const c of creatures) calm(c);
}
