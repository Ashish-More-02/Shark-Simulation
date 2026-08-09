import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { WORLD, FISH } from './config/config.js';
import { scene } from './core.js';
import { floorAt } from './terrain.js';
import { ringRadius, clampRadius, makeStream, live } from './placement.js';
import { habitatY, openWaterY, headroom } from './levels.js';
import { resolveSolids } from './collision.js';
import { tickMixer } from './mixers.js';
import { registerPrey } from './prey.js';

// ============================================================
//  SHOALS  — a school cruises on a heading, and runs when the shark closes in.
//
//  A school is described by ONE row of numbers — member count, school volume,
//  cruise speed, size range — and there are two sources of those rows:
//
//    FISH.classes  size classes of the generic bait fish, picked by weight, so the
//                  reef holds everything from clouds of fry to slow lone lunkers.
//    FISH.species  named animated rigs (blue fish, clownfish, fish-2), a fixed
//                  per-species school count rather than a weighted roll.
//
//  The steering below doesn't care which it got. The only branch is that a species
//  row carries a `clip`, which means the fish are skinned rigs that animate
//  themselves instead of being wagged procedurally.
//
//  ---- WHY THERE ARE NO WAYPOINTS ----
//  This used to steer toward a target POINT: pick a spot, swim at it, pick another.
//  Every version of that model has the same terminal flaw — its goal is ARRIVAL, and
//  arrival is a full stop. On reaching the target the direction vector collapses to
//  zero, the velocity decays to nothing, and the facing (`atan2(-vel.x, -vel.z)`)
//  gets computed from two near-zero components, which is pure noise. The visible
//  result is a school hanging in one place flipping through random headings.
//
//  Three separate things all led to that same stall: an alarmed school re-pinned its
//  retarget timer every frame so it could never choose a new point; a `fleeDistance`
//  of 30 units clamped into a center school's 22-unit roam circle produced "escape"
//  targets two units away; and nothing anywhere guarded the facing against a
//  vanishing velocity.
//
//  So there is no destination any more. A school carries a HEADING as state and
//  always swims forward along it at no less than cruise speed. Steering means
//  turning that heading at a bounded rate — toward a random nudge while wandering,
//  toward open water near the boundary, away from the shark when frightened. Nothing
//  can stall because there is nothing to arrive at, and the facing can never be
//  garbage because it is read from the heading itself rather than from a vector that
//  is allowed to reach zero.
// ============================================================

const schools = [];
const tmp = new THREE.Vector3();

// This subsystem's own slice of the world seed (placement.js). Everything a school
// is BORN with comes from here, so the same seed lays out the same shoals: how many
// of each species, where each one starts, how big its members are, which way it is
// facing on the first frame.
//
// What it must never be used for is the steering in updateSchools — that runs off
// `live` instead. The dividing line is BORN vs BEHAVES: a school's spawn is part of
// the world and has to be reproducible, whereas its panic turn three minutes in
// happens because the player swam at it, at a frame rate nothing can replay. Mixing
// the two would also mean the fish quietly re-rolled their own spawn stream for the
// whole session, so a second level built later would come out different.
//
// PER LEVEL, not one for the whole world. createSchools is called once per level,
// and on a single stream the shallows drew first — so their school COUNTS, which
// are random ranges, decided where every shoal on the reef ended up. Halving the
// plain's density re-laid the reef. Each level now gets its own slice, so the two
// cannot reach each other; `rng` is reassigned at the top of createSchools and
// read by everything below it.
let rng = makeStream('fish');

// How far out a shoal may range FROM ITS OWN LEVEL'S CENTRE, as a fraction of
// that level's own play bound — so a shoal fills whatever basin it is in, and a
// level that grows takes its fish with it. Under the bound, so the shoals are
// always somewhere the shark can follow them.
function roamFor(level) {
  return level.play * FISH.roam;
}

// Shortest signed distance between two angles, so a school crossing ±π turns the
// short way round instead of unwinding the long way.
function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

// A random depth inside the band, at this z.
//
// Two storeys, and which one a school is in is fixed when it spawns:
//   normal — height above the SEABED (levels.js habitatY). This is where a reef
//            shoal belongs: down among the kelp, the ferns and the boulders. The
//            band numbers in config are read against a fixed reference span, so
//            they mean the same height at every depth.
//   high   — the open water above that band, which only a level deeper than the
//            reference has any of. Without these, level 2's extra 35 units of
//            water would be visibly empty.
//
// Takes its stream explicitly because it is called from BOTH sides of the split:
// once at spawn (seeded) and again on every wander nudge (live).
function bandY(band, z, high, draw) {
  const f = band[0] + draw() * (band[1] - band[0]);
  return high ? openWaterY(f, z) : habitatY(f, z);
}

// Where a school starts, measured from its own level's centre. Equal-area radius
// (placement.js): picking it uniformly is what used to pack every shoal into the
// middle of the map. Only used at spawn — there is no "next waypoint" after this.
function spawnPoint(home, outer, band, high) {
  const a = rng() * Math.PI * 2, r = ringRadius(0, outer, rng);
  const x = home[0] + Math.cos(a) * r;
  const z = home[2] + Math.sin(a) * r;
  return new THREE.Vector3(x, bandY(band, z, high, rng), z);
}

// Weighted pick over FISH.classes — small fish should be the common sight.
function pickClass() {
  const classes = FISH.classes;
  let total = 0;
  for (const c of classes) total += c.weight;
  let roll = rng() * total;
  for (const c of classes) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }
  return classes[classes.length - 1];
}

// Give one cloned rig its own playhead on the named clip. Rooted on the CLONE, so
// the clip's bone-name lookups resolve inside that fish's own subtree and no two
// fish share a time. The action comes back as well as the mixer: the member loop
// scales its timeScale by how hard the fish is actually swimming.
function startClip(root, clips, cls) {
  if (!clips || !clips.length) {
    console.warn(`fish "${cls.model}": no animation clips found`);
    return null;
  }
  const clip = THREE.AnimationClip.findByName(clips, cls.clip) || clips[0];
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  const rate = cls.rate * (0.85 + rng() * 0.3);
  action.timeScale = rate;
  action.play();
  action.time = rng() * clip.duration;   // stagger, or the school beats as one fish
  return { mixer, action, rate };
}

// `roam` is how far out THIS school may range. Defaults to the reef-wide ROAM; the
// centerSchools rows get a much smaller one so they hold the middle ground.
function makeSchool(proto, cls, home, roam, high = false) {
  const animated = !!cls.clip;
  // Where in the water column this school lives, and how close to the dunes its
  // centre is allowed to sit. A bottom species needs both: the band alone still
  // leaves it hovering three units up, which is above most of the plants.
  const band = cls.band || FISH.band;
  const floorClear = cls.floorClear ?? FISH.floorClear;
  const center = spawnPoint(home, roam, band, high);
  const [sx, sy, sz] = cls.spread;
  const [scaleMin, scaleMax] = cls.scale;
  const count = cls.count[0] + Math.floor(rng() * (cls.count[1] + 1));
  const members = [];

  for (let i = 0; i < count; i++) {
    const size = scaleMin + rng() * (scaleMax - scaleMin);
    // A skinned rig MUST go through SkeletonUtils.clone: plain clone() duplicates
    // the bones but leaves every copy bound to the PROTOTYPE's skeleton, so the
    // whole school would deform as a single fish (and inherit its position too).
    const f = animated ? cloneSkinned(proto) : proto.clone(true);
    f.scale.multiplyScalar(size);
    f.position.copy(center);
    f.rotation.order = 'YXZ';
    scene.add(f);
    const clip = animated ? startClip(f, proto.clips, cls) : null;
    const phase = rng() * Math.PI * 2;
    const m = {
      obj: f,
      offset: new THREE.Vector3(
        (rng() - 0.5) * sx,
        (rng() - 0.5) * sy,
        (rng() - 0.5) * sz
      ),
      phase,
      // Tail beat scales inversely with length: a 3 cm fry flickers, a big fish
      // makes slow deliberate strokes. Keeps the shoal from looking like one
      // animation played at N scales.
      wobble: (0.4 + rng() * 0.7) / Math.sqrt(size),
      // ACCUMULATED tail-beat phase for the procedural fish. It has to accumulate
      // rather than being sin(t * rate): the rate now tracks how hard the fish is
      // swimming, and sin() of a time multiplied by a changing rate jumps every time
      // the rate changes. Integrating the rate instead keeps it continuous.
      beat: phase,
      // Own collision radius, so a lunker clears a boulder by more than a fry.
      radius: 0.35 * size,
      mixer: clip ? clip.mixer : null,
      action: clip ? clip.action : null,
      baseRate: clip ? clip.rate : 0,
      // Eaten fish are skipped by the update loop entirely (see updateSchools),
      // which is also what makes them free while they're gone.
      alive: true,
    };
    members.push(m);

    // Biteable. `f.position` is handed over as a LIVE reference — prey.js reads
    // wherever the fish currently is without anyone having to tell it.
    registerPrey({
      pos: f.position,
      // Generous next to the fish's 0.35-per-unit collision radius. That number
      // is for not clipping boulders; this one is for a moving target you are
      // trying to catch at 14 units a second, and a hitbox that tight would make
      // every bite feel broken. Clamped at the top so the rare 5-unit lunker
      // doesn't end up with a hit sphere as long as it is — that reads as biting
      // a fish you never actually reached.
      radius: THREE.MathUtils.clamp(m.radius * 3, 0.7, 2.4),
      name: cls.name || 'Fish',
      bites: cls.bites ?? FISH.bites,
      points: cls.points ?? FISH.points,
      hide() { m.alive = false; f.visible = false; },
      // Back at the school's centre — `center` is the live Vector3 the shoal
      // steers, so the fish rejoins wherever its school has wandered to in the
      // minute it was gone, then lerps into its slot in formation.
      show() { m.alive = true; f.visible = true; f.position.copy(center); },
    });
  }

  const speed = cls.speed[0] + rng() * cls.speed[1];
  const yaw = rng() * Math.PI * 2;

  schools.push({
    center, members, animated, band, floorClear, roam, speed, high,
    // The basin this shoal belongs to. Everything radial below — the edge turn,
    // the position clamp — is measured from here rather than from the origin, so
    // a level-1 school holds level 1 instead of being dragged toward level 2.
    hx: home[0], hz: home[2],
    // ---- steering state ----
    yaw,                  // heading of travel in the XZ plane, as (cos yaw, sin yaw)
    wantYaw: yaw,         // heading it is turning toward
    wantY: center.y,      // depth it is easing toward, inside `band`
    spd: speed,           // current speed, eased toward cruise x whatever gear it's in
    // Max turn rate. Scaled DOWN by the formation's width, so a wide school of big
    // fish arcs and a tight cloud of fry can flick round — the same trick creatures.js
    // uses to make a whale feel heavy next to a dolphin.
    turn: (FISH.turnRate[0] + rng() * FISH.turnRate[1]) / (1 + Math.max(sx, sz) * 0.06),
    vel: new THREE.Vector3(),   // derived each frame from yaw/spd, for facing + pitch
    radius: Math.max(sx, sz) * 0.5,   // the formation's own half-width, for collision
    retarget: 0,      // seconds until the next wander nudge
    sprint: 0,        // seconds of burst left
    sprintCd: 0,      // seconds until another one is allowed
    spreadMul: 1,     // formation flash-expand, eased toward FISH.burstSpread
  });
}

// Populate one level. `density` scales every count for a level that should feel
// emptier than the reef — level 1 is a plain, and a plain with a full reef's worth
// of fish in it is not a plain.
export function createSchools(models, level, density = 1) {
  rng = makeStream(`fish:${level.id}`);
  const home = level.center;
  const ROAM = roamFor(level);
  const scale = (n) => Math.max(1, Math.round(n * density));

  for (let i = 0; i < scale(FISH.schools); i++) makeSchool(models.fish, pickClass(), home, ROAM);

  // ---- THE UPPER STOREY ----
  // Only in levels with water to spare above the habitat band. Level 1's column IS
  // the reference span, so it gets none and stays a plain with fish on the sand;
  // level 2 has 35 units over the reef and would look abandoned up there without
  // these. Same bait fish, just riding higher — so looking up from the reef shows
  // shoals crossing overhead, and the shark can hunt at two heights.
  if (headroom(level.seabed) > FISH.highMinRoom) {
    for (let i = 0; i < scale(FISH.highSchools); i++) {
      makeSchool(models.fish, { ...pickClass(), band: FISH.highBand }, home, ROAM, true);
    }
  }

  // Schools that hold the middle of the basin — the water the shark starts in and
  // patrols, which equal-area placement leaves nearly empty. See centerSchools.
  const inner = ROAM * FISH.centerRoam;
  for (let i = 0; i < scale(FISH.centerSchools); i++) {
    makeSchool(models.fish, pickClass(), home, inner);
  }

  // The named species on top: a fixed small count of schools each, so every
  // playthrough has all of them somewhere on the reef rather than leaving it to a
  // weighted roll. Species are per-level too — `only` restricts a row to one
  // level's id, which is how the reef keeps a species the shallows doesn't have.
  for (const cls of FISH.species) {
    if (cls.only && cls.only !== level.id) continue;
    const proto = models[cls.model];
    if (!proto) { console.warn(`fish model "${cls.model}" not loaded`); continue; }
    const [lo, hi] = cls.schools;
    const n = scale(lo + Math.floor(rng() * (hi - lo + 1)));
    for (let i = 0; i < n; i++) makeSchool(proto, cls, home, ROAM);
  }
  return schools;
}

export function updateSchools(dt, t, sharkPos) {
  for (const s of schools) {
    // Shark in the shoal. A STATE, not an event: true the whole time it is there,
    // which is what stops a school going back to cruising between bursts.
    const alarmed = s.center.distanceTo(sharkPos) < FISH.fleeRadius;

    s.sprint -= dt;
    s.sprintCd -= dt;

    // ---- WANDER: nudge the heading ----
    s.retarget -= dt;
    if (s.retarget <= 0) {
      s.retarget = FISH.wanderDwell[0] + live() * FISH.wanderDwell[1];
      // A frightened school is not sightseeing — leave its escape line alone. And
      // note this timer runs down normally either way, so unlike the version that
      // pinned it every frame there is no state it can get stuck in.
      if (!alarmed) {
        s.wantYaw = s.yaw + (live() * 2 - 1) * FISH.wanderTurn;
        s.wantY = bandY(s.band, s.center.z, s.high, live);
      }
    }

    // ---- BURST: aim the escape ----
    // Once per cooldown, not every frame the shark is near, so the line is committed
    // to rather than redrawn as the shark circles.
    if (alarmed && s.sprint <= 0 && s.sprintCd <= 0) {
      const ax = s.center.x - sharkPos.x, az = s.center.z - sharkPos.z;
      const awayYaw = ax * ax + az * az > 1e-6
        ? Math.atan2(az, ax)
        : live() * Math.PI * 2;             // shark exactly on top of them

      // Take a FRACTION of the turn toward straight-away, so a school already
      // running keeps its line and simply puts on speed — that is what reads as
      // fleeing rather than wheeling. But never keep a heading that still points
      // into the shark: escapeCone is how close to straight-away the result has to
      // end up at worst, so a school swimming right at it does turn out.
      const d = angleDelta(s.yaw, awayYaw);
      const mag = Math.abs(d);
      const take = Math.min(mag, Math.max(mag * FISH.escapeTurn, mag - FISH.escapeCone));
      s.wantYaw = s.yaw + Math.sign(d) * take;
      // Break through open water, not into the sand or up through the surface.
      s.wantY = bandY(s.band, s.center.z, s.high, live);

      s.sprint = FISH.sprintTime;
      s.sprintCd = FISH.sprintCooldown;
    }

    // ---- EDGE: curve back toward open water ----
    // Replaces steering at a clamped target. clampRadius still backstops the
    // position below, but a school should never actually reach it: the pressure to
    // come about ramps up from `edgeMargin` to the boundary, so it arcs round while
    // still swimming — which is exactly the sweep along the mountain line.
    const r = Math.hypot(s.center.x - s.hx, s.center.z - s.hz);
    const edge = s.roam * FISH.edgeMargin;
    if (r > edge) {
      const inward = Math.atan2(s.hz - s.center.z, s.hx - s.center.x);
      const push = Math.min((r - edge) / Math.max(s.roam - edge, 0.001), 1);
      s.wantYaw += angleDelta(s.wantYaw, inward) * Math.min(push * dt * FISH.edgeTurn, 1);
    }

    // ---- TURN + THROTTLE ----
    let speedMul = 1;
    if (s.sprint > 0) speedMul = FISH.fleeSpeedMul;
    else if (alarmed) speedMul = FISH.alarmSpeedMul;   // between bursts, still running

    const step = s.turn * (alarmed ? FISH.alarmTurnMul : 1) * dt;
    s.yaw += THREE.MathUtils.clamp(angleDelta(s.yaw, s.wantYaw), -step, step);

    // sprintCap is a hard ceiling below the shark's own top speed — see config.js.
    const wantSpd = Math.min(s.speed * speedMul, FISH.sprintCap);
    s.spd += (wantSpd - s.spd) * (1 - Math.pow(FISH.speedEase, dt));

    // ---- MOVE: always forward ----
    // s.spd never drops below cruise, so `vel` is never degenerate and the facing
    // derived from it downstream is always meaningful.
    const climb = THREE.MathUtils.clamp(s.wantY - s.center.y, -FISH.climbRate, FISH.climbRate);
    s.vel.set(Math.cos(s.yaw) * s.spd, climb, Math.sin(s.yaw) * s.spd);
    s.center.addScaledVector(s.vel, dt);

    // keep the shoal inside its own range and off the seabed
    clampRadius(s.center, s.roam, s.hx, s.hz);
    s.center.y = THREE.MathUtils.clamp(s.center.y, floorAt(s.center.x, s.center.z, s.floorClear), WORLD.surface - 2.5);

    // Steer the whole shoal around rock, using the school's own volume as the
    // radius. Resolving only the individual fish would let the formation's centre
    // sit inside a boulder with the members squashed against its surface — they'd
    // never penetrate it, but they'd cling to it like iron filings.
    if (resolveSolids(s.center, s.radius)) {
      // Come about, rather than grinding along the face for the rest of the leg.
      // A random side: the alternative is deriving one from the contact normal,
      // which resolveSolids doesn't report, and a coin flip looks the same.
      s.wantYaw = s.yaw + (live() < 0.5 ? -1 : 1) * (0.7 + live() * 0.9);
      // The push is horizontal, so re-seat above the dunes at the new x/z.
      s.center.y = Math.max(s.center.y, floorAt(s.center.x, s.center.z, s.floorClear));
    }

    // Flash expand — the formation blows outward during a burst and eases back after.
    const wantSpread = s.sprint > 0 ? FISH.burstSpread : 1;
    s.spreadMul += (wantSpread - s.spreadMul) * (1 - Math.pow(0.02, dt));

    // ---- MEMBERS ----
    // Facing comes straight off the heading, NOT off atan2 of the velocity. Same
    // number while moving, but it cannot degenerate — this is the line that used to
    // produce the spinning. Model forward is -Z, hence the negated components.
    const heading = Math.atan2(-Math.cos(s.yaw), -Math.sin(s.yaw));
    const vLen = s.vel.length();
    const pitch = -Math.asin(THREE.MathUtils.clamp(s.vel.y / vLen, -1, 1)) * 0.7;
    const follow = 1 - Math.pow(0.05, dt);
    // How hard the school is working: 1 at cruise, up to ~2 flat out. Drives the tail
    // beat, which is most of why the fish "looked slow" — the beat used to be a fixed
    // 7 Hz (or a fixed clip timeScale) no matter how fast the fish was travelling, so
    // nothing on screen said "this fish is sprinting" except the metres going past.
    const effort = Math.min(s.spd / s.speed, FISH.beatMax);

    for (const m of s.members) {
      // Eaten: hidden, and skipped outright — no lerp, no two rock resolves, no
      // mixer. An eaten fish costs literally nothing for the minute it is gone.
      if (!m.alive) continue;
      // Slot offsets are held in WORLD axes, deliberately NOT rotated into the
      // shoal's heading. Rotating them is what made the fish appear to swap places
      // with each other: every `spread` in config.js is symmetric in x and z (a
      // flattened disc — [7.0, 3.2, 7.0] and friends), so spinning the offsets
      // changes the formation's SHAPE by exactly nothing while carrying a fish from
      // one side of the school to the other. All cost, no benefit.
      //
      // If a row ever gets an asymmetric spread — long and narrow, a genuine
      // travelling column — this is where the rotation goes back in.
      tmp.set(
        m.offset.x * s.spreadMul,
        m.offset.y + Math.sin(t * 1.6 * m.wobble + m.phase) * 0.5,
        m.offset.z * s.spreadMul
      ).add(s.center);
      m.obj.position.lerp(tmp, follow);
      // Individual resolve on top of the shoal-level one: the formation is wider
      // than the rock it's steering around, so members on the inside of the turn
      // still clip it even when the centre is clear.
      resolveSolids(m.obj.position, m.radius);
      // Then its own floor, UNCONDITIONALLY — not just after a rock push. The
      // shoal centre is what gets clamped off the dunes, and a member at the bottom
      // of the formation with its bob at full stretch hangs a good unit below that.
      // Mid-water that's invisible; for the reef species, whose centre rides low on
      // purpose, it's the difference between brushing the sand and swimming in it.
      const p = m.obj.position;
      p.y = Math.max(p.y, floorAt(p.x, p.z, m.radius));
      m.obj.rotation.y = heading;
      m.obj.rotation.x = pitch;
      // The bait fish have no clip, so their "swimming" IS this roll — a fast body
      // flick, integrated so it stays continuous as `effort` changes. An animated rig
      // already beats its own tail, and stacking a 7 Hz roll on top of that reads as
      // a convulsion, so those get a slow lazy bank and quicken their CLIP instead.
      if (s.animated) {
        m.obj.rotation.z = Math.sin(t * 0.9 * m.wobble + m.phase) * 0.07;
        m.action.timeScale = m.baseRate * effort;
      } else {
        m.beat += dt * 7 * m.wobble * effort;
        m.obj.rotation.z = Math.sin(m.beat) * 0.1;
      }
      // Distance-gated: full rate up close, 20 Hz mid-range, frozen past the fog
      // horizon. See mixers.js — most of the school is not worth a bone-texture
      // upload every frame.
      tickMixer(m, dt, p);
    }
  }
}
