import * as THREE from 'three';
import { WORLD, GOD_RAYS } from './config.js';
import { scene, camera, uTime } from './core.js';

// ============================================================
//  GOD RAYS  — additive shafts hanging off the surface
// ============================================================

const shafts = [];

export function createGodRays() {
  const geo = new THREE.PlaneGeometry(1, 1);   // one geometry, scaled per shaft
  const proto = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime, uSeed: { value: 0 }, uColor: { value: new THREE.Color(0xbfe8ff) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform float uSeed; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float edge = smoothstep(0.0, 0.42, vUv.x) * smoothstep(1.0, 0.58, vUv.x);
        float fall = pow(vUv.y, 1.7);                       // bright at the surface
        float flick = 0.72 + 0.28 * sin(uTime * 0.6 + uSeed * 6.2831);
        gl_FragColor = vec4(uColor, edge * fall * 0.16 * flick);
      }`,
  });

  for (let i = 0; i < GOD_RAYS.count; i++) {
    const mat = proto.clone();
    // ShaderMaterial.clone() deep-copies uniforms, which would give each shaft
    // its own frozen clock — point it back at the shared one.
    mat.uniforms.uTime = uTime;
    mat.uniforms.uSeed.value = Math.random();

    const h = 24 + Math.random() * 12;
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(5 + Math.random() * 9, h, 1);
    m.rotation.order = 'YXZ';                   // billboard on Y, keep the Z lean
    m.rotation.z = (Math.random() - 0.5) * 0.3;
    m.position.set(
      (Math.random() - 0.5) * WORLD.half * 1.7,
      WORLD.surface - h / 2,
      (Math.random() - 0.5) * WORLD.half * 1.7
    );
    scene.add(m);
    shafts.push(m);
  }
  return shafts;
}

// Turn each shaft to face the camera so it's never seen edge-on.
export function updateGodRays() {
  for (const s of shafts) {
    s.rotation.y = Math.atan2(camera.position.x - s.position.x, camera.position.z - s.position.z);
  }
}
