import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { WORLD, CREATURES } from './config.js';
import { scene } from './core.js';
import { floorAt } from './terrain.js';
import { ringRadius, clampRadius } from './placement.js';
import { resolveBody } from './collision.js';
import { tickMixer } from './mixers.js';

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

// How far out a creature may roam: the whole basin, stopping just short of the
// mountain range.
//
// Tied to WORLD.mountainRing rather than to WORLD.half, which is a change from
// when the play area was smaller than the range. A fraction of WORLD.half now
// works out past r=100, i.e. inside the peaks — and while the wildlife does have
// rock collision, an animal that spends its life bouncing off mountain flanks and
// re-routing looks broken rather than alive. Better to keep them in the open water
// where they belong and let collision stay the backstop it's meant to be.
//
// Enforced as a CIRCLE, not a box: see clampRadius() in placement.js for why.
const ROAM_LIMIT = WORLD.mountainRing - 2;

// scratch — allocated once, reused every frame
const tmp = new THREE.Vector3();
const away = new THREE.Vector3();
const fwd = new THREE.Vector3();

// Fraction of the water column -> world Y. 0 = mean seabed, 1 = surface.
function columnY(frac) {
  return WORLD.seabed + frac * (WORLD.surface - WORLD.seabed);
}

// Shortest signed distance between two angles, so a creature crossing ±π turns
// the short way round instead of unwinding the long way.
function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function newWaypoint(c) {
  const a = Math.random() * Math.PI * 2;
  const [inner, outer] = c.spec.ring;
  // min() so a `ring` widened in config can never place a waypoint outside the
  // circle the creature is actually allowed to reach — see ROAM_LIMIT.
  const r = ringRadius(Math.min(inner, ROAM_LIMIT * 0.9), Math.min(outer, ROAM_LIMIT * 0.95));
  const [lo, hi] = c.spec.band;
  c.target.set(Math.cos(a) * r, columnY(lo + Math.random() * (hi - lo)), Math.sin(a) * r);
  c.retarget = c.spec.dwell[0] + Math.random() * c.spec.dwell[1];
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
  const size = spec.sMin + Math.random() * (spec.sMax - spec.sMin);
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
    yaw: Math.random() * Math.PI * 2,
    pitch: 0,
    roll: 0,
    speed: spec.speed * (0.85 + Math.random() * 0.3),
    // keep the belly off the sand and the dorsal fin under the surface
    clearance: dims.halfHeight * size + 0.6,
    // Rock collision: three spheres down the animal's length. A 21-unit whale
    // resolved as one sphere at its middle would push its whole head through a
    // mountain before the centre ever registered contact.
    halfLength: dims.halfLength * size,
    girth: dims.halfHeight * size,
    retarget: 0,
    mixer: null,
  };

  newWaypoint(c);
  pivot.position.copy(c.target);
  pivot.rotation.y = c.yaw;

  // Each rig gets its own mixer rooted on its own clone, so bone-name lookups
  // resolve inside that subtree and the copies never share a playhead.
  const clips = proto.clips;
  if (clips && clips.length) {
    const clip = THREE.AnimationClip.findByName(clips, spec.clip) || clips[0];
    c.mixer = new THREE.AnimationMixer(model);
    const action = c.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.timeScale = spec.rate * (0.9 + Math.random() * 0.2);
    action.play();
    action.time = Math.random() * clip.duration;   // stagger, or they beat in lockstep
  } else {
    console.warn(`${spec.model}: no animation clips found`);
  }

  creatures.push(c);
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
  for (const c of creatures) {
    const { spec, pivot, body } = c;
    const pos = pivot.position;

    c.retarget -= dt;
    if (c.retarget <= 0) newWaypoint(c);

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
    fwd.set(0, 0, -1).applyQuaternion(pivot.quaternion);
    pos.addScaledVector(fwd, c.speed * dt);

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
    if (resolveBody(pos, fwd, c.halfLength, c.girth) > 0.01) {
      c.retarget = Math.min(c.retarget, 0.6);
      // The push is horizontal, so re-seat above the dunes at the new x/z.
      pos.y = Math.max(pos.y, floorAt(pos.x, pos.z, c.clearance));
    }

    // Distance-gated (mixers.js). halfLength is passed as slack so the whale —
    // 21 units nose to tail — is judged by how close its BODY is, not its pivot.
    tickMixer(c, dt, pos, c.halfLength);
  }
}
