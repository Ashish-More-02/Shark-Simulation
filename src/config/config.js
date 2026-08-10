// ============================================================
//  CONFIG — every tunable in the game. Data only, no logic.
//  Level definitions and their prop tables live in ./levels/.
// ============================================================

export const WORLD = {
  half: 77, // content radius of one basin — most placement sizes off this
  surface: 18, // water surface plane, one for the whole world
  seed: 2112001399, // one seed for the whole world; ?seed=12345 overrides for a session
  mountainRing: 78, // inner edge of the shallows' mountain range
  margin: 130, // bare sand past the play bound so the seabed fades into fog
};

// The only route between the two basins: a corridor in plan, a ramp in
// elevation. The ramp is a function of z alone, which keeps the seabed
// continuous without special-casing the corridor.
export const CANYON = {
  halfWidth: 26,
  zMin: 88, // level 2 end of the corridor
  zMax: 197, // level 1 end
  rampBottom: 95, // at/below this z the floor is fully at level 2's height
  rampTop: 190, // at/above this z it is fully at level 1's height
  plainDunes: 0.35, // level 1's dunes, as a fraction of level 2's
};

export const DEEP_COLOR = 0x0c3b58; // fog / water tint
export const SAND_COLOR = "#c8ab7d"; // seabed
export const FOG_DENSITY = 0.0135; // loose enough to see the mountains

// Above the waterline. sunDir must match the DirectionalLight in core.js.
export const SKY = {
  horizon: 0xc2dbe8,
  zenith: 0x4f96c8,
  sun: 0xfff2d0,
  sunDir: [0.283, 0.943, 0.189],
};

// The water column you see past the reef.
export const BACKDROP = { top: 0x2c83b2, bottom: 0x020c14 };

// The surface from underneath: a bright Snell's window overhead falling off to a
// dark mirror at grazing angles. DEEP_COLOR, BACKDROP and this move together.
export const WATER = {
  deep: 0x06202f, // grazing — the mirror
  window: 0x2f7ba4, // overhead — sky through the window
  glint: 0xa8dcf5, // sun veins inside the window
  opacity: [0.94, 0.52], // [grazing, overhead]
  brightness: 1.2, // luminance multiplier, applied in the shader
};

// Per-instance rock colouring (props.js). Weighted dark so the reef reads black.
export const ROCK_PALETTE = [
  0x26262a, 0x2e2e31, 0x1e1e21, 0x37373a, // basalt
  0x6a6a6c, 0x7b7871, 0x565859, 0x4d4f50, // granite / weathered grey
  0x6b5643, 0x7a6a52, 0x54483a, 0x453a2f, // sandstone / sediment
  0x49543f, 0x3f4a3c, // algae-covered
];
export const MOUNTAIN_PALETTE = [
  0x4a5560, 0x3d4a52, 0x55606b, 0x46484a, // cold distant rock
  0x5a5245, 0x4e463c, 0x615748, // brown sediment flanks
];
// Pebbles sit on pale sand, so they read as shingle rather than basalt.
export const PEBBLE_PALETTE = [
  0x8d8378, 0x9a9186, 0x7c7468, 0xa39a8c, // sun-bleached shingle
  0x8a7a63, 0x99886d, 0x6f6455, // sandy / sediment
  0x6d726b, 0x5f665e, // damp greenish grey
];

// Per-model setup.
//   targetSize : longest dimension in world units after auto-scaling by bbox
//   rotY       : spin that points the model's nose at -Z (Three.js forward)
//   anchorBottom: seat the model on the sand instead of on its own origin
//   twoSided   : disable backface culling. Only for geometry you can see the
//                inside of — animals (single-sided fins), alpha-cut leaf cards,
//                and kelp-2, whose edges are wound inconsistently. If a prop ever
//                looks hollow, adding this row's flag is the whole fix.
export const MODELS = {
  shark: { url: "assets/shark-animated.glb", targetSize: 6.0, rotY: Math.PI, anchorBottom: false, twoSided: true },
  fish: { url: "assets/fish.glb", targetSize: 1.1, rotY: Math.PI, anchorBottom: false, twoSided: true },

  // Animated reef fish — skinned rigs that shoal (fish.js). targetSize is length
  // against a 6-unit shark, held near 1 so they read at fog distance.
  blueFish: { url: "assets/blue_fish.glb", targetSize: 0.95, rotY: Math.PI, anchorBottom: false, twoSided: true },
  clownFish: { url: "assets/clownFish.glb", targetSize: 0.8, rotY: Math.PI, anchorBottom: false, twoSided: true },
  fish2: { url: "assets/fish-2.glb", targetSize: 1.15, rotY: Math.PI, anchorBottom: false, twoSided: true },

  // Animated wildlife — one AnimationMixer each (creatures.js).
  dolphin: { url: "assets/Dolphin.glb", targetSize: 5.0, rotY: Math.PI, anchorBottom: false, twoSided: true },
  whale: { url: "assets/whale.glb", targetSize: 21, rotY: Math.PI, anchorBottom: false, twoSided: true },
  angler: { url: "assets/anglerfish.glb", targetSize: 2.4, rotY: Math.PI, anchorBottom: false, twoSided: true },

  // Seabed flora
  grass: { url: "assets/grass.glb", targetSize: 2.6, rotY: 0, anchorBottom: true },
  kelp: { url: "assets/kelp.glb", targetSize: 8.5, rotY: 0, anchorBottom: true },
  kelpBush: { url: "assets/kelp-tall.glb", targetSize: 5.5, rotY: 0, anchorBottom: true },
  kelpFrond: { url: "assets/kelp-2.glb", targetSize: 4.6, rotY: 0, anchorBottom: true, twoSided: true },
  seaweed: { url: "assets/seaweed.glb", targetSize: 4.5, rotY: 0, anchorBottom: true },
  seagrass: { url: "assets/Seaweed-3.glb", targetSize: 3.0, rotY: 0, anchorBottom: true },
  anemone: { url: "assets/sea-anemone.glb", targetSize: 2.6, rotY: 0, anchorBottom: true },
  fern: { url: "assets/fern.glb", targetSize: 3.4, rotY: 0, anchorBottom: true, twoSided: true },

  // Rock — coloured per instance from ROCK_PALETTE / MOUNTAIN_PALETTE
  boulder: { url: "assets/rock-boulder.glb", targetSize: 6.0, rotY: 0, anchorBottom: true },
  rockPile: { url: "assets/rock-cluster.glb", targetSize: 8.0, rotY: 0, anchorBottom: true },
  rockSpire: { url: "assets/rock-large.glb", targetSize: 4.8, rotY: 0, anchorBottom: true },
  mountain: { url: "assets/mountain.glb", targetSize: 46, rotY: 0, anchorBottom: true },
  pebbles: { url: "assets/pebbles.glb", targetSize: 1.7, rotY: 0, anchorBottom: true },

  // Seabed litter
  log: { url: "assets/log.glb", targetSize: 3.2, rotY: 0, anchorBottom: true },
  bones: { url: "assets/fish-bones.glb", targetSize: 1.9, rotY: 0, anchorBottom: true },
};

// Roaming wildlife — one skinned rig per instance, not instanced, so counts stay
// small. All of it lives in level 2 (the reef).
//   band   : [low, high] fraction of the water column, 0 = seabed, 1 = surface
//   ring   : [inner, outer] radius its waypoints are drawn from, equal-area
//   clip   : animation clip name; falls back to the file's first clip
//   rate   : clip timeScale at cruise speed
//   turn   : max yaw rate, rad/s — big animals arc, small ones dart
//   shy    : how hard it veers off when the shark closes in (0 = ignores you)
//   speedCap: optional hard ceiling on the per-individual speed jitter, so a fast
//            species can never out-run the shark. Prey that cannot be caught is
//            scenery — see FISH.sprintCap, which is the same guard for shoals.
//   glow   : { material, color, intensity } — material name must match EXACTLY
//   bites  : snaps to eat it (prey.js);  points : what eating it pays — see UPGRADES
//   combat : this species FIGHTS BACK once bitten. Absent = it never does, which is
//            every species but the whale. See COMBAT below and
//            Docs/systems/attack-and-health.md.
export const CREATURES = [
  {
    model: "whale",
    count: 2,
    sMin: 0.92,
    sMax: 1.06,
    band: [0.42, 0.78],
    ring: [30, 68],
    clip: "Armature|Swim",
    rate: 0.34,
    speed: 2.4,
    turn: 0.28,
    dwell: [10, 8],
    shy: 0,
    name: "Whale",
    // 50 x PLAYER.attack 20 = 1000 hp (prey.js derives it). Up from 240: this is the
    // biggest animal in the ocean and the only one that fights back, so it is the
    // wall the upgrade curve is measured against — 50 bites at level zero, 13 fully
    // upgraded.
    bites: 50,
    // Doubled with the health, not quadrupled with it. The old 70 was for an animal
    // you could kill in ten free bites; 150 is for one that can kill you, and it is
    // deliberately WORSE points-per-second than the old whale was — that ratio being
    // too good is what let a player max the entire stat sheet in ten minutes. It is
    // still the best-paying thing in the ocean once you can actually take one, which
    // is the right shape: the hard content pays best. Sustained income from whaling is
    // capped anyway by BITE.respawn — two whales an minute, and no more.
    points: 150,

    // ---- THE ONE NEUTRAL MOB (Docs/systems/attack-and-health.md) ----
    // Its hp is NOT here: prey.js derives it from `bites` above. This block is the
    // temper, not the body.
    //
    // Read the three time values together — commit at 9 m, rear back for 0.75 s,
    // then ram for 0.55 s and connect inside 7 m. 0.75 s of warning is 9.2 m of
    // travel at the shark's cruise speed against a 7 m strike, which is what makes
    // EVERY hit dodgeable with no upgrade and no precision. That inequality is the
    // one thing in this block that is not a free tuning choice — everything else
    // here is a feel dial, and the first pass was tuned far too slow.
    combat: {
      // Tripled from 18. At the shark's starting 100 hp that is TWO strikes to kill
      // you, which is what makes the whale a wall rather than a slow-motion vending
      // machine — and it is why Health is the cheapest row on the upgrade sheet.
      attack: 54,
      cooldown: 3.0, // seconds from one commit to the next
      commit: 9, // body-surface distance at which it decides to strike...
      reach: 7, // ...and the distance the ram actually connects at, so it can miss
      windup: 0.75, // the tell: it slows and rears before every strike
      lunge: 0.55, // the ram itself. One commitment, not a tracking beam.
      windupMul: 0.55, // speed while loading — a load, not a dead stop
      lungeMul: 4.4, // 10.6 m/s. Still under the shark's 12.2 cruise, on purpose.
      chaseMul: 2.6, // 6.2 m/s while hunting you. It follows; it never catches you.
      turnMul: 2.2, // 0.62 rad/s — a 180 takes 5 s. You out-turn it, always.
      rear: -0.3, // pitch bias while winding up, radians: nose up, whole body loads
      // How far it follows you. Inside this it chases; past it, `forget` starts
      // counting, and coming back inside resets that clock in full.
      //
      // Halved from 70 to 35, which puts it INSIDE the ~50 m the fog lets you see:
      // the whale now breaks off while it is still in plain sight, so disengaging
      // is something you watch happen rather than something you infer from the ⚠
      // going out. Note it is measured pivot-to-pivot on a 21 m animal, so 35 m
      // from the pivot is only ~25 m from its nose. If this ever wants to be "gives
      // up sooner" rather than "gives up closer", `forget` is the number for that.
      leash: 35,
      forget: 10, // seconds outside the leash before it is a whale again
    },
  },
  {
    model: "dolphin",
    count: 4,
    sMin: 0.85,
    sMax: 1.08,
    // ---- TUNED FOR SOMETHING YOU CAN COMFORTABLY FOLLOW ----
    // A dolphin takes ten bites now, so the player spends real time behind one, and
    // every one of these four numbers used to work against that. Together they were
    // making people motion-sick: a 1.5 rad/s yaw rate on a 3-second dwell is an animal
    // that changes its mind before it has finished the last turn, and a 0.5-0.95 band
    // is 15 metres of water to climb and dive through while doing it.
    //
    //   band  0.5-0.95 -> a 9 m slice instead of 15, so consecutive waypoints sit at
    //         similar heights and the chase stays roughly level
    //   ring  8-52 -> 16-58: legs between waypoints are longer, so more of the swim
    //         is a straight line and less of it is a corner
    //   dwell 3-6 s -> 9-16 s: it commits to a heading for long enough to read
    //   turn  1.5 -> 0.55 rad/s: wide arcs. Still twice the whale's 0.28, so it is
    //         plainly more agile than a whale, but a 180 takes 5.7 s instead of 2.1.
    //
    // See also FLEE, which is what stops it pivoting on the spot while you chase it.
    band: [0.55, 0.82],
    ring: [16, 58],
    clip: "Armature|Swim",
    // The clip rate is set once at spawn for a non-combat species, so it does not track
    // speed on its own. `speed / rate` is METRES PER TAIL BEAT, and that is the dial —
    // 1.68 puts this at 8.0 m a stroke, about 1.6 body lengths.
    //
    // Walked down from 2.8 (a 40% cut) after looking at it on screen, and the direction
    // is worth recording: the arithmetic said match the beat to the speed, and the
    // arithmetic was wrong. A tail thrashing in proportion to 13.5 m/s reads as panic,
    // and a dolphin at speed mostly GLIDES — long coasts between strokes is what the
    // animal actually does. Trust the picture over the ratio here.
    rate: 1.68,
    // ---- SPEED, AND THE CEILING IT RUNS INTO ----
    // 8.6 x 1.6 = 13.8. The spawn jitter is x0.85-1.15 (creatures.js), which would put
    // the fastest individual at 15.8 m/s — PAST the shark's 15.2 sprint, and well past
    // its 12.2 cruise. A ten-bite animal you cannot catch is not difficult prey, it is
    // scenery worth 40 points that nothing can ever collect. `speedCap` is the backstop,
    // and it is the same guard, for the same reason, as FISH.sprintCap.
    //
    // 13.5 leaves 1.7 m/s of closing speed on the fastest dolphin while sprinting, and
    // sits ABOVE cruise — so this is now the one animal in the game you cannot catch
    // without spending boost. That is a deliberate statement rather than a side effect:
    // it is what makes the Stamina row worth buying before you can fight a whale.
    speed: 13.8,
    speedCap: 13.5,
    // Raised from 0.55. Turn radius is speed/turn, and THAT is the number that decides
    // whether following one is pleasant: the original dizzying dolphin arced through
    // 9.8 m, and this arcs through ~12.9 — tighter and more alive than the 15.6 m it had
    // a moment ago, still 30% wider than the version that made people queasy. Bank
    // follows yaw RATE (creatures.js), so it leans 20 degrees into a turn now, against
    // 11 before and 30 on the original.
    //
    // Push past ~1.3 rad/s and the radius is back to the original 9.8 m. That is the
    // line to stay behind.
    turn: 1.0,
    dwell: [9, 7],
    // Set against FLEE: 34 x 1.0 = a 34 m escape target, well past the 22 m radius that
    // triggers it, and reached in 2.6 s of the 3.5 s it commits to. So a fleeing dolphin
    // runs one clean line clear of the trigger zone rather than stalling on a target
    // short of it or being cut off mid-flight.
    shy: 1.0,

    // ---- IT HAS TO BREATHE ----
    // A dolphin is a mammal living 55-63 m under the surface, and going up for air is
    // the most characteristic thing it does. Every `every[0] + rng x every[1]` seconds
    // it abandons its waypoint's DEPTH — keeping its horizontal heading — climbs to
    // `depth` metres under the surface, and drops back to the reef when the trip budget
    // runs out. See breathe() in creatures.js.
    //
    // `climbPitch` is why this works at all. The shared pitch limit is 0.5 rad, and at
    // that angle 55 m of ascent takes 8.7 s — with the 9 s descent that is a 22-second
    // round trip against a 15-second timer, so the animal would spend its entire life in
    // transit and never touch the reef. 0.95 rad (54 degrees) is a brisk, deliberate
    // dash for the surface: 5 s up, ~4 s of the `trip` budget left to linger.
    //
    // The DESCENT is deliberately left at the normal 0.5 limit, so it rises hard and
    // glides back down over about nine seconds. That asymmetry is both what a dolphin
    // actually looks like and the gentler half to watch — the long shallow return is not
    // the part that makes anyone queasy.
    //
    // ---- WHY `every` IS 30 AND NOT THE 15 THAT WAS ASKED FOR ----
    // The cycle is not a tuning choice, it is arithmetic: 5.3 s of rise + 3.7 s of
    // linger + 9.2 s of glide back down is an 18-SECOND ROUND TRIP, and no number in
    // this block shortens it much — 55 m of water at 13.5 m/s is what it is. On a
    // 15-21 s timer the next breath is therefore due before the last one has finished,
    // so the animal never once holds its depth: it is a permanent yo-yo, which is
    // exactly the vertical motion that got tuned OUT of this dolphin two changes ago.
    //
    // 30-42 s (avg 36) makes the split about even — an individual holds the reef band
    // for roughly as long as it spends breathing. And because the four dolphins are
    // staggered independently, the POD still has someone rising almost all the time, so
    // the behaviour reads as constant even though any one animal is mostly at depth.
    // It is also squarely in the real range for an active dolphin.
    //
    // Raise `trip` for a longer visit up top, `depth` to stop short of the surface, and
    // `every` for the cadence. Note a chase CANCELS a breath outright (the flee block
    // runs after breathe()), so none of this fires while you are actually on one.
    surface: { every: [30, 12], trip: 9, depth: 4, climbPitch: 0.95 },
    name: "Dolphin",
    // 10 x PLAYER.attack 20 = 200 hp, up from 60. Ten snaps at the base 0.8 s cooldown
    // is eight seconds of staying on a target that is actively running from you
    // (`shy` above), which turns a dolphin from a snack into a chase — the middle rung
    // between a one-bite fish and the 50-bite whale, and the only prey in the game that
    // tests handling rather than damage.
    bites: 10,
    // Raised with the health, for the same reason the whale's was: 3.3x the time to
    // kill for the same 14 points would have made dolphins strictly worse value than
    // the fish beside them, and four of the world's eleven wildlife rigs would quietly
    // become scenery. 40 puts a dolphin slightly ahead of efficient shoal-farming,
    // which is right — it is harder, and there are only four of them.
    points: 40,
  },
  {
    model: "angler",
    count: 5,
    sMin: 0.7,
    sMax: 1.35,
    band: [0.02, 0.22],
    ring: [10, 54],
    clip: "Fish_Armature|Swimming_Normal",
    rate: 0.85,
    speed: 1.4,
    turn: 0.8,
    dwell: [6, 6],
    shy: 0.5,
    glow: { material: "Light", color: 0x9df0ff, intensity: 2.6 },
    name: "Anglerfish",
    bites: 1,
    points: 3,
  },
];

// ---- FLEEING (creatures.js) --------------------------------------------------
// How a shy animal runs from the shark. One shared block: `shy` on the species row
// scales the distance, and everything else about panicking is the same for a dolphin
// as for an anglerfish.
//
// The important number is `hold`. The escape heading is picked ONCE and kept for this
// long, rather than recomputed every frame from wherever the shark currently is — the
// per-frame version made the target swing around the animal as the player circled it,
// so the poor thing pivoted on the spot for the whole chase and watching it was
// genuinely nauseating. fish.js holds a shoal's escape heading for exactly the same
// reason; this is the wildlife's version of it.
export const FLEE = {
  radius: 22, // how close the shark has to get to set one off
  distance: 34, // x the species' `shy` = how far away the escape target is set
  hold: 3.5, // seconds it commits to that line before it may pick another
  // How much of the VERTICAL escape it keeps. A shark chasing from below pushes the
  // animal up and from above pushes it down, and the player's camera pitches with it
  // the whole way — which is the other half of what made chasing a dolphin unpleasant.
  // A quarter still reads as evasion without turning the pursuit into a rollercoaster.
  rise: 0.25,
};

// Shark handling, plus the timeScale multipliers for its baked swim clip.
// Drag pins cruise speed at accel/drag ≈ 12.2; boostAccelMul is what pushes the
// equilibrium past boostSpeed, which then hard-clamps it there.
//
// One world unit is one metre (see depthMetres/sharkLength in shark.js), so these
// are m/s and convert to real speeds directly: cruise 12.2 m/s = 27 mph, sprint
// 15.2 m/s = 34 mph. Both sit in the band a real shark runs — ~25-35 mph cruising,
// 35-45 in a burst.
export const SHARK = {
  maxSpeed: 14,
  accel: 22,
  drag: 1.8,
  turn: 1.6,
  pitchRate: 1.2,
  pitchLimit: 1.15,
  boostSpeed: 15.2,   // 34 mph
  // Has to keep the boosted equilibrium (accel x this / drag) clear of boostSpeed
  // or the clamp stops governing and the sprint creeps up to its asymptote over
  // several seconds instead of arriving. 1.35 puts it at 16.5, so 15.2 is reached
  // about two thirds of a second after Shift goes down.
  boostAccelMul: 1.35,
  reverseFrac: 0.4,
  reverseAccelMul: 1.2,
  tailRateIdle: 0.55,
  tailRateFast: 2.3,
  tailNormalMul: 0.8, // flat multipliers on top of the idle -> fast ramp, so
  tailSprintMul: 1.2, // cruise and sprint read as two distinct gaits
  camOffset: [0, 2.6, 8.5], // behind (+Z) and above the head
  startPos: [0, -2, 280], // middle of level 1; the floor clamp seats it on frame one
  floorClearance: 1.8,
  wakeAtSpeed: 3.5, // bubble trail kicks in above this
  mouseSensitivity: 0.0022,
  bodyRadius: 1.15, // resolved as three spheres down the body (collision.js)
  bodyHalfLength: 2.3,

  // Growth. Every length above is multiplied by the current scale at use
  // (shark.js) — collider, floor clearance, camera offset, bite reach.
  maxScale: 2.1, // 6.0 x 2.1 = 12.6 units, against the whale's 21
  camGrowth: 0, // how much of the growth the camera follows. 0 = growth is visible
  // Points for maxScale, read against a LIFETIME point total that buying upgrades
  // never spends (src/upgrades.js) — so the currency and the body cannot fight over
  // the same number.
  //
  // It has been raised three times, always for the same reason: this has to be a
  // fraction of the POINTS THE WHOLE GAME WILL PAY OUT, or the shark reaches adult
  // size in the first ten minutes and the one genuinely real stat in the build stops
  // meaning anything. 400 was one clearing of the reef. 2400 made it a long arc.
  // 3400 held that arc when the fish were priced by size. And now the upgrade sheet
  // costs ~54,500 points to finish, so 20,000 puts full size at roughly a third of
  // the way through a complete playthrough — earned, and well before the end.
  growthFull: 20000,
  growthLag: 1.2, // seconds for the scale to catch up — cosmetic damping
};

// Boost as a resource, measured in seconds of boost so the bar means something.
// Bottoming out LATCHES (shark.js): Shift does nothing until it refills fully,
// or an exhausted shark stutters in and out of boost one frame at a time.
export const STAMINA = {
  boostSeconds: 6, // a full bar, held down
  refillSeconds: 3.5, // empty -> full
};

// Biting. One sphere-vs-body query per click against the prey registry
// (prey.js) — no per-frame cost, which is why the reach can be generous.
export const BITE = {
  // Seconds between snaps — the base of the Attack speed stat, and the only one on
  // the sheet where LOWER is better, which is why the menu shows its reciprocal
  // (bites per second) instead. Read the live value through biteCooldown()
  // (upgrades.js), never from here.
  //
  // Doubled from 0.4 to NERF the unupgraded shark. A jaw that resets in four tenths
  // of a second is free damage: nothing in the ocean can punish it, so there was no
  // fight to have and nothing for an upgrade to sell you. At 0.8 s a whale takes
  // eight seconds of unbroken biting, which is two or three of its strikes taken —
  // so the first fight is genuinely hard, and buying attack speed buys the snappiness
  // back. Level 4 restores the old 0.4 s and level 5 goes past it.
  cooldown: 0.8,
  snap: 0.22, // head-snap animation length
  lunge: 3.2, // forward impulse, so a bite is also a pounce
  mouthAhead: 2.9, // puts the bite sphere at the nose; scales with the shark
  reach: 3.4, // hit radius, plus the prey's own girth
  coneCos: 0.45, // prey must be roughly ahead — ~63° half-angle
  gape: 1.8, // ...except inside this distance, where angle stops mattering
  respawn: 60, // seconds until an eaten animal returns, well away from the shark
  orbPoints: 6, // orbs are pure bonus growth: no bites, no chase
};

// ---- COMBAT (src/combat/, Docs/systems/attack-and-health.md) ----------------
// The shark's side of the fight. Its two headline numbers are NOT here — max
// health is PLAYER.health and bite damage is PLAYER.attack — because those are
// what the stat sheet upgrades, and a capability belongs in one place. This block
// is the rules around them.
//
// NOTHING HERE GROWS ON ITS OWN. Bite damage is a flat PLAYER.attack, max health a
// flat PLAYER.health, boost a flat STAMINA.boostSeconds. Eating makes the shark
// BIGGER and pays points; it does not quietly hand out damage or hit points on the
// side. Those are the upgrade system's to sell, from the menu, for points the player
// chooses to spend — and a stat that also creeps up by itself can never be priced.
//
// What still scales with the shark's size is GEOMETRY, not numbers: jaw reach and
// the hull the whale aims at. A 12.6 m animal with a 6 m animal's reach could not
// bite past its own nose.
export const COMBAT = {
  hitFlash: 0.22, // seconds the shark's whole body flashes white on being hit
  hitFlashGain: 2.4, // ...and how much emissive is added at the peak of it
  // How long the bar over the shark's head stays up after its health MOVES, either
  // way. It is not a permanent gauge: a health bar you can always see is a health
  // bar you stop reading, and this one is here to tell you something just happened.
  barShowFor: 2.5,
  hurtGrace: 0.3, // immunity after a hit, so two whales can't stack on one frame
  regenDelay: 8, // seconds without damage before health starts coming back...
  regenRate: 0.7, // ...at this, per second. Deliberately worse than one dolphin:
  //                  a floor that stops one bad fight being a dead end, not a heal.
  // Eating IS the repair kit — roadmap §4 rules out a hunger clock, so food has to
  // be worth something without ever being urgent. Paid against the same `points`
  // that drive growth: a whale restores 60 hp, a dolphin 16, a reef fish 0.4.
  //
  // Came down from 0.6 when the whale's points went to 150, or eating one would have
  // healed 90 of a starting shark's 100 hp. That is the seam in tying the heal to the
  // currency: points now carry a DIFFICULTY premium as well as biomass, and the day
  // those two diverge any further this wants its own per-creature number.
  healPerPoint: 0.4,
  deathHold: 2.2, // seconds you drift dead before waking in the shallows
  // The head bar is read by COLOUR first and length second: green, then amber below
  // warnHealth, then red below lowHealth — which is also where the damage vignette
  // stops flashing per hit and simply stays up.
  warnHealth: 0.6,
  lowHealth: 0.3,
};

// Shoaling fish. Each school picks one size class (weighted), then every member
// jitters inside that class, so the variety reads as species rather than noise.
export const FISH = {
  schools: 6, // generic bait schools, spread by area
  centerSchools: 4, // extra schools pinned near the start point...
  centerRoam: 0.34, // ...with a roam radius this fraction of the usual one

  // Two panic states: ALARMED is sustained flight while the shark is inside
  // fleeRadius; SPRINT is the extra gear on top, in bursts. The escape heading
  // is picked once per burst and held, so a shoal runs a line instead of
  // pivoting with the shark.
  fleeRadius: 26,
  fleeSpeedMul: 2.0, // burst multiplier
  alarmSpeedMul: 1.6, // sustained-flight multiplier between bursts
  sprintTime: 2.2,
  sprintCooldown: 3.2, // from the START of one burst to the next
  escapeTurn: 0.45, // fraction of the turn away from the shark a burst takes
  escapeCone: 1.2, // ...but never end up within this many rad of facing it
  burstSpread: 1.5, // formation flash-expands during a burst
  // Hard ceiling on shoal speed, whatever the multipliers work out to. Must stay
  // under the shark's own top speed or fish become uncatchable — this is what
  // stops the next cruise-speed raise reintroducing that bug.
  sprintCap: 13.2,
  beatMax: 2.2, // tail beat scales with speed/cruise, capped here
  roam: 0.85, // schools range this x WORLD.half

  // Steering: a school holds a HEADING and always swims forward along it.
  wanderDwell: [4, 4], // [min, extra] seconds between course nudges
  wanderTurn: 0.9, // max nudge, radians — curves, never doubles back
  turnRate: [1.1, 0.7], // [min, extra] rad/s, divided down by formation width
  alarmTurnMul: 1.9,
  speedEase: 0.002, // fraction of the speed gap remaining after one second
  climbRate: 2.2, // max vertical speed, units/s
  edgeMargin: 0.78, // fraction of roam radius where the turn-back pressure starts
  edgeTurn: 3.0, // ...and how hard it builds

  // Depth band, as HEIGHT ABOVE THE SEABED expressed as a fraction of levels.js
  // HABITAT (33 units) — so it means the same height at every depth.
  band: [0.18, 0.82],
  // Extra schools riding the water above the habitat band, where a deeper level
  // has headroom. Level 1's column IS the reference span, so it gets none.
  highSchools: 4,
  highBand: [0.05, 0.85], // fraction of the headroom, top of habitat -> surface
  highMinRoom: 12, // below this much spare column, don't bother
  floorClear: 3, // how far the school's CENTRE stays off the dunes
  bites: 1, // a class or species row may override either
  points: 1,

  //   scale  : [min, max] multiplier on the normalized fish model
  //   count  : [min, extra] members per school
  //   spread : school volume the members hold station in
  //   speed  : [base, extra] cruise speed — both halves move together
  //   weight : relative odds of a school drawing this class
  // `points` per class, because a 5-unit lunker and a 0.6-unit fry being worth the
  // same was the one flat part of the reward table — and points are a currency now
  // (src/upgrades.js), so what a thing is worth has to read off its size.
  classes: [
    { scale: [0.6, 1.0], count: [6, 5], spread: [4.5, 2.0, 4.5], speed: [5.0, 2.8], weight: 2, points: 1 }, // fry
    { scale: [1.0, 1.6], count: [8, 6], spread: [7.0, 3.2, 7.0], speed: [4.8, 3.0], weight: 4, points: 2 }, // mid-water
    { scale: [2.1, 3.0], count: [4, 4], spread: [9.0, 4.2, 9.0], speed: [4.2, 2.6], weight: 4, points: 3 }, // large
    { scale: [3.8, 5.0], count: [1, 2], spread: [11, 5.5, 11], speed: [3.6, 2.2], weight: 3, points: 5 }, // lunkers
  ],

  // Named species — real skinned rigs playing their own clip, at three draw
  // calls each, so they come in ones and twos. `schools` is [min, max] here, not
  // the [min, extra] pair `count` uses. band/floorClear override the defaults
  // above: the clownfish and blue fish are bottom-dwellers layered just apart,
  // fish-2 keeps the mid-water band and is the one deliberately common species.
  species: [
    {
      model: "blueFish",
      schools: [1, 2],
      count: [3, 1],
      scale: [1.0, 1.4],
      spread: [3.4, 1.6, 3.4],
      speed: [4.2, 2.6],
      clip: "Armature|Swim.001",
      rate: 2.2,
      band: [0.06, 0.28],
      floorClear: 1.8,
      name: "Blue fish",
      points: 2,
    },
    {
      model: "clownFish",
      schools: [1, 2],
      count: [3, 1],
      scale: [0.9, 1.3],
      spread: [3.0, 1.4, 3.0],
      speed: [4.6, 2.8],
      clip: "Armature|Swim",
      rate: 2.6,
      band: [0.02, 0.18],
      floorClear: 1.6,
      name: "Clownfish",
      points: 2,
    },
    {
      model: "fish2",
      schools: [2, 3],
      count: [4, 2],
      scale: [1.0, 1.4],
      spread: [4.4, 2.0, 4.4],
      speed: [4.6, 2.8],
      clip: "Armature|Swim",
      rate: 2.0,
      name: "Reef fish",
      points: 2,
    },
  ],
};

export const ORBS = { count: 12, collectRadius: 2.2 };

// One world unit is one metre, so every speed in this file is m/s. This is the
// only place that conversion is written down — the HUD and the menu both read it.
export const MPH = 2.23694;

// ---- PLAYER PROGRESSION (the E menu) ---------------------------------------
// What the shark IS at level 0, before it has bought anything. Every row of the
// stat sheet reads "what this shark can do now / what it could do fully upgraded",
// so the empty part of each bar is the upgrade path — what is still on the table.
// Moment-to-moment values (how fast you are going right now, how much boost is
// left in the tank) are the HUD's job and are deliberately not here.
//
// These are BASE values, and the live ones are base + level x step (src/upgrades.js).
// Nothing in the world raises them on its own: they move when the player spends
// points from the menu and at no other time, which is the only way an upgrade can be
// worth a price. See UPGRADES below and Docs/systems/progression.md.
//
// The two handling stats are not restated here at all — stamina's base is
// STAMINA.boostSeconds and speed's is SHARK.boostSpeed, the numbers the game
// actually runs on, so retuning handling moves the stat sheet with it.
export const PLAYER = {
  health: 100, // max hp — under TWO of the whale's 54-damage strikes.
  // Damage per bite, unupgraded. Every prey animal's hp is `bites x this` (prey.js),
  // so this number sets the scale of the whole ocean's health as well as the shark's
  // damage: the whale's 50 bites are 1000 hp because of it.
  attack: 20,
  // Pressure the shark can take, in atmospheres. The deepest floor in the world
  // is ~9.2 atm, so a starting 14 means every level is currently survivable with
  // room to spare — which is what you want while there is nothing to survive.
  // No upgrade row: pressure damage does not exist yet, and selling a stat that
  // does nothing is the one thing an upgrade screen must never do.
  pressure: 14,
  pressureCap: 60,
};

// ---- UPGRADES (src/upgrades.js, Docs/systems/progression.md) -----------------
// Eating pays points. Points buy levels. A level is a small fixed step on one stat,
// and the cost of the NEXT one is 20% higher than the last, so the interesting
// decision is never "can I afford everything" — it is "which of these four do I need
// next, and can I live without the other three for another twenty minutes".
//
//   step   what one level adds, in the stat's own unit. Deliberately TINY: ten levels
//          of +40 hp is a curve you climb, where two of +200 is a switch you flip.
//   levels ten, on every row. The stat sheet's `max` is base + step x levels, DERIVED
//          rather than authored, so the far end of every bar is a number you can
//          actually reach — the panel can never advertise a ceiling that no amount of
//          spending arrives at.
//   cost   points for the FIRST level. Every level after it is costGrowth times the
//          one before, so a row reads 450, 540, 648 ... 2322 and totals ~11,700.
//
// ---- WHY THE PRICES ARE THIS BRUTAL ----
// They were 50-100 points a level, and the whole sheet could be maxed in five or ten
// minutes by farming whales — which made every number on it meaningless and the whole
// upgrade screen a formality. The target is a 2-3 HOUR playthrough across ten depth
// levels with progression still live at the end of it, so the arc has to be measured
// in hours, not in one hunting trip.
//
// Maxing all four rows is ~54,500 points. That is NOT the expected playthrough — it
// is the completionist's. A focused build (two rows to level 7, two to level 4) is
// ~19,000 points, which is about two hours at a mid-game earning rate. Spreading
// levels evenly across four rows is the trap the rising cost is there to punish.
//
// These are tuned for a TWO-basin world and will need raising again as levels 3-10
// land and bring their own prey with them.
//
// WHY FOUR ROWS AND NOT SIX. Speed is missing on purpose: raising boostSpeed alone
// breaks the boostAccelMul invariant documented in SHARK, and roadmap §6 puts speed
// and pressure under the *Insight* currency (from discovery) rather than Growth (from
// hunting). Pressure is missing because nothing in the world reads it. Both rows still
// render — captioned as such — and adding either later is one row here plus a getter.
export const UPGRADES = {
  // Every level after the first costs this much more than the one before it. One
  // shared ratio rather than four, because the SHAPE of the curve is a single design
  // decision and the per-row `cost` below is what differentiates them.
  costGrowth: 1.2,

  // 100 -> 500 hp, +40 a level. Still the cheapest row, and still for the same
  // reason: dying is what stops a player exploring. It is also the row the whale
  // forces you to buy — at 100 hp its 54-damage strike kills you in two.
  health: { step: 40, levels: 10, cost: 450, unit: 'hp' },

  // 20 -> 80 dmg, +6 a level. Read it in BITES TO KILL A WHALE (1000 hp): 50 at level
  // zero, 27 at level 3, 20 at 5, 13 at 10. Every level is a shorter fight and so
  // less time inside a hostile whale's reach — the priciest row, and the one that
  // decides whether the biggest animal in the game is content or a wall.
  attack: { step: 6, levels: 10, cost: 600, unit: 'dmg' },

  // Attack speed, and the one INVERTED stat on the sheet: `step` comes off the bite
  // cooldown, so 0.8 s -> 0.3 s across ten levels and the jaws end up 2.7x faster.
  // 1.25 bites a second up to 3.3. The menu shows it as bites per second, because
  // "lower is better" cannot be drawn on a bar that fills as you improve. Level 8
  // restores the 0.4 s the shark once had for free; levels 9 and 10 go past it.
  //
  // Priced just under attack power, because the two rows buy the same thing — damage
  // per second — by different means, and they MULTIPLY: a whale is 40 seconds of
  // unbroken biting at level 0, 15 s with this row maxed, 16 s with attack maxed, and
  // 3.9 s with both. That compounding is the only interaction on this sheet, and it is
  // what makes committing to a build pay more than spreading levels evenly.
  attackSpeed: { step: 0.05, levels: 10, cost: 550, unit: 'bites/s' },

  // 6 -> 20 seconds of boost, +1.4 a level. `refillStep` is the honest half of it: a
  // 20-second tank that still refilled in 3.5 s would make stamina strictly better
  // than everything else on the sheet, so refilling a bigger tank takes longer too —
  // just not proportionally. At level 0 a rest second buys 1.7 boost seconds; fully
  // upgraded it buys 2.7. So the upgrade lengthens the sprint AND improves the rate,
  // without ever making boost free.
  stamina: { step: 1.4, refillStep: 0.4, levels: 10, cost: 500, unit: 's of boost' },
};

// In-game placement editor (F4). The brush cycles `models`, ordered big-to-small
// so the things worth hand-placing come first.
export const EDITOR = {
  models: [
    "mountain",
    "rockPile",
    "boulder",
    "rockSpire",
    "kelp",
    "kelpBush",
    "kelpFrond",
    "seaweed",
    "seagrass",
    "fern",
    "grass",
    "anemone",
    "log",
    "bones",
    "pebbles",
  ],
  distance: 26, // how far ahead of the shark the brush starts
  eraseRadius: 15, // starting size of the erase circle (Tab switches to it)
};

// Bubbles and marine snow, spread over a box sized off WORLD.half. One draw call
// each, so the real cost is FILL — alpha-blended sprites a tile GPU cannot cull.
export const PARTICLES = {
  bubbles: { count: 350, size: 0.55, opacity: 0.6 },
  snow: { count: 700, size: 0.16, opacity: 0.42 },
  wake: { count: 150, size: 0.3, opacity: 0.5 },
};

// One InstancedMesh, billboarded in the vertex shader — so `count` costs fill,
// not draw calls. The camera lives inside the volume and each shaft covers a big
// slab of screen, which is why 10 and not 30.
export const GOD_RAYS = {
  count: 10,
  fade: [70, 135], // [near, far] world units from the camera
};

// ---- PERFORMANCE DIALS -----------------------------------------------------
// Everything here trades image quality for frame time. Hand-set to Medium/High.
export const PERF = {
  targetFps: 60, // 0 = uncapped. The sim is time-based, so extra frames buy nothing.

  // Prop chunking: each PROPS row is split into a grid of InstancedMeshes with
  // tight bounding spheres, so frustum culling stops being all-or-nothing.
  // Target TRIANGLES per chunk, not instances — 8000 is where the curve flattens
  // (~119 draw calls, ~57% fewer triangles submitted). Cheap rows stay one chunk.
  chunkTriangles: 8000,
  minPropsPerChunk: 5, // ...floored here, so heavy rows can't shatter per-instance
  // Hard distance cull, matched to the fog, measured to a chunk's NEAR EDGE —
  // which is why the mountains (one big chunk) always survive it.
  propCull: 120,
  // 'lambert' | 'standard'. Lambert is a large fragment-ALU saving across ~1.4M
  // triangles of fogged rock. Flip to 'standard' if the rock looks too flat.
  propMaterial: "lambert",

  // Animation mixers: full rate inside mixerNear, mixerFarHz beyond it, frozen
  // past mixerFar. The shark always runs full rate.
  mixerNear: 45,
  mixerFar: 100,
  mixerFarHz: 20,
};

// Three always-on loops plus a fourth whose volume/rate track the shark's speed;
// the rest are one-shot SFX. volume/rate are [atRest, atMaxSpeed] pairs for the
// swim loop, a flat number elsewhere. A `rate` pair on a one-shot is per-play
// pitch jitter. Note HTMLAudioElement.volume is hard capped at 1.0.
export const AUDIO = {
  ambience: { url: "assets/audio/deep-ocean-ambience.mp3", volume: 1.0 },
  bubbles: { url: "assets/audio/bubbles-ambience.ogg", volume: 0.224 },
  whale: { url: "assets/audio/whale_sound.mp3", volume: 0.644 },
  swim: {
    url: "assets/audio/shark_movement.mp3",
    volume: [0.05, 0.45],
    rate: [0.8, 1.5],
  },
  collect: { url: "assets/audio/orb-collect.mp3", volume: 0.3 },
  splash: { url: "assets/audio/shark_drop_into_ocean.wav", volume: 0.36 },
  bite: { url: "assets/audio/shark_bite.mp3", volume: 0.45, rate: [0.92, 1.08] },
  eat: { url: "assets/audio/orb-collect.mp3", volume: 0.17, rate: 0.75 },

  // ---- COMBAT ----
  // Both are existing assets played at a rate they were not recorded at, rather
  // than two new files: the bite pitched down two thirds is a dull impact, and the
  // fish-flee whoosh at half speed is a big animal shifting its weight. Neither is
  // final — a whale strike wants its own recording — but a telegraph you can hear
  // is worth more than one waiting on an asset.
  hurt: { url: "assets/audio/shark_bite.mp3", volume: 0.5, rate: [0.5, 0.62] },
  whaleStrike: { url: "assets/audio/fish-flee.mp3", volume: 0.55, rate: [0.45, 0.55] },
};
