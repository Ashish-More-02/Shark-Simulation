import { PLAYER, SHARK, WORLD, MPH, COMBAT, CREATURES, UPGRADES } from '../config/config.js';
import { DEEPEST } from '../levels.js';
import {
  maxHealth, biteDamage, boostSeconds, refillSeconds, biteCooldown, attackRate,
  healthCeiling, attackCeiling, staminaCeiling, attackRateCeiling,
  levelOf, levelsFor, costOf, canBuy, isMaxed,
} from '../upgrades.js';

// ============================================================
//  STATS  — what a stat IS. One row per number the menu shows.
//
//  EVERY ROW IS "WHAT THIS SHARK CAN DO NOW / WHAT IT COULD DO FULLY UPGRADED",
//  and that is the whole design of this panel. A row is:
//
//    { key, label, now, max, unit, decimals, note, dummy,
//      buy: { level, levels, cost, afford, maxed } | null }
//
//  A stat sheet is a description of the ANIMAL, not a telemetry readout. Six
//  seconds of boost capacity out of a possible twenty is a fact about your shark
//  that is worth opening a menu for; 4.3 seconds left in the tank right now is
//  not — it will be wrong before you finish reading it, and the green ring beside
//  the shark already says it better. Same for speed: the row is your top speed,
//  not your speedometer, which is what the HUD is for.
//
//  So the empty part of every bar is the UPGRADE PATH — the levels still for sale.
//  Since progression.md landed that is literal: `max` is base + step x levels,
//  DERIVED from what the shop actually stocks (upgrades.js), so a full bar means a
//  finished stat and never an aspirational number nobody can reach.
//
//  The panel does no arithmetic and knows no game rules. It renders whatever this
//  returns, which is what lets the pricing change without the page changing at all.
//
//  Rows carrying `dummy: true` are drawn dimmed and captioned as placeholders.
//  A fake stat that looks live is a bug you find three months later.
//
//  NOTHING HERE MOVES ON ITS OWN. Every `now` is base + what the player has bought,
//  and the only thing that raises one is spending points on this screen. Attack
//  power briefly grew with the shark's size and that was reverted for exactly this
//  reason — a stat sheet whose values drift upward by themselves is a shop with no
//  prices. See the note on UPGRADES in config.js.
// ============================================================

// Seawater adds one atmosphere every 10.06 m, on top of the one already pressing
// down at the surface. Real physics — the world is metric (one unit = one metre)
// and this is what that buys. Used only to say what the world demands of you.
const M_PER_ATM = 10.06;
const SEA_FLOOR_ATM = 1 + (WORLD.surface - DEEPEST) / M_PER_ATM;   // ~9.2 atm

// Read off the handling config rather than restated, so retuning the shark moves
// the stat sheet with it — see the note on PLAYER in config.js.
const SPRINT_MPH = SHARK.boostSpeed * MPH;
const CRUISE_MPH = (SHARK.accel / SHARK.drag) * MPH;

// Same derivation prey.js uses, for the same reason the two speeds above are read
// off SHARK rather than restated: bites-to-kill-a-whale is what an attack level
// actually means, and if the whale's `bites` is ever retuned these notes have to
// move with it. Found by name so it survives the CREATURES array being reordered.
const WHALE_HP = (CREATURES.find((c) => c.model === 'whale')?.bites ?? 0) * PLAYER.attack;

// The purchase half of a row. Null for a stat with nothing for sale, which is what
// makes the page draw no button at all rather than a dead one.
function buyState(key) {
  if (!UPGRADES[key]) return null;
  return {
    level: levelOf(key),
    levels: levelsFor(key),
    cost: costOf(key),
    afford: canBuy(key),
    maxed: isMaxed(key),
  };
}

export function readStats() {
  const dmg = biteDamage();
  const tank = boostSeconds();
  return [
    {
      // CAPACITY, not the current reading — the bar over the shark's head and the
      // HUD's HEALTH row are the reading, and this panel is about what the animal IS.
      key: 'health',
      label: 'Health',
      now: maxHealth(),
      max: healthCeiling(),
      unit: 'hp',
      note: `+${UPGRADES.health.step} hp a level · survives ${Math.ceil(maxHealth() / 18)} whale strikes · eating heals ${COMBAT.healPerPoint} hp per point`,
      buy: buyState('health'),
    },
    {
      // The capacity behind the green ring. The ring shows how much of the tank
      // is left; this shows how big the tank is, which is the part that upgrades.
      key: 'stamina',
      label: 'Stamina',
      now: tank,
      max: staminaCeiling(),
      unit: 's of boost',
      note: `+${UPGRADES.stamina.step}s a level · ${tank}s held down · ${refillSeconds().toFixed(1)}s to refill from empty`,
      buy: buyState('stamina'),
    },
    {
      // Top speed, not the speedometer — the HUD has the speedometer. No `max` and
      // therefore no bar: there is nothing for sale on this row, and a progress
      // track with no progress to make is the panel lying about its own shape.
      key: 'speed',
      label: 'Speed',
      now: SPRINT_MPH,
      unit: 'mph',
      note: `${Math.round(CRUISE_MPH)} mph cruising · ${Math.round(SPRINT_MPH)} mph sprinting on Shift`,
      locked: 'not for sale — raising sprint speed needs the boost accel invariant retuned with it, and roadmap §6 puts speed under Insight',
      buy: null,
    },
    {
      key: 'attack',
      label: 'Attack power',
      now: dmg,
      max: attackCeiling(),
      unit: 'dmg',
      // Bites-to-kill is the only reading of this stat that means anything in play,
      // so the note carries it rather than the raw damage the value already shows.
      note: `+${UPGRADES.attack.step} dmg a level · ${Math.ceil(WHALE_HP / dmg)} bites to kill a whale (${WHALE_HP} hp)`,
      buy: buyState('attack'),
    },
    {
      // The one INVERTED stat: what improves is the bite cooldown coming down, so the
      // value shown is its reciprocal. "0.8 -> 0.3 seconds" cannot be drawn on a bar
      // that fills as you get better; "1.25 -> 3.3 bites a second" can, and is also
      // what the player feels. The seconds go in the note, where a falling number
      // reads fine.
      key: 'attackSpeed',
      label: 'Attack speed',
      now: attackRate(),
      max: attackRateCeiling(),
      unit: 'bites/s',
      decimals: 1,
      // Seconds of contact to kill a whale — damage and rate multiplied, which is the
      // one place on this sheet where two rows visibly compound.
      note: `${Math.round(UPGRADES.attackSpeed.step * 1000)}ms off the cooldown a level · ${biteCooldown().toFixed(2)}s between snaps · ${(Math.ceil(WHALE_HP / dmg) * biteCooldown()).toFixed(1)}s of biting to kill a whale`,
      buy: buyState('attackSpeed'),
    },
    {
      // What the shark can TAKE. The world only demands ~9.2 atm of it today, so
      // the note names that number: a tolerance means nothing without the depth
      // it is measured against.
      key: 'pressure',
      label: 'Pressure',
      now: PLAYER.pressure,
      max: PLAYER.pressureCap,
      unit: 'atm',
      decimals: 1,
      note: `the deepest sea floor is ${SEA_FLOOR_ATM.toFixed(1)} atm — about ${Math.round(WORLD.surface - DEEPEST)} m down`,
      dummy: true,
      locked: 'nothing in the world reads pressure yet, so there is nothing to sell',
      buy: null,
    },
  ];
}
