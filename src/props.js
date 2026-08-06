import * as THREE from 'three';
import { WORLD, PERF } from './config.js';
import { scene, camera, uTime } from './core.js';
import { floorAt } from './terrain.js';
import { ringRadius } from './placement.js';
import { addSolid } from './collision.js';

// ============================================================
//  SEABED PROPS  — instanced, spatially chunked, swayed on the GPU
//
//  Every prop row becomes InstancedMeshes instead of N cloned Object3Ds: ~1,900
//  props that would cost ~1,900 draw calls cost a couple of hundred. Per-instance
//  colour rides along in instanceColor; per-instance transforms are baked into
//  instanceMatrix ONCE and never touched again.
//
//  Two things changed here from the first instanced version, and they are the two
//  biggest remaining costs in the frame:
//
//  1. CHUNKING (PERFORMANCE.md §3.3, §3.4)
//     A row used to be ONE InstancedMesh covering r=0..115. Its bounding sphere
//     therefore covered the entire world, which makes frustum culling useless —
//     so culling was switched off, and all 1.38M prop triangles were submitted
//     every frame including everything behind the camera. With a 60° FOV that is
//     roughly 4x the geometry you can actually see.
//
//     Rows are now split into a grid of cells, one InstancedMesh per non-empty
//     cell, each with a tight sphere we compute at build time. updateProps() then
//     does the culling itself — frustum AND a hard distance cut matched to the fog
//     — rather than leaving it to three. That is deliberate: a chunk's real bounds
//     live in its instanceMatrix, and which of geometry.boundingSphere vs
//     InstancedMesh.boundingSphere three consults has moved between versions.
//     Testing our own sphere is a handful of floats per chunk and cannot silently
//     start culling visible scenery after a three upgrade.
//
//  2. GPU SWAY (§4.1)
//     updateSway() rebuilt 1,574 instance matrices per frame — an Euler ->
//     quaternion -> Matrix4 compose plus a 4x4 multiply each — and flagged 16
//     instanceMatrix buffers for re-upload. All of it to evaluate two sines.
//
//     The sway is a closed-form function of (time, phase, amp), exactly like the
//     water ripple and the particles, so it belongs in the vertex shader. Phase
//     and amplitude are baked into instanced attributes once; the matrices are
//     written once with sway = 0 and marked StaticDrawUsage. 1,574 matrix composes
//     and 16 buffer uploads per frame -> zero.
//
//     It also looks better. The CPU version rotated each plant rigidly about its
//     base, so a 12-unit kelp swung like a metronome arm. The shader weights the
//     bend by height², so the root stays planted and only the tip really moves.
// ============================================================

// Every chunk in the world, flat, so the per-frame cull is one linear walk.
//   { mesh, center: Vector3, radius, cullSq }
const chunks = [];

// scratch — allocated once, reused for every instance matrix
const scratch = new THREE.Object3D();
scratch.rotation.order = 'YXZ';
const color = new THREE.Color();

// scratch for the per-frame cull
const frustum = new THREE.Frustum();
const viewProj = new THREE.Matrix4();
const probeSphere = new THREE.Sphere();

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

// Compose one instance's matrix. Sway is no longer part of this — it happens in
// the vertex shader — so every matrix written here is final.
//
// There is no `rel` term any more either: it is baked into the geometry (see
// bakeRel), which is what lets the sway shader treat geometry-local space as the
// plant's own upright frame.
function writeMatrix(mesh, index, item, protoScale) {
  scratch.position.set(item.x, item.y, item.z);
  scratch.rotation.set(0, item.rotY, item.tilt);
  scratch.scale.setScalar(protoScale * item.scale);
  scratch.updateMatrix();
  mesh.setMatrixAt(index, scratch.matrix);
}

// Fold a part's transform-relative-to-the-wrapper into its vertices, once.
//
// It used to ride along as a right-hand multiply on every instance matrix, which
// was correct but left geometry-local space meaning something different for every
// part of every model. The sway shader can't live with that: it needs
// `transformed.y` to be height above the plant's base and `transformed.xz` to be
// world-ish horizontal, and for the models the loader does NOT merge (grass and
// Seaweed-3 are 2 and 3 nodes, under its >3 threshold — and both sway) the glTF
// node transform can carry a rotation that breaks both assumptions.
//
// Cached per source geometry: `rel` is deterministic for a given model, so the two
// rows that share a model share one baked copy instead of duplicating the buffers.
const IDENTITY = new THREE.Matrix4();
const bakedGeometry = new Map();
function bakeRel(geometry, rel) {
  let baked = bakedGeometry.get(geometry.uuid);
  if (!baked) {
    baked = rel.equals(IDENTITY) ? geometry : geometry.clone().applyMatrix4(rel);
    ensureVertexColorAttribute(baked);
    baked.computeBoundingBox();
    bakedGeometry.set(geometry.uuid, baked);
  }
  return baked;
}

// Turn a row's instances into collision volumes. Measured ONCE per row: the
// wrapper's normalization scale is already baked into this box, so an instance's
// true world size is just (measured x item.scale) — no second scale to track.
//
// item.y is the footprint because every solid row is anchorBottom; a row that
// isn't would need its box min.y folded in here.
function registerSolids(protoSize, items, { solid, taper = 0.5 }) {
  // Widest horizontal half-span. `solid` trims it — better to let the player
  // brush the visible surface than to stop them short against thin air, and
  // these props are convex blobs whose corners don't reach the bbox anyway.
  const footprint = Math.max(protoSize.x, protoSize.z) * 0.5 * solid;

  for (const it of items) {
    addSolid(it.x, it.z, it.y, protoSize.y * it.scale, footprint * it.scale, taper);
  }
}

// ---- SWAY, IN THE VERTEX SHADER --------------------------------------------
//
// `transformed` at this point is in GEOMETRY-local space, before instanceMatrix
// is applied (three's <project_vertex> multiplies by it afterwards), so the bend
// automatically scales with the instance — a 3x kelp sways 3x as far in world
// units, which is what you want.
//
// aAmp keeps the old meaning: radians of lean at the tip. A rigid rotation of
// `amp` about the base displaces the tip by sin(amp)·height ≈ amp·height, so
// multiplying by uSwayHeight reproduces the previous amplitude exactly while
// distributing it as a bend instead of a hinge.
//
// Normals are deliberately left alone. Recomputing them for a bend this shallow
// costs a normalize and a cross product per vertex to move a foliage highlight by
// a few degrees inside fog.
function addSway(material, baseY, height) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uSwayBase = { value: baseY };
    shader.uniforms.uSwayHeight = { value: Math.max(height, 1e-3) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform float uSwayBase;
        uniform float uSwayHeight;
        attribute float aPhase;
        attribute float aAmp;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // height above the plant's own base, 0..1 — squared so the root stays
        // planted in the sand and the tip carries the whole movement
        float swayH = clamp((transformed.y - uSwayBase) / uSwayHeight, 0.0, 1.0);
        float swayK = swayH * swayH * aAmp * uSwayHeight;
        transformed.x += sin(uTime * 0.80 + aPhase)       * swayK;
        transformed.z += cos(uTime * 0.62 + aPhase * 1.3) * swayK * 0.7;`);
  };
  // Distinct cache key so the swaying variant gets its own compiled program and
  // does not evict the static one (three appends this to the full parameter key).
  material.customProgramCacheKey = () => 'propSway';
}

// A second BufferGeometry over the SAME attribute objects. Chunks of one row all
// draw identical geometry, but instanced attributes (aPhase / aAmp) live on the
// geometry, so each chunk needs its own container to hang them off. Sharing the
// attributes means three still uploads one vertex buffer per row, not one per
// chunk — the clone is a few dozen bytes of JS, not a copy of the mesh.
function shareGeometry(src) {
  const g = new THREE.BufferGeometry();
  for (const name of Object.keys(src.attributes)) g.setAttribute(name, src.attributes[name]);
  if (src.index) g.setIndex(src.index);
  g.boundingBox = src.boundingBox;
  g.boundingSphere = src.boundingSphere;
  return g;
}

// MeshStandardMaterial -> MeshLambertMaterial (§2.7). Every prop material arrives
// from GLTFLoader as Standard: a full Cook-Torrance BRDF evaluated per fragment
// against three lights, with metalness forced to 0 (loader.js) and no environment
// map for the specular lobe to reflect. Across ~1.4M triangles of fogged rock and
// foliage that is a lot of ALU buying very little.
//
// Only the maps these models actually ship are carried across; roughness and
// metalness have no Lambert equivalent and were doing nothing useful anyway.
function toLambert(src) {
  const m = new THREE.MeshLambertMaterial();
  m.name = src.name;
  m.color.copy(src.color);
  m.map = src.map;
  m.alphaMap = src.alphaMap;
  m.aoMap = src.aoMap;
  m.aoMapIntensity = src.aoMapIntensity;
  m.normalMap = src.normalMap;
  if (src.normalScale) m.normalScale.copy(src.normalScale);
  m.emissive.copy(src.emissive);
  m.emissiveMap = src.emissiveMap;
  m.emissiveIntensity = src.emissiveIntensity;
  m.transparent = src.transparent;
  m.opacity = src.opacity;
  m.alphaTest = src.alphaTest;
  m.depthWrite = src.depthWrite;
  m.side = src.side;
  m.flatShading = src.flatShading;
  m.toneMapped = src.toneMapped;
  return m;
}

// ---- CHUNK SIZING ----------------------------------------------------------
// Cell size is derived per row, not fixed, and it is derived from TRIANGLES rather
// than instance count. Those give very different answers: 17 driftwood logs and 84
// canopy kelp bushes are both "a row", but the logs are 6k triangles and the kelp
// is 289k. Chunking the logs buys nothing and costs 8 draw calls; chunking the
// kelp is the single biggest geometry win available.
//
//   cells wanted = row triangles / PERF.chunkTriangles
//   band area    = π(outer² - inner²)          <- the row's own placement ring
//   cell size    = sqrt(band area / cells wanted)
//
// Also floored at PERF.minPropsPerChunk instances per cell, so a row of a few
// heavy props doesn't shatter into one draw call each. Rows that come out wanting
// a single chunk get one (Infinity => every prop lands in the same cell).
function chunkSize(count, trisPerInstance, ring) {
  const wanted = Math.min(
    (count * trisPerInstance) / PERF.chunkTriangles,
    count / PERF.minPropsPerChunk,
  );
  if (wanted <= 1.2) return Infinity;
  const area = Math.PI * Math.max(ring[1] * ring[1] - ring[0] * ring[0], 1);
  return THREE.MathUtils.clamp(Math.sqrt(area / wanted), 36, 400);
}

function triangleCount(geometry) {
  const n = geometry.index ? geometry.index.count : geometry.attributes.position.count;
  return n / 3;
}

function cellKey(x, z, size) {
  if (size === Infinity) return 0;
  // 4096 is far wider than the handful of cell indices this world produces; it
  // only has to exceed the grid so two different cells can't collide on one key.
  return (Math.floor(x / size) + 2048) * 4096 + (Math.floor(z / size) + 2048);
}

function buildRow(proto, count, opts) {
  const parts = collectMeshes(proto);         // also zeroes + updates proto's matrices
  const protoScale = proto.scale.x;           // uniform normalization scale
  // Measured with proto.scale applied, so this is world units at item.scale = 1.
  const protoSize = new THREE.Box3().setFromObject(proto).getSize(new THREE.Vector3());
  const { items, palette, sway } = planInstances(count, opts, proto.hasTexture);
  if (opts.solid) registerSolids(protoSize, items, opts);

  // Bake each part's relative transform in, then take the union of the results:
  // one upright span shared by every part of the model. Per-part spans would make
  // each material bend over its own extent, so the top half of a two-material kelp
  // would bend as though its own base were its root.
  const baked = parts.map((p) => ({ geometry: bakeRel(p.geometry, p.rel), material: p.material }));
  const localBox = new THREE.Box3();
  let trisPerInstance = 0;
  for (const part of baked) {
    localBox.union(part.geometry.boundingBox);
    trisPerInstance += triangleCount(part.geometry);
  }
  const localHeight = Math.max(localBox.max.y - localBox.min.y, 1e-3);

  // ---- group the instances into spatial cells ----
  const size = chunkSize(count, trisPerInstance, opts.ring || [6, WORLD.half * 1.35]);
  const cells = new Map();
  for (const it of items) {
    const key = cellKey(it.x, it.z, size);
    let cell = cells.get(key);
    if (!cell) cells.set(key, cell = []);
    cell.push(it);
  }

  const cullDist = opts.cull ?? PERF.propCull;

  for (const part of baked) {
    const material = PERF.propMaterial === 'lambert' && part.material.isMeshStandardMaterial
      ? toLambert(part.material)
      : part.material.clone();
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
      if ('roughness' in material) {
        material.roughness = 0.85;           // was per-instance; one value now
        material.metalness = 0;
      }
    }
    // rel is baked in, so every part shares one base and one span.
    if (sway) addSway(material, localBox.min.y, localHeight);

    // How far the bend reaches past an instance's own radius, per unit of
    // item.scale. The chunk sphere has to allow for it, or a swaying edge instance
    // pokes out of a sphere we then cull. 1.4 is planInstances' amplitude jitter
    // ceiling (sway x 0.6..1.4).
    const swayReach = sway ? sway * 1.4 * localHeight * protoScale : 0;

    for (const cellItems of cells.values()) {
      const n = cellItems.length;
      const geo = sway ? shareGeometry(part.geometry) : part.geometry;
      const inst = new THREE.InstancedMesh(geo, material, n);

      // World AABB of this chunk, accumulated as we write the matrices.
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      const phase = sway ? new Float32Array(n) : null;
      const amp = sway ? new Float32Array(n) : null;

      for (let i = 0; i < n; i++) {
        const it = cellItems[i];
        writeMatrix(inst, i, it, protoScale);
        inst.setColorAt(i, it.tint);
        if (sway) { phase[i] = it.phase; amp[i] = it.amp; }

        // Every prop row is anchorBottom, so an instance occupies a box from its
        // footprint up to (footprint + height), and reach wide horizontally.
        const reach = (Math.max(protoSize.x, protoSize.z) * 0.5 + swayReach) * it.scale;
        if (it.x - reach < minX) minX = it.x - reach;
        if (it.x + reach > maxX) maxX = it.x + reach;
        if (it.z - reach < minZ) minZ = it.z - reach;
        if (it.z + reach > maxZ) maxZ = it.z + reach;
        if (it.y < minY) minY = it.y;
        if (it.y + protoSize.y * it.scale > maxY) maxY = it.y + protoSize.y * it.scale;
      }

      if (sway) {
        geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
        geo.setAttribute('aAmp', new THREE.InstancedBufferAttribute(amp, 1));
      }
      // Nothing rewrites these buffers again — tell the driver so it can put them
      // somewhere it never expects a write.
      inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) {
        inst.instanceColor.setUsage(THREE.StaticDrawUsage);
        inst.instanceColor.needsUpdate = true;
      }
      // The chunk itself sits at the origin (all placement is in instanceMatrix)
      // and never moves, so keep it out of the scene-graph matrix walk (§4.4).
      inst.matrixAutoUpdate = false;
      inst.updateMatrix();
      // We cull it ourselves in updateProps() — see the header note on why.
      inst.frustumCulled = false;

      scene.add(inst);
      chunks.push({
        mesh: inst,
        center: new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
        radius: 0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ),
        cull: cullDist,
      });
    }
  }
}

// Build the whole seabed from a PROPS table plus the loaded model map.
export function scatterAll(propTable, models) {
  for (const { model, count, ...opts } of propTable) {
    buildRow(models[model], count, opts);
  }
}

// How many chunks exist / are drawn — surfaced on the F3 readout so the culling
// can be verified rather than assumed.
export const propStats = { chunks: 0, visible: 0 };

// ---- PER-FRAME: CULL --------------------------------------------------------
// This is all that is left of the old updateSway(). It replaces 1,574 matrix
// composes and 16 buffer uploads with one linear pass of float compares.
//
// Two tests, cheapest first:
//   distance — matched to the fog (PERF.propCull). Measured to the chunk's near
//     edge, so a big chunk is never cut while part of it is still in visible range.
//   frustum  — with the chunk spheres now tight, this is what finally stops the
//     scenery behind the camera from being submitted.
export function updateProps() {
  // camera.matrixWorldInverse is refreshed inside renderer.render(), which has not
  // run yet this frame — shark.js moved the camera moments ago. Without this the
  // frustum is one frame stale, which pops chunks at the screen edge during fast
  // turns. renderer.render() will redo this harmlessly.
  camera.updateMatrixWorld();
  viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(viewProj);

  const cp = camera.position;
  let visible = 0;

  for (const c of chunks) {
    const dx = cp.x - c.center.x, dy = cp.y - c.center.y, dz = cp.z - c.center.z;
    const near = Math.sqrt(dx * dx + dy * dy + dz * dz) - c.radius;
    if (near > c.cull) { c.mesh.visible = false; continue; }

    probeSphere.center.copy(c.center);
    probeSphere.radius = c.radius;
    const vis = frustum.intersectsSphere(probeSphere);
    c.mesh.visible = vis;
    if (vis) visible++;
  }

  propStats.chunks = chunks.length;
  propStats.visible = visible;
}
