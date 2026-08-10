import * as THREE from 'three';
import { WORLD, SHARK, MODELS, BITE, COMBAT } from './config/config.js';
import { scene, camera } from './core.js';
import { floorAt } from './terrain.js';
import { clampToWorld } from './levels.js';
import { resolveSolids, resolveBody } from './collision.js';
import { turnAxis, pitchAxis, thrustAxis, boosting, consumeMouseLook } from './input.js';
import { preyStats } from './prey.js';
import { boostSeconds, refillSeconds } from './upgrades.js';

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
  // ---- BOOST STAMINA (see STAMINA in config.js) ----
  // Read by the HUD ring. Kept here rather than in hud.js because it is game
  // state that happens to be displayed, not display state: the gate below is what
  // decides whether Shift does anything at all.
  stamina: 1,           // 0..1 of a full bar
  staminaSpent: false,  // bottomed out — Shift is dead until stamina is back to 1
  boostHeld: false,     // Shift down this frame, whether or not it bought anything
  sprinting: false,     // ...and whether it actually did
  // Seconds of "your input does nothing" left. Set by combat/health.js on death and
  // cleared by respawnShark(). The shark keeps its momentum and drifts, which is
  // both cheaper and better looking than freezing it: a hard stop reads as a bug,
  // and a fade to black is a sequence this build has not earned yet.
  stunned: 0,
};

let mixer = null, swimAction = null;
let yaw = 0, pitch = 0;
const camOffset = new THREE.Vector3(...SHARK.camOffset);
const camTarget = new THREE.Vector3();

// ---- HIT FLASH -------------------------------------------------------------
// Every material on the shark, with the emissive values it shipped with, so a hit
// can blow the whole body out to white and put it back exactly as it was. Collected
// once at build: the rig is one model and its material list never changes.
//
// Why emissive and not a colour swap: `color` is multiplied by the albedo texture,
// so driving it to white just brightens the texture and the shark still reads as a
// shark. Emissive is ADDED after lighting, so it washes the silhouette out
// regardless of what the texture or the fog are doing — which is the point. Being
// hit has to be legible in the half second you are looking at the whale, not at
// yourself.
//
// The menu's preview shark is a separate load with its own materials (preview.js),
// so nothing here touches it.
const hitMats = [];
let hitFlash = 0;

export function flashHit() {
  hitFlash = COMBAT.hitFlash;
}

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

  // See the HIT FLASH note above. `emissive` is cloned rather than referenced, or
  // the "original" would be the same Color object the flash writes into.
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!mat.emissive) continue;      // no emissive term to drive on this material
      hitMats.push({ mat, emissive: mat.emissive.clone(), intensity: mat.emissiveIntensity ?? 1 });
    }
  });
  // An unlit model (KHR_materials_unlit -> MeshBasicMaterial) has no emissive to
  // drive, and the flash would then do nothing at all — silently, which is the worst
  // way for a piece of combat feedback to fail. Say so.
  if (!hitMats.length) console.warn('shark model has no emissive materials — the hit flash will not show');

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
  // Consumed whether or not it is used: a stunned shark that banked its mouse-look
  // would snap round through every degree of it the moment control came back.
  const look = consumeMouseLook();

  // Dead (combat/health.js). Every input axis reads zero, so the shark coasts to a
  // stop on drag alone, and the chase camera at the bottom keeps working — you
  // watch your own shark drift, which is the whole of the death beat.
  const stunned = sharkState.stunned > 0;
  if (stunned) sharkState.stunned = Math.max(0, sharkState.stunned - dt);

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
  const turnInput = stunned ? 0 : turnAxis();
  if (!stunned) {
    yaw += turnInput * SHARK.turn * dt + look.yaw;
    pitch += pitchAxis() * SHARK.pitchRate * dt + look.pitch;
    pitch = THREE.MathUtils.clamp(pitch, -SHARK.pitchLimit, SHARK.pitchLimit);
  }

  // --- boost stamina ---
  // Drain is charged for the boost you RECEIVE, not for the key you hold: Shift
  // while drifting or reversing never bought a sprint (boost has always required
  // forward thrust), so it must not cost anything either. The ring still shows
  // while merely holding Shift — that's what makes it a gauge you can check.
  const thrust = stunned ? 0 : thrustAxis();
  const held = !stunned && boosting();
  const sprinting = held && thrust > 0 && !sharkState.staminaSpent;
  if (sprinting) {
    // boostSeconds(), not STAMINA.boostSeconds: the tank's SIZE is an upgrade
    // (upgrades.js). `stamina` stays a 0..1 fraction of whatever the tank currently
    // is, so a level bought mid-swim needs no migration — the same fraction is
    // simply worth more seconds, and the ring beside the shark drains slower.
    sharkState.stamina -= dt / boostSeconds();
    if (sharkState.stamina <= 0) {
      sharkState.stamina = 0;
      sharkState.staminaSpent = true;    // latched — see the note in config.js
    }
  } else if (sharkState.stamina < 1) {
    // One constant rate, so a half-spent bar costs half of refillSeconds to
    // recover. Refills while Shift is still down, which is the only way out of
    // the spent state. A bigger tank takes longer to fill, but less than
    // proportionally — see the note on UPGRADES.stamina.
    sharkState.stamina += dt / refillSeconds();
    if (sharkState.stamina >= 1) {
      sharkState.stamina = 1;
      sharkState.staminaSpent = false;
    }
  }
  sharkState.boostHeld = held;
  sharkState.sprinting = sprinting;

  // --- speed: thrust, then drag, then clamp ---
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
  // Horizontal bound is the union of every basin's disc and the canyon between
  // them (levels.js) — not a box any more, because the world is no longer one
  // basin and a box around two of them would let you swim across open sand from
  // one to the other without ever using the corridor.
  clampToWorld(obj.position);
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

  // --- hit flash ---
  // Ramps DOWN from the moment of the hit rather than in and out: the impact is on
  // frame one, so the brightest frame has to be frame one too. Anything with an
  // attack is a sine and reads as a glow rather than as a blow.
  if (hitFlash > 0) {
    hitFlash = Math.max(0, hitFlash - dt);
    const k = hitFlash / COMBAT.hitFlash;      // 1 -> 0 over the flash
    for (const m of hitMats) {
      if (hitFlash > 0) {
        m.mat.emissive.setScalar(k);
        m.mat.emissiveIntensity = m.intensity + k * COMBAT.hitFlashGain;
      } else {
        // Restored exactly, not zeroed: the shark's materials may legitimately ship
        // an emissive of their own, and a flash must not be a permanent edit.
        m.mat.emissive.copy(m.emissive);
        m.mat.emissiveIntensity = m.intensity;
      }
    }
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

// Put the shark back at the sanctuary. Called by world.js off the health system's
// respawn hook (combat/health.js), which owns the timing and the banner; this owns
// only the rig.
//
// SHARK.startPos is the middle of level 1 — the de facto sanctuary until
// sanctuaries exist — and the floor clamp in updateShark reseats it on the dunes on
// the first frame, exactly as it does at boot.
//
// Growth is NOT reset. Roadmap §4: death costs you the swim back, never your
// progress. Stamina is refilled because arriving with a spent bar would mean the
// first thing a respawn does is take something else away from you.
export function respawnShark() {
  const { obj } = sharkState;
  obj.position.set(...SHARK.startPos);
  yaw = 0;
  pitch = 0;
  obj.rotation.set(0, 0, 0);
  sharkState.forward.set(0, 0, -1).applyQuaternion(obj.quaternion);
  sharkState.speed = 0;
  sharkState.snap = 0;
  sharkState.stunned = 0;
  sharkState.stamina = 1;
  sharkState.staminaSpent = false;

  // SNAP the camera rather than letting it lerp. Its easing covers about 10% of the
  // gap per frame, so from the reef to the shallows it would fly 280 m across the
  // whole world — through the canyon wall — over about half a second.
  snapCamera();
}

// The camera deliberately does NOT track the shark's growth — see the camGrowth
// note in config.js. Matching the offset to the scale is what makes a growing
// shark look like a shrinking ocean.
let camScale = -1;

function snapCamera() {
  const pos = sharkState.obj.position;
  camera.position.copy(camOffset).applyQuaternion(sharkState.obj.quaternion).add(pos);
  camera.lookAt(pos.x, pos.y + 0.6 * Math.max(camScale, 1), pos.z);
}

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
