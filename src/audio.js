import { AUDIO } from './config.js';

// ============================================================
//  AUDIO — plain HTMLAudioElements: three ambient loops, one loop
//  whose volume/rate track the shark's speed, and a few one-shot
//  SFX. Small enough a Web Audio graph would be pure overhead.
// ============================================================

let muted = false;

function makeLoop(cfg) {
  const el = new Audio(cfg.url);
  el.loop = true;
  el.volume = Array.isArray(cfg.volume) ? cfg.volume[0] : cfg.volume;
  return el;
}

const ambience = makeLoop(AUDIO.ambience);
const bubbles  = makeLoop(AUDIO.bubbles);
const whale    = makeLoop(AUDIO.whale);
const swim     = makeLoop(AUDIO.swim);
const loops = [ambience, bubbles, whale, swim];

function playOnce(cfg) {
  const el = new Audio(cfg.url);
  el.volume = cfg.volume;
  el.muted = muted;
  el.play().catch(() => {});   // ignore autoplay rejection outside a user gesture
}

// Browsers won't start any of this until a real user gesture — call from the
// "Dive In" click handler, never from buildWorld(). Guarded so a stray
// second call (e.g. the click firing twice) can't replay the splash.
let started = false;
export function startAmbience() {
  if (started) return;
  started = true;
  playOnce(AUDIO.splash);
  for (const el of loops) {
    el.muted = muted;
    el.play().catch(() => {});
  }
}

// Fold the shark's speed into the swim loop so water sound tracks movement.
export function updateSwim(speedAbs, maxSpeed) {
  const t = Math.min(speedAbs / maxSpeed, 1);
  const [vMin, vMax] = AUDIO.swim.volume;
  const [rMin, rMax] = AUDIO.swim.rate;
  swim.volume = vMin + t * (vMax - vMin);
  swim.playbackRate = rMin + t * (rMax - rMin);
}

let fleeCooldown = 0;
export function updateFishFlee(dt, fleeing) {
  fleeCooldown -= dt;
  if (fleeing && fleeCooldown <= 0) {
    fleeCooldown = AUDIO.fishFlee.cooldown;
    playOnce(AUDIO.fishFlee);
  }
}

export function playCollectSound() {
  playOnce(AUDIO.collect);
}

export function toggleMute() {
  muted = !muted;
  for (const el of loops) el.muted = muted;
  return muted;
}
