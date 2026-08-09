import { PLAYER, SHARK, STAMINA, WORLD, MPH } from '../config/config.js';
import { DEEPEST } from '../levels.js';

// ============================================================
//  STATS  — what a stat IS. One row per number the menu shows.
//
//  EVERY ROW IS "WHAT THIS SHARK CAN DO NOW / WHAT IT COULD DO FULLY UPGRADED",
//  and that is the whole design of this panel. A row is:
//
//    { key, label, now, max, unit, decimals, note, dummy }
//
//  A stat sheet is a description of the ANIMAL, not a telemetry readout. Six
//  seconds of boost capacity out of a possible twenty is a fact about your shark
//  that is worth opening a menu for; 4.3 seconds left in the tank right now is
//  not — it will be wrong before you finish reading it, and the green ring beside
//  the shark already says it better. Same for speed: the row is your top speed,
//  not your speedometer, which is what the HUD is for.
//
//  So the empty part of every bar is the UPGRADE PATH — the growth still on the
//  table. That is the one reading a menu can give you that the HUD cannot.
//
//  The panel does no arithmetic and knows no game rules. It renders whatever this
//  returns, which is what lets a real upgrade system replace a placeholder here
//  without the page changing at all.
//
//  Rows carrying `dummy: true` are drawn dimmed and captioned as placeholders.
//  A fake stat that looks live is a bug you find three months later.
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

export function readStats() {
  return [
    {
      key: 'health',
      label: 'Health',
      now: PLAYER.health,
      max: PLAYER.healthCap,
      unit: 'hp',
      note: 'nothing damages you yet',
      dummy: true,
    },
    {
      // The capacity behind the green ring. The ring shows how much of the tank
      // is left; this shows how big the tank is, which is the part that upgrades.
      key: 'stamina',
      label: 'Stamina',
      now: STAMINA.boostSeconds,
      max: PLAYER.staminaCap,
      unit: 's of boost',
      note: `a full bar is ${STAMINA.boostSeconds}s held down · ${STAMINA.refillSeconds}s to refill from empty`,
    },
    {
      // Top speed, not the speedometer — the HUD has the speedometer.
      key: 'speed',
      label: 'Speed',
      now: SPRINT_MPH,
      max: PLAYER.speedCap,
      unit: 'mph',
      note: `${Math.round(CRUISE_MPH)} mph cruising · ${Math.round(SPRINT_MPH)} mph sprinting on Shift`,
    },
    {
      key: 'attack',
      label: 'Attack power',
      now: PLAYER.attack,
      max: PLAYER.attackCap,
      unit: 'dmg',
      note: 'bites cost hit points, not damage, for now',
      dummy: true,
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
    },
  ];
}
