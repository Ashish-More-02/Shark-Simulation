import * as THREE from 'three';
import { BITE, COMBAT } from '../config/config.js';
import { sharkState } from '../shark.js';
import { consumeBite } from '../input.js';
import { tryBite, updatePrey } from '../prey.js';
import { emitPuff } from '../particles.js';
import { flashBite, showBiteInfo } from '../hud.js';
import { playBite, playEat } from '../audio.js';
import { biteDamage, biteCooldown } from '../upgrades.js';
import { health, healShark } from './health.js';

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
//
//  ---- WHAT A BITE IS WORTH ----
//  biteDamage() — PLAYER.attack plus whatever the player has BOUGHT (upgrades.js),
//  20 up to 80. Never a function of the shark's size: it briefly scaled with growth,
//  and a stat that rises on its own is a stat the upgrade screen cannot sell.
//
//  Prey health is in the same units (prey.js) and is baked from the BASE attack, so
//  a whale is 1000 hp forever and what an attack level actually buys is bites-to-kill:
//  50 at level zero, 32 at level 2, 23 at 4, 18 at 6, 13 at 10.
//
//  What the shark's SIZE still buys is reach — BITE.reach x scale below — because
//  that is the geometry of a bigger animal's jaws, not a number on a sheet.
//
//  ---- AND HOW OFTEN ----
//  biteCooldown(), the Attack speed stat: a deliberately slow 0.8 s at level 0, down
//  to 0.3 s fully upgraded. Damage and rate multiply, so the two attack rows are the
//  only pair on the sheet where buying one makes the other worth more — and at level
//  zero a whale is FORTY seconds of unbroken biting against an animal that kills you in
//  two strikes, which is a fight you simply lose until you have spent some points.
// ============================================================

const mouth = new THREE.Vector3();
let cooldown = 0;

export function updateBite(dt) {
  updatePrey(dt);

  cooldown -= dt;
  // Consume the click either way: a click during the cooldown is a click you
  // spent, not one that queues up and fires itself later. Same for a click while
  // dead — it must not be banked and spent on the frame you respawn.
  const clicked = consumeBite();
  if (!clicked || cooldown > 0 || health.dead) return;
  // biteCooldown(), not BITE.cooldown: attack speed is an upgrade. Read at the moment
  // of the bite rather than cached, so a level bought in the menu applies to the very
  // next snap — and a level bought DURING a cooldown does not shorten the one already
  // running, which is the honest way round.
  cooldown = biteCooldown();

  const scale = sharkState.scale;
  mouth.copy(sharkState.obj.position).addScaledVector(sharkState.forward, BITE.mouthAhead * scale);

  // The snap and the pounce happen whether or not anything is there to eat —
  // biting at nothing still has to feel like biting.
  sharkState.snap = BITE.snap;
  sharkState.speed += BITE.lunge;
  playBite();

  const hit = tryBite(mouth, sharkState.forward, BITE.reach * scale, biteDamage());
  // Recycles the wake's bubble pool, so this costs no new particle system.
  emitPuff(mouth, hit ? 16 : 7, 1.5 * scale);

  if (!hit) return;
  flashBite(hit.killed);
  if (hit.killed) {
    playEat();
    // Eating is the only real heal in the game (COMBAT.healPerPoint, and the note
    // on hunger in health.js). healShark returns what it ACTUALLY restored, so at
    // full health the readout says nothing rather than lying about +42.
    //
    // The points are named here too, and that is the one place the game says what a
    // kill was worth at the moment you earned it — a currency you only ever see as a
    // total in the corner is a currency nobody connects to what they just did.
    const healed = Math.round(healShark(hit.points * COMBAT.healPerPoint));
    showBiteInfo(
      `${hit.name} eaten   +${hit.points} pts${healed > 0 ? `   +${healed} hp` : ''}`
    );
  } else {
    // The health readout, not a bite tally: a whale at 740 of 1000 is the only way to
    // tell an animal that is taking damage from one that is shrugging you off — and at
    // fifty bites it is the only thing making that fight legible at all.
    showBiteInfo(`${hit.name}   ${Math.ceil(hit.hp)} / ${hit.maxHp}`, hit.hp / hit.maxHp);
  }
}
