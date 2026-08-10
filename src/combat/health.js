import { PLAYER, COMBAT } from '../config/config.js';
import { sharkState, flashHit } from '../shark.js';
import { flashDamage, showDeath, hideDeath } from '../hud.js';
import { playHurt, playSplash } from '../audio.js';
import { maxHealth } from '../upgrades.js';

// ============================================================
//  HEALTH  — the shark's one health pool, and what happens when it empties.
//
//  This is the module the rest of the game damages. It owns nothing about the
//  shark's rig or its handling: it holds a number, decides whether an incoming hit
//  is allowed to touch it, and when it reaches zero it stuns the animal and asks
//  world.js to put it back at the sanctuary. That split is what keeps shark.js
//  ignorant of combat and this file ignorant of terrain, cameras and creatures.
//
//  WHY THERE IS NO HUNGER BAR HERE
//  Roadmap §4: a constant drain punishes the player for stopping to look at
//  things, and looking at things is the product. So health is only ever spent by
//  something ATTACKING you, and food is the repair kit rather than a clock. That
//  makes eating valuable without ever making it urgent, which is the only version
//  of this that survives contact with an exploration game.
//
//  Full design: Docs/systems/attack-and-health.md
// ============================================================

// Mutated in place, read by the HUD every frame — never returned fresh, so the
// frame loop touches it without allocating.
export const health = {
  hp: PLAYER.health,
  max: PLAYER.health,
  grace: 0,          // seconds of immunity left after a hit
  sinceHit: 999,     // ...and how long since the last one, for the regen delay
  dead: false,
  respawnIn: 0,
  killedBy: '',
  // Seconds the bar over the shark's head has left to live. Raised by damage and by
  // eating — anything that MOVES your health in a way you should notice — and
  // deliberately NOT by the out-of-combat regen, which would otherwise hold the bar
  // on screen for the two and a half minutes it takes to trickle back up.
  barFor: 0,
};

// world.js registers what "wake up somewhere else" means. Kept as a callback
// rather than an import so this module never has to know that terrain, a chase
// camera or a basin full of angry whales exist — see the note in world.js.
let onRespawn = null;

export function setRespawnHandler(fn) {
  onRespawn = fn;
}

// `source` is what to name on the death banner. Callers do not check anything
// first: the grace window, the death state and the clamp all live here, so there
// is exactly one place that can get "can this hit land" wrong.
export function damageShark(amount, source = '') {
  if (health.dead || health.grace > 0 || amount <= 0) return;

  health.hp -= amount;
  health.grace = COMBAT.hurtGrace;
  health.sinceHit = 0;
  health.barFor = COMBAT.barShowFor;
  // Three channels for one event, each answering a different question: the body
  // flash is "that hit ME" (shark.js), the vignette is "I am taking damage right
  // now" (hud.js), the bar is "and this is what I have left".
  flashHit();
  flashDamage();
  playHurt();

  if (health.hp > 0) return;

  // ---- death ----
  health.hp = 0;
  health.dead = true;
  health.killedBy = source;
  health.respawnIn = COMBAT.deathHold;
  // Ignore input and drift on the momentum you had. shark.js owns this flag's
  // meaning; all we do is set the clock. A hard freeze would look like a bug and a
  // fade to black is a sequence this system has not earned yet.
  sharkState.stunned = COMBAT.deathHold;
  showDeath(source);
}

// Follow the upgrade system's max, and hand over the difference as CURRENT health
// too. Buying +50 max and being left at 20/150 is an upgrade that made you feel
// weaker, which is the wrong lesson from spending points; the whole level lands the
// moment you buy it.
//
// Polled rather than pushed. upgrades.js has no idea this module exists, and the
// menu that spends the points has no idea either — this runs once a frame, costs a
// comparison, and cannot be forgotten by whatever grants a level next (a pickup, a
// story beat, a save file loading).
function syncMax() {
  const max = maxHealth();
  if (max === health.max) return;
  const gained = max - health.max;
  health.max = max;
  if (health.dead) return;      // don't half-resurrect a corpse; revive() fills it
  health.hp = Math.min(max, Math.max(0, health.hp + gained));
  if (gained > 0) health.barFor = COMBAT.barShowFor;   // show what you just bought
}

// Eating is the heal (COMBAT.healPerPoint, paid against the same `points` that
// drive growth). Returns what was ACTUALLY restored, so the bite readout can say
// "+42 hp" and be telling the truth at full health, where the answer is nothing.
export function healShark(amount) {
  if (health.dead || amount <= 0) return 0;
  const before = health.hp;
  health.hp = Math.min(health.max, health.hp + amount);
  // Only when a meal actually restored something. Eating at full health should not
  // put a full bar on screen to tell you nothing happened.
  if (health.hp > before) health.barFor = COMBAT.barShowFor;
  return health.hp - before;
}

export function updateHealth(dt) {
  if (health.grace > 0) health.grace -= dt;
  if (health.barFor > 0) health.barFor -= dt;
  syncMax();

  if (health.dead) {
    health.respawnIn -= dt;
    // Held up rather than allowed to expire: an empty bar over a drifting shark is
    // the clearest thing on screen about what just happened.
    health.barFor = COMBAT.barShowFor;
    if (health.respawnIn <= 0) revive();
    return;
  }

  health.sinceHit += dt;
  // Out-of-combat trickle. Deliberately worse than a single dolphin: it exists so
  // that one bad fight is not a dead end, not so that you can heal by waiting.
  //
  // Written straight into `hp` rather than through healShark(), which is what keeps
  // the bar off screen while it runs — see `barFor`.
  if (health.sinceHit > COMBAT.regenDelay && health.hp < health.max) {
    health.hp = Math.min(health.max, health.hp + COMBAT.regenRate * dt);
  }
}

// Wake at the sanctuary. Roadmap §4 wants the Souls loop — respawn, and go and
// pick up the Insight you dropped where you died — and this is as much of it as
// can exist before Insight does: full health, nothing lost, and the swim back is
// the price. Growth, points and the eaten count all survive on purpose.
function revive() {
  health.dead = false;
  health.hp = health.max;
  health.grace = COMBAT.hurtGrace;
  health.sinceHit = 0;
  health.respawnIn = 0;
  health.barFor = COMBAT.barShowFor;   // arrive showing a full bar
  // The banner already said where you were going (hud.js) — it fades as you arrive
  // rather than being replaced by a second message nobody asked for. The splash is
  // the one the game opens on, which is the right sound: you are dropped back in.
  hideDeath();
  playSplash();
  onRespawn?.();
}
