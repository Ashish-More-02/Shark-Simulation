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
