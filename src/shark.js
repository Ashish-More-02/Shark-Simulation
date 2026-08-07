import * as THREE from 'three';
import { WORLD, SHARK, MODELS, BITE } from './config.js';
import { scene, camera } from './core.js';
import { floorAt } from './terrain.js';
import { resolveSolids, resolveBody } from './collision.js';
import { turnAxis, pitchAxis, thrustAxis, boosting, consumeMouseLook } from './input.js';
import { preyStats } from './prey.js';

// ============================================================
//  SHARK  — rig, handling, skeletal swim cycle, chase camera
// ============================================================

// Read by fish.js (flee), orbs.js (collection), particles.js (wake) and bite.js.
export const sharkState = {
  obj: null,        // pivot: carries heading + world position
  body: null,       // inner wrapper: banking and bob, independent of heading
  speed: 0,
  forward: new THREE.Vector3(),
  // How big eating has made us, 1 .. SHARK.maxScale. Every length the shark is
  // measured by is multiplied by this — see the GROWTH note in config.js.
  scale: 1,
  // Seconds left of the jaw-snap pose. bite.js sets it; we play it out.
  snap: 0,
};

let mixer = null, swimAction = null;
let yaw = 0, pitch = 0;
const camOffset = new THREE.Vector3(...SHARK.camOffset);
const camTarget = new THREE.Vector3();

export function createShark(model) {
  // rig: pivot (heading) -> body (sway/roll) -> model
  const obj = new THREE.Group();
  obj.rotation.order = 'YXZ';
  obj.position.set(...SHARK.startPos);

  const body = new THREE.Group();
  body.add(model);
  obj.add(body);
  scene.add(obj);

  sharkState.obj = obj;
  sharkState.body = body;

  // drive the baked skeletal swim cycle (tail + pectoral fins)
  const clips = model.clips;
  if (clips && clips.length) {
    mixer = new THREE.AnimationMixer(model.animRoot);
    const swim = THREE.AnimationClip.findByName(clips, 'Armature|Swim') || clips[0];
    swimAction = mixer.clipAction(swim);
    swimAction.setLoop(THREE.LoopRepeat, Infinity);
    swimAction.play();
  } else {
    console.warn('shark model has no animation clips — falling back to procedural sway');
  }

  return obj;
}

export function updateShark(dt, t) {
  const { obj, body } = sharkState;
  const look = consumeMouseLook();

  // --- growth: points -> scale, damped so a big meal swells in rather than pops ---
  const want = 1 + (SHARK.maxScale - 1) * Math.min(preyStats.points / SHARK.growthFull, 1);
  if (sharkState.scale !== want) {
    sharkState.scale = THREE.MathUtils.lerp(
      sharkState.scale, want, 1 - Math.pow(0.001, dt / SHARK.growthLag)
    );
    // Snap the last sliver shut, or this chases `want` forever and every length
    // below is recomputed for a difference of 1e-9.
    if (Math.abs(want - sharkState.scale) < 1e-4) sharkState.scale = want;
    body.scale.setScalar(sharkState.scale);
  }
  const scale = sharkState.scale;

  // --- turning (keys + mouse) ---
  const turnInput = turnAxis();
  yaw += turnInput * SHARK.turn * dt + look.yaw;

  pitch += pitchAxis() * SHARK.pitchRate * dt + look.pitch;
  pitch = THREE.MathUtils.clamp(pitch, -SHARK.pitchLimit, SHARK.pitchLimit);

  // --- speed: thrust, then drag, then clamp ---
  const thrust = thrustAxis();
  const sprinting = boosting() && thrust > 0;
  if (thrust) {
    const accelMul = thrust < 0 ? SHARK.reverseAccelMul : (sprinting ? SHARK.boostAccelMul : 1);
    sharkState.speed += SHARK.accel * dt * thrust * accelMul;
  }
  sharkState.speed -= sharkState.speed * SHARK.drag * dt;
  const top = sprinting ? SHARK.boostSpeed : SHARK.maxSpeed;
  sharkState.speed = THREE.MathUtils.clamp(sharkState.speed, -SHARK.maxSpeed * SHARK.reverseFrac, top);

  // --- orient + move ---
  obj.rotation.y = yaw;
  obj.rotation.x = pitch;
  sharkState.forward.set(0, 0, -1).applyQuaternion(obj.quaternion);
  obj.position.addScaledVector(sharkState.forward, sharkState.speed * dt);

  // --- bounds (follow the dunes so the shark never clips into the sand) ---
  // Clearances scale with the animal: a 12-unit shark that keeps a 6-unit shark's
  // 1.8 off the sand is swimming with half its belly in it.
  obj.position.x = THREE.MathUtils.clamp(obj.position.x, -WORLD.half, WORLD.half);
  obj.position.z = THREE.MathUtils.clamp(obj.position.z, -WORLD.half, WORLD.half);
  obj.position.y = THREE.MathUtils.clamp(
    obj.position.y,
    floorAt(obj.position.x, obj.position.z, SHARK.floorClearance * scale),
    WORLD.surface - 1.5 * scale
  );

  // --- rock collision ---
  // Scale the speed loss by how far we actually got pushed, rather than damping a
  // flat amount on every frame that reports contact. Grazing a boulder at full
  // tilt barely displaces you and should barely cost you; swimming nose-first
  // into a spire displaces you by most of a frame's travel and should stop you.
  // A flat multiplier would bleed all speed away while merely sliding along a
  // face, which turns every rock into flypaper.
  const push = resolveBody(
    obj.position, sharkState.forward,
    SHARK.bodyHalfLength * scale, SHARK.bodyRadius * scale
  );
  if (push > 0) {
    sharkState.speed *= Math.max(0.2, 1 - push * 2.5);
    // The push is purely horizontal, so it can slide us over a taller dune and
    // leave us buried in the sand. Re-seat on the floor at the NEW x/z. Only the
    // lower bound needs redoing — a sideways shove can't raise us into the sky.
    obj.position.y = Math.max(
      obj.position.y,
      floorAt(obj.position.x, obj.position.z, SHARK.floorClearance * scale)
    );
  }

  // --- swim animation: the skeleton does the tail beat, we only scale its rate ---
  const absSpeed = Math.abs(sharkState.speed);
  if (mixer) {
    // Normalized against boostSpeed, not maxSpeed: normal cruise (accel/drag,
    // well under maxSpeed) leaves room on this scale, so tailRateFast is only
    // actually reached while sprinting — the tail visibly quickens with it.
    const spd01 = Math.min(absSpeed / SHARK.boostSpeed, 1);
    const base = SHARK.tailRateIdle + spd01 * (SHARK.tailRateFast - SHARK.tailRateIdle);
    swimAction.timeScale = base * (sprinting ? SHARK.tailSprintMul : SHARK.tailNormalMul);
    mixer.update(dt);
  } else {
    // fallback for a non-animated model: fake the tail sway at the body level
    const swimRate = 4 + absSpeed * 0.8;
    body.rotation.y = Math.sin(t * swimRate) * 0.18 * (0.4 + absSpeed / SHARK.maxSpeed);
  }

  // --- bank into turns + gentle bob (on top of the skeletal animation) ---
  body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, -turnInput * 0.5, 0.1);
  body.position.y = Math.sin(t * 2.2) * 0.12 * scale;

  // --- jaw snap ---
  // shark-animated.glb ships exactly one clip ("Armature|Swim") — there is no
  // bite animation to play — so the snap is a fast nose-down lunge of the whole
  // body, in and out over BITE.snap seconds. A half sine, so it starts and ends
  // at rest with the peak in the middle: a chomp, not a twitch.
  //
  // Written EVERY frame, not just while snapping. updateShark owns body.rotation
  // and nothing else zeroes it, so a one-off write would leave the shark
  // permanently nose-down after its first bite.
  if (sharkState.snap > 0) {
    sharkState.snap = Math.max(0, sharkState.snap - dt);
    const p = 1 - sharkState.snap / BITE.snap;      // 0 -> 1 over the snap
    body.rotation.x = -0.3 * Math.sin(p * Math.PI);
  } else {
    body.rotation.x = 0;
  }

  updateChaseCamera(dt, scale);
}

// The camera deliberately does NOT track the shark's growth — see the camGrowth
// note in config.js. Matching the offset to the scale is what makes a growing
// shark look like a shrinking ocean.
let camScale = -1;

function updateChaseCamera(dt, scale) {
  const pos = sharkState.obj.position;

  // Recomputed only when it actually changes, which at the default camGrowth of 0
  // means exactly once for the whole run.
  const want = 1 + (scale - 1) * SHARK.camGrowth;
  if (want !== camScale) {
    camScale = want;
    const [cx, cy, cz] = SHARK.camOffset;
    camOffset.set(cx * want, cy * want, cz * want);
  }

  camTarget.copy(camOffset).applyQuaternion(sharkState.obj.quaternion).add(pos);
  camera.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
  camera.position.y = THREE.MathUtils.clamp(
    camera.position.y,
    floorAt(camera.position.x, camera.position.z, 1.0),
    WORLD.surface - 0.6      // stay under the surface, don't pop out of the water
  );
  // Keep the camera out of the rock too. Back the shark against a boulder without
  // this and the camera ends up inside it, so you're looking at the inside faces
  // of a rock — or, with backface culling, at nothing at all.
  resolveSolids(camera.position, 0.7);
  // Aim point rides with the camera, not with the shark: at camGrowth 0 the framing
  // is fixed, so the growing body fills the frame from a fixed vantage instead of
  // sliding down out of it.
  camera.lookAt(pos.x, pos.y + 0.6 * camScale, pos.z);
}

export function depthMetres() {
  return Math.max(0, Math.round(WORLD.surface - sharkState.obj.position.y));
}

// Nose to tail, in world units — what the HUD reads out. MODELS.shark.targetSize
// is the loader's normalized length, so this is the one true source for it.
export function sharkLength() {
  return MODELS.shark.targetSize * sharkState.scale;
}
