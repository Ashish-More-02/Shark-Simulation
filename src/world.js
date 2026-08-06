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
import { createShark, updateShark, sharkState, depthMetres } from './shark.js';
import { setDepth, setSpeed } from './hud.js';
import { updateSwim, updateFishFlee } from './audio.js';

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

  // The shark moves first: everything below reads its final position this frame.
  updateShark(dt, t);
  const pos = sharkState.obj.position;

  // God rays billboard themselves in the vertex shader now, and the foliage sway
  // is a vertex-shader function of (time, phase, amp) — neither needs a per-frame
  // CPU pass any more. What replaced updateSway() is pure culling: decide which
  // prop chunks are in front of the camera and near enough to matter.
  updateProps();
  const fleeing = updateSchools(dt, t, pos);
  updateCreatures(dt, pos);
  updateOrbs(dt, t, pos);

  const speed = Math.abs(sharkState.speed);
  if (speed > SHARK.wakeAtSpeed) emitWake(pos, sharkState.forward);
  updateWake(dt);
  // Bubbles, marine snow, the water ripple, the god-ray billboards and the foliage
  // sway are all GPU-side now — no per-frame CPU work and no buffer uploads for any
  // of them.

  updateSwim(speed, SHARK.maxSpeed);
  updateFishFlee(dt, fleeing);

  setDepth(depthMetres());
  setSpeed(speed);
}
