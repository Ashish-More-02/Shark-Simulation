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
//  1000 hp forever, and upgrading your bite lowers how many bites that is. If prey hp
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

// The spec for one upgradable stat, or undefined. Guards on `levels` rather than on
// mere presence, because UPGRADES also carries `costGrowth` — a bare number shared by
// every row. Without this, `costGrowth` would look exactly like a purchasable stat to
// anything that asked, and the failure would be silent.
function specFor(key) {
  const spec = UPGRADES[key];
  return spec && spec.levels ? spec : undefined;
}

// Also exported, so the menu can ask "is this row for sale at all" with the same
// answer this module uses rather than its own guess at one.
export function isUpgradable(key) {
  return !!specFor(key);
}

export function levelOf(key) {
  return levels[key] ?? 0;
}

export function levelsFor(key) {
  return specFor(key)?.levels ?? 0;
}

export function isMaxed(key) {
  const spec = specFor(key);
  return !!spec && levels[key] >= spec.levels;
}

// Points for the NEXT level, or null if there isn't one.
//
// GEOMETRIC, not linear: each level costs costGrowth (1.2) times the one before, so a
// row reads 450, 540, 648 ... 2322. Linear-in-level was the first attempt and it is
// the wrong curve for a ten-level row — it makes the last level only ten times the
// first, so the tail of every stat is cheap relative to the income you have by the
// time you reach it, and the sheet finishes itself. Compounding keeps the last level
// of anything expensive no matter how rich the player has become.
//
// Rounded, so the menu never prints a price with a decimal in it.
export function costOf(key) {
  const spec = specFor(key);
  if (!spec || isMaxed(key)) return null;
  return Math.round(spec.cost * Math.pow(UPGRADES.costGrowth, levels[key]));
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
  const spec = specFor(key);
  return spec ? base + levels[key] * spec.step : base;
}

// ...and what the same stat would be with every level bought. This is the `max` the
// stat sheet draws its bars against, so the empty part of a bar is exactly the
// upgrades that are still for sale — never an aspirational number nobody can reach.
function ceiling(base, key) {
  const spec = specFor(key);
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
// `step: -0.05` in config for someone to "fix" later.
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
