// ============================================================
//  HUD / SCREENS  — the only module that touches the DOM.
//  Elements are looked up once here rather than every frame.
// ============================================================

import { MPH, COMBAT } from './config/config.js';

const el = {
  depth:    document.getElementById('depth'),
  hp:       document.getElementById('hp'),
  speed:    document.getElementById('speed'),
  orbs:     document.getElementById('orbs'),
  eaten:    document.getElementById('eaten'),
  points:   document.getElementById('points'),
  size:     document.getElementById('size'),
  track:    document.getElementById('track'),
  hud:      document.getElementById('hud'),
  hint:     document.getElementById('hint'),
  cross:    document.getElementById('crosshair'),
  biteInfo: document.getElementById('biteInfo'),
  biteText: document.getElementById('biteText'),
  biteBar:  document.getElementById('biteBar'),
  health:   document.getElementById('health'),
  damage:   document.getElementById('damage'),
  death:    document.getElementById('death'),
  start:    document.getElementById('start'),
  loading:  document.getElementById('loading'),
  controls: document.getElementById('controls'),
  dive:     document.getElementById('dive'),
  mute:     document.getElementById('mute'),
  perf:     document.getElementById('perf'),
  stamina:  document.getElementById('stamina'),
  editor:   document.getElementById('editor'),
};

// Cache the last values so we only touch the DOM when the text actually changes
// — writing textContent every frame invalidates layout for no reason. That matters
// most for SIZE, which creeps by ~0.004 units per fish and would otherwise rewrite
// its node on every one of the 60 frames it takes to show one decimal place.
let lastDepth = null, lastSpeed = null, lastEaten = null, lastSize = null, lastTrack = null;

export function setDepth(metres) {
  if (metres === lastDepth) return;
  lastDepth = metres;
  el.depth.textContent = `${metres} m`;
}

// One world unit is one metre — the same unit setDepth and setSize already print,
// anchored on the 6.0-unit shark model being a 6 m animal. `speed` arrives in
// units/second, i.e. m/s, so real-world mph is a straight x2.23694: drag pins
// cruise at accel/drag = 12.2 m/s = 27 mph, and boostSpeed clamps sprint at
// 15.2 m/s = 34 mph. Whole mph is both what a speedo shows and coarse enough
// (0.45 m/s a step) that a steady cruise stops rewriting the node every frame.
export function setSpeed(speed) {
  const s = Math.round(speed * MPH);
  if (s === lastSpeed) return;
  lastSpeed = s;
  el.speed.textContent = `${s} mph`;
}

export function setOrbs(collected, total) {
  el.orbs.textContent = `${collected} / ${total}`;
}

export function setEaten(n) {
  if (n === lastEaten) return;
  lastEaten = n;
  el.eaten.textContent = `${n}`;
}

// Points you have left to spend, NOT the lifetime total (upgrades.js draws the
// distinction). This is the row the player checks against a price they saw in the
// menu, so it has to be the number the menu will let them spend — a lifetime figure
// would keep rising after a purchase and read as if nothing had been deducted.
//
// EATEN sits directly above it on purpose: how many animals, and what they were
// worth. The gap between the two is the whole reason bigger fish exist.
let lastPoints = null;

export function setPoints(n) {
  if (n === lastPoints) return;
  lastPoints = n;
  el.points.textContent = `${n}`;
}

// Length nose to tail, in world units — the shark starts at 6.0 and tops out at
// 12.6 against the whale's 21.
export function setSize(length) {
  const s = length.toFixed(1);
  if (s === lastSize) return;
  lastSize = s;
  el.size.textContent = `${s} m`;
}

// ---- NEAREST WILDLIFE ------------------------------------------------------
// "Dolphin ↗ 38 m". `bearing` is the signed horizontal angle from the shark's own
// heading to the animal: 0 is dead ahead, +π/2 is off the right flank, ±π is
// behind you. Eight sectors is plenty — you only need to know which way to turn.
//
// `hostile` appends a ⚠ and reddens the row. With a 35 m leash a hostile whale is
// usually close enough to see, so this is less "where is it" than "is it still
// angry" — and the ten seconds it spends forgetting you are exactly the window where
// it can be out in the fog and still coming.
const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

export function setTrack(name, metres, bearing, hostile = false) {
  const text = name
    ? `${name} ${ARROWS[(((Math.round(bearing / (Math.PI / 4))) % 8) + 8) % 8]} ${metres} m${hostile ? ' ⚠' : ''}`
    : '—';
  if (text === lastTrack) return;
  lastTrack = text;
  el.track.textContent = text;
  el.track.classList.toggle('hostile', !!hostile);
}

// ---- BOOST STAMINA RING ----------------------------------------------------
// Called every frame from world.js with the shark's own state (shark.js owns the
// numbers; this only draws them). `level` is 0..1, `visible` is Shift held,
// `spent` is the bottomed-out lockout, `scale` is the shark's growth — the CSS
// sizes and offsets the ring off it so it keeps station beside a growing animal.
//
// Both writes are quantised. `level` changes every single frame the ring is up,
// but a full 6-second drain only crosses 200 steps, so at 60 fps that drops
// roughly two writes in three — and a step is a third of a degree of arc, under a
// pixel on a 50px ring. `scale` creeps by a rounding error per fish now that growthFull
// is 20,000, so quantising to hundredths makes it one write per many dozens of fish
// instead of one per frame.
let lastStep = -1, lastOn = null, lastSpent = null, lastScale = -1;

export function setStamina(level, visible, spent, scale) {
  if (visible !== lastOn) {
    lastOn = visible;
    el.stamina.classList.toggle('on', visible);
  }
  // Nothing below is worth doing while it's invisible. The ring fades out holding
  // the arc it had at the moment Shift came up, which is what you want to see it
  // do; the next press refreshes it on the same frame the class goes back on, so
  // it never shows a stale value once it's actually readable.
  if (!visible) return;

  if (spent !== lastSpent) {
    lastSpent = spent;
    el.stamina.classList.toggle('spent', spent);
  }
  const s = Math.round(scale * 100);
  if (s !== lastScale) {
    lastScale = s;
    el.stamina.style.setProperty('--s', s / 100);
  }

  const step = Math.round(level * 200);
  if (step === lastStep) return;
  lastStep = step;
  el.stamina.style.setProperty('--p', step / 200);
}

// ---- HEALTH ----------------------------------------------------------------
// Two surfaces for one number, because they answer different questions. The BAR
// floats over the shark's own head and answers "am I about to die" without you
// looking away from the animal that is trying to kill you; it is only up for a
// couple of seconds after your health moves (see style.css and COMBAT.barShowFor).
// The HUD ROW is always there and answers "how much, exactly", which a bar cannot.
//
// `x` and `y` are PIXELS, already projected through the camera by world.js — this
// module stays DOM-only and does no 3D maths, the same division setTrack works on.
// `visible` is the health system's own timer, not a decision made here.
//
// Every write is quantised or gated on a change: the row prints whole hit points,
// the fill steps in 200ths (half a pixel on a 70px bar), and the position is written
// only while the bar is actually up.
let lastHp = -1, lastHpStep = -1, lastBarOn = null, lastLow = null, lastWarn = null, lastHpScale = -1;

export function setHealth(hp, max, scale, x, y, visible) {
  const whole = Math.ceil(hp);
  if (whole !== lastHp) {
    lastHp = whole;
    el.hp.textContent = `${whole} / ${max}`;
  }

  const frac = max > 0 ? hp / max : 0;

  // The vignette is driven off health rather than off the bar, because it is a state
  // and not a notification: at low health it stays up whether or not the bar is
  // showing, so "I am nearly dead" is legible from the middle of the screen even
  // while you are staring at a whale.
  const low = frac <= COMBAT.lowHealth;
  if (low !== lastLow) {
    lastLow = low;
    el.health.classList.toggle('low', low);
    el.damage.classList.toggle('critical', low);
  }
  const warn = !low && frac <= COMBAT.warnHealth;
  if (warn !== lastWarn) {
    lastWarn = warn;
    el.health.classList.toggle('warn', warn);
  }

  if (visible !== lastBarOn) {
    lastBarOn = visible;
    el.health.classList.toggle('on', visible);
  }
  // Nothing below is worth doing while it is invisible — and in particular the
  // POSITION must not be written, or the bar fades out drifting to wherever the
  // shark went after the timer expired.
  if (!visible) return;

  el.health.style.setProperty('--x', `${x.toFixed(1)}px`);
  el.health.style.setProperty('--y', `${y.toFixed(1)}px`);

  const s = Math.round(scale * 100);
  if (s !== lastHpScale) {
    lastHpScale = s;
    el.health.style.setProperty('--s', s / 100);
  }

  const step = Math.round(frac * 200);
  if (step === lastHpStep) return;
  lastHpStep = step;
  el.health.style.setProperty('--p', step / 200);
}

// One hit. A red pulse in from the edges — an animation restarted from JS, so it
// replays on every hit even when they land inside each other.
let dmgTimer = 0;

export function flashDamage() {
  el.damage.classList.remove('hit');
  void el.damage.offsetWidth;        // reflow, or re-adding the class won't replay
  el.damage.classList.add('hit');
  clearTimeout(dmgTimer);
  dmgTimer = setTimeout(() => el.damage.classList.remove('hit'), 520);
}

// ---- DEATH -----------------------------------------------------------------
// Up for COMBAT.deathHold while the shark drifts, then faded by hideDeath() as it
// wakes. It names the killer and where you are going, because those are the only
// two things you want to know, and it does not offer a button: the respawn is
// automatic and a prompt would just be a key to press to be told the same thing.
export function showDeath(killedBy) {
  el.death.innerHTML = killedBy
    ? `<b>Killed by ${killedBy}</b><span>waking in the shallows…</span>`
    : `<b>You died</b><span>waking in the shallows…</span>`;
  el.death.classList.add('show');
}

export function hideDeath() {
  el.death.classList.remove('show');
}

// ---- BITE FEEDBACK ---------------------------------------------------------
// A bite is instant and the target is usually a small fish somewhere off to the
// side, so without these two you genuinely cannot tell a hit from a miss. Both are
// pure CSS animations restarted from JS — no per-frame DOM work.
let flashTimer = 0, infoTimer = 0;

export function flashBite(killed) {
  el.cross.classList.remove('hit', 'kill');
  void el.cross.offsetWidth;          // reflow, or re-adding the class won't replay
  el.cross.classList.add(killed ? 'kill' : 'hit');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.cross.classList.remove('hit', 'kill'), 340);
}

// "Whale 168 / 240" under the crosshair — the only way to know a ten-bite animal
// is actually taking damage rather than shrugging you off, and now also the only
// place you can see that a bigger shark hits harder.
//
// `frac` is the target's remaining health, 0..1, and draws a bar under the text.
// Omitted for a kill: there is nothing left to show the health of, and an empty
// bar on the frame something died reads as a bug.
export function showBiteInfo(text, frac = null) {
  el.biteText.textContent = text;
  el.biteBar.classList.toggle('hidden', frac === null);
  if (frac !== null) {
    el.biteBar.firstElementChild.style.width = `${Math.max(0, Math.min(frac, 1)) * 100}%`;
  }
  el.biteInfo.classList.add('show');
  clearTimeout(infoTimer);
  infoTimer = setTimeout(() => el.biteInfo.classList.remove('show'), 1400);
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

// ---- PLACEMENT EDITOR READOUT (F4) -----------------------------------------
// editor.js owns the state and composes the text; this only puts it on screen,
// so hud.js stays the one module that touches the DOM.
export function setEditorPanel(html) {
  el.editor.innerHTML = html;
}

export function showEditorPanel(visible) {
  el.editor.classList.toggle('hidden', !visible);
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
    el.cross.classList.remove('hidden');
    el.stamina.classList.remove('hidden');
    // #health is NOT unhidden here: it has no `hidden` class to drop. It is opacity
    // 0 until its own timer raises it, and that timer cannot have started before the
    // player has been in the water.
    onDive();
  }, { once: true });
}

// toggleMute returns the new muted state; we just reflect it in the icon.
export function wireMuteButton(toggleMute) {
  el.mute.addEventListener('click', () => {
    el.mute.blur();          // ...or Space (rise) lands on the focused button
    el.mute.textContent = toggleMute() ? '🔇' : '🔊';
  });
}
