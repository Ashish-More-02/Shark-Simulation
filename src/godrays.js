import * as THREE from 'three';
import { WORLD, GOD_RAYS } from './config/config.js';
import { LEVELS } from './config/levels/index.js';
import { scene, uTime } from './core.js';
import { makeStream } from './placement.js';

// This module's slice of the world seed (placement.js). Where the shafts hang is
// as much a part of a given seed's ocean as where the rocks are.
const rng = makeStream('godrays');

// ============================================================
//  GOD RAYS  — additive shafts hanging off the surface
//
//  One InstancedMesh, one material, no per-frame CPU work (PERFORMANCE.md §2.3).
//
//  It used to be N separate meshes, each with its own CLONED ShaderMaterial, and
//  an updateGodRays() that rewrote every shaft's rotation.y each frame so the quad
//  faced the camera. That is three costs for one effect:
//
//    N draw calls, and — worse — N distinct material instances, so N uniform
//    uploads and N pipeline state changes on the most overdraw-heavy geometry in
//    the scene.
//
//    A CPU loop doing an atan2 per shaft per frame, purely to compute something
//    the vertex shader already has everything it needs to derive.
//
//  Now the billboard happens in the vertex shader: each instance reads its own
//  origin straight out of instanceMatrix, builds a right-vector perpendicular to
//  the direction to the camera, and sweeps the quad across it. `uSeed` and the
//  per-shaft lean become instanced attributes.
//
//  The other thing one draw call buys is a DISTANCE FADE, which N independent
//  meshes could not have without N more CPU updates. A shaft 135 units away is
//  contributing about 2% of its colour through FogExp2 but still costs its full
//  blended fill, and blended fill is exactly what a tile-based GPU cannot skip.
//  Fading it to zero lets those fragments be discarded outright.
//
//  Kept from the Phase 1 pass: FrontSide, not DoubleSide. The quad always faces
//  the camera, so the back face is never the one you see and rendering it was pure
//  duplicated fill.
// ============================================================

export function createGodRays() {
  const geo = new THREE.PlaneGeometry(1, 1);

  // per-instance: animation seed and the little lean off vertical
  // Per LEVEL, not per world — 10 shafts dealt across two basins would halve the
  // density in each. Fill cost is unaffected: the distance fade means only the
  // basin you are actually in ever rasterises anything.
  const n = GOD_RAYS.count * LEVELS.length;
  const seed = new Float32Array(n);
  const lean = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    seed[i] = rng();
    lean[i] = (rng() - 0.5) * 0.3;
  }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  geo.setAttribute('aLean', new THREE.InstancedBufferAttribute(lean, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      uTime,
      uColor: { value: new THREE.Color(0xbfe8ff) },
      uFade:  { value: new THREE.Vector2(GOD_RAYS.fade[0], GOD_RAYS.fade[1]) },
    },
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute float aLean;
      uniform vec2 uFade;
      varying vec2 vUv;
      varying float vSeed;
      varying float vFade;

      void main() {
        vUv = uv;
        vSeed = aSeed;

        // The instance matrix is translate * scale with no rotation (see below), so
        // its origin is column 3 and its axis lengths are the column magnitudes.
        vec3 origin = instanceMatrix[3].xyz;
        float sx = length(instanceMatrix[0].xyz);
        float sy = length(instanceMatrix[1].xyz);

        vec3 toCam = cameraPosition - origin;
        // Billboard about Y only: these are shafts of light hanging vertically, so
        // they must never pitch toward the camera, only turn to face it.
        vec2 dir = normalize(vec2(toCam.x, toCam.z) + vec2(1e-5));
        vec3 right = vec3(dir.y, 0.0, -dir.x);

        // aLean shears the quad instead of rotating it — same visible tilt, and it
        // survives the billboard without needing a second basis vector.
        float lx = position.x + position.y * aLean;
        vec3 world = origin + right * (lx * sx) + vec3(0.0, position.y * sy, 0.0);

        vFade = 1.0 - smoothstep(uFade.x, uFade.y, length(toCam));
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying float vSeed;
      varying float vFade;
      void main() {
        if (vFade <= 0.0) discard;                          // past the fog horizon
        float edge = smoothstep(0.0, 0.42, vUv.x) * smoothstep(1.0, 0.58, vUv.x);
        float fall = pow(vUv.y, 1.7);                       // bright at the surface
        float flick = 0.72 + 0.28 * sin(uTime * 0.6 + vSeed * 6.2831);
        gl_FragColor = vec4(uColor, edge * fall * 0.16 * flick * vFade);
      }`,
  });

  const rays = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const h = 24 + rng() * 12;
    // Translation + scale only. The vertex shader reads the origin and the axis
    // lengths straight out of these columns, so no rotation may live here.
    m.makeScale(5 + rng() * 9, h, 1);
    // Spread across one basin at a time and dealt out round-robin, so every level
    // gets its share of the same single InstancedMesh. One draw call for the whole
    // world is the entire point of this module (see the header), so the shafts
    // must not be split into a mesh per level.
    const L = LEVELS[i % LEVELS.length];
    m.setPosition(
      L.center[0] + (rng() - 0.5) * WORLD.half * 1.7,
      WORLD.surface - h / 2,
      L.center[2] + (rng() - 0.5) * WORLD.half * 1.7,
    );
    rays.setMatrixAt(i, m);
  }
  rays.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  rays.instanceMatrix.needsUpdate = true;
  // The mesh sits at the origin and every shaft billboards itself, so nothing here
  // ever needs a matrix refresh — and the shafts span the world, so leave three's
  // (now useless) bounding-sphere cull off. The shader's distance fade is the cull.
  rays.frustumCulled = false;
  rays.matrixAutoUpdate = false;
  rays.updateMatrix();
  scene.add(rays);
  return rays;
}
