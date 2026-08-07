import * as THREE from 'three';
import { BITE } from './config.js';
import { sharkState } from './shark.js';
import { consumeBite } from './input.js';
import { tryBite, updatePrey } from './prey.js';
import { emitPuff } from './particles.js';
import { flashBite, showBiteInfo } from './hud.js';
import { playBite, playEat } from './audio.js';

// ============================================================
//  BITE  — the attack itself: cooldown, the lunge, the hit, the feedback.
//
//  Kept out of shark.js on purpose. shark.js is handling and animation; this is
//  the one place that knows a bite exists, so it can pull in prey, particles, HUD
//  and audio without any of those becoming shark.js's business.
//
//  Runs BEFORE updateShark() in the frame (world.js), which is what makes the
//  snap and the forward impulse land on the same frame as the click instead of
//  the next one. The cost is that the hit test uses last frame's positions for
//  both the shark and the fish — 16 ms of staleness on both sides of a test with
//  metres of tolerance.
// ============================================================

const mouth = new THREE.Vector3();
let cooldown = 0;

export function updateBite(dt) {
  updatePrey(dt);

  cooldown -= dt;
  // Consume the click either way: a click during the cooldown is a click you
  // spent, not one that queues up and fires itself later.
  const clicked = consumeBite();
  if (!clicked || cooldown > 0) return;
  cooldown = BITE.cooldown;

  const scale = sharkState.scale;
  mouth.copy(sharkState.obj.position).addScaledVector(sharkState.forward, BITE.mouthAhead * scale);

  // The snap and the pounce happen whether or not anything is there to eat —
  // biting at nothing still has to feel like biting.
  sharkState.snap = BITE.snap;
  sharkState.speed += BITE.lunge;
  playBite();

  const hit = tryBite(mouth, sharkState.forward, BITE.reach * scale);
  // Recycles the wake's bubble pool, so this costs no new particle system.
  emitPuff(mouth, hit ? 16 : 7, 1.5 * scale);

  if (!hit) return;
  flashBite(hit.killed);
  if (hit.killed) {
    playEat();
    showBiteInfo(`${hit.name} eaten`);
  } else {
    // Only worth saying for something that takes more than one bite.
    showBiteInfo(`${hit.name}  ${hit.taken}/${hit.of}`);
  }
}
