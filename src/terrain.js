import * as THREE from 'three';
import { SAND_COLOR } from './config/config.js';
import { scene, renderer } from './core.js';
import { addCaustics } from './materials.js';
import { seabedBase, duneScale, worldBounds } from './levels.js';
import { makeStream } from './placement.js';

// This module's slice of the world seed (placement.js), for the grain speckle in
// the sand texture. The HEIGHT field never needed one — seabedHeight is a pure
// function of x and z, which is why the dunes were the one part of this world that
// was always identical on every load.
const rng = makeStream('sand');

// ============================================================
//  SEABED  — sand, dunes, caustics
// ============================================================

// The DUNES: local relief only, with no idea which level it is in. Kept separate
// from the level height so the two can be composed — see floorAt.
function dunes(x, z) {
  return Math.sin(x * 0.08) * 0.8
       + Math.cos(z * 0.06) * 0.8
       + Math.sin(x * 0.021 + z * 0.017) * 2.4;   // broad swells
}

// The one and only answer to "where is the floor at (x, z)".
//
// ONE CONTINUOUS FUNCTION OVER THE WHOLE CHAIN OF LEVELS — that is the whole
// design (Docs/systems/world-levels.md §1). The level height and the dune damping
// both come from `z` through the same ramp, so the canyon floor joins both basins
// with no seam to stitch and nothing to line up by hand. Used by the mesh
// displacement, prop placement, the shark, the camera, the shoals and the
// creatures alike, which is why nothing ever floats above the sand or sinks in.
export function seabedHeight(x, z) {
  return seabedBase(z) + dunes(x, z) * duneScale(z);
}

// World Y a prop/creature should sit at, plus optional clearance.
export function floorAt(x, z, clearance = 0) {
  return seabedHeight(x, z) + clearance;
}

// Procedural sand: colour speckle + ripple, plus a matching normal map so the
// ripples catch the light at grazing angles.
// One sand tile covers this many world units. Was implicit in a repeat of 14 over
// a 400-unit plane; pulled out as a constant because the plane is no longer a
// fixed size, and a repeat that didn't scale with it would stretch the ripples
// across the whole world as levels are added.
const SAND_TILE = 28.6;

function makeSandTextures(repeatX, repeatZ) {
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
      const k = 1 + Math.sin(a) * 0.05 + (rng() - 0.5) * 0.10;
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
    t.repeat.set(repeatX, repeatZ);
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: finish(colCanvas, true), normalMap: finish(nrmCanvas, false) };
}

// One vertex every this many world units. The finest thing the height field has
// to resolve is sin(x * 0.08), a 78-unit wavelength, so ~4 units still gives ~19
// samples a period; the canyon ramp gets ~24 across its 95-unit run. Held as a
// DENSITY rather than a segment count so a world that grows a level gets more
// triangles instead of coarser dunes.
const VERTEX_SPACING = 4;

export function createSeabed() {
  const b = worldBounds();
  const sandTex = makeSandTextures(b.width / SAND_TILE, b.depth / SAND_TILE);
  const segX = Math.ceil(b.width / VERTEX_SPACING);
  const segZ = Math.ceil(b.depth / VERTEX_SPACING);

  const seabed = new THREE.Mesh(
    new THREE.PlaneGeometry(b.width, b.depth, segX, segZ),
    addCaustics(new THREE.MeshStandardMaterial({
      color: 0xffffff, map: sandTex.map, normalMap: sandTex.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.95, metalness: 0,
    }), 0.7)
  );
  seabed.rotation.x = -Math.PI / 2;
  // The height field is ABSOLUTE now — it returns world Y, not a displacement off
  // a constant — so the mesh sits at y = 0 and every vertex carries its own height.
  seabed.position.set(b.midX, 0, b.midZ);

  // PlaneGeometry is authored in XY then rotated, so local +y maps to world -z
  // and local z displaces world height. The plane is centred on (midX, midZ), so
  // local coordinates have to be shifted into world space before sampling.
  const p = seabed.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setZ(i, seabedHeight(p.getX(i) + b.midX, -p.getY(i) + b.midZ));
  }
  seabed.geometry.computeVertexNormals();

  // Static for the rest of the run — keep it out of the per-frame matrix walk (§4.4).
  seabed.matrixAutoUpdate = false;
  seabed.updateMatrix();

  scene.add(seabed);
  return seabed;
}
