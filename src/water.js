import * as THREE from 'three';
import { WORLD } from './config.js';
import { scene, uTime } from './core.js';

// ============================================================
//  WATER SURFACE  — translucent plane, ripples done on the GPU
//
//  The ripple used to be a CPU loop rewriting 4225 vertices and re-uploading the
//  whole position buffer every frame. It's the same two sine waves, so it moves
//  into the vertex shader: zero CPU cost, zero uploads.
// ============================================================

export function createWater() {
  // segments only need to be dense enough to sample the ripple wavelength
  const geo = new THREE.PlaneGeometry(WORLD.floor, WORLD.floor, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x63c6ee, transparent: true, opacity: 0.3,
    roughness: 0.15, metalness: 0.15, side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      // begin_vertex declares `transformed`; the plane is authored in XY and
      // rotated -90° about X, so local +z is world height.
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.z += sin(position.x * 0.15 + uTime * 1.5) * 0.6
                       + cos(position.y * 0.12 + uTime) * 0.6;`);
  };
  mat.customProgramCacheKey = () => 'waterRipple';

  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WORLD.surface;
  scene.add(water);
  return water;
}
