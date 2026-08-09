import * as THREE from 'three';
import { EDITOR, MODELS } from './config/config.js';
import { scene } from './core.js';
import { floorAt } from './terrain.js';
import { levelAt } from './levels.js';
import { clearArea } from './props.js';
import { sharkState } from './shark.js';
import { setEditorPanel, showEditorPanel } from './hud.js';

// ============================================================
//  PLACEMENT EDITOR  — put things where you want them, in game.
//
//  Press F4. Swim to a spot, aim, press Enter. When the scene looks right,
//  press \ and a ready-to-paste config block lands on your clipboard.
//
//  WHY THIS EXISTS
//  Describing a position in words and having someone translate it into
//  coordinates is a terrible loop: every round trip risks disturbing something
//  that already looked right, and you cannot see the result until it is already
//  committed. Placement is a VISUAL judgement and it belongs in the viewport.
//
//  WHAT IT IS NOT
//  It is not a level format. Nothing here is loaded at startup and nothing here
//  is authoritative — placed objects are previews with no collision and no
//  instancing. The output is source code, which you paste into config.js, and
//  from that moment the props system owns it exactly like every other prop. That
//  is deliberate: one source of truth (config.js), and an editor that only ever
//  helps you write it.
// ============================================================

let on = false;
let models = null;
let erasing = false;      // Tab switches between the place brush and the erase brush

// Current brush
let modelIndex = 0;
let scale = 1;
let rotY = 0;
let dist = EDITOR.distance;
let sink = 0;
let eraseR = EDITOR.eraseRadius;

// The translucent preview, rebuilt whenever the model changes.
let ghost = null;
const ghostMat = new THREE.MeshBasicMaterial({
  color: 0x46e08a, transparent: true, opacity: 0.34, depthWrite: false,
});

// Everything placed this session, newest last.
const placed = [];
// Every area cleared this session: { level, x, z, r } in LEVEL-LOCAL coordinates.
const cleared = [];

const tmp = new THREE.Vector3();

// The erase brush: a flat disc lying on the sand showing exactly what will go.
let eraseDisc = null;
function makeEraseDisc() {
  const g = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({
    color: 0xff7a5c, transparent: true, opacity: 0.22,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(g, m);
  disc.renderOrder = 2;
  return disc;
}

function currentKey() {
  return EDITOR.models[modelIndex];
}

// A prop wrapper carries the loader's normalization in its own scale, so an
// instance's true size is (that x the brush scale) — the same product props.js
// bakes into every instance matrix.
function spawn(key, useGhostMaterial) {
  const proto = models[key];
  if (!proto) return null;
  const obj = proto.clone(true);
  if (useGhostMaterial) {
    obj.traverse((o) => { if (o.isMesh) o.material = ghostMat; });
  }
  scene.add(obj);
  return obj;
}

function rebuildGhost() {
  if (ghost) { scene.remove(ghost); ghost = null; }
  if (eraseDisc) eraseDisc.visible = false;
  if (erasing) {
    if (!eraseDisc) scene.add(eraseDisc = makeEraseDisc());
    eraseDisc.visible = true;
  } else {
    ghost = spawn(currentKey(), true);
  }
}

// Where the brush is pointing: `dist` ahead of the shark, dropped onto the sand.
// Ahead rather than underfoot so you can stand back and look at what you are
// about to commit — placing a 70-unit mountain on top of yourself tells you
// nothing about how it reads.
function brushPoint(out) {
  const p = sharkState.obj.position;
  out.copy(sharkState.forward).multiplyScalar(dist).add(p);
  out.y = floorAt(out.x, out.z);
  return out;
}

function applyTransform(obj, at) {
  const proto = models[currentKey()];
  obj.position.set(at.x, at.y - sink * scale, at.z);
  obj.rotation.set(0, rotY, 0);
  obj.scale.setScalar(proto.scale.x * scale);
}

function place() {
  const at = brushPoint(tmp);
  const obj = spawn(currentKey(), false);
  if (!obj) return;
  applyTransform(obj, at);
  placed.push({ obj, model: currentKey(), x: at.x, z: at.z, scale, rotY, sink });
}

function erase() {
  const at = brushPoint(tmp);
  const n = clearArea(at.x, at.z, eraseR);
  const L = levelAt(at.x, at.z);
  cleared.push({
    level: L, x: at.x - L.center[0], z: at.z - L.center[2], r: eraseR,
  });
  flash(`cleared ${n} — reload to undo`);
}

function undo() {
  // Only placements can be taken back on the spot. An erase has already zeroed
  // instance matrices and dropped colliders, and rebuilding a chunk mid-session
  // to put them back is far more machinery than a reload — which restores them
  // exactly, because the world is seeded.
  if (erasing) {
    if (cleared.pop()) flash('erase un-recorded — reload to see it back');
    return;
  }
  const last = placed.pop();
  if (last) scene.remove(last.obj);
}

// ---- EXPORT ----------------------------------------------------------------
// Grouped by model and emitted in LEVEL-LOCAL coordinates, because that is what
// a PROPS row wants: the same row can then be reused by any level and lands in
// the right place relative to that basin's centre.
//
// rotY is only written when it was actually turned. A `fixed` entry without one
// gets a random bearing per instance, which is what you want for anything you
// did not deliberately aim.
// The erase half of the export: one `clear` array per level, ready to replace the
// (usually empty) one on that level's LEVELS row.
function exportClears() {
  if (!cleared.length) return '';
  const byLevel = new Map();
  for (const c of cleared) {
    if (!byLevel.has(c.level)) byLevel.set(c.level, []);
    byLevel.get(c.level).push(c);
  }
  const out = [];
  for (const [L, items] of byLevel) {
    const lines = items.map(
      (c) => `      { x: ${c.x.toFixed(1)}, z: ${c.z.toFixed(1)}, r: ${c.r.toFixed(0)} },`
    );
    out.push(
      `// Replace the \`clear\` array on LEVELS[${L.id - 1}] (${L.name}):\n` +
      `    clear: [\n${lines.join('\n')}\n    ],`
    );
  }
  return out.join('\n\n');
}

function exportText() {
  const clears = exportClears();
  if (!placed.length) return clears || '// nothing placed or erased yet';

  const byModel = new Map();
  for (const p of placed) {
    if (!byModel.has(p.model)) byModel.set(p.model, []);
    byModel.get(p.model).push(p);
  }

  const out = [];
  for (const [model, items] of byModel) {
    const lines = items.map((p) => {
      const L = levelAt(p.x, p.z);
      const lx = (p.x - L.center[0]).toFixed(1);
      const lz = (p.z - L.center[2]).toFixed(1);
      const rot = Math.abs(p.rotY) > 1e-3 ? `, rotY: ${p.rotY.toFixed(2)}` : '';
      const sk = p.sink ? `, sink: ${p.sink.toFixed(1)}` : '';
      return `      { x: ${lx}, z: ${lz}, scale: ${p.scale.toFixed(2)}${rot}${sk} },   // level ${L.id}`;
    });
    out.push(
      `  { model: '${model}', count: 0,\n` +
      `    fixed: [\n${lines.join('\n')}\n    ] },`
    );
  }

  return (
    `// ---- placed in-game with the F4 editor ----\n` +
    `// Paste into the PROPS table for the level named on each line, then add the\n` +
    `// row's usual options (palette / solid / taper / shade / sway / sink / tilt)\n` +
    `// — the editor only records placement, not material and collision settings.\n` +
    out.join('\n') +
    (clears ? `\n\n${clears}` : '')
  );
}

function copyExport() {
  const text = exportText();
  console.log(text);
  navigator.clipboard?.writeText(text).then(
    () => flash('copied to clipboard — also in the console'),
    () => flash('clipboard blocked — the block is in the console'),
  );
}

let note = '';
let noteTimer = 0;
function flash(msg) {
  note = msg;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { note = ''; draw(); }, 2600);
  draw();
}

function draw() {
  if (!on) return;
  const at = brushPoint(tmp);
  const L = levelAt(at.x, at.z);
  const where =
    `at ${(at.x - L.center[0]).toFixed(1)}, ${(at.z - L.center[2]).toFixed(1)}` +
    `  <span class="dim">local to ${L.name}</span>   reach ${dist.toFixed(0)}\n`;
  const tail =
    `<span class="dim">Tab</span> ${erasing ? 'place mode' : 'erase mode'}   ` +
    `<span class="dim">; '</span> reach   <span class="dim">Enter</span> ${erasing ? 'erase' : 'place'}   ` +
    `<span class="dim">Backspace</span> undo\n` +
    `<span class="dim">\\</span> copy config   <span class="dim">F4</span> close` +
    (note ? `\n<span class="ok">${note}</span>` : '');

  if (erasing) {
    setEditorPanel(
      `<b class="warn">ERASE</b>  clears scattered props inside the circle\n` +
      `radius ${eraseR.toFixed(0)}\n` + where +
      `cleared ${cleared.length}   placed ${placed.length}\n` +
      `<span class="dim">- =</span> radius\n` + tail
    );
    return;
  }

  const height = (MODELS[currentKey()].targetSize * scale).toFixed(1);
  setEditorPanel(
    `<b>PLACE</b>  ${currentKey()}  <span class="dim">(${modelIndex + 1}/${EDITOR.models.length})</span>\n` +
    `scale ${scale.toFixed(2)}   height ${height}   yaw ${(rotY * 57.3).toFixed(0)}°   sink ${sink.toFixed(1)}\n` +
    where +
    `placed ${placed.length}   cleared ${cleared.length}\n` +
    `<span class="dim">[ ]</span> model   <span class="dim">- =</span> scale   ` +
    `<span class="dim">, .</span> yaw   <span class="dim">9 0</span> sink\n` + tail
  );
}

export function initEditor(loaded) {
  models = loaded;
}

// Per-frame: keep the ghost sitting where the brush is pointing, and keep the
// readout honest about the coordinates you are about to commit.
export function updateEditor() {
  if (!on) return;
  const at = brushPoint(tmp);
  if (erasing && eraseDisc) {
    // A hair above the sand: exactly on it z-fights the seabed, and the disc is
    // a guide, not a decal.
    eraseDisc.position.set(at.x, at.y + 0.35, at.z);
    eraseDisc.scale.setScalar(eraseR);
  } else if (ghost) {
    applyTransform(ghost, at);
  }
  draw();
}

addEventListener('keydown', (e) => {
  if (e.code === 'F4') {
    e.preventDefault();
    // The listener is live from page load but the models are not — pressing F4 on
    // the loading screen would clone `undefined` and take the whole boot with it.
    if (!models || !sharkState.obj) return;
    on = !on;
    showEditorPanel(on);
    if (on) { rebuildGhost(); draw(); }
    else {
      if (ghost) { scene.remove(ghost); ghost = null; }
      if (eraseDisc) eraseDisc.visible = false;
    }
    return;
  }
  if (!on) return;

  const n = EDITOR.models.length;
  switch (e.code) {
    case 'Tab': erasing = !erasing; rebuildGhost(); break;
    case 'BracketLeft':  modelIndex = (modelIndex - 1 + n) % n; rebuildGhost(); break;
    case 'BracketRight': modelIndex = (modelIndex + 1) % n;     rebuildGhost(); break;
    case 'Minus':
      if (erasing) eraseR = Math.max(3, eraseR - 3);
      else scale = Math.max(0.05, scale / 1.12);
      break;
    case 'Equal':
      if (erasing) eraseR = Math.min(160, eraseR + 3);
      else scale = Math.min(40, scale * 1.12);
      break;
    case 'Comma':  rotY -= 0.13; break;
    case 'Period': rotY += 0.13; break;
    case 'Semicolon': dist = Math.max(4, dist - 4); break;
    case 'Quote':     dist = Math.min(220, dist + 4); break;
    case 'Digit9': sink = Math.max(0, sink - 0.5); break;
    case 'Digit0': sink += 0.5; break;
    case 'Enter':     erasing ? erase() : place(); break;
    case 'Backspace': e.preventDefault(); undo(); break;
    case 'Backslash': copyExport(); break;
    default: return;
  }
  e.preventDefault();
  draw();
});
