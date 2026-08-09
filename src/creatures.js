import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { WORLD, CREATURES } from './config/config.js';
import { LEVELS } from './config/levels/index.js';
import { scene } from './core.js';
import { floorAt } from './terrain.js';
import { ringRadius, clampRadius, makeStream, live } from './placement.js';
import { habitatY } from './levels.js';
import { resolveBody } from './collision.js';
import { tickMixer } from './mixers.js';
import { registerPrey } from './prey.js';

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
// ============================================================

const creatures = [];

// This subsystem's slice of the world seed (placement.js). Spawn draws from it, so
// the same seed puts the same whale in the same place at the same size facing the
// same way; the roaming afterwards draws from `live`, because where a dolphin is
// two minutes in depends on where the player chased it.
const rng = makeStream('creatures');

// How far out a creature may roam: the whole basin, stopping just short of the
// bound. Kept out of the peaks deliberately — the wildlife does have rock
// collision, but an animal that spends its life bouncing off mountain flanks and
// re-routing looks broken rather than alive, so collision stays the backstop it
// is meant to be rather than the thing that steers.
//
// Enforced as a CIRCLE, not a box: see clampRadius() in placement.js for why.
//
// Taken from the REEF's own play bound rather than from a shared constant: the
// wildlife lives in level 2 and its range has to grow when that level does.
const ROAM_LIMIT = LEVELS[1].play - 10;

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
// Every creature lives in LEVELS[1] — the reef, centred on the origin — so the
// floor is sampled at z = 0. Wildlife is deliberately absent from the shallows:
// a plain you can see across with a whale in it is not a plain, and "the big
// animals live deeper" is the first thing the descent should teach.
function columnY(frac) {
  return habitatY(frac, 0);
}

// Shortest signed distance between two angles, so a creature crossing ±π turns
// the short way round instead of unwinding the long way.
function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

// `draw` is the stream to use: the seeded one for the waypoint an animal is BORN
// on (that is its spawn position — part of the world), `live` for every waypoint it
// picks afterwards.
function newWaypoint(c, draw) {
  const a = draw() * Math.PI * 2;
  const [inner, outer] = c.spec.ring;
  // min() so a `ring` widened in config can never place a waypoint outside the
  // circle the creature is actually allowed to reach — see ROAM_LIMIT.
  const r = ringRadius(Math.min(inner, ROAM_LIMIT * 0.9), Math.min(outer, ROAM_LIMIT * 0.95), draw);
  const [lo, hi] = c.spec.band;
  c.target.set(Math.cos(a) * r, columnY(lo + draw() * (hi - lo)), Math.sin(a) * r);
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

function spawn(proto, spec) {
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
    target: new THREE.Vector3(),
    yaw: rng() * Math.PI * 2,
    pitch: 0,
    roll: 0,
    speed: spec.speed * (0.85 + rng() * 0.3),
    // keep the belly off the sand and the dorsal fin under the surface
    clearance: dims.halfHeight * size + 0.6,
    // Rock collision: three spheres down the animal's length. A 21-unit whale
    // resolved as one sphere at its middle would push its whole head through a
    // mountain before the centre ever registered contact.
    halfLength: dims.halfLength * size,
    girth: dims.halfHeight * size,
    retarget: 0,
    mixer: null,
    // Own heading vector rather than a shared scratch: prey.js holds onto this as
    // the axis of the animal's capsule hit volume, so it has to stay valid between
    // frames instead of being whatever the last creature in the loop wrote.
    fwd: new THREE.Vector3(0, 0, -1),
    alive: true,
  };

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
    track: true,        // wildlife shows up in the HUD's NEAREST bearing
    hide() { c.alive = false; pivot.visible = false; },
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
  c.fwd.set(0, 0, -1).applyQuaternion(c.pivot.quaternion);
  newWaypoint(c, live);   // ...and now somewhere to actually swim
}

export function createCreatures(models) {
  for (const spec of CREATURES) {
    const proto = models[spec.model];
    if (!proto) { console.warn(`creature model "${spec.model}" not loaded`); continue; }
    if (spec.glow) lightUpLure(proto, spec.glow);
    for (let i = 0; i < spec.count; i++) spawn(proto, spec);
  }
  return creatures;
}

export function updateCreatures(dt, sharkPos) {
  lastShark.copy(sharkPos);      // for reseat(), when one of these respawns

  for (const c of creatures) {
    if (!c.alive) continue;      // eaten: hidden, and not simulated until it's back
    const { spec, pivot, body } = c;
    const pos = pivot.position;

    c.retarget -= dt;
    if (c.retarget <= 0) newWaypoint(c, live);

    // Shy species break off and put distance between themselves and the shark.
    // The whale (shy: 0) keeps its course — nothing down here worries it.
    if (spec.shy && pos.distanceTo(sharkPos) < 22) {
      away.copy(pos).sub(sharkPos);
      if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
      away.normalize().multiplyScalar(34 * spec.shy);
      c.target.copy(pos).add(away);
      // Keep the panic target inside the roam circle and the species' depth band.
      // Without this the flee vector can point at a spot outside the bounds, and
      // the creature spends the next few seconds grinding along the clamp instead
      // of swimming — a dolphin pinned flat against an invisible wall. Ignore
      // `ring`'s inner radius here: fleeing across the middle beats not fleeing.
      clampRadius(c.target, ROAM_LIMIT * 0.95);
      c.target.y = THREE.MathUtils.clamp(c.target.y, columnY(spec.band[0]), columnY(spec.band[1]));
      c.retarget = Math.min(c.retarget, 2);
    }

    // --- steer: yaw at a capped rate, pitch damped toward the waypoint ---
    tmp.copy(c.target).sub(pos);
    const flat = Math.hypot(tmp.x, tmp.z);
    let yawRate = 0;
    if (flat > 0.5) {
      const wantYaw = Math.atan2(-tmp.x, -tmp.z);     // model forward is -Z
      const step = spec.turn * dt;
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

    const wantPitch = THREE.MathUtils.clamp(Math.atan2(tmp.y, Math.max(flat, 0.001)), -0.5, 0.5);
    c.pitch = THREE.MathUtils.lerp(c.pitch, wantPitch, 1 - Math.pow(0.15, dt));

    // --- move along the new heading ---
    pivot.rotation.y = c.yaw;
    pivot.rotation.x = c.pitch;
    body.rotation.z = c.roll;
    c.fwd.set(0, 0, -1).applyQuaternion(pivot.quaternion);
    pos.addScaledVector(c.fwd, c.speed * dt);

    // --- bounds: off the dunes, under the surface, inside the roam circle ---
    clampRadius(pos, ROAM_LIMIT);
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

    // Distance-gated (mixers.js). halfLength is passed as slack so the whale —
    // 21 units nose to tail — is judged by how close its BODY is, not its pivot.
    tickMixer(c, dt, pos, c.halfLength);
  }
}
