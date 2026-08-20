import { SHARK } from './config/config.js';
import { canvas } from './core.js';

// ============================================================
//  INPUT  — keyboard state plus accumulated mouse-look delta
// ============================================================

const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---- SUSPEND ---------------------------------------------------------------
// One switch that makes this whole module answer "no input" — held by the menu
// (src/menu/menu.js) while it is open. It is gated HERE, at the source, rather
// than each consumer choosing to ignore input, for two reasons: every axis and
// the bite go quiet in one place, and the click that would otherwise re-capture
// the pointer lands on the 30% of the canvas the menu overlay does not cover, so
// the lock has to be refused here or a click on the visible margin drops you
// straight back into mouse-look with a menu still on screen.
let suspended = false;

// Read by the pause card (src/menu/pause.js): it comes up when the pointer lock
// is lost, and the E menu opening is one of the things that loses it. "Is
// something already holding the input" is the question that separates the two,
// and asking it here rather than asking menu.js is what keeps the two screens
// from having to know about each other.
export function isInputSuspended() {
  return suspended;
}

export function setInputSuspended(v) {
  suspended = v;
  if (v) {
    // Drop anything mid-press: releasing W while suspended still fires keyup, but
    // a key held THROUGH the open would otherwise resume the moment we close.
    for (const k of Object.keys(keys)) keys[k] = false;
    mouseYaw = 0; mousePitch = 0; bitePressed = false;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
}

// ---- ARROW CAPTURE ---------------------------------------------------------
// The placement editor (F4) rotates its ghost with the arrow keys, and the arrows
// are also aliases for steering — so without this, aiming a prop would swim the
// shark and drag the brush point out from under what you were aiming at.
//
// Narrower than `suspended` on purpose: the editor NEEDS the shark drivable,
// because swimming is how you aim the brush. Only the four arrows go quiet, and
// WASD keeps every axis they were an alias for. Nothing is lost.
let arrowsCaptured = false;

export function setArrowsCaptured(v) {
  arrowsCaptured = v;
  // Cleared on BOTH edges, because an arrow held across either one is latched in
  // `keys` with its keyup landing on the other side of the switch: held into the
  // editor it would steer the moment you left, and held out of it, immediately.
  keys['ArrowUp'] = keys['ArrowDown'] = keys['ArrowLeft'] = keys['ArrowRight'] = false;
}

const arrow = (code) => !arrowsCaptured && keys[code];

let mouseYaw = 0, mousePitch = 0;
addEventListener('mousemove', (e) => {
  if (suspended || document.pointerLockElement !== canvas) return;
  mouseYaw   -= e.movementX * SHARK.mouseSensitivity;
  mousePitch -= e.movementY * SHARK.mouseSensitivity;
});

canvas.addEventListener('click', () => {
  if (suspended) return;
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
});

// Left click bites. Gated on the pointer being locked, which does two jobs: the
// click that CAPTURES the pointer isn't also a bite, and while the cursor is free
// (Esc, or the start screen) the mute button and the Dive In button are clickable
// without the shark snapping at the water behind them.
let bitePressed = false;
addEventListener('mousedown', (e) => {
  if (suspended || e.button !== 0 || document.pointerLockElement !== canvas) return;
  bitePressed = true;
});

export function capturePointer() {
  if (suspended) return;
  // Chrome rate-limits a lock that follows an unlock too closely (toggling the
  // menu twice in a second does exactly that) and rejects the promise. Losing
  // the lock there is fine — one click takes it back; an unhandled rejection in
  // the console is not.
  Promise.resolve(canvas.requestPointerLock()).catch(() => {});
}

// -1 / 0 / +1 axes, so the shark module never names key codes itself.
export function turnAxis() {
  if (suspended) return 0;
  return (keys['KeyA'] || arrow('ArrowLeft') ? 1 : 0) - (keys['KeyD'] || arrow('ArrowRight') ? 1 : 0);
}

// Rise / dive. E used to be dive; it opens the menu now (see Docs/systems/menu.md),
// so vertical moved to Space/Ctrl — the near-universal swim-and-fly binding — with
// Q and Z kept as aliases for the old habit.
export function pitchAxis() {
  if (suspended) return 0;
  const up   = keys['Space'] || keys['KeyQ'];
  const down = keys['ControlLeft'] || keys['ControlRight'] || keys['KeyZ'];
  return (up ? 1 : 0) - (down ? 1 : 0);
}

export function thrustAxis() {
  if (suspended) return 0;
  return (keys['KeyW'] || arrow('ArrowUp') ? 1 : 0) - (keys['KeyS'] || arrow('ArrowDown') ? 1 : 0);
}

export function boosting() {
  return !suspended && !!(keys['ShiftLeft'] || keys['ShiftRight']);
}

// Like the mouse-look delta below: reading it consumes it, so one press is one
// bite no matter how the frame rate lines up with the click.
export function consumeBite() {
  const wanted = bitePressed;
  bitePressed = false;
  return wanted;
}

// Mouse look is a delta: reading it consumes it, so it applies exactly once.
export function consumeMouseLook() {
  const out = { yaw: mouseYaw, pitch: mousePitch };
  mouseYaw = 0;
  mousePitch = 0;
  return out;
}
