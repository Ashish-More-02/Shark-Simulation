// ============================================================
//  🦈 Deep Ocean Shark — entry point.
//  Boot, then run the frame loop. All the actual work lives in src/:
//
//    config.js     every tunable, no logic
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
//    input.js      keyboard / mouse-look
//    hud.js        the only module that touches the DOM
//    world.js      composition root: builds the scene, drives updates
// ============================================================
import { PERF } from './src/config.js';
import { renderer, scene, camera, uTime } from './src/core.js';
import { buildWorld, updateWorld } from './src/world.js';
import { propStats } from './src/props.js';
import { showControls, showLoadError, wireStartScreen, wireMuteButton,
         wirePerfToggle, isPerfVisible, setPerf } from './src/hud.js';
import { capturePointer } from './src/input.js';
import { startAmbience, toggleMute, setAudioSuspended } from './src/audio.js';

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

  const cpuStart = performance.now();
  updateWorld(dt, uTime.value);
  cpuMs += performance.now() - cpuStart;

  renderer.render(scene, camera);
  reportPerf(dt);                    // after render(): renderer.info is per-frame
}

function startLoop() {
  if (running) return;
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
  const hidden = document.visibilityState === 'hidden';
  setAudioSuspended(hidden);
  if (hidden) running = false;
  else startLoop();
});

wireStartScreen(() => { capturePointer(); startAmbience(); });
wireMuteButton(toggleMute);
wirePerfToggle();
