import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { WORLD, FISH } from './config.js';
import { scene } from './core.js';
import { floorAt } from './terrain.js';
import { ringRadius, clampRadius } from './placement.js';
import { resolveSolids } from './collision.js';

// ============================================================
//  SHOALS  — a school holds station around a wandering centre,
//            and bolts when the shark closes in.
//
//  A school is described by ONE row of numbers — member count, school volume,
//  cruise speed, size range — and there are two sources of those rows:
//
//    FISH.classes  size classes of the generic bait fish, picked by weight, so the
//                  reef holds everything from clouds of fry to slow lone lunkers.
//    FISH.species  named animated rigs (blue fish, clownfish, ...), a fixed one or
//                  two schools each.
//
//  The steering below doesn't care which it got. The only branch is that a species
//  row carries a `clip`, which means the fish are skinned rigs that animate
//  themselves instead of being wagged procedurally.
// ============================================================

const schools = [];
const tmp = new THREE.Vector3();
const away = new THREE.Vector3();

// How far out a shoal may range. Slightly past the shark's own bounds, so there
// are always fish out at the rim of the reef and not just in the middle.
const ROAM = WORLD.half * FISH.roam;

// Fraction of the water column -> world Y. 0 = mean seabed, 1 = surface. Same
// convention as CREATURES `band` — see config.js.
function columnY(frac) {
  return WORLD.seabed + frac * (WORLD.surface - WORLD.seabed);
}

// A random point in open water inside `band`, used both to spawn and to re-target.
// The radius is equal-area (placement.js): picking it uniformly is what used to
// pack every shoal into the centre of the map.
function wanderPoint(target, outer, band) {
  const a = Math.random() * Math.PI * 2, r = ringRadius(0, outer);
  return target.set(
    Math.cos(a) * r,
    columnY(band[0] + Math.random() * (band[1] - band[0])),
    Math.sin(a) * r
  );
}

// Weighted pick over FISH.classes — small fish should be the common sight.
function pickClass() {
  const classes = FISH.classes;
  let total = 0;
  for (const c of classes) total += c.weight;
  let roll = Math.random() * total;
  for (const c of classes) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }
  return classes[classes.length - 1];
}

// Give one cloned rig its own playhead on the named clip. Rooted on the CLONE, so
// the clip's bone-name lookups resolve inside that fish's own subtree and no two
// fish share a time.
function startClip(root, clips, cls) {
  if (!clips || !clips.length) {
    console.warn(`fish "${cls.model}": no animation clips found`);
    return null;
  }
  const clip = THREE.AnimationClip.findByName(clips, cls.clip) || clips[0];
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.timeScale = cls.rate * (0.85 + Math.random() * 0.3);
  action.play();
  action.time = Math.random() * clip.duration;   // stagger, or the school beats as one fish
  return mixer;
}

function makeSchool(proto, cls) {
  const animated = !!cls.clip;
  // Where in the water column this school lives, and how close to the dunes its
  // centre is allowed to sit. A bottom species needs both: the band alone still
  // leaves it hovering three units up, which is above most of the plants.
  const band = cls.band || FISH.band;
  const floorClear = cls.floorClear ?? FISH.floorClear;
  const center = wanderPoint(new THREE.Vector3(), ROAM, band);
  const [sx, sy, sz] = cls.spread;
  const [scaleMin, scaleMax] = cls.scale;
  const count = cls.count[0] + Math.floor(Math.random() * (cls.count[1] + 1));
  const members = [];

  for (let i = 0; i < count; i++) {
    const size = scaleMin + Math.random() * (scaleMax - scaleMin);
    // A skinned rig MUST go through SkeletonUtils.clone: plain clone() duplicates
    // the bones but leaves every copy bound to the PROTOTYPE's skeleton, so the
    // whole school would deform as a single fish (and inherit its position too).
    const f = animated ? cloneSkinned(proto) : proto.clone(true);
    f.scale.multiplyScalar(size);
    f.position.copy(center);
    f.rotation.order = 'YXZ';
    scene.add(f);
    members.push({
      obj: f,
      offset: new THREE.Vector3(
        (Math.random() - 0.5) * sx,
        (Math.random() - 0.5) * sy,
        (Math.random() - 0.5) * sz
      ),
      phase: Math.random() * Math.PI * 2,
      // Tail beat scales inversely with length: a 3 cm fry flickers, a big fish
      // makes slow deliberate strokes. Keeps the shoal from looking like one
      // animation played at N scales.
      wobble: (0.4 + Math.random() * 0.7) / Math.sqrt(size),
      // Own collision radius, so a lunker clears a boulder by more than a fry.
      radius: 0.35 * size,
      mixer: animated ? startClip(f, proto.clips, cls) : null,
    });
  }

  schools.push({
    center, members, animated, band, floorClear,
    target: center.clone(),
    vel: new THREE.Vector3(),
    speed: cls.speed[0] + Math.random() * cls.speed[1],
    radius: Math.max(sx, sz) * 0.5,   // the formation's own half-width, for collision
    retarget: 0,
  });
}

export function createSchools(models) {
  for (let i = 0; i < FISH.schools; i++) makeSchool(models.fish, pickClass());

  // The named species on top: a fixed one or two schools each, so every playthrough
  // has all of them somewhere on the reef rather than leaving it to a weighted roll.
  for (const cls of FISH.species) {
    const proto = models[cls.model];
    if (!proto) { console.warn(`fish model "${cls.model}" not loaded`); continue; }
    const [lo, hi] = cls.schools;
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    for (let i = 0; i < n; i++) makeSchool(proto, cls);
  }
  return schools;
}

export function updateSchools(dt, t, sharkPos) {
  let fleeing = false;
  for (const s of schools) {
    s.retarget -= dt;
    if (s.retarget <= 0) {
      wanderPoint(s.target, ROAM, s.band);
      s.retarget = 4 + Math.random() * 5;
    }

    let speedMul = 1;
    if (s.center.distanceTo(sharkPos) < FISH.fleeRadius) {
      // bolt away from the shark
      away.copy(s.center).sub(sharkPos);
      if (away.lengthSq() < 1e-6) away.set(1, 0, 0);   // shark right on top of them
      // Mostly LATERALLY, though. A shoal dived on from above gets a flee vector
      // pointing almost straight down, and a target under the sand is no escape at
      // all — it spends the panic pressed into the floor clamp while the shark eats
      // it. Damping Y makes them scatter sideways, which is what a shoal does.
      away.y *= 0.4;
      away.normalize().multiplyScalar(FISH.fleeDistance);
      s.target.copy(s.center).add(away);
      // Panic inside the shoal's OWN band: a reef species that bolts up into open
      // water and then spends ten seconds sinking home has left its habitat.
      s.target.y = THREE.MathUtils.clamp(s.target.y, columnY(s.band[0]), columnY(s.band[1]));
      // Pull the panic target back inside the roam circle. Otherwise a shoal
      // cornered against the bounds spends the next second pressed flat into the
      // clamp instead of actually escaping.
      clampRadius(s.target, ROAM);
      speedMul = FISH.fleeSpeedMul;
      s.retarget = Math.min(s.retarget, 1.2);
      fleeing = true;
    }

    tmp.copy(s.target).sub(s.center);
    if (tmp.lengthSq() > 1e-4) tmp.normalize().multiplyScalar(s.speed * speedMul);
    s.vel.lerp(tmp, 1 - Math.pow(0.08, dt));
    s.center.addScaledVector(s.vel, dt);

    // keep the shoal inside the world and off the seabed
    clampRadius(s.center, ROAM);
    s.center.y = THREE.MathUtils.clamp(s.center.y, floorAt(s.center.x, s.center.z, s.floorClear), WORLD.surface - 2.5);

    // Steer the whole shoal around rock, using the school's own volume as the
    // radius. Resolving only the individual fish would let the formation's centre
    // sit inside a boulder with the members squashed against its surface — they'd
    // never penetrate it, but they'd cling to it like iron filings.
    if (resolveSolids(s.center, s.radius)) {
      s.retarget = Math.min(s.retarget, 1.0);
      // The push is horizontal, so re-seat above the dunes at the new x/z.
      s.center.y = Math.max(s.center.y, floorAt(s.center.x, s.center.z, s.floorClear));
    }

    // model forward is -Z, so heading = atan2(-vx, -vz)
    const heading = Math.atan2(-s.vel.x, -s.vel.z);
    const vLen = s.vel.length();
    const cosH = Math.cos(heading), sinH = Math.sin(heading);
    const pitch = vLen > 0.1 ? -Math.asin(THREE.MathUtils.clamp(s.vel.y / vLen, -1, 1)) * 0.7 : 0;
    const follow = 1 - Math.pow(0.05, dt);

    for (const m of s.members) {
      // rotate the slot offset into the shoal's heading
      tmp.set(
        m.offset.x * cosH + m.offset.z * sinH,
        m.offset.y + Math.sin(t * 1.6 * m.wobble + m.phase) * 0.5,
        -m.offset.x * sinH + m.offset.z * cosH
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
      // flick. An animated rig already beats its own tail, and stacking a 7 Hz roll
      // on top of that reads as a convulsion, so those get a slow lazy bank instead.
      m.obj.rotation.z = s.animated
        ? Math.sin(t * 0.9 * m.wobble + m.phase) * 0.07
        : Math.sin(t * 7 * m.wobble + m.phase) * 0.1;
      if (m.mixer) m.mixer.update(dt);
    }
  }
  return fleeing;
}
