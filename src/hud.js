// ============================================================
//  HUD / SCREENS  — the only module that touches the DOM.
//  Elements are looked up once here rather than every frame.
// ============================================================

const el = {
  depth:    document.getElementById('depth'),
  speed:    document.getElementById('speed'),
  orbs:     document.getElementById('orbs'),
  hud:      document.getElementById('hud'),
  hint:     document.getElementById('hint'),
  start:    document.getElementById('start'),
  loading:  document.getElementById('loading'),
  controls: document.getElementById('controls'),
  dive:     document.getElementById('dive'),
  mute:     document.getElementById('mute'),
  perf:     document.getElementById('perf'),
};

// Cache the last values so we only touch the DOM when the text actually changes
// — writing textContent every frame invalidates layout for no reason.
let lastDepth = null, lastSpeed = null;

export function setDepth(metres) {
  if (metres === lastDepth) return;
  lastDepth = metres;
  el.depth.textContent = `${metres} m`;
}

export function setSpeed(speed) {
  const s = speed.toFixed(1);
  if (s === lastSpeed) return;
  lastSpeed = s;
  el.speed.textContent = s;
}

export function setOrbs(collected, total) {
  el.orbs.textContent = `${collected} / ${total}`;
}

// ---- PERF READOUT ----------------------------------------------------------
// Off by default, toggled with F3 (or ` if the browser eats F3). The point of
// having it is the one in PERFORMANCE.md §1: every optimisation should be
// accepted or rejected on a number, and the number that matters is ms/frame —
// not fps, which compresses exactly where you need resolution (55 -> 60 fps is
// 1.5 ms, 20 -> 25 fps is 10 ms).
//
// The CPU figure is updateWorld() alone. Read it against the total: if the frame
// is 20 ms and CPU is 2 ms, you are GPU-bound and no amount of JS tuning helps.
let perfOn = false;

export function isPerfVisible() {
  return perfOn;
}

export function setPerf(text) {
  el.perf.textContent = text;
}

export function wirePerfToggle() {
  addEventListener('keydown', (e) => {
    if (e.code !== 'F3' && e.code !== 'Backquote') return;
    e.preventDefault();          // F3 is "find again" in most browsers
    perfOn = !perfOn;
    el.perf.classList.toggle('hidden', !perfOn);
  });
}

export function showControls() {
  el.loading.classList.add('hidden');
  el.controls.classList.remove('hidden');
}

export function showLoadError(err) {
  el.loading.textContent = 'Failed to load models — check the assets/ folder & console.';
  console.error(err);
}

// Wire the "Dive In" button. onDive runs after the overlay is dismissed.
// { once: true } plus the blur are both needed: the button stays in the DOM
// (just faded out) so it can still hold keyboard focus, and a focused button
// treats Space as a native click — without this, diving in then pressing
// Space to swim replays the whole dive sequence, splash included.
export function wireStartScreen(onDive) {
  el.dive.addEventListener('click', () => {
    el.dive.blur();
    el.start.classList.add('gone');
    el.hud.classList.remove('hidden');
    el.hint.classList.remove('hidden');
    onDive();
  }, { once: true });
}

// toggleMute returns the new muted state; we just reflect it in the icon.
export function wireMuteButton(toggleMute) {
  el.mute.addEventListener('click', () => {
    el.mute.textContent = toggleMute() ? '🔇' : '🔊';
  });
}
