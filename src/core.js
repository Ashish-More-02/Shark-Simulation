import * as THREE from 'three';
import { DEEP_COLOR, FOG_DENSITY, BACKDROP } from './config.js';

// ============================================================
//  CORE  — renderer, scene, camera, clock, backdrop.
//  Everything else imports from here; this imports only config.
// ============================================================

export const canvas = document.getElementById('scene');

// ---- PIXEL BUDGET ----------------------------------------------------------
// This is the single most expensive dial in the whole game, so it gets the
// longest comment. On a 2x-DPR display (every Retina Mac) the old
// `min(devicePixelRatio, 2)` + `antialias: true` combination asked for a
// 2880x1800 buffer with 4x MSAA — 20.7 MILLION colour+depth samples resolved
// every frame, before a single triangle is drawn.
//
// Apple GPUs are tile-based deferred renderers: opaque overdraw is nearly free
// because occluded fragments are discarded before shading, but ALPHA BLENDING
// defeats that entirely — every blended fragment is rasterised and shaded in
// submission order. This scene layers a translucent water plane, additive god
// rays and ~1000 blended point sprites, so it pays that full sample cost several
// times over. Halving the sample count is worth more here than any amount of
// geometry work.
//
// 1.5 keeps text and prop silhouettes crisp while costing 44% fewer pixels than
// 2.0, and MSAA comes off entirely: in a scene this fogged the aliasing it fixes
// is barely visible, and it multiplies the bandwidth of every blended layer.
// (Phase 2 of PERFORMANCE.md replaces this constant with dynamic scaling.)
const PIXEL_RATIO_CAP = 1.5;

export const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,            // was true — 4x MSAA on a 2x buffer, see above
  stencil: false,              // nothing here uses stencil; saves a byte/sample
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_CAP));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // stops the bright sand blowing out
renderer.toneMappingExposure = 1.05;

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(DEEP_COLOR, FOG_DENSITY);

export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 4, 12);

// Shared clock uniform. ONE object, referenced (never copied) by every custom
// shader, so advancing main.js's loop advances all of them at once.
export const uTime = { value: 0 };

// Gradient "water column" backdrop (lighter near surface, dark in the deep).
//
// This sphere fills every gap in the scenery, so its two colours set the mood of
// the whole scene more than anything else does — which is why they now live in
// config.js next to the water and fog tints rather than being buried here. See
// the BACKDROP comment there for why they moved off cyan.
//
// Radius stays 320. It looks like an obvious thing to shrink alongside
// camera.far, but the camera can sit ~118 units from the origin and this sphere
// is world-centred, so its far side is ~438 units away: any far plane under ~450
// clips a hole in the water column. Segments come down instead — 24x12 is ample
// for a two-colour vertical gradient and saves 700 triangles of pure backdrop.
export function createBackdrop() {
  const backdrop = new THREE.Mesh(
    new THREE.SphereGeometry(320, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top:    { value: new THREE.Color(BACKDROP.top) },
        bottom: { value: new THREE.Color(BACKDROP.bottom) },
      },
      vertexShader: `varying float vy; void main(){ vy = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying float vy;
        void main(){ float t = clamp((vy + 130.0) / 280.0, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }`,
    })
  );
  backdrop.matrixAutoUpdate = false;    // world-centred, never moves
  backdrop.updateMatrix();
  scene.add(backdrop);
  return backdrop;
}

export function createLights() {
  // sky above / sand bounce below — the warm ground term is what sells the sand
  scene.add(new THREE.HemisphereLight(0xa9e2ff, 0x8a7048, 1.05));
  const sun = new THREE.DirectionalLight(0xdff2ff, 1.35);
  sun.position.set(18, 60, 12);
  scene.add(sun);
  // cool fill from the deep so black rock doesn't read as a flat silhouette
  const fill = new THREE.DirectionalLight(0x3f7fa8, 0.35);
  fill.position.set(-25, -10, -18);
  scene.add(fill);
  return { sun, fill };
}

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // Re-apply the cap: dragging the window to a display with a different DPR
  // changes devicePixelRatio, and setSize alone would keep the stale ratio.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_CAP));
  renderer.setSize(window.innerWidth, window.innerHeight);
});
