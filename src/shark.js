import * as THREE from 'three';
import { WORLD, SHARK } from './config.js';
import { scene, camera } from './core.js';
import { floorAt } from './terrain.js';
import { resolveSolids, resolveBody } from './collision.js';
import { turnAxis, pitchAxis, thrustAxis, boosting, consumeMouseLook } from './input.js';

// ============================================================
//  SHARK  — rig, handling, skeletal swim cycle, chase camera
// ============================================================

// Read by fish.js (flee), orbs.js (collection) and particles.js (wake).
export const sharkState = {
  obj: null,        // pivot: carries heading + world position
  body: null,       // inner wrapper: banking and bob, independent of heading
  speed: 0,
  forward: new THREE.Vector3(),
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
  obj.position.x = THREE.MathUtils.clamp(obj.position.x, -WORLD.half, WORLD.half);
  obj.position.z = THREE.MathUtils.clamp(obj.position.z, -WORLD.half, WORLD.half);
  obj.position.y = THREE.MathUtils.clamp(
    obj.position.y,
    floorAt(obj.position.x, obj.position.z, SHARK.floorClearance),
    WORLD.surface - 1.5
  );

  // --- rock collision ---
  // Scale the speed loss by how far we actually got pushed, rather than damping a
  // flat amount on every frame that reports contact. Grazing a boulder at full
  // tilt barely displaces you and should barely cost you; swimming nose-first
  // into a spire displaces you by most of a frame's travel and should stop you.
  // A flat multiplier would bleed all speed away while merely sliding along a
  // face, which turns every rock into flypaper.
  const push = resolveBody(obj.position, sharkState.forward, SHARK.bodyHalfLength, SHARK.bodyRadius);
  if (push > 0) {
    sharkState.speed *= Math.max(0.2, 1 - push * 2.5);
    // The push is purely horizontal, so it can slide us over a taller dune and
    // leave us buried in the sand. Re-seat on the floor at the NEW x/z. Only the
    // lower bound needs redoing — a sideways shove can't raise us into the sky.
    obj.position.y = Math.max(
      obj.position.y,
      floorAt(obj.position.x, obj.position.z, SHARK.floorClearance)
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
  body.position.y = Math.sin(t * 2.2) * 0.12;

  updateChaseCamera(dt);
}

function updateChaseCamera(dt) {
  const pos = sharkState.obj.position;
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
  camera.lookAt(pos.x, pos.y + 0.6, pos.z);
}

export function depthMetres() {
  return Math.max(0, Math.round(WORLD.surface - sharkState.obj.position.y));
}
