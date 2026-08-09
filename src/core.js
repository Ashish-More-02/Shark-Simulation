import * as THREE from 'three';
import { DEEP_COLOR, FOG_DENSITY, BACKDROP, SKY, WORLD } from './config/config.js';
// levels.js imports config.js and nothing else, so this cannot cycle back.
import { playBounds } from './levels.js';

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

// ---- BACKDROP SIZE, AND THE FAR PLANE THAT HAS TO CLEAR IT -----------------
// Both live here, together, because they are ONE number pretending to be two: the
// far plane's only job is to be further away than the far side of the backdrop
// sphere. Split apart they drift, and they did — `far` was hardcoded at 500 back
// when the world was one basin (camera ~118 from the origin, sphere 320, far side
// 438). A chain of levels put the camera 262 units from the sphere's centre and
// grew the sphere to 382, so the far side went to ~644 and the frustum sheared a
// disc clean out of the water column: looking from one level toward the next you
// were staring through a 24-sided black hole at the clear colour.
//
// Derived from playBounds now, so adding level 3 moves both at once.
const play = playBounds();
const BACKDROP_RADIUS = Math.max(320, play.reach + 120);
// play.reach is the furthest the camera can get from the sphere's centre (the
// sphere is centred on the same midpoint), so radius + reach is the furthest any
// backdrop fragment can ever be. Plus a little for the chase camera's swing.
const FAR = Math.ceil(BACKDROP_RADIUS + play.reach + 40);

export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, FAR);
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
// Radius is BACKDROP_RADIUS above, and the far plane is derived from it — see
// that comment for why the two can never be tuned independently. Segments come
// down instead of the radius: 24x12 is ample for a two-colour vertical gradient
// and saves 700 triangles of pure backdrop.
export function createBackdrop() {
  // ---- SIZED AND CENTRED ON THE PLAY AREA, NOT ON THE ORIGIN ----
  // This was a radius-320 sphere at the origin, which was right when the world
  // was one basin centred there. With a chain of levels the far rim is 375 units
  // out — you would swim clean through the backdrop and be looking at the clear
  // colour. So it centres on the middle of the play area and is sized to enclose
  // the furthest the camera can get, plus enough that it always sits well beyond
  // the fog (FOG_DENSITY 0.0135 finishes everything by ~200 units).
  //
  // Only x/z move. The gradient below is a function of the vertex's LOCAL y, and
  // local y is world y while the sphere's own y stays 0 — shifting it vertically
  // would slide the whole gradient and is exactly what must not happen.
  const backdrop = new THREE.Mesh(
    new THREE.SphereGeometry(BACKDROP_RADIUS, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top:      { value: new THREE.Color(BACKDROP.top) },
        bottom:   { value: new THREE.Color(BACKDROP.bottom) },
        skyLow:   { value: new THREE.Color(SKY.horizon) },
        skyHigh:  { value: new THREE.Color(SKY.zenith) },
        sunCol:   { value: new THREE.Color(SKY.sun) },
        sunDir:   { value: new THREE.Vector3(...SKY.sunDir).normalize() },
        surfaceY: { value: WORLD.surface },
      },
      // vDir is the direction from the sphere's centre to this fragment, which for
      // a backdrop this large is the view direction — that is all the sun needs.
      vertexShader: `
        varying float vy;
        varying vec3 vDir;
        void main() {
          vy = position.y;
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      // Two gradients meeting at the waterline, blended over a NARROW band rather
      // than a hard cut. Narrow because the whole point is a legible edge — the
      // line where the sea stops is the reference the player is missing, and a
      // gentle fade just makes the blue get lighter again. Not razor-sharp though:
      // the backdrop carries no fog (it is the horizon; nothing is beyond it to
      // haze it), so an abrupt seam would read as a bright decal pasted across the
      // distance. Six units of y is about two degrees of arc on this sphere.
      fragmentShader: `
        uniform vec3 top, bottom, skyLow, skyHigh, sunCol, sunDir;
        uniform float surfaceY;
        varying float vy;
        varying vec3 vDir;
        void main() {
          vec3 water = mix(bottom, top, clamp((vy + 130.0) / 280.0, 0.0, 1.0));
          vec3 sky = mix(skyLow, skyHigh, clamp((vy - surfaceY) / 150.0, 0.0, 1.0));
          // Disc plus glow. The wide, weak term is the one that survives: the disc
          // alone is a few pixels once the surface has taken half its brightness,
          // and what matters is knowing which way up is bright.
          float s = max(dot(vDir, normalize(sunDir)), 0.0);
          sky += sunCol * (pow(s, 260.0) * 1.6 + pow(s, 7.0) * 0.30);
          gl_FragColor = vec4(mix(water, sky, smoothstep(surfaceY - 2.0, surfaceY + 4.0, vy)), 1.0);
        }`,
    })
  );
  backdrop.position.set(play.midX, 0, play.midZ);
  backdrop.matrixAutoUpdate = false;    // set once, never moves again
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
