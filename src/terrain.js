import * as THREE from 'three';
import { WORLD, SAND_COLOR } from './config.js';
import { scene, renderer } from './core.js';
import { addCaustics } from './materials.js';

// ============================================================
//  SEABED  — sand, dunes, caustics
// ============================================================

// One height field, used for BOTH the mesh displacement and prop placement, so
// nothing floats above the sand or sinks into it. The shark, camera and fish
// shoals all clamp against it too — it is the single source of truth for
// "where is the floor at (x, z)".
export function seabedHeight(x, z) {
  return Math.sin(x * 0.08) * 0.8
       + Math.cos(z * 0.06) * 0.8
       + Math.sin(x * 0.021 + z * 0.017) * 2.4;   // broad swells
}

// Convenience: world Y a prop/creature should sit at, plus optional clearance.
export function floorAt(x, z, clearance = 0) {
  return WORLD.seabed + seabedHeight(x, z) + clearance;
}

// Procedural sand: colour speckle + ripple, plus a matching normal map so the
// ripples catch the light at grazing angles.
function makeSandTextures() {
  const S = 512, RIPPLE = 9, WARP = 3;
  const A = (x, y) => (x / S) * Math.PI * 2 * RIPPLE + Math.sin((y / S) * Math.PI * 2 * WARP) * 1.6;

  const colCanvas = document.createElement('canvas');
  colCanvas.width = colCanvas.height = S;
  const cx = colCanvas.getContext('2d');
  cx.fillStyle = SAND_COLOR;
  cx.fillRect(0, 0, S, S);
  const img = cx.getImageData(0, 0, S, S), d = img.data;

  const nrmCanvas = document.createElement('canvas');
  nrmCanvas.width = nrmCanvas.height = S;
  const nx = nrmCanvas.getContext('2d');
  const nImg = nx.createImageData(S, S), nd = nImg.data;

  const amp = 2.2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const a = A(x, y);
      // colour: ripple shading + fine grain
      const k = 1 + Math.sin(a) * 0.05 + (Math.random() - 0.5) * 0.10;
      d[i]     = Math.min(255, d[i]     * k);
      d[i + 1] = Math.min(255, d[i + 1] * k);
      d[i + 2] = Math.min(255, d[i + 2] * k * 0.985);
      // normal: analytic slope of the same ripple field
      const dhdx = amp * Math.cos(a) * (Math.PI * 2 * RIPPLE / S);
      const dhdy = amp * Math.cos(a) * Math.cos((y / S) * Math.PI * 2 * WARP) * 1.6 * (Math.PI * 2 * WARP / S);
      const len = Math.hypot(-dhdx, -dhdy, 1);
      nd[i]     = ((-dhdx / len) * 0.5 + 0.5) * 255;
      nd[i + 1] = ((-dhdy / len) * 0.5 + 0.5) * 255;
      nd[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      nd[i + 3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
  nx.putImageData(nImg, 0, 0);

  // Anisotropic filtering was pinned to getMaxAnisotropy() — 16 on Apple silicon —
  // on BOTH the albedo and the normal map of a plane that fills the lower half of
  // the screen. That is up to 32 texture taps per fragment at grazing angles,
  // which is where the seabed spends most of its screen area. 4 is the standard
  // sweet spot: the near sand still holds its ripple detail, and the far sand it
  // would have sharpened is behind fog anyway.
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const finish = (canvasEl, srgb) => {
    const t = new THREE.CanvasTexture(canvasEl);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(14, 14);
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: finish(colCanvas, true), normalMap: finish(nrmCanvas, false) };
}

export function createSeabed() {
  const sandTex = makeSandTextures();
  const seabed = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.floor, WORLD.floor, 110, 110),
    addCaustics(new THREE.MeshStandardMaterial({
      color: 0xffffff, map: sandTex.map, normalMap: sandTex.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.95, metalness: 0,
    }), 0.7)
  );
  seabed.rotation.x = -Math.PI / 2;
  seabed.position.y = WORLD.seabed;

  // PlaneGeometry is authored in XY then rotated, so local +y maps to world -z
  // and local z displaces world height.
  const p = seabed.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, seabedHeight(p.getX(i), -p.getY(i)));
  seabed.geometry.computeVertexNormals();

  // Static for the rest of the run — keep it out of the per-frame matrix walk (§4.4).
  seabed.matrixAutoUpdate = false;
  seabed.updateMatrix();

  scene.add(seabed);
  return seabed;
}
