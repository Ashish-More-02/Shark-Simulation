import { PLAYER, STAMINA, BITE, UPGRADES } from './config/config.js';
import { preyStats } from './prey.js';

// ============================================================
//  UPGRADES  — the points you have, the levels you bought, and every stat the
//              rest of the game should read instead of the config constant.
//
//  ONE INCOME, TWO USES, NO DRIFT
//  Eating pays into `preyStats.points` (prey.js) and always has. That total is a
//  LIFETIME figure and nothing here ever decrements it, because the shark's SIZE is
//  a function of it (SHARK.growthFull) — spend it and buying an upgrade would shrink
//  the animal. So this module tracks `spent` instead, and what you can afford is
//
//      bank = lifetime points - points spent
//
//  which cannot drift out of step with either use, needs no second accumulator to
//  keep in sync, and makes a save file two numbers and a level table.
//
//  WHY THE GETTERS EXIST
//  Everything that consumes a player stat — max health, bite damage, boost seconds —
//  used to read a constant out of config.js. It now calls the getter below instead.
//  config.js holds the BASE and the STEP; this holds the LEVEL; the getter composes
//  them. The alternative was mutating PLAYER.health in place, which loses the
//  authored value the moment anything is bought, cannot be reset, and quietly turns
//  "every tunable in the game, data only" into mutable state.
//
//  What deliberately does NOT go through here: prey hit points. An animal's maxHp is
//  `bites x PLAYER.attack` at the BASE attack (prey.js), baked at spawn — a whale is
//  240 hp forever, and upgrading your bite lowers how many bites that is. If prey hp
//  ever tracked your upgraded damage, buying attack would do literally nothing.
//
//  Full design, and every number: Docs/systems/progression.md
// ============================================================

// The only mutable state in the system. A save file is this plus `spent`.
const levels = { health: 0, attack: 0, attackSpeed: 0, stamina: 0 };
let spent = 0;

// ---- CURRENCY --------------------------------------------------------------

export function bank() {
  return preyStats.points - spent;
}

// Lifetime earnings, for the "you have banked N of M ever" reading in the menu.
export function earned() {
  return preyStats.points;
}

export function levelOf(key) {
  return levels[key] ?? 0;
}

export function levelsFor(key) {
  return UPGRADES[key]?.levels ?? 0;
}

export function isMaxed(key) {
  return !!UPGRADES[key] && levels[key] >= UPGRADES[key].levels;
}

// Points for the NEXT level, or null if there isn't one. Rises with the level being
// bought: the first is `cost`, the eighth is 8 x cost.
export function costOf(key) {
  const spec = UPGRADES[key];
  if (!spec || isMaxed(key)) return null;
  return spec.cost * (levels[key] + 1);
}

export function canBuy(key) {
  const cost = costOf(key);
  return cost !== null && bank() >= cost;
}

// Spend. Returns true if it happened, so the caller can refuse to re-render or play
// a sound on a click that bought nothing. Every affordability rule lives here rather
// than in the menu, so a disabled button is a convenience and not the enforcement.
export function buy(key) {
  if (!canBuy(key)) return false;
  spent += costOf(key);
  levels[key]++;
  return true;
}

// ---- THE LIVE STATS --------------------------------------------------------
// base + level x step, in one line each. Every consumer in the game reads these.

function value(base, key) {
  const spec = UPGRADES[key];
  return spec ? base + levels[key] * spec.step : base;
}

// ...and what the same stat would be with every level bought. This is the `max` the
// stat sheet draws its bars against, so the empty part of a bar is exactly the
// upgrades that are still for sale — never an aspirational number nobody can reach.
function ceiling(base, key) {
  const spec = UPGRADES[key];
  return spec ? base + spec.levels * spec.step : base;
}

export function maxHealth()   { return value(PLAYER.health, 'health'); }
export function biteDamage()  { return value(PLAYER.attack, 'attack'); }
export function boostSeconds(){ return value(STAMINA.boostSeconds, 'stamina'); }

// The tank gets bigger and slower to fill at the same time — see the note on
// UPGRADES.stamina for why it is not proportional.
export function refillSeconds() {
  return STAMINA.refillSeconds + levels.stamina * UPGRADES.stamina.refillStep;
}

// ---- ATTACK SPEED, THE INVERTED ONE ----------------------------------------
// Every other stat improves by going UP. This one improves by the bite cooldown
// coming DOWN, so it gets its own pair of getters rather than being forced through
// value()/ceiling() with a negative step — which would work, and would leave a
// `step: -0.02` in config for someone to "fix" later.
//
// The floor is a hard guard, not a tuning value: `step x levels` is authored to land
// on 0.3 s, but a cooldown at or below zero would let one click bite every frame, and
// the config is the sort of thing that gets edited at midnight.
const MIN_COOLDOWN = 0.05;

export function biteCooldown() {
  const spec = UPGRADES.attackSpeed;
  return Math.max(MIN_COOLDOWN, BITE.cooldown - levels.attackSpeed * spec.step);
}

// What the menu actually shows: bites per second, which rises as the stat improves.
export function attackRate() {
  return 1 / biteCooldown();
}

export function attackRateCeiling() {
  const spec = UPGRADES.attackSpeed;
  return 1 / Math.max(MIN_COOLDOWN, BITE.cooldown - spec.levels * spec.step);
}

export function healthCeiling()  { return ceiling(PLAYER.health, 'health'); }
export function attackCeiling()  { return ceiling(PLAYER.attack, 'attack'); }
export function staminaCeiling() { return ceiling(STAMINA.boostSeconds, 'stamina'); }

// Wipe every level and hand the points back. Nothing calls this yet — it is here
// because a respec is the first thing anyone asks for once the costs are real, and
// because it is two lines while the state is still this small.
export function resetUpgrades() {
  for (const key of Object.keys(levels)) levels[key] = 0;
  spent = 0;
}
