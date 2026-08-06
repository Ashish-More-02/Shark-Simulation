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

// One-shots are POOLED, not constructed per play (§4.6). `new Audio(url)` per shot
// means the browser fetches (or at best re-decodes) the file every time, spins up a
// decode thread to do it, and leaves the element for the GC. It barely shows up in
// frame time, but it is one of the reasons every core looked busy.
//
// Three elements per sound: enough that two overlapping orb collects don't cut each
// other off, few enough that the whole pool is decoded once during the first play.
const POOL_SIZE = 3;
const pools = new Map();

function playOnce(cfg) {
  let pool = pools.get(cfg.url);
  if (!pool) {
    pool = { els: [], next: 0 };
    for (let i = 0; i < POOL_SIZE; i++) pool.els.push(new Audio(cfg.url));
    pools.set(cfg.url, pool);
  }
  const el = pool.els[pool.next];
  pool.next = (pool.next + 1) % POOL_SIZE;
  el.volume = cfg.volume;
  el.muted = muted;
  el.currentTime = 0;          // rewind — this element may still be playing
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
  // Pooled one-shots read `muted` when they start, but one already in flight when
  // you hit the button has to be caught here or it plays on over the silence.
  for (const pool of pools.values()) for (const el of pool.els) el.muted = muted;
  return muted;
}

// Pause everything when the tab goes to the background (§4.7). Without this a
// backgrounded tab keeps three ambience loops running over whatever you switched to.
export function setAudioSuspended(suspended) {
  for (const el of loops) {
    if (suspended) el.pause();
    else if (started && !el.ended) el.play().catch(() => {});
  }
}
