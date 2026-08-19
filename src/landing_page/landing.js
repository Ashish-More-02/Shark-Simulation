// ============================================================
//  DEEP OCEAN SHARK — landing page behaviour.
//
//  Five jobs, in order of how much they matter:
//
//    1. boot()          hand the page over to the real game, on click, once
//    2. wireDescent()   the depth readout on the ten-level section
//    3. wireStrip()     click-to-play and the arrows on the gameplay strip
//    4. wireLightbox()  the <dialog> that opens a still full-size
//    5. wireReveals()   IntersectionObserver fade-ups
//
//  No dependencies, no CDN, no framework. Everything that moves is rAF-driven
//  and every one of them stops when its section leaves the viewport — the page
//  is in front of a WebGL game and must not be the thing that costs the frame.
// ============================================================

const doc = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================================
//  1. THE HANDOFF
//
//  The whole point of the split: Three.js and ~30 .glb files are not fetched
//  until someone actually asks to play. main.js is imported dynamically, ONCE,
//  and after that its own start screen / "Dive In" flow takes over untouched.
// ============================================================
// Teardown registry. Every observer and rAF loop below pushes its own stopper
// here, so the handoff can shut the whole marketing page down with one call
// rather than each section knowing about the game.
const stoppers = [];
function stopAll() { while (stoppers.length) stoppers.pop()(); }

const landing = document.getElementById('landing');
const game = document.getElementById('game');
let booting = false;

function boot() {
  if (booting) return;
  booting = true;

  // Reveal the game BEFORE importing. core.js reads window.innerWidth for the
  // renderer size and grabs #scene at module scope, so the canvas has to be in
  // layout by the time that module body runs — a display: none wrapper would
  // hand it a zero-sized viewport.
  landing.hidden = true;
  game.hidden = false;
  doc.classList.add('playing');       // gives style.css its overflow: hidden back
  doc.classList.remove('lp-js');

  // Stop everything the marketing page was running.
  stopAll();
  window.scrollTo(0, 0);

  import('../../main.js').catch((err) => {
    console.error('[landing] the game failed to load', err);
    const loading = document.getElementById('loading');
    if (loading) loading.textContent = 'The ocean failed to load — check the console.';
  });
}

for (const btn of document.querySelectorAll('[data-play]')) {
  btn.addEventListener('click', boot);
}

// The escape hatch. A reload is the honest way out: it drops the WebGL context,
// the audio graph and the pointer lock in one go, with nothing to un-wire by
// hand. Dropping the hash matters — #play would boot us straight back in.
document.getElementById('lp-exit')?.addEventListener('click', () => {
  location.replace(location.pathname + location.search);
});

// Deep link: /#play boots on arrival, so a "play now" link can skip the page.
if (location.hash === '#play') boot();

// ============================================================
//  2. THE DESCENT READOUT
//
//  Ten rows, each carrying the depth and pressure at the BOTTOM of its band in
//  data attributes. The gauge reads whichever row is crossing the anchor line
//  and interpolates between that row's floor and the one above it, so the number
//  climbs continuously as you read down rather than jumping ten times.
//
//  The darkening is not here — it is a single gradient on the section in
//  landing.css, so it is right with JS off, on a slow scroll and on a fast one.
// ============================================================
function wireDescent() {
  const section = document.querySelector('[data-descent]');
  const list = section?.querySelector('[data-levels]');
  if (!section || !list) return;

  const valEl = section.querySelector('[data-depth-val]');
  const barEl = section.querySelector('[data-depth-bar]');
  const pressEl = section.querySelector('[data-depth-press]');
  const rows = [...list.children].map((li) => ({
    el: li,
    depth: Number(li.dataset.depth),
    press: Number(li.dataset.press),
  }));
  const floor = rows[rows.length - 1].depth;

  let raf = 0;
  let shown = 0;

  function sample() {
    // The anchor is the gauge's own line, a little below the fixed nav.
    const anchor = 110;
    let depth = 0;
    let press = 1;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].el.getBoundingClientRect();
      if (r.bottom < anchor) continue;            // already read past this band
      if (r.top > anchor) break;                  // not there yet
      const t = Math.min(1, Math.max(0, (anchor - r.top) / r.height));
      const from = i === 0 ? 0 : rows[i - 1].depth;
      const fromP = i === 0 ? 1 : rows[i - 1].press;
      depth = from + (rows[i].depth - from) * t;
      press = fromP + (rows[i].press - fromP) * t;
      return { depth, press };
    }

    // Above the first row, or below the last: clamp to the ends.
    const first = rows[0].el.getBoundingClientRect();
    if (first.top > anchor) return { depth: 0, press: 1 };
    return { depth: floor, press: rows[rows.length - 1].press };
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    const { depth, press } = sample();
    // A little smoothing so the digits settle instead of flickering on a flick.
    // Under reduced motion, take the value straight.
    shown = reduceMotion ? depth : shown + (depth - shown) * 0.2;

    if (valEl) valEl.textContent = Math.round(shown).toLocaleString('en-US');
    if (barEl) barEl.style.width = ((shown / floor) * 100).toFixed(2) + '%';
    if (pressEl) pressEl.textContent = Math.round(press).toLocaleString('en-US') + ' bar';
  }

  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !raf) raf = requestAnimationFrame(tick);
    else if (!entry.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
  }, { rootMargin: '20% 0px' });

  io.observe(section);
  stoppers.push(() => { io.disconnect(); if (raf) cancelAnimationFrame(raf); });
}

// ============================================================
//  3. THE GAMEPLAY FILMSTRIP
//
//  Two jobs, and deliberately only two — the scrolling itself is native, because
//  a browser's own scroller beats a hand-rolled one on inertia, snapping,
//  trackpads, keyboards and accessibility all at once.
//
//    - click to play. The clip carries preload="none", so its 5 MB is not
//      requested until this button is pressed. The button then REMOVES itself,
//      which is what uncovers the video's own native controls underneath it.
//    - the two arrows under the track, which scroll by one item. The item width
//      is read from the DOM rather than hardcoded, because every shot in the
//      strip is a different width by design.
// ============================================================
function wireStrip() {
  const strip = document.querySelector('[data-strip]');
  if (!strip) return;

  const video = strip.querySelector('[data-strip-video]');
  const play = strip.querySelector('[data-strip-play]');

  if (video && play) {
    // Hang the teardown off the VIDEO, not the button. `controls` is on from the
    // start and the video sits before the overlay in the tab order, so a keyboard
    // user can reach the native play control underneath and start playback without
    // the button ever being clicked — which would leave the clip running behind an
    // opaque overlay.
    video.addEventListener('play', () => play.remove(), { once: true });

    play.addEventListener('click', () => {
      // If play() rejects (a codec this browser will not touch) the `play` event
      // never fires, so uncover the native controls here and let them report it —
      // a dead button over a poster is the worse failure.
      video.play().catch(() => play.remove());
    });

    // Scrolling the clip out of the strip should not leave footage decoding off
    // screen. root: strip, because the question is whether it has left the
    // TRACK's view, not the window's.
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && !video.paused) video.pause();
    }, { root: strip, threshold: 0.2 });
    io.observe(video);
    stoppers.push(() => { io.disconnect(); video.pause(); });
  }

  // One item's worth of scroll, measured live: the shots are all different
  // widths by design, so "next" is the gap plus whichever card is first.
  function step() {
    const first = strip.querySelector('.lp-shot');
    const gap = parseFloat(getComputedStyle(strip).columnGap) || 14;
    return (first ? first.getBoundingClientRect().width : strip.clientWidth * 0.8) + gap;
  }

  const section = strip.closest('section');
  section?.querySelector('[data-strip-prev]')
    ?.addEventListener('click', () => strip.scrollBy({ left: -step(), behavior: 'smooth' }));
  section?.querySelector('[data-strip-next]')
    ?.addEventListener('click', () => strip.scrollBy({ left: step(), behavior: 'smooth' }));

  wireLightbox(strip);
}

// ============================================================
//  4. THE LIGHTBOX
//
//  Click a still in the strip and it opens full-size, centred, with arrows to
//  cycle. A native <dialog> + showModal() rather than a div overlay, which buys
//  three things outright instead of reimplementing them:
//
//    - the TOP LAYER, so it paints over the fixed nav pill and the grain without
//      a single z-index being chosen
//    - a focus trap, and focus restored to whatever opened it on close
//    - Esc, for free
//
//  The gallery is read out of the DOM, so adding a figure to the strip adds it
//  here too — the only contract is `data-shot-open` on the button around the img.
//  The clip is excluded by having no such button: it has its own player.
// ============================================================
function wireLightbox(strip) {
  const box = document.querySelector('[data-lightbox]');
  const openers = [...strip.querySelectorAll('[data-shot-open]')];

  // No <dialog> support, or nothing to show: leave the buttons inert rather than
  // half-wiring a viewer that cannot close itself.
  if (!box || typeof box.showModal !== 'function' || !openers.length) {
    for (const btn of openers) btn.disabled = true;
    return;
  }

  const imgEl = box.querySelector('[data-lightbox-img]');
  const capEl = box.querySelector('[data-lightbox-cap]');
  const atEl = box.querySelector('[data-lightbox-i]');
  const ofEl = box.querySelector('[data-lightbox-n]');
  if (!imgEl) return;

  if (ofEl) ofEl.textContent = String(openers.length);

  let at = 0;
  let opener = null;   // the thumbnail that opened it, for focus restore

  function show(i) {
    at = (i + openers.length) % openers.length;
    const thumb = openers[at].querySelector('img');
    const cap = openers[at].closest('figure')?.querySelector('figcaption');

    // Carry the intrinsic size across as ATTRIBUTES, so swapping a 930x528 shot
    // for a 1472x920 one does not reflow the figure before the new file decodes.
    // Not `imgEl.width = ...`: that IDL setter coerces a missing value to 0, and
    // width="0" is a broken aspect ratio rather than an absent one.
    for (const dim of ['width', 'height']) {
      const v = thumb.getAttribute(dim);
      if (v) imgEl.setAttribute(dim, v);
      else imgEl.removeAttribute(dim);
    }
    imgEl.src = thumb.src;
    imgEl.alt = thumb.alt;

    // Clone the caption's nodes rather than copying innerHTML — same markup, and
    // the <b> lead-in survives without going through a string.
    if (capEl) capEl.replaceChildren(...(cap ? [...cap.cloneNode(true).childNodes] : []));
    if (atEl) atEl.textContent = String(at + 1);
  }

  openers.forEach((btn, i) => btn.addEventListener('click', () => {
    opener = btn;
    show(i);
    box.showModal();
    // The page behind must not scroll under the viewer. `scrollbar-gutter: stable`
    // in landing.css is what stops that costing a layout shift.
    doc.classList.add('lp-zoom');
  }));

  box.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => show(at - 1));
  box.querySelector('[data-lightbox-next]')?.addEventListener('click', () => show(at + 1));
  box.querySelector('[data-lightbox-close]')?.addEventListener('click', () => box.close());

  // Left/right cycle. Esc is the dialog's own, and Tab is trapped for us.
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    show(e.key === 'ArrowRight' ? at + 1 : at - 1);
  });

  // Click-outside-to-close. A modal dialog's ::backdrop is not a child element,
  // so a click on the empty space around the figure lands on the dialog itself —
  // which is exactly the test, provided the dialog has no padding of its own that
  // the figure does not fill.
  box.addEventListener('click', (e) => { if (e.target === box) box.close(); });

  // One place to undo the open, whichever way it closed — Esc, the X, or the
  // backdrop all end here.
  box.addEventListener('close', () => {
    doc.classList.remove('lp-zoom');
    opener?.focus();
    opener = null;
  });

  stoppers.push(() => {
    doc.classList.remove('lp-zoom');
    if (box.open) box.close();
  });
}

// ============================================================
//  5. SCROLL REVEALS
//  One observer, unobserving as it goes — a reveal fires once and is done.
// ============================================================
function wireReveals() {
  const targets = document.querySelectorAll('.lp-reveal');
  if (reduceMotion) {
    for (const el of targets) el.classList.add('is-in');
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  for (const el of targets) io.observe(el);
  stoppers.push(() => io.disconnect());
}

// ============================================================
//  BOOTSTRAP
//  Skipped entirely if #play already sent us into the game.
// ============================================================
if (!booting) {
  wireDescent();
  wireStrip();
  wireReveals();
}
