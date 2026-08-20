// ============================================================
//  DEEP OCEAN SHARK — landing page behaviour.   pages/landing/landing.js
//
//  Nine jobs:
//
//    1. wireDescent()    the depth readout on the ten-level section
//    2. wireStrip()      click-to-play and the arrows on the gameplay strip
//    3. wireLightbox()   the <dialog> that opens a still full-size
//    4. wireReveals()    IntersectionObserver fade-ups
//    5. wireHeroHud()    the ticking readouts on the hero's dive computer
//    6. wireHeroVideo()  the backdrop's fallbacks, pause rules and its one control
//    7. wireCharacters() the cast rail — one tablist, one panel
//    8. wireNavGlide()   the glass pill that follows the cursor along the nav
//    9. wireNavMenu()    the same nav as a sheet, on a phone
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
  let onScreen = false;

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

  // The loop SLEEPS as soon as the readout has caught up with the page, and a
  // scroll is what wakes it. It used to run for as long as the section was
  // anywhere near the viewport, which meant a reader who stopped to look at the
  // chart was paying for ten getBoundingClientRect() calls — ten forced layouts —
  // plus three DOM writes, sixty or a hundred and twenty times a second, forever,
  // to recompute a number that was not changing.
  //
  // The smoothing below is why it cannot simply run on the scroll event: the
  // digits ease toward the target over several frames after the scroll has
  // stopped. So the exit test is "has the eased value arrived", not "has the
  // scroll ended" — a few frames of tail, then silence.
  function tick() {
    raf = 0;
    const { depth, press } = sample();
    // A little smoothing so the digits settle instead of flickering on a flick.
    // Under reduced motion, take the value straight.
    shown = reduceMotion ? depth : shown + (depth - shown) * 0.2;

    if (valEl) valEl.textContent = Math.round(shown).toLocaleString('en-US');
    if (barEl) barEl.style.width = ((shown / floor) * 100).toFixed(2) + '%';
    if (pressEl) pressEl.textContent = Math.round(press).toLocaleString('en-US') + ' bar';

    // Half a metre: below that the rounded readout cannot change and the bar
    // moves by less than a hundredth of a percent.
    if (Math.abs(depth - shown) > 0.5) raf = requestAnimationFrame(tick);
  }

  function wake() {
    if (onScreen && !raf) raf = requestAnimationFrame(tick);
  }

  addEventListener('scroll', wake, { passive: true });
  // A resize moves every row under the anchor line without a scroll event.
  addEventListener('resize', wake);

  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) wake();
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
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
//  5. THE HERO DIVE COMPUTER
//
//  A one-shot boot sequence: the four readouts sweep from surface values to
//  station-keeping depth over a couple of seconds, then hold with a slow drift
//  so the panel reads as live instead of as a screenshot of an instrument.
//
//  The numbers are real for 38 m of clear tropical water — pressure is
//  1 + depth/10 atm exactly, and the others are interpolated between plausible
//  surface and 38 m values. Nothing here is wired to the game; it is set
//  dressing, which is why the whole panel is aria-hidden in the markup.
//
//  Cost control, because this is the only rAF loop above the fold:
//    - the loop is gated on an IntersectionObserver and does not run while the
//      hero is off screen
//    - writes are throttled to ~12 per second. Four text writes at 60fps would
//      be four style recalcs per frame for numbers nobody can read that fast
//    - under reduced motion the final values are written once and no loop
//      starts at all
// ============================================================
function wireHeroHud() {
  const panel = document.querySelector('[data-hud]');
  if (!panel) return;

  const out = {};
  for (const el of panel.querySelectorAll('[data-hud]')) out[el.dataset.hud] = el;
  if (!out.depth) return;

  // [surface, at 38 m, decimal places]
  const bands = {
    depth: [0, 38, 0],
    temp: [22.0, 18.4, 1],
    press: [1.0, 4.8, 1],
    light: [100, 21, 0],
  };

  function write(t, drift) {
    for (const key in bands) {
      const [from, to, dp] = bands[key];
      const v = from + (to - from) * t + (drift || 0) * (to - from) * 0.012;
      out[key].textContent = v.toFixed(dp);
    }
  }

  if (reduceMotion) { write(1, 0); return; }

  const BOOT = 2200;      // ms of descent
  const STEP = 1000 / 12; // ms between writes
  let raf = 0;
  let start = 0;
  let last = 0;

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!start) start = now;
    if (now - last < STEP) return;
    last = now;

    const elapsed = now - start;
    if (elapsed < BOOT) {
      // easeOutCubic: the sweep decelerates into the target rather than
      // stopping dead on it.
      const p = elapsed / BOOT;
      write(1 - Math.pow(1 - p, 3), 0);
    } else {
      // Held depth, breathing. Two sines at incommensurate periods so the drift
      // never settles into a visible loop.
      const s = elapsed / 1000;
      write(1, Math.sin(s * 0.7) + Math.sin(s * 0.23) * 0.6);
    }
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && !raf) {
        raf = requestAnimationFrame(tick);
      } else if (!entry.isIntersecting && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
  }, { threshold: 0 });
  io.observe(panel);
}

// ============================================================
//  6. THE HERO BACKDROP
//
//  The clip autoplays from the markup — muted, looped, inline, no controls — so
//  it is running before this file is parsed and it keeps running with JS off.
//  Everything here is the three cases the attributes cannot cover:
//
//    - REDUCED MOTION. A full-bleed looping video is the exact thing the setting
//      asks not to be given. landing.css hides the element and paints the poster
//      as a background instead; this pauses it too, because a display: none video
//      that is still decoding is still spending the battery.
//    - OFF SCREEN. Nothing below the fold should be decoding 1080p behind it.
//      The hero is one screen tall and the visitor leaves it almost immediately,
//      so this is the difference between one decode and a whole session of them.
//    - REFUSED. Some browsers still reject a programmatic-looking autoplay, and a
//      few will not touch the codec. Either way the poster is already on screen
//      underneath, so the failure state is the still hero the page had before —
//      which is why this catch is empty rather than apologetic.
// ============================================================
function wireHeroVideo() {
  const video = document.querySelector('[data-hero-video]');
  if (!video) return;

  const btn = document.querySelector('[data-hero-toggle]');
  const btnLabel = document.querySelector('[data-hero-toggle-label]');

  // Taking the clip out of the DOM entirely, rather than pausing it or trusting
  // the stylesheet's `display: none`. A hidden <video> with autoplay and loop is
  // still an element the browser may buffer and decode, and on the devices this
  // matters for that is the whole cost being avoided. The two cross-fading stills
  // in landing.css take over — they are declared inside the same media query, so
  // this is one backdrop or the other, never both.
  let dead = false;
  function killVideo() {
    if (dead) return;
    dead = true;
    video.pause();
    // removeAttribute, not just pause(): `loop` + `autoplay` will happily restart
    // playback on the next readyState change and undo the pause.
    video.removeAttribute('autoplay');
    video.removeAttribute('loop');
    video.remove();
    // Leaving a live control wired to an element that is gone is how a keyboard
    // user finds a button that appears to do nothing.
    btn?.remove();
  }

  // Same pair of triggers as the stylesheet's mobile backdrop and as .lp-play:
  // a narrow window, or a device whose primary pointer cannot hover.
  const stills = matchMedia('(max-width: 820px), (hover: none) and (pointer: coarse)');
  if (stills.matches) { killVideo(); return; }
  // A desktop window dragged narrow crosses into the stills. One-way on purpose:
  // dragging back does not re-create the element, because a visitor who has been
  // on the still backdrop for a while has no reason to be handed a video start.
  stills.addEventListener?.('change', (e) => { if (e.matches) killVideo(); });

  if (reduceMotion) {
    video.pause();
    video.removeAttribute('autoplay');
    video.removeAttribute('loop');
    btn?.remove();
    return;
  }

  // The visitor's own decision, and it outranks every automatic resume below. The
  // three rules under it — off screen, backgrounded tab, first play — are about
  // not wasting a decode; none of them is a reason to override someone who asked
  // for the picture to stop moving.
  let userPaused = false;

  // play() returns a promise on every engine that matters. An unhandled rejection
  // here is a console error on a page whose hero still looks completely fine.
  const resume = () => { if (!userPaused && !dead) video.play?.().catch(() => {}); };

  resume();

  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) resume();
    else video.pause();
  }, { threshold: 0 });
  io.observe(video);

  // A backgrounded tab already throttles rAF, but it does not necessarily stop a
  // video decode. This does.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else if (video.getBoundingClientRect().bottom > 0) resume();
  });

  // ---- THE CONTROL ----
  //
  //  The button does not hold the state; the VIDEO does. Clicking sets the intent
  //  and asks the element, and the element's own play/pause events are what repaint
  //  the button — so a refused autoplay, a scroll-away pause, or a backgrounded tab
  //  all show up on the pill instead of leaving it claiming the clip is running.
  if (!btn) return;

  function paint() {
    const playing = !video.paused;
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? 'Pause the background video' : 'Play the background video');
    if (btnLabel) btnLabel.textContent = playing ? 'Pause' : 'Play';
  }

  btn.addEventListener('click', () => {
    userPaused = !video.paused;
    if (userPaused) video.pause();
    else video.play?.().catch(paint);
  });

  video.addEventListener('play', paint);
  video.addEventListener('pause', paint);
  paint();
}

// ============================================================
//  8. THE NAV'S SLIDING HIGHLIGHT
//
//  One glass pill for the whole link group, moved to whichever link the pointer
//  or focus is on. Measuring live rather than caching the offsets: the nav is a
//  fluid-width pill with clamped gaps, so every window resize moves all five
//  links, and a getBoundingClientRect on hover is cheaper than a resize observer
//  keeping five cached rects honest.
//
//  The one subtlety is the COLD start. Coming from nothing the pill would slide
//  in from x=0 at width 0, which reads as a bug rather than as a transition, so
//  the first move is made with only the opacity transition live — the pill fades
//  in already at the right size and place, and every move after it travels.
// ============================================================
function wireNavGlide() {
  const nav = document.querySelector('[data-nav-links]');
  const glide = nav?.querySelector('[data-nav-glide]');
  if (!nav || !glide) return;

  const links = [...nav.querySelectorAll('a')];
  if (!links.length) return;

  function moveTo(link) {
    const cold = !nav.classList.contains('is-gliding');
    // Only opacity animates on the way in. Restored below, after a forced reflow
    // so the new geometry is committed before the transitions come back.
    if (cold) glide.style.transitionProperty = 'opacity';

    const a = link.getBoundingClientRect();
    const b = nav.getBoundingClientRect();
    glide.style.setProperty('--gw', `${a.width}px`);
    glide.style.setProperty('--gh', `${a.height}px`);
    glide.style.setProperty('--gx', `${a.left - b.left}px`);
    nav.classList.add('is-gliding');

    if (cold) {
      void glide.offsetWidth;
      glide.style.transitionProperty = '';
    }
  }

  const clear = () => nav.classList.remove('is-gliding');

  for (const link of links) {
    link.addEventListener('pointerenter', () => moveTo(link));
    // Keyboard gets the same highlight. :focus-visible would be the better test,
    // but it is not exposed to a focus event — and a pill following a mouse click
    // that has just landed on the link is harmless.
    link.addEventListener('focus', () => moveTo(link));
  }

  nav.addEventListener('pointerleave', clear);
  nav.addEventListener('focusout', (e) => {
    if (!nav.contains(e.relatedTarget)) clear();
  });
}

// ============================================================
//  9. THE MOBILE MENU
//
//  Below 780px the same <nav> that is a row of links inside the pill becomes a
//  glass sheet under it, and this opens and closes it. One element, one class,
//  one attribute — .lp-nav.is-open drives every bit of the CSS, and aria-expanded
//  on the button is the same state announced.
//
//  Four ways out, because a menu that can only be closed by the button that
//  opened it is a trap on a phone: the button, any link in it (they are all
//  in-page jumps, and a sheet left standing over the section you just asked for
//  is the most common way this gets built wrong), Esc, and a tap anywhere else on
//  the page.
// ============================================================
function wireNavMenu() {
  const header = document.querySelector('.lp-nav');
  const btn = header?.querySelector('[data-nav-toggle]');
  const menu = header?.querySelector('[data-nav-links]');
  if (!header || !btn || !menu) return;

  const isOpen = () => header.classList.contains('is-open');

  function set(open) {
    header.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close the menu' : 'Open the menu');
  }

  btn.addEventListener('click', () => set(!isOpen()));

  // Any link in the sheet is an in-page jump; the sheet has to be gone before the
  // scroll lands. delegated rather than per-link so a sixth link needs no JS.
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    set(false);
    // Focus goes back to the control that opened it, or it is left stranded
    // inside a sheet that is no longer on screen.
    btn.focus();
  });

  // Tap-outside. The button is inside the header, so this cannot fire on the
  // same click that opened the menu.
  document.addEventListener('click', (e) => {
    if (isOpen() && !header.contains(e.target)) set(false);
  });

  // Crossing back above the breakpoint would otherwise leave .is-open set on what
  // is now a plain row of links — invisible, but the button's aria-expanded would
  // be lying and the next tap on it would do nothing.
  matchMedia('(min-width: 781px)').addEventListener?.('change', (e) => {
    if (e.matches) set(false);
  });
}

// ============================================================
//  7. THE CAST RAIL
//
//  A tablist, not a carousel: nine <button role="tab"> thumbnails, one
//  role="tabpanel" holding the plate and the dossier together. There is no timer,
//  no cloned slide and no transform track, which is most of why this is short.
//
//  The cast is declared entirely in the markup — every field the panel shows is a
//  data attribute on the tab, and the tab's own <img> is the source for the big
//  plate. Adding a tenth creature is one <button> and no JS, and the rail cannot
//  fall out of sync with the panel because there is only one copy of the data.
//
//  Two details worth naming:
//
//    - Selection is stored in aria-selected, not in a class. The attribute the
//      screen reader reads is the same one landing.css paints, so the visible
//      state and the announced state cannot drift.
//    - Roving tabindex. Exactly one tab is tabbable at a time and the arrows move
//      between them, which is what a tablist is expected to do — Tab should step
//      PAST the rail into the panel, not through nine buttons.
// ============================================================
function wireCharacters() {
  const rail = document.querySelector('[data-cast-thumbs]');
  const panel = document.getElementById('cast-panel');
  if (!rail || !panel) return;

  const tabs = [...rail.querySelectorAll('[data-cast-tab]')];
  if (!tabs.length) return;

  const frame = panel.querySelector('.lp-cast-frame');
  const imgEl = panel.querySelector('[data-cast-img]');
  const section = panel.closest('section');

  // One lookup table instead of nine querySelector calls per change. The key is
  // the data attribute's name and the value is the element that displays it, so
  // adding a field to the dossier is one entry here and one element in the HTML.
  const out = {};
  for (const key of ['name', 'role', 'tag', 'band', 'standing', 'note', 'cap']) {
    out[key] = section?.querySelector(`[data-cast-${key}]`) || null;
  }
  const atEl = section?.querySelector('[data-cast-i]');
  const ofEl = section?.querySelector('[data-cast-n]');

  const pad = (n) => String(n).padStart(2, '0');
  if (ofEl) ofEl.textContent = pad(tabs.length);

  let at = -1;

  function select(i, { focus = false } = {}) {
    const next = (i + tabs.length) % tabs.length;
    if (next === at) return;
    at = next;

    const tab = tabs[at];
    const thumb = tab.querySelector('img');

    tabs.forEach((t, n) => {
      const live = n === at;
      t.setAttribute('aria-selected', live ? 'true' : 'false');
      // Roving tabindex: the live tab is the rail's single tab stop.
      t.tabIndex = live ? 0 : -1;
    });

    if (imgEl && thumb) {
      // Carry the intrinsic size across as ATTRIBUTES so swapping a 2254x1014
      // render for a 1776x1162 one does not reflow the plate before the new file
      // decodes. Same reasoning as the lightbox above, and the same trap: the IDL
      // setter coerces a missing value to 0, and width="0" is a broken aspect
      // ratio rather than an absent one.
      for (const dim of ['width', 'height']) {
        const v = thumb.getAttribute(dim);
        if (v) imgEl.setAttribute(dim, v);
        else imgEl.removeAttribute(dim);
      }
      imgEl.src = thumb.currentSrc || thumb.src;
      // The plate is decorative — the dossier beside it names and describes the
      // creature in text, and the thumbnail in the rail carries the real alt. A
      // second copy of that sentence read out on every arrow press is noise.
      imgEl.alt = '';
    }

    for (const key in out) {
      if (out[key] && tab.dataset[key] != null) out[key].textContent = tab.dataset[key];
    }
    // The caption under the plate is the rail position, not a sentence.
    if (out.cap) out.cap.textContent = `Specimen ${pad(at + 1)} of ${pad(tabs.length)}`;
    // Drives the three pill colours in landing.css. Lower-cased so the markup can
    // spell it however it reads best.
    if (out.tag) out.tag.dataset.temper = (tab.dataset.tag || '').toLowerCase();
    if (atEl) atEl.textContent = pad(at + 1);

    revealTab(tab);
    if (focus) tab.focus();
  }

  // Keep the live thumbnail inside the rail's own view, and NEVER touch the page's
  // scroll doing it. This was `tab.scrollIntoView({ block: 'nearest' })`, which is
  // fine on a click but wrong under the auto-advance below: 'nearest' still scrolls
  // the block axis when the rail is only partly in view, so every tenth second
  // would have quietly dragged the page under the reader. Measuring and scrolling
  // the rail by hand is the only version that cannot do that.
  function revealTab(tab) {
    const railBox = rail.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    const edge = 16;   // breathing room so the live thumb never sits flush to a rim
    let delta = 0;

    if (tabBox.left < railBox.left + edge) delta = tabBox.left - railBox.left - edge;
    else if (tabBox.right > railBox.right - edge) delta = tabBox.right - railBox.right + edge;
    if (delta) rail.scrollBy({ left: delta, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  // The swap animation is a class the CSS owns: drop the plate out, change the
  // src, let it come back. Guarded on reduceMotion because a fade is still motion,
  // and skipped entirely if the image is not there.
  //
  // Every path through here re-arms the clock, which is what makes the ten seconds
  // mean "ten seconds since the last change" rather than "ten seconds since the
  // last tick" — press next at the nine-second mark and you get a full ten before
  // the rail moves again, not one. When the visitor has taken over, armClock() is
  // already a no-op and this costs nothing.
  function change(i, opts) {
    if (reduceMotion || !frame || !imgEl) {
      select(i, opts);
    } else {
      frame.classList.add('is-swapping');
      select(i, opts);
      // One frame is enough — the class only has to survive long enough for the src
      // assignment to land, and the CSS transition does the rest on the way back.
      requestAnimationFrame(() => requestAnimationFrame(() => frame.classList.remove('is-swapping')));
    }
    armClock();
  }

  // ---- THE CLOCK ----
  //
  //  The rail advances on its own every ten seconds, and the progress bar under the
  //  counter IS the timer rather than a picture of one: it is a single Web
  //  Animation, and the rail advances on that animation's `finish` event. One clock
  //  means the bar cannot drift out of step with the thing it is describing, and
  //  pause/resume comes free and exact — a setInterval plus a CSS animation would
  //  need the elapsed time tracked by hand in two places to survive being paused.
  //
  //  Four things stop it, and the distinction between them matters:
  //
  //    stopped   PERMANENT. The visitor picked a character, so the rail is theirs
  //              now and it never moves on its own again. This is also the
  //              pause mechanism WCAG 2.2.2 asks for on anything that
  //              auto-updates for more than five seconds: every control that
  //              reaches it — nine thumbnails, two arrows, the arrow keys — is
  //              keyboard-reachable, and the bar disappears to confirm it.
  //    onScreen  the section is not in view, so nothing is spent on it
  //    held      the cursor is on the rail or in the dossier, or focus is anywhere
  //              in the section. Reading is not the same as not caring.
  //    hidden    the tab is in the background
  //
  //  Under reduced motion it never starts at all: a ten-second carousel is exactly
  //  the auto-updating content that setting is asking not to be given.
  const DWELL = 10000;
  const meter = section?.querySelector('[data-cast-meter]') || null;
  const bar = section?.querySelector('[data-cast-clock]') || null;

  let clock = null;
  let stopped = reduceMotion;
  let onScreen = false;
  let held = false;

  // The bar is the clock's host when it exists. When it does not — someone pruned
  // the markup — the animation runs on the panel with a keyframe that changes
  // nothing, so the timing still works and there is simply no indicator.
  const host = bar || panel;
  const frames = bar
    ? [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }]
    : [{ opacity: 1 }, { opacity: 1 }];

  function sync() {
    if (!clock) return;
    if (stopped || !onScreen || held || document.hidden) clock.pause();
    else clock.play();
  }

  function armClock() {
    clock?.cancel();
    clock = null;
    if (stopped || tabs.length < 2 || typeof host.animate !== 'function') return;

    clock = host.animate(frames, { duration: DWELL, easing: 'linear', fill: 'forwards' });
    // Advancing from `finish` re-enters change(), which re-arms — so the loop is
    // the animation's own lifecycle and there is no interval to leak.
    clock.onfinish = () => change(at + 1);
    sync();
  }

  // Hand the rail over for good. Called from every explicit selection, never from
  // hover or focus — those only pause.
  function surrender() {
    if (stopped) return;
    stopped = true;
    clock?.cancel();
    clock = null;
    meter?.classList.add('is-off');
  }

  function hold(v) { held = v; sync(); }

  tabs.forEach((tab, i) => tab.addEventListener('click', () => { surrender(); change(i); }));

  // The keyboard contract for a tablist: arrows move and select, Home and End go
  // to the ends. Left/Right and Up/Down both, because the rail is visually
  // horizontal but wraps to a scroller and either gesture is a fair guess.
  rail.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); surrender(); change(at + step, { focus: true }); return; }
    if (e.key === 'Home') { e.preventDefault(); surrender(); change(0, { focus: true }); }
    if (e.key === 'End') { e.preventDefault(); surrender(); change(tabs.length - 1, { focus: true }); }
  });

  section?.querySelector('[data-cast-prev]')?.addEventListener('click', () => { surrender(); change(at - 1); });
  section?.querySelector('[data-cast-next]')?.addEventListener('click', () => { surrender(); change(at + 1); });

  // Hover-pause is scoped to the rail and the dossier rather than the whole
  // section, and that is a deliberate limit: the section is most of a screen tall,
  // so pausing on the whole thing would mean a cursor resting anywhere in the
  // viewport froze the rail and the feature looked broken. On the thumbnails or in
  // the text, a resting cursor means intent.
  for (const zone of [rail.parentElement, section?.querySelector('.lp-cast-dossier')]) {
    zone?.addEventListener('pointerenter', () => hold(true));
    zone?.addEventListener('pointerleave', () => hold(false));
  }
  // Focus pauses across the whole section. Content changing under a keyboard user
  // is worse than content that has stopped moving.
  section?.addEventListener('focusin', () => hold(true));
  section?.addEventListener('focusout', (e) => {
    if (!section.contains(e.relatedTarget)) hold(false);
  });

  document.addEventListener('visibilitychange', sync);

  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    sync();
  }, { threshold: 0.35 });
  if (section) io.observe(section);

  // First paint. Honour whichever tab the markup marked live so the section's
  // resting state is a decision in the HTML rather than an index in here. select()
  // rather than change() — there is no clock to re-arm yet.
  const initial = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  select(initial < 0 ? 0 : initial);

  if (stopped) meter?.classList.add('is-off');
  else armClock();
}

// ============================================================
//  BOOTSTRAP
// ============================================================
wireDescent();
wireStrip();
wireReveals();
wireHeroHud();
wireHeroVideo();
wireCharacters();
wireNavGlide();
wireNavMenu();
