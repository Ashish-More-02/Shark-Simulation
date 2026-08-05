import * as THREE from 'three';
import { WORLD } from './config.js';
import { scene } from './core.js';
import { floorAt } from './terrain.js';
import { ringRadius } from './placement.js';
import { addSolid } from './collision.js';

// ============================================================
//  SEABED PROPS  — instanced placement, per-instance weathering, sway
//
//  Every prop row becomes one InstancedMesh per source mesh instead of N cloned
//  Object3Ds. ~190 props that cost ~300 draw calls now cost about a dozen.
//  Per-instance colour rides along in the instanceColor attribute; per-instance
//  transforms are baked into instanceMatrix once (static rows) or refreshed each
//  frame (rows that sway in the current).
// ============================================================

// Instanced groups whose matrices have to be rebuilt every frame.
const animated = [];

// scratch objects — allocated once, reused for every instance matrix
const scratch = new THREE.Object3D();
scratch.rotation.order = 'YXZ';
const outMat = new THREE.Matrix4();
const color = new THREE.Color();

// InstancedMesh.setColorAt() is NOT enough on its own. In three r160 the vertex
// side handles USE_INSTANCING_COLOR, but color_pars_fragment / color_fragment
// only declare and apply vColor under USE_COLOR — so instanceColor never reaches
// the fragment shader unless the material also sets vertexColors. And enabling
// vertexColors without a `color` attribute makes the shader read a disabled
// attribute (black). So: give the geometry an all-white color attribute once,
// then material.color * instanceColor lands on diffuse exactly as intended.
function ensureVertexColorAttribute(geometry) {
  if (geometry.getAttribute('color')) return;
  const n = geometry.getAttribute('position').count;
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
}

// Pick one natural rock colour: a palette entry, nudged in hue, saturation and
// lightness so neighbours never match.
function rockColour(palette, keepTexture) {
  const c = color.set(palette[Math.floor(Math.random() * palette.length)]);
  // Hue/saturation drift only. Lightness is a linear multiply instead of an HSL
  // offset, because an HSL lightness offset clamps the darkest basalt picks all
  // the way to #000 — and pure black reads as a hole in the scene, not as rock.
  c.offsetHSL((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.12, 0);
  c.multiplyScalar(0.78 + Math.random() * 0.46);

  if (keepTexture) {
    // This model ships its own albedo, and the tint MULTIPLIES it — a near-black
    // pick would erase every bit of baked detail. So scale the tint up to a mid
    // luminance, which keeps the palette's hue and saturation ratio while letting
    // the texture read through. (Colour maths here is in linear space, which is
    // why we scale luminance rather than lerp to white — a linear lerp toward
    // white blows dark picks out far too fast.)
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    if (lum > 1e-4) {
      c.multiplyScalar((0.30 + Math.random() * 0.18) / lum);
      c.r = Math.min(c.r, 1); c.g = Math.min(c.g, 1); c.b = Math.min(c.b, 1);
    }
  }
  return c;
}

// Collect the meshes of a loaded prototype together with each one's transform
// RELATIVE to the wrapper, so an instance matrix is just (instance × relative).
function collectMeshes(proto) {
  proto.position.set(0, 0, 0);
  proto.rotation.set(0, 0, 0);
  proto.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(proto.matrix).invert();

  const out = [];
  proto.traverse((o) => {
    if (!o.isMesh) return;
    out.push({ geometry: o.geometry, material: o.material, rel: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) });
  });
  return out;
}

// Build the instance list (transform + colour) for one PROPS row.
//
// The default ring reaches PAST the play area (WORLD.half) and out toward the
// mountain skirt, so the reef doesn't just stop at an invisible wall — you can
// see it continuing into the haze past where you're allowed to swim.
function planInstances(count, opts, keepTexture) {
  const { sMin = 0.7, sMax = 1.5, ring = [6, WORLD.half * 1.35],
          shade = 0, sway = 0, tilt = 0, palette = null, edgeScale = 0 } = opts;
  const span = Math.max(ring[1] - ring[0], 1e-6);
  const items = [];

  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = ringRadius(ring[0], ring[1]);       // equal-area — see placement.js
    const x = Math.cos(a) * r, z = Math.sin(a) * r;

    // Size can either be flat random across the row, or biased outward: the
    // sheltered deep water at the rim grows the tall stuff, while the open middle
    // — where the shark actually patrols — stays cropped short. edgeScale is how
    // much of the size comes from radius vs. how much stays random, so 1 is a
    // strict gradient and 0.7 is a gradient you can still see exceptions in.
    const radial = (r - ring[0]) / span;
    const sizeK = edgeScale ? edgeScale * radial + (1 - edgeScale) * Math.random()
                            : Math.random();

    // instanceColor multiplies the material colour, so:
    //   palette rows -> material goes white, the palette colour lives here
    //   shade rows    -> material keeps its own colour, this is a grey multiplier
    let tint;
    if (palette) {
      tint = rockColour(palette, keepTexture).clone();
    } else if (shade) {
      const grey = 1 - shade + Math.random() * shade * 2;
      tint = new THREE.Color(grey, grey, grey);
    } else {
      tint = new THREE.Color(1, 1, 1);
    }

    items.push({
      x, z, y: floorAt(x, z),
      rotY: Math.random() * Math.PI * 2,
      tilt: tilt ? (Math.random() - 0.5) * tilt : 0,
      scale: sMin + sizeK * (sMax - sMin),
      tint,
      phase: Math.random() * Math.PI * 2,
      amp: sway ? sway * (0.6 + Math.random() * 0.8) : 0,
    });
  }
  return { items, palette, sway };
}

// Compose one instance's matrix. t drives the sway; pass 0 for static rows.
function writeMatrix(mesh, index, item, rel, protoScale, t) {
  scratch.position.set(item.x, item.y, item.z);
  scratch.rotation.set(
    item.amp ? Math.cos(t * 0.62 + item.phase * 1.3) * item.amp * 0.7 : 0,
    item.rotY,
    item.amp ? Math.sin(t * 0.8 + item.phase) * item.amp : item.tilt
  );
  scratch.scale.setScalar(protoScale * item.scale);
  scratch.updateMatrix();
  outMat.multiplyMatrices(scratch.matrix, rel);
  mesh.setMatrixAt(index, outMat);
}

// Turn a row's instances into collision volumes. Measured ONCE per row: the
// wrapper's normalization scale is already baked into this box, so an instance's
// true world size is just (measured x item.scale) — no second scale to track.
//
// item.y is the footprint because every solid row is anchorBottom; a row that
// isn't would need its box min.y folded in here.
function registerSolids(proto, items, { solid, taper = 0.5 }) {
  const size = new THREE.Box3().setFromObject(proto).getSize(new THREE.Vector3());
  // Widest horizontal half-span. `solid` trims it — better to let the player
  // brush the visible surface than to stop them short against thin air, and
  // these props are convex blobs whose corners don't reach the bbox anyway.
  const footprint = Math.max(size.x, size.z) * 0.5 * solid;

  for (const it of items) {
    addSolid(it.x, it.z, it.y, size.y * it.scale, footprint * it.scale, taper);
  }
}

function buildRow(proto, count, opts) {
  const parts = collectMeshes(proto);         // also zeroes + updates proto's matrices
  const protoScale = proto.scale.x;          // uniform normalization scale
  const { items, palette, sway } = planInstances(count, opts, proto.hasTexture);
  if (opts.solid) registerSolids(proto, items, opts);
  const meshes = [];

  for (const part of parts) {
    const material = part.material.clone();
    material.vertexColors = true;            // required for instanceColor — see above
    // Foliage authored as alpha-BLEND (fern.glb) can't be sorted per instance —
    // an InstancedMesh is one draw call, so overlapping fronds punch holes in each
    // other and in whatever is behind them. Leaf cards want a hard cutout anyway:
    // alphaTest keeps them in the opaque pass, depth-correct from every angle.
    if (opts.cutout) {
      material.transparent = false;
      material.alphaTest = opts.cutout;
      material.depthWrite = true;
    }
    if (palette) {
      material.color.setRGB(1, 1, 1);        // colour comes entirely from instanceColor
      material.roughness = 0.85;             // was per-instance; one value now
      material.metalness = 0;
    }
    ensureVertexColorAttribute(part.geometry);

    const inst = new THREE.InstancedMesh(part.geometry, material, count);
    inst.frustumCulled = false;              // instances span the whole world
    for (let i = 0; i < count; i++) {
      writeMatrix(inst, i, items[i], part.rel, protoScale, 0);
      inst.setColorAt(i, items[i].tint);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
    meshes.push({ inst, rel: part.rel });
  }

  if (sway) animated.push({ meshes, items, protoScale });
}

// Build the whole seabed from a PROPS table plus the loaded model map.
export function scatterAll(propTable, models) {
  for (const { model, count, ...opts } of propTable) {
    buildRow(models[model], count, opts);
  }
}

// Only the swaying rows are rebuilt; static rock/mountains never touch the CPU
// again after setup.
export function updateSway(t) {
  for (const group of animated) {
    for (const { inst, rel } of group.meshes) {
      for (let i = 0; i < group.items.length; i++) {
        writeMatrix(inst, i, group.items[i], rel, group.protoScale, t);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  }
}
