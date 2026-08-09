import * as THREE from 'three';
import { WORLD, PARTICLES } from './config/config.js';
import { scene, uTime } from './core.js';
import { softSprite } from './materials.js';
import { worldBounds, DEEPEST } from './levels.js';
import { makeStream, live } from './placement.js';

// ============================================================
//  PARTICLES  — bubbles rise, marine snow drifts down,
//               and the shark drags a bubble wake behind it.
//
//  Bubbles and snow are pure functions of (start position, speed, time), so they
//  run entirely in the vertex shader: 1120 particles that used to cost a CPU loop
//  plus two full buffer re-uploads every frame now cost nothing per frame.
//  The wake stays on the CPU — it's event-driven, not a closed-form motion.
// ============================================================

let wake = null;

// This module's slice of the world seed (placement.js), for the standing bubble and
// snow FIELD — laid out once at build and then animated entirely in the shader, so
// it is scenery like anything else. The wake and the bite spray below are not: they
// happen where the player swims and bites, and draw from `live`.
const rng = makeStream('particles');

// A GPU-animated Points field. `motion` is GLSL that rewrites `transformed`,
// with `aSpeed` / `aPhase` available per particle.
// The field is one box spanning every level — bubbles and snow are a single draw
// call each no matter how big it is, and a per-level field would need the wrap
// height to change as you crossed a boundary, which is a shader constant.
//
// FLOOR is the DEEPEST seabed in the world, so the column is tall enough for the
// lowest level. In the shallows that means snow keeps falling for a while below
// the sand, and bubbles are born under it — both invisible, both free, and both
// far cheaper than making the wrap depth-dependent.
const FLOOR = DEEPEST;
const SPAN = WORLD.surface - FLOOR;

function gpuField({ count, size, opacity }, tex, spread, motion) {
  const b = worldBounds();
  const pos = new Float32Array(count * 3);
  const spd = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = b.midX + (rng() - 0.5) * b.width * spread;
    pos[i * 3 + 1] = FLOOR + rng() * SPAN;
    pos[i * 3 + 2] = b.midZ + (rng() - 0.5) * b.depth * spread;
    spd[i] = 0.4 + rng();
    phase[i] = rng() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));

  // PointsMaterial (not a raw ShaderMaterial) so we keep three's correct size
  // attenuation, fog and sprite handling for free.
  const mat = new THREE.PointsMaterial({
    size, map: tex, transparent: true, depthWrite: false, opacity,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        attribute float aSpeed;
        attribute float aPhase;
        const float uSeabed  = ${FLOOR.toFixed(1)};
        const float uSurface = ${WORLD.surface.toFixed(1)};
        const float uSpan    = ${SPAN.toFixed(1)};`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${motion}`);
  };
  mat.customProgramCacheKey = () => 'gpuParticles:' + motion.length;

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;   // the shader moves them; the bounding sphere can't know
  scene.add(pts);
  return pts;
}

export function createParticles() {
  // rise steadily and wrap back to the seabed at the surface
  const bubbles = gpuField(
    PARTICLES.bubbles,
    softSprite('rgba(255,255,255,0.9)', 'rgba(200,235,255,0.5)'),
    1.0,
    `transformed.y = uSeabed + mod(position.y - uSeabed + uTime * (1.0 + aSpeed * 1.8), uSpan);`
  );

  // sink steadily, wrap at the seabed, and sway sideways on the way down
  const snow = gpuField(
    PARTICLES.snow,
    softSprite('rgba(255,255,255,0.85)', 'rgba(225,240,255,0.45)'),
    1.1,
    `transformed.y = uSurface - mod(uSurface - position.y + uTime * aSpeed * 0.22, uSpan);
     transformed.x += sin(uTime * 0.3 + aPhase) * 0.8;`
  );

  // wake particles start parked far off-screen and are recycled on demand
  const w = PARTICLES.wake;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(w.count * 3).fill(1e6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: w.size, map: softSprite('rgba(255,255,255,0.8)', 'rgba(210,240,255,0.4)'),
    transparent: true, depthWrite: false, opacity: w.opacity,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  wake = { pts, pos, life: new Float32Array(w.count), count: w.count, next: 0, live: 0, dirty: false };

  return { bubbles, snow, wake };
}

// Claim the next slot in the ring and park a bubble at (x, y, z).
function spawnBubble(x, y, z) {
  const i = wake.next;
  if (wake.life[i] <= 0) wake.live++;
  wake.pos[i * 3]     = x;
  wake.pos[i * 3 + 1] = y;
  wake.pos[i * 3 + 2] = z;
  wake.life[i] = 1;
  wake.next = (i + 1) % wake.count;
  wake.dirty = true;
}

// Drop one bubble just behind the shark's tail.
export function emitWake(position, forward) {
  spawnBubble(
    position.x - forward.x * 3 + (live() - 0.5) * 0.8,
    position.y - forward.y * 3 + (live() - 0.5) * 0.8,
    position.z - forward.z * 3 + (live() - 0.5) * 0.8
  );
}

// A burst at a point — the spray off a bite (bite.js). Same pool as the wake, so
// a hard chomp briefly borrows slots from the trail and then gives them back;
// there is no second particle system and no allocation.
export function emitPuff(position, count, spread) {
  for (let i = 0; i < count; i++) {
    spawnBubble(
      position.x + (live() - 0.5) * spread,
      position.y + (live() - 0.5) * spread,
      position.z + (live() - 0.5) * spread
    );
  }
}

export function updateWake(dt) {
  // skip the loop and the upload entirely while no bubbles are alive
  if (!wake.dirty) return;

  let live = 0;
  for (let i = 0; i < wake.count; i++) {
    if (wake.life[i] <= 0) continue;
    wake.life[i] -= dt * 0.5;
    wake.pos[i * 3 + 1] += dt * 1.4;                       // bubbles float up
    if (wake.life[i] <= 0) wake.pos[i * 3 + 1] = 1e6;      // park it off-screen
    else live++;
  }
  wake.pts.geometry.attributes.position.needsUpdate = true;
  wake.live = live;
  if (live === 0) wake.dirty = false;
}
