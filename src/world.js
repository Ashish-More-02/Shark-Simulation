import { MODELS, PROPS, SHARK } from './config.js';
import { createBackdrop, createLights, renderer, scene, camera } from './core.js';
import { loadAll } from './loader.js';
import { createSeabed } from './terrain.js';
import { createWater } from './water.js';
import { createGodRays } from './godrays.js';
import { createParticles, emitWake, updateWake } from './particles.js';
import { scatterAll, updateProps } from './props.js';
import { createSchools, updateSchools } from './fish.js';
import { createCreatures, updateCreatures } from './creatures.js';
import { createOrbs, updateOrbs } from './orbs.js';
import { createShark, updateShark, sharkState, depthMetres, sharkLength } from './shark.js';
import { updateBite } from './bite.js';
import { preyStats, nearestTracked } from './prey.js';
import { setDepth, setSpeed, setEaten, setSize, setTrack } from './hud.js';
import { updateSwim } from './audio.js';

// ============================================================
//  WORLD  — composition root. Builds the scene in order, then
//  drives every subsystem's per-frame update.
// ============================================================

let ready = false;

export async function buildWorld() {
  // static scenery first — none of it depends on the models
  createBackdrop();
  createLights();
  createSeabed();
  createWater();
  createGodRays();
  createParticles();

  const models = await loadAll(MODELS);

  createShark(models.shark);
  scatterAll(PROPS, models);
  createSchools(models);
  createCreatures(models);
  createOrbs();

  // Compile every program NOW, while the start screen is still up (§6). Otherwise
  // each material compiles the first time it is drawn, and the opening seconds of
  // play stutter once per shader as the reef comes into view — which is exactly
  // when the player is looking around and most likely to notice.
  renderer.compile(scene, camera);

  ready = true;
}

export function updateWorld(dt, t) {
  if (!ready) return;

  // Bite BEFORE the shark moves, so the head snap and the lunge impulse both land
  // on the frame you clicked rather than the one after. The hit test pays for that
  // with last frame's positions — see bite.js.
  updateBite(dt);

  // The shark moves first: everything below reads its final position this frame.
  updateShark(dt, t);
  const pos = sharkState.obj.position;

  // God rays billboard themselves in the vertex shader now, and the foliage sway
  // is a vertex-shader function of (time, phase, amp) — neither needs a per-frame
  // CPU pass any more. What replaced updateSway() is pure culling: decide which
  // prop chunks are in front of the camera and near enough to matter.
  updateProps();
  updateSchools(dt, t, pos);
  updateCreatures(dt, pos);
  updateOrbs(dt, t, pos);

  const speed = Math.abs(sharkState.speed);
  if (speed > SHARK.wakeAtSpeed) emitWake(pos, sharkState.forward);
  updateWake(dt);
  // Bubbles, marine snow, the water ripple, the god-ray billboards and the foliage
  // sway are all GPU-side now — no per-frame CPU work and no buffer uploads for any
  // of them.

  updateSwim(speed, SHARK.maxSpeed);

  setDepth(depthMetres());
  setSpeed(speed);
  setEaten(preyStats.eaten);
  setSize(sharkLength());

  // Bearing to the nearest whale / dolphin / anglerfish. Screen-right is
  // cross(forward, up) = (-fz, 0, fx), so the target's right- and forward-
  // components give a signed angle straight out of atan2: 0 dead ahead, positive
  // to starboard. Done here rather than in hud.js, which stays DOM-only.
  const track = nearestTracked(pos);
  if (!track) {
    setTrack(null);
  } else {
    const dx = track.pos.x - pos.x, dz = track.pos.z - pos.z;
    const fx = sharkState.forward.x, fz = sharkState.forward.z;
    setTrack(track.name, Math.round(track.dist), Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz));
  }
}
