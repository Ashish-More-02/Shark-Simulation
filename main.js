// ============================================================
//  🦈 Deep Ocean Shark — entry point.
//  Boot, then run the frame loop. All the actual work lives in src/:
//
//    config/       every tunable, no logic — config.js + levels/level-N.js
//    core.js       renderer / scene / camera / shared clock
//    levels.js     the shape of the world: floor profile, play bound, extent
//    materials.js  caustic shader injection, particle sprites
//    terrain.js    sand, dunes, the seabedHeight() source of truth
//    water.js      surface plane + ripples
//    godrays.js    additive light shafts
//    particles.js  bubbles, marine snow, shark wake
//    loader.js     GLB loading, scale/orientation normalizing, merging
//    props.js      scatter placement + per-instance rock weathering
//    fish.js       shoaling and fleeing
//    orbs.js       collectibles
//    audio.js      ambience loops, speed-reactive swim sound, SFX
//    shark.js      rig, handling, swim clip, chase camera
//    upgrades.js   points earned and spent, and every live player stat
//    combat/       the fight: bite damage, the shark's health, the whale's temper
//    input.js      keyboard / mouse-look
//    hud.js        the HUD — the only module that touches the HUD's DOM
//    menu/         the E menu: shell, 3D preview, stats, pages
//    world.js      composition root: builds the scene, drives updates
// ============================================================
import { PERF } from './src/config/config.js';
import { renderer, scene, camera, uTime } from './src/core.js';
import { buildWorld, updateWorld } from './src/world.js';
import { propStats } from './src/props.js';
import { showControls, showLoadError, wireStartScreen, wireMuteButton,
         wirePerfToggle, isPerfVisible, setPerf } from './src/hud.js';
import { capturePointer } from './src/input.js';
import { startAmbience, toggleMute, setAudioSuspended, stopAudio } from './src/audio.js';
import { isMenuOpen, armMenu } from './src/menu/menu.js';
import { isPaused, armPause } from './src/menu/pause.js';
import { disposeAllPreviews } from './src/menu/preview.js';

let last = performance.now();

// Rolling perf window. Sampled every frame (two performance.now() calls is
// nothing), but only formatted and pushed to the DOM twice a second, and only
// while the F3 readout is actually up.
const SAMPLE_SECONDS = 0.5;
let frames = 0, elapsed = 0, cpuMs = 0;

function reportPerf(dt) {
  frames++;
  elapsed += dt;
  if (elapsed < SAMPLE_SECONDS || !isPerfVisible()) {
    if (elapsed >= SAMPLE_SECONDS) { frames = 0; elapsed = 0; cpuMs = 0; }
    return;
  }
  const { render, memory, programs } = renderer.info;
  setPerf(
    `${(frames / elapsed).toFixed(0).padStart(3)} fps   ${(elapsed * 1000 / frames).toFixed(1)} ms/frame\n` +
    `cpu ${(cpuMs / frames).toFixed(1)} ms (updateWorld)\n` +
    `${render.calls} draw calls   ${(render.triangles / 1e6).toFixed(2)}M tris\n` +
    `props ${propStats.visible}/${propStats.chunks} chunks\n` +
    `dpr ${renderer.getPixelRatio()}   ${programs?.length ?? '?'} programs   ${memory.geometries} geo`
  );
  frames = 0; elapsed = 0; cpuMs = 0;
}

// A backgrounded tab still ran the whole simulation and every draw call (§4.7).
// requestAnimationFrame is throttled but not stopped, and audio isn't touched at
// all. Stop the loop outright and hand the machine back.
let running = false;

// ---- FRAME CAP (PERF.targetFps) --------------------------------------------
// requestAnimationFrame fires at the DISPLAY's refresh rate, which on any recent
// Mac is 120 Hz — so the loop was drawing ~208 fps and burning a full GPU frame
// for every one of them. The simulation is time-based (dt comes from the real
// clock), so frames above 60 buy no responsiveness at all; they are pure heat.
//
// The gate cannot simply be `now < nextSlot`. rAF timestamps jitter by a
// millisecond or so, so on a 60 Hz display a callback arriving at 16.6 ms for a
// 16.67 ms slot gets skipped, the next one lands at 33 ms, and the frame rate
// silently HALVES to 30. The fix is to render on whichever callback is *nearest*
// the due time, which means the tolerance has to be half of the DISPLAY's interval
// — not half of the target's, or a 120 Hz panel would pass every callback and the
// cap would do nothing. So measure the display: a rolling minimum of the observed
// gap between callbacks.
const FRAME_MS = PERF.targetFps ? 1000 / PERF.targetFps : 0;
let nextSlot = 0;        // timestamp the next rendered frame is due
let prevCallback = 0;    // previous rAF timestamp, for measuring the refresh interval
let refreshMs = FRAME_MS;

function tick(now) {
  if (!running) return;
  requestAnimationFrame(tick);      // re-arm first: a skipped frame must still re-arm

  if (FRAME_MS) {
    if (prevCallback) {
      const gap = now - prevCallback;
      if (gap > 0.5 && gap < refreshMs) refreshMs = gap;    // rolling minimum
    }
    prevCallback = now;

    if (now < nextSlot - refreshMs * 0.5) return;

    // Advance on the ideal grid so the average holds exactly at the target with no
    // drift — but if we have already slipped a whole frame (a hitch, a slow frame,
    // a tab switch) resync to now instead of trying to catch up in a burst.
    nextSlot += FRAME_MS;
    if (nextSlot < now) nextSlot = now + FRAME_MS;
  }

  const dt = Math.min((now - last) / 1000, 0.05);   // clamp: no huge step after a tab switch
  last = now;
  uTime.value = now * 0.001;

  // Both overlays FREEZE the simulation but not the drawing. Each blurs what is
  // behind it with a backdrop-filter, and what is behind it is this canvas —
  // stop rendering and you are blurring a buffer nobody is maintaining.
  const cpuStart = performance.now();
  if (!isMenuOpen() && !isPaused()) updateWorld(dt, uTime.value);
  cpuMs += performance.now() - cpuStart;

  renderer.render(scene, camera);
  reportPerf(dt);                    // after render(): renderer.info is per-frame
}

function startLoop() {
  // `torn` guards the case where the visitor leaves before buildWorld() resolves:
  // the .then() below would otherwise start a loop on a disposed renderer.
  if (running || torn) return;
  running = true;
  last = performance.now();          // don't bill the paused time to the next frame
  nextSlot = 0;                      // ...and don't make the cap catch up either
  prevCallback = 0;
  requestAnimationFrame(tick);
}

buildWorld().then(() => {
  showControls();
  startLoop();                       // render behind the start screen
}).catch(showLoadError);

document.addEventListener('visibilitychange', () => {
  if (torn) return;                  // nothing left to suspend or resume
  const hidden = document.visibilityState === 'hidden';
  setAudioSuspended(hidden);
  if (hidden) running = false;
  else startLoop();
});

// ============================================================
//  TEARDOWN — give the machine back when the page goes away
//
//  The bug this fixes: leaving the game for the landing page left the laptop hot
//  and the fans up. Every exit here is an ordinary link (#lp-exit, "Go to
//  homepage", Escape), and a navigation does NOT free a WebGL context — it
//  freezes the document into the back/forward cache, holding every texture,
//  buffer, shader and geometry this scene uploaded, on both contexts (the world's
//  and the menu preview's), for as long as the browser chooses to keep the entry
//  around. On a Mac a live `powerPreference: 'high-performance'` context is also
//  enough on its own to keep the machine in its high-power graphics state.
//
//  visibilitychange above is not the fix and was never meant to be: it stops the
//  frame loop, which is the CPU half, and the loop was already stopped by the
//  time the heat was being reported. What was still held was the GPU half.
//
//  pagehide is the right event, and deliberately not `unload`:
//    - unload does not fire reliably on mobile Safari, and registering a handler
//      for it makes a page ineligible for the back/forward cache in Chrome —
//      i.e. the listener that is supposed to help would break the fast Back.
//    - pagehide fires on BOTH paths, and e.persisted says which: true means
//      frozen into the cache, false means actually being destroyed.
//
//  Both paths free the GPU, because "frozen" is exactly the case that was
//  costing something. That makes the cached document unrestorable — its canvas
//  has no context any more — so pageshow reloads it if the visitor presses Back.
//  That is a real cost, one ocean re-load on Back, and it is the trade being
//  made knowingly: a held GPU context is a cost every second the visitor is
//  somewhere else, and a reload is a cost only if they come back.
// ============================================================
let torn = false;

function teardown() {
  if (torn) return;
  torn = true;

  running = false;
  stopAudio();
  disposeAllPreviews();

  // dispose() releases what three.js tracks — programs, render targets, the
  // things it allocated on our behalf. forceContextLoss() is what drops the
  // context itself, and with it every byte still resident on the GPU. The first
  // without the second frees comparatively little, which is why both are here.
  renderer.dispose();
  try { renderer.forceContextLoss(); } catch { /* extension absent: nothing to lose */ }
}

addEventListener('pagehide', teardown);

addEventListener('pageshow', (e) => {
  // Restored from the back/forward cache onto a canvas whose context we dropped.
  // There is nothing to draw with, so start again rather than showing a dead
  // frame that will never update.
  if (e.persisted && torn) location.reload();
});

// armMenu() / armPause(): neither screen exists while the player is still looking
// at "Dive In" — there is no lock to lose yet and nothing to pause.
wireStartScreen(() => { capturePointer(); startAmbience(); armMenu(); armPause(); });
wireMuteButton(toggleMute);
wirePerfToggle();
