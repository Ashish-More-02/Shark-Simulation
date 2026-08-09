import * as THREE from 'three';
import { ORBS, BITE } from './config/config.js';
import { scene } from './core.js';
import { floorAt } from './terrain.js';
import { softSprite } from './materials.js';
import { ringRadius, makeStream } from './placement.js';
import { insideSolid } from './collision.js';
import { setOrbs } from './hud.js';
import { playCollectSound } from './audio.js';
import { addPoints } from './prey.js';

// ============================================================
//  COLLECTIBLE ORBS
//
//  Also the one free ride on the size curve: an orb is worth BITE.orbPoints of
//  growth (config.js) for no chase and no bites — six fish for swimming through
//  it. They don't respawn, so this is a one-time bonus of ~18% of the way to full
//  size for exploring the whole reef.
// ============================================================

const orbs = [];
let total = 0;

// This subsystem's slice of the world seed (placement.js). Orbs are placed once and
// never move, so there is no live half here — every draw below is generation.
//
// Its own stream matters more than most: the retry loop below runs a VARIABLE
// number of times, so on a shared sequence the orbs would shift everything built
// after them by an amount nobody could predict. Here it shifts nothing but orbs.
//
// And per LEVEL, for the same reason again one level down: the shallows' orbs are
// placed first and their retries are unpredictable, so on one shared stream they
// decided where the reef's orbs went. Reassigned at the top of createOrbs.
let rng = makeStream('orbs');

export function createOrbs(level, count = ORBS.count) {
  rng = makeStream(`orbs:${level.id}`);
  // ONE geometry, ONE orb material, ONE halo material for all of them (§3.7).
  // Every orb used to build its own MeshStandardMaterial and its own
  // SpriteMaterial: 24 material instances for 24 draw calls, so every orb was also
  // a pipeline state change and a fresh uniform upload. They are identical — the
  // per-orb variation is all in the transform — so they can share.
  //
  // 12x8 segments instead of 16x16: these are half-unit spheres that are usually a
  // few pixels across, and it saves 4k triangles for a difference you cannot see.
  const geo = new THREE.SphereGeometry(0.5, 12, 8);
  const haloTex = softSprite('rgba(255,236,180,0.95)', 'rgba(255,190,60,0.45)');
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xffe08a, emissive: 0xffb020, emissiveIntensity: 1.4, roughness: 0.3,
  });
  const haloMat = new THREE.SpriteMaterial({
    map: haloTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.85,
  });

  const [ox, , oz] = level.center;

  for (let i = 0; i < count; i++) {
    const orb = new THREE.Mesh(geo, orbMat);
    // Equal-area radius (placement.js), so the orbs are spread across the whole
    // reef instead of bunched near the start point. Outer bound stays inside
    // the level bound — every orb has to be somewhere the shark can actually reach.
    // Keep drawing positions until one is clear of the rock. The shark can no
    // longer enter a solid, so an orb buried in a boulder is flatly uncollectable
    // and the run unwinnable — with nothing on screen to explain why.
    //
    // Retry rather than push it out: a push lands the orb wherever the shove
    // happens to leave it, and being shoved off a big peak could put it outside
    // the bound entirely — out of the shark's own reach, which is the very
    // problem we're avoiding. ~18% of the near-seabed area is solid, so a clear
    // draw is near-certain within a handful of tries.
    let x, z, y;
    for (let tries = 0; tries < 16; tries++) {
      // Off this LEVEL's bound, not a global constant, so orbs fill whatever
      // basin they were asked for. Inside it: an orb the shark cannot reach is an
      // unwinnable run with nothing on screen to explain why.
      const a = rng() * Math.PI * 2, r = ringRadius(8, level.play * 0.9, rng);
      x = ox + Math.cos(a) * r;
      z = oz + Math.sin(a) * r;
      y = floorAt(x, z, 3 + rng() * 16);
      if (!insideSolid(x, y, z, ORBS.collectRadius + 1)) break;
    }
    orb.position.set(x, y, z);
    orb.userData.phase = rng() * Math.PI * 2;

    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(3.4);
    orb.add(halo);

    scene.add(orb);
    orbs.push(orb);
  }

  // Accumulates across levels — createOrbs is called once per level and `orbs` is
  // module state, so this is the running world total, not this level's count.
  total = orbs.length;
  setOrbs(0, total);
  return orbs;
}

export function updateOrbs(dt, t, sharkPos) {
  for (let i = orbs.length - 1; i >= 0; i--) {
    const orb = orbs[i];
    const phase = orb.userData.phase;
    orb.position.y += Math.sin(t * 2 + phase) * 0.003;
    orb.rotation.y += dt * 1.5;
    orb.scale.setScalar(1 + Math.sin(t * 4 + phase) * 0.12);

    if (orb.position.distanceTo(sharkPos) < ORBS.collectRadius) {
      scene.remove(orb);
      orbs.splice(i, 1);
      setOrbs(total - orbs.length, total);
      addPoints(BITE.orbPoints);
      playCollectSound();
    }
  }
}
