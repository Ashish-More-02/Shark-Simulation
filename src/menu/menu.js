import { SHARK } from '../config/config.js';
import { setInputSuspended, capturePointer } from '../input.js';
import { updateSwim } from '../audio.js';
import { PAGES } from './pages/index.js';
import { isPaused } from './pause.js';

// ============================================================
//  MENU  — the game's second screen. Press E.
//
//  WHY IT EXISTS
//  The HUD is a GLANCE surface: read while moving, one line per fact, and its
//  budget is already spent on six rows and a stamina ring. Health, bite damage,
//  a map, a quest log — none of those can be read in a tenth of a second, and
//  forcing them onto the HUD ruins the HUD. So: a second surface, deliberately
//  large, that stops the world while it is up. Pausing is not a feature bolted
//  on; it is what makes a STUDY surface fair to read.
//
//  SHELL vs PAGE
//  This file owns the overlay, the title, the tab strip, the E key and the
//  handoff with the running game. It knows nothing about sharks or stats. Each
//  page owns one tab's worth of body — see pages/index.js for the contract.
//
//  This is the second module allowed to touch the DOM (hud.js is the other), and
//  the last: see Docs/systems/menu.md.
// ============================================================

const root = document.getElementById('menu');

let open = false;
let armed = false;         // stays shut until the start screen is dismissed
let built = false;
let active = null;         // the page object currently showing
let tabsEl = null, bodyEl = null;
const mounted = new Set(); // pages whose mount() has run

function build() {
  root.innerHTML = `
    <div class="menu-panel">
      <h2 class="menu-title">🦈 Deep Ocean Shark</h2>
      <button class="menu-close" aria-label="Close menu" title="Close (E)">x</button>
      <nav class="menu-tabs"></nav>
      <div class="menu-body"></div>
    </div>`;
  tabsEl = root.querySelector('.menu-tabs');
  bodyEl = root.querySelector('.menu-body');
  root.querySelector('.menu-close').addEventListener('click', closeMenu);

  for (const page of PAGES) {
    const tab = document.createElement('button');
    tab.className = 'menu-tab';
    tab.textContent = page.title;
    tab.dataset.page = page.id;
    tab.addEventListener('click', () => { tab.blur(); show(page); });
    tabsEl.appendChild(tab);

    // One container per page, built up front and kept — a page's DOM survives
    // being hidden, so switching tabs never re-runs mount().
    const pane = document.createElement('div');
    pane.className = 'menu-page hidden';
    pane.dataset.page = page.id;
    bodyEl.appendChild(pane);
  }
  built = true;
}

function paneFor(page) {
  return bodyEl.querySelector(`.menu-page[data-page="${page.id}"]`);
}

function show(page) {
  if (active === page) return;
  if (active) {
    active.exit();
    paneFor(active).classList.add('hidden');
    tabsEl.querySelector(`[data-page="${active.id}"]`).classList.remove('on');
  }
  active = page;
  const pane = paneFor(page);
  pane.classList.remove('hidden');
  tabsEl.querySelector(`[data-page="${page.id}"]`).classList.add('on');

  // mount() is deferred to the first time a tab is actually opened, so a page
  // nobody visits costs nothing — including its WebGL context.
  if (!mounted.has(page)) { page.mount(pane); mounted.add(page); }
  page.enter();
}

export function openMenu() {
  if (open || !armed) return;
  if (!built) build();
  open = true;
  root.classList.remove('hidden');

  // Hand the game over. Input is gated at the source (see input.js) rather than
  // ignored per-consumer, which is also what stops a click on the visible margin
  // of the canvas re-capturing the pointer behind the overlay.
  setInputSuspended(true);
  updateSwim(0, SHARK.maxSpeed);   // or the swim loop keeps churning over a frozen shark

  // Reopening returns to the tab you left on. show() early-outs when the page is
  // already active, so the re-entry has to be explicit rather than a show() call.
  if (active) active.enter();
  else show(PAGES[0]);
}

export function closeMenu() {
  if (!open) return;
  open = false;
  if (active) active.exit();       // ...but `active` is KEPT, so we reopen on it
  root.classList.add('hidden');
  setInputSuspended(false);
  capturePointer();                // straight back into mouse-look, no extra click
}

export function toggleMenu() {
  open ? closeMenu() : openMenu();
}

// Read by main.js to skip updateWorld. Rendering deliberately continues: the
// overlay's backdrop blur samples the canvas, so the frame behind it has to keep
// being drawn even though nothing in it is moving.
export function isMenuOpen() {
  return open;
}

// Called once the start screen is gone — E should do nothing while the player is
// still looking at "Dive In".
export function armMenu() {
  armed = true;
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') {
    // isPaused(): the pause card is up and the game is already stopped. Opening
    // a study surface over it would leave two overlays stacked, each thinking it
    // owns the input. pause.js does not import this file, so the dependency runs
    // one way only.
    if (!armed || isPaused()) return;
    e.preventDefault();
    toggleMenu();
  } else if (e.code === 'Escape' && open) {
    closeMenu();
  }
});
