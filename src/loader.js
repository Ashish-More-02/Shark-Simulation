import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ============================================================
//  MODEL LOADER  — normalizes scale + orientation
// ============================================================

const manager = new THREE.LoadingManager();
const loader = new GLTFLoader(manager);

// Bake a model's mesh nodes down to one mesh per material. kelp-tall.glb ships as
// 21 separate nodes, which would cost 21 draw calls on EVERY clone; merged it costs
// 2. Only safe for static geometry — a skinned mesh must keep its own node.
function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(geo.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    }
    if (!groups.has(o.material.uuid)) groups.set(o.material.uuid, { mat: o.material, geos: [] });
    groups.get(o.material.uuid).geos.push(geo);
  });

  const merged = new THREE.Group();
  for (const { mat, geos } of groups.values()) {
    const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!geo) return root;                 // attributes didn't line up — keep the original
    merged.add(new THREE.Mesh(geo, mat));
  }
  return merged;
}

export function loadModel({ url, targetSize, rotY, anchorBottom }) {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      let model = gltf.scene;

      // collapse draw-call-heavy static props (skinned rigs are left alone)
      let meshNodes = 0, skinned = false;
      model.traverse((o) => {
        if (o.isSkinnedMesh) skinned = true;
        if (o.isMesh) meshNodes++;
      });
      if (!skinned && meshNodes > 3) model = mergeByMaterial(model);

      // Does this model carry its own albedo texture? If so, per-instance
      // colouring has to tint it gently rather than replace it — see props.js.
      let hasTexture = false;
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;   // skinned verts deform outside their bind-pose bounds
        for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) {
          mat.side = THREE.DoubleSide;
          // Several of these models came through an FBX -> glTF conversion that
          // stamped metallicFactor 0.4 onto everything — leaves, bone, fish skin,
          // pebbles. Nothing in this scene is metal, and in three's PBR that 0.4
          // scales diffuse down by 60% while adding specular we have no
          // environment map to supply, so those props just render flat and dead.
          // Zero it: dielectric is the physically right answer for all of it.
          mat.metalness = 0;
          if (mat.map) hasTexture = true;
        }
      });

      // MUST come before any bbox measurement on a skinned model. A SkinnedMesh's
      // verts are placed by its BONES, and Box3 compensates for that via
      // bindMatrixInverse — which only gets refreshed inside
      // SkinnedMesh.updateMatrixWorld(). GLTFLoader binds with an identity
      // bindMatrix and never calls it, and Box3.expandByObject() calls
      // updateWorldMatrix() (a different method that skips the refresh), so
      // measuring a freshly-loaded rig double-applies the mesh node's transform.
      // Here that node carries scale 159.42, so the box came back 2513 units
      // instead of 15.77 and scaled the shark down to a 4 cm invisible speck.
      model.updateMatrixWorld(true);

      // recenter using WORLD-space bbox (bind pose for skinned meshes, which is
      // what we want: a stable normalization that doesn't jitter with the tail)
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= anchorBottom ? box.min.y : center.y;

      // center group (no transform) so rotation happens around origin
      const centerGroup = new THREE.Group();
      centerGroup.add(model);
      // rotation group: align nose to -Z
      const rotGroup = new THREE.Group();
      rotGroup.rotation.y = rotY;
      rotGroup.add(centerGroup);
      // wrapper: uniform scale to target size
      const wrapper = new THREE.Group();
      const s = targetSize / Math.max(size.x, size.y, size.z);
      wrapper.scale.setScalar(s);
      wrapper.add(rotGroup);

      // Hand the clips (and the node they animate) up to the caller — an
      // AnimationMixer must be rooted on the object that owns the bones.
      // These are plain own properties, NOT userData, and that is deliberate:
      // Object3D.copy() does `userData = JSON.parse(JSON.stringify(userData))`,
      // and both Object3D and AnimationClip implement toJSON — so a reference
      // parked in userData makes every clone() (fish.js still clones per fish)
      // serialize an entire model subtree, textures included as base64 data URLs.
      // Own properties are simply not copied by clone(), which is what we want.
      wrapper.clips = gltf.animations || [];
      wrapper.animRoot = model;
      wrapper.hasTexture = hasTexture;

      resolve(wrapper);
    }, undefined, reject);
  });
}

// Load every entry of a MODELS-shaped map in parallel, keyed the same way.
export async function loadAll(models) {
  const out = {};
  await Promise.all(
    Object.entries(models).map(async ([key, cfg]) => { out[key] = await loadModel(cfg); })
  );
  return out;
}
