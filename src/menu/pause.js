import { SHARK } from '../config/config.js';
import { setInputSuspended, capturePointer, isInputSuspended } from '../input.js';
import { updateSwim } from '../audio.js';

// ============================================================
//  PAUSE  — the card that comes up when the player steps out.
//
//  WHAT TRIGGERS IT, AND WHY IT IS NOT THE ESCAPE KEY
//  Escape is the player's gesture, but it is not an event this page can rely on
//  receiving. While the pointer is locked, Escape belongs to the browser: it
//  exits the lock and the keydown is consumed by the UA rather than dispatched to
//  the document. A keydown handler for it would work on some engines, silently
//  never fire on others, and look correct in the source either way.
//
//  So the trigger is the lock being LOST — `pointerlockchange` with no
//  pointerLockElement. That is the same moment, arrived at honestly, and it
//  covers more than the key does: alt-tabbing out of the window also frees the
//  cursor, and a paused game is the right thing to come back to.
//
//  THE ONE WAY OUT IS THE BUTTON
//  Esc does not resume, and neither does clicking the water around the card.
//  Both existed and both had to go, because either one turns Esc into a toggle
//  over a lock the page does not fully control:
//
//    Esc            exits the lock -> card up
//    Esc again      resume -> requestPointerLock() -> lock acquired, and the
//                   browser drops it again on the same gesture -> card up again,
//                   a frame later. That is the flicker.
//    Esc a third    resume -> requestPointerLock() REJECTED, because Chrome rate
//                   limits a re-lock that follows an unlock too closely -> card
//                   down, no lock, cursor loose over a live game.
//
//  Every one of those steps is the browser behaving as specified; the bug was
//  building a toggle on top of them. One button, one direction: the card goes up
//  when the lock is lost and comes down when the player says so. Clicking Resume
//  is also a fresh user gesture seconds after the unlock, which is the condition
//  requestPointerLock() actually wants.
//
//  WHAT IT IS NOT
//  Not the E menu. That one is a study surface — tabs, stats, a 3D preview — and
//  it opens ON PURPOSE. This is two buttons and it opens because the player left.
//  They freeze the world the same way (main.js skips updateWorld for either) and
//  they are mutually exclusive: the E menu suspends input on its way open, which
//  is exactly the guard below that stops its own exitPointerLock() from raising
//  this card behind it.
// ============================================================

const root = document.getElementById('pause');
const resumeBtn = document.getElementById('pause-resume');

let paused = false;
// Stays shut until the start screen is dismissed, for the same reason the E menu
// does: before "Start game" there is no lock to lose and nothing to pause.
let armed = false;

// Read by main.js to skip updateWorld. Rendering deliberately continues — the
// card's backdrop-filter samples the canvas, so the frozen frame behind it still
// has to be drawn.
export function isPaused() {
  return paused;
}

export function armPause() {
  armed = true;
}

export function pauseGame() {
  if (paused || !armed || !root) return;
  paused = true;
  root.classList.remove('hidden');

  // Same handover as the E menu: input is gated at the source, and the swim loop
  // is told the shark has stopped or it keeps churning over a frozen animal.
  setInputSuspended(true);
  updateSwim(0, SHARK.maxSpeed);

  // The card is the only thing on screen; give it the keyboard. blur() on the way
  // out is what keeps this from turning Space into a second Resume once the game
  // has the keys back — the same trap hud.js documents for #dive.
  resumeBtn?.focus();
}

export function resumeGame() {
  if (!paused) return;
  paused = false;
  root.classList.add('hidden');
  resumeBtn?.blur();

  setInputSuspended(false);
  // Straight back into mouse-look. If the browser refuses — Chrome rate-limits a
  // lock that follows an unlock too closely, which is exactly what this is —
  // capturePointer() swallows it and one click on the water takes it back.
  capturePointer();
}

if (root) {
  // The only way back into the water. See the note at the top of this file for
  // why Esc and a click on the backdrop are deliberately NOT wired here.
  resumeBtn?.addEventListener('click', resumeGame);

  document.addEventListener('pointerlockchange', () => {
    // Acquired, not lost — including the re-lock resumeGame() just asked for.
    if (document.pointerLockElement) return;
    // isInputSuspended() is the guard that keeps this out of the E menu's way:
    // openMenu() suspends input, and suspending exits the pointer lock, which
    // would otherwise raise this card behind the menu on every E press. Asking
    // input.js rather than menu.js also keeps the two screens from importing each
    // other.
    if (!armed || paused || isInputSuspended()) return;
    pauseGame();
  });
}
