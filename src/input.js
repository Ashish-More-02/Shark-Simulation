import { SHARK } from './config.js';
import { canvas } from './core.js';

// ============================================================
//  INPUT  — keyboard state plus accumulated mouse-look delta
// ============================================================

const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });

let mouseYaw = 0, mousePitch = 0;
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  mouseYaw   -= e.movementX * SHARK.mouseSensitivity;
  mousePitch -= e.movementY * SHARK.mouseSensitivity;
});

canvas.addEventListener('click', () => {
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
});

export function capturePointer() {
  canvas.requestPointerLock();
}

// -1 / 0 / +1 axes, so the shark module never names key codes itself.
export function turnAxis() {
  return (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
}

export function pitchAxis() {
  return (keys['KeyQ'] ? 1 : 0) - (keys['KeyE'] ? 1 : 0);   // rise / dive
}

export function thrustAxis() {
  return (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
}

export function boosting() {
  return !!(keys['ShiftLeft'] || keys['ShiftRight']);
}

// Mouse look is a delta: reading it consumes it, so it applies exactly once.
export function consumeMouseLook() {
  const out = { yaw: mouseYaw, pitch: mousePitch };
  mouseYaw = 0;
  mousePitch = 0;
  return out;
}
