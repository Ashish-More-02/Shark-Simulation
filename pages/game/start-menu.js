// ============================================================
//  DEEP OCEAN SHARK — start menu behaviour.   pages/game/start-menu.js
//
//  The menu lives inside the game's document (game.html, alongside this file) and
//  this file is NOT on the critical path. "Go to homepage" is a plain link and "Start
//  game" is #dive, which src/hud.js wires on its own; with this module blocked or
//  broken the menu still works with a mouse. Nothing here starts the game.
//
//  What it adds is the thing a game's start screen owes a player who has just read
//  "WASD swims": that the menu itself answers to the keyboard. Up/Down move the
//  selection, Space takes it, Escape leaves. The pointer and the keyboard share one
//  "which item is selected" state, so hovering an option and then pressing Enter
//  does what it looks like it will do — those two tracking separately is the classic
//  bug in hand-rolled menus.
//
//  The item list is read LIVE rather than cached, because Start does not exist yet
//  when this runs: it is inside #controls, which is display: none until hud.js
//  unhides it on showControls(). Which is also what the observer at the bottom is
//  for — the moment the ocean is ready, the selection moves to Start so Enter
//  begins the game without touching the mouse.
// ============================================================

const menu = document.querySelector('[data-menu]');
const controls = document.getElementById('controls');
const start = document.getElementById('start');

// display: none gives an element no offsetParent. That is the test for "is this
// option actually on screen", and it is why the list cannot be cached.
const items = () =>
  [...(menu?.querySelectorAll('[data-menu-item]') ?? [])].filter((el) => el.offsetParent !== null);

let at = 0;

function select(i, { focus = true } = {}) {
  const list = items();
  if (!list.length) return;
  at = (i + list.length) % list.length;
  list.forEach((el, n) => el.classList.toggle('is-on', n === at));
  if (focus) list[at].focus();
}

if (menu) {
  // Hover and focus both write the same state the arrow keys do — one cursor.
  // Delegated, so an option that appears later (Start) is covered without rebinding.
  menu.addEventListener('pointerover', (e) => {
    const i = items().indexOf(e.target.closest('[data-menu-item]'));
    if (i >= 0) select(i, { focus: false });
  });
  menu.addEventListener('focusin', (e) => {
    const i = items().indexOf(e.target.closest('[data-menu-item]'));
    if (i >= 0) select(i, { focus: false });
  });

  select(0, { focus: false });

  addEventListener('keydown', (e) => {
    // Once the overlay is gone the game owns the keyboard: WASD, E, Esc and the
    // rest are all bound in src/. This must go silent at that moment, and .gone is
    // how hud.js says so.
    if (start?.classList.contains('gone')) return;
    // Never swallow a modified key: Cmd/Ctrl+Down is a browser gesture and Alt+Left
    // is Back. The menu only owns the bare press.
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

    switch (e.key) {
      case 'ArrowDown': case 'ArrowRight': e.preventDefault(); select(at + 1); break;
      case 'ArrowUp':   case 'ArrowLeft':  e.preventDefault(); select(at - 1); break;
      case 'Home':                         e.preventDefault(); select(0); break;
      case 'End':                          e.preventDefault(); select(items().length - 1); break;
      // Enter already activates a focused <a> or <button> everywhere. Space is the
      // one that needs help: on a link it scrolls instead.
      case ' ': case 'Spacebar': {
        e.preventDefault();
        items()[at]?.click();
        break;
      }
      // Escape is "out" here for the same reason it is "out" in the game.
      case 'Escape': e.preventDefault(); location.href = '../../index.html'; break;
      default: break;
    }
  });
}

// hud.js unhides #controls when buildWorld() resolves. That is the only signal this
// file needs: move the selection onto Start and focus it, so a player who never
// touched the mouse can press Enter the moment the ocean is ready. One-shot — the
// observer disconnects itself, and it is skipped entirely if #controls is already
// visible by the time this module runs.
if (controls && menu) {
  if (controls.classList.contains('hidden')) {
    const obs = new MutationObserver(() => {
      if (controls.classList.contains('hidden')) return;
      obs.disconnect();
      select(0);
    });
    obs.observe(controls, { attributes: true, attributeFilter: ['class'] });
  } else {
    select(0);
  }
}
