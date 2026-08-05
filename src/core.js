import * as THREE from 'three';
import { DEEP_COLOR, FOG_DENSITY } from './config.js';

// ============================================================
//  CORE  — renderer, scene, camera, clock, backdrop.
//  Everything else imports from here; this imports only config.
// ============================================================

export const canvas = document.getElementById('scene');

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

// Gradient "water column" backdrop (lighter near surface, dark in the deep)
export function createBackdrop() {
  const backdrop = new THREE.Mesh(
    new THREE.SphereGeometry(320, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top:    { value: new THREE.Color(0x3f9fcc) },
        bottom: { value: new THREE.Color(0x03121e) },
      },
      vertexShader: `varying float vy; void main(){ vy = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying float vy;
        void main(){ float t = clamp((vy + 130.0) / 280.0, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }`,
    })
  );
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
  renderer.setSize(window.innerWidth, window.innerHeight);
});
