import { MODELS, PROPS, SHARK } from './config.js';
import { createBackdrop, createLights } from './core.js';
import { loadAll } from './loader.js';
import { createSeabed } from './terrain.js';
import { createWater } from './water.js';
import { createGodRays, updateGodRays } from './godrays.js';
import { createParticles, emitWake, updateWake } from './particles.js';
import { scatterAll, updateSway } from './props.js';
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

  ready = true;
}

export function updateWorld(dt, t) {
  if (!ready) return;

  // The shark moves first: everything below reads its final position this frame.
  updateShark(dt, t);
  const pos = sharkState.obj.position;

  updateGodRays();                  // billboards to the camera the shark just moved
  updateSway(t);
  const fleeing = updateSchools(dt, t, pos);
  updateCreatures(dt, pos);
  updateOrbs(dt, t, pos);

  const speed = Math.abs(sharkState.speed);
  if (speed > SHARK.wakeAtSpeed) emitWake(pos, sharkState.forward);
  updateWake(dt);
  // bubbles, marine snow and the water ripple are all GPU-side now — no per-frame
  // CPU work and no buffer uploads for any of them.

  updateSwim(speed, SHARK.maxSpeed);
  updateFishFlee(dt, fleeing);

  setDepth(depthMetres());
  setSpeed(speed);
}
