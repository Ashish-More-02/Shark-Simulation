// ============================================================
//  DEEP OCEAN SHARK — landing page behaviour.   pages/landing/landing.js
//
//  Four jobs:
//
//    1. wireDescent()   the depth readout on the ten-level section
//    2. wireStrip()     click-to-play and the arrows on the gameplay strip
//    3. wireLightbox()  the <dialog> that opens a still full-size
//    4. wireReveals()   IntersectionObserver fade-ups
//
//  This file used to own a fifth and much bigger job: boot(), which hid the
//  marketing markup, revealed a #game wrapper in the same document and
//  dynamically imported main.js. It also carried a teardown registry so every
//  observer and rAF loop in here could be shut down before the WebGL context came
//  up. All of it is gone — "Dive in" is an ordinary link to pages/game/game.html
//  now, and a navigation tears the page down for free. Nothing on this page
//  competes with a render loop any more.
//
//  No dependencies, no CDN, no framework. Every rAF loop is gated on an
//  IntersectionObserver, so a section that is off screen costs nothing.
// ============================================================

const doc = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================================
//  1. THE DESCENT READOUT
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
}

// ============================================================
//  2. THE GAMEPLAY FILMSTRIP
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
//  3. THE LIGHTBOX
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

}

// ============================================================
//  4. SCROLL REVEALS
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
}

// ============================================================
//  BOOTSTRAP
// ============================================================
wireDescent();
wireStrip();
wireReveals();
