import * as THREE from 'three';
import { MODELS } from '../config/config.js';
import { loadModel } from '../loader.js';
import { sharkState } from '../shark.js';

// ============================================================
//  MODEL PREVIEW  — a rotatable 3D viewport inside the menu.
//
//  Its own WebGLRenderer, its own scene, its own copy of the model. Not the
//  game's renderer and not the game's shark: reusing either would mean lifting
//  the real animal out of the world and putting it back, or scissoring a
//  viewport into the canvas the menu is laid out on top of. A second context
//  costs one model's worth of memory and only draws while the menu is open.
//
//  The model loads LAZILY on the first open, through the same loadModel() the
//  world uses — so it arrives normalized, nose down -Z, clips attached — and the
//  browser serves the GLB from cache. Boot time is untouched.
// ============================================================

const FOV = 32;
const PITCH_LIMIT = 0.6;     // ±35°, so it can never end up belly-up
const DRAG_SPEED = 0.008;    // rad per pixel
const MARGIN = 1.25;         // fraction of the fitted distance to back off by

// The resting pose, restored every time the menu opens. The loader points every
// model's nose down -Z and the camera sits on +Z, so a yaw of 0 shows you the
// TAIL — π turns it around to face you. The 0.35 off dead-on is what keeps it
// from being a flat silhouette: you get the face and the length of the body at
// once. Nothing spins it but you.
const HOME_YAW = Math.PI - 0.35;
const HOME_PITCH = 0.1;

// Every preview ever built, so the page teardown in main.js can reach them. The
// menu owns their start/stop and nothing else has a reference — which is fine
// while the page is alive and useless when it is being handed back to the OS.
// A live WebGL context is not freed by a navigation on its own (see the note in
// main.js), and this one is a SECOND context with its own copy of the shark.
const previews = new Set();

export function disposeAllPreviews() {
  for (const p of previews) p.dispose();
  previews.clear();
}

export function createPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

  // Two lights and no fog. This is a display case, not the ocean — the animal
  // should read cleanly here even though the game deliberately hides it in murk.
  scene.add(new THREE.HemisphereLight(0x9fd8ff, 0x0b2233, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(3, 5, 4);
  scene.add(key);

  // pivot spins; holder carries the shark's growth scale. Two groups, because the
  // model's OWN scale is the loader's size normalization and must not be touched.
  const pivot = new THREE.Group();
  const holder = new THREE.Group();
  pivot.add(holder);
  scene.add(pivot);

  let model = null, mixer = null, loading = false, radius = 4;
  let yaw = HOME_YAW, pitch = HOME_PITCH;
  let dragging = false;
  let raf = 0, last = 0, w = 0, h = 0;

  function load() {
    if (model || loading) return;
    loading = true;
    loadModel(MODELS.shark).then((m) => {
      // Measured BEFORE parenting: once it is inside `holder` the growth scale is
      // in its world matrix and the radius comes back multiplied by it. Measured
      // here it is the bind pose at scale 1, and frameCamera() applies the growth
      // itself — so the whole animal stays in frame at any size.
      const sphere = new THREE.Box3().setFromObject(m).getBoundingSphere(new THREE.Sphere());
      radius = sphere.radius || 4;

      model = m;
      holder.add(m);

      const clips = m.clips || [];
      if (clips.length) {
        mixer = new THREE.AnimationMixer(m.animRoot);
        const swim = THREE.AnimationClip.findByName(clips, 'Armature|Swim') || clips[0];
        const action = mixer.clipAction(swim);
        action.timeScale = 0.34;      // a still model reads as a trophy
        action.play();
      }
    }).catch((e) => console.warn('menu preview: shark model failed to load', e));
  }

  // ---- DRAG TO SPIN --------------------------------------------------------
  // Pointer events (not mouse) so a trackpad drag and a touch drag are the same
  // code path, and pointer capture so a drag that leaves the canvas still tracks.
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += e.movementX * DRAG_SPEED;
    pitch = THREE.MathUtils.clamp(pitch + e.movementY * DRAG_SPEED, -PITCH_LIMIT, PITCH_LIMIT);
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // The canvas is sized by CSS, so the drawing buffer has to chase the layout.
  // Checked per frame rather than on a resize listener because the panel also
  // changes size when the menu opens, which fires no resize event.
  function fit() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch || (cw === w && ch === h)) return;
    w = cw; h = ch;
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
  }

  // Distance that fits a sphere of the CURRENT size. Horizontal fov is the
  // binding constraint on a wide panel, so take the smaller of the two half
  // angles — otherwise a squat viewport clips the nose and tail.
  function frameCamera(scale) {
    const vFov = THREE.MathUtils.degToRad(FOV) / 2;
    const hFov = Math.atan(Math.tan(vFov) * camera.aspect);
    const d = (radius * scale) / Math.sin(Math.min(vFov, hFov)) * MARGIN;
    camera.position.set(0, radius * scale * 0.18, d);
    camera.lookAt(0, 0, 0);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    fit();
    pivot.rotation.set(pitch, yaw, 0);   // only a drag ever moves this

    const scale = sharkState.scale || 1;     // eating grew it; show the real animal
    holder.scale.setScalar(scale);
    frameCamera(scale);

    if (mixer) mixer.update(dt);
    renderer.render(scene, camera);
  }

  const api = {
    start() {
      load();
      // Back to facing you on every open. Whatever angle you spun it to last time
      // was for last time — reopening the menu should not start you looking at
      // the underside of a tail you have to drag your way out of.
      yaw = HOME_YAW;
      pitch = HOME_PITCH;
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },

    // One-way. Called from the page teardown, never from the menu — closing the
    // menu stops the loop, leaving the page gives the GPU its memory back.
    //
    // dispose() releases what three.js is tracking (programs, render targets);
    // forceContextLoss() is what actually drops the CONTEXT, and with it every
    // texture, buffer and shader still resident on the GPU. Without the second
    // call the first frees comparatively little.
    dispose() {
      api.stop();
      mixer?.stopAllAction();
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [o.material].flat()) {
          if (!m) continue;
          for (const v of Object.values(m)) v?.isTexture && v.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* extension absent: nothing to lose */ }
    },
  };

  previews.add(api);
  return api;
}
