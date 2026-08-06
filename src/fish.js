import * as THREE from 'three';
import { WORLD, FISH } from './config.js';
import { scene } from './core.js';
import { floorAt } from './terrain.js';
import { ringRadius, clampRadius } from './placement.js';
import { resolveSolids } from './collision.js';

// ============================================================
//  SHOALS  — a school holds station around a wandering centre,
//            and bolts when the shark closes in.
//
//  Every school is one size class drawn from FISH.classes, so the reef holds
//  everything from clouds of fry to lone slow-moving lunkers. Class sets the
//  member count, the school volume and the cruise speed together, because those
//  three go with body size in the same direction.
// ============================================================

const schools = [];
const tmp = new THREE.Vector3();
const away = new THREE.Vector3();

// How far out a shoal may range. Slightly past the shark's own bounds, so there
// are always fish out at the rim of the reef and not just in the middle.
const ROAM = WORLD.half * FISH.roam;

// A random point in open water, used both to spawn and to re-target. The radius
// is equal-area (placement.js): picking it uniformly is what used to pack every
// shoal into the centre of the map.
function wanderPoint(target, outer) {
  const a = Math.random() * Math.PI * 2, r = ringRadius(0, outer);
  return target.set(
    Math.cos(a) * r,
    WORLD.seabed + 6 + Math.random() * (WORLD.surface - WORLD.seabed - 12),
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

function makeSchool(protoFish) {
  const cls = pickClass();
  const center = wanderPoint(new THREE.Vector3(), ROAM);
  const [sx, sy, sz] = cls.spread;
  const [scaleMin, scaleMax] = cls.scale;
  const count = cls.count[0] + Math.floor(Math.random() * (cls.count[1] + 1));
  const members = [];

  for (let i = 0; i < count; i++) {
    const size = scaleMin + Math.random() * (scaleMax - scaleMin);
    const f = protoFish.clone(true);
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
    });
  }

  schools.push({
    center, members,
    target: center.clone(),
    vel: new THREE.Vector3(),
    speed: cls.speed[0] + Math.random() * cls.speed[1],
    radius: Math.max(sx, sz) * 0.5,   // the formation's own half-width, for collision
    retarget: 0,
  });
}

export function createSchools(protoFish) {
  for (let i = 0; i < FISH.schools; i++) makeSchool(protoFish);
  return schools;
}

export function updateSchools(dt, t, sharkPos) {
  let fleeing = false;
  for (const s of schools) {
    s.retarget -= dt;
    if (s.retarget <= 0) {
      wanderPoint(s.target, ROAM);
      s.retarget = 4 + Math.random() * 5;
    }

    let speedMul = 1;
    if (s.center.distanceTo(sharkPos) < FISH.fleeRadius) {
      // bolt directly away from the shark
      away.copy(s.center).sub(sharkPos).normalize().multiplyScalar(FISH.fleeDistance);
      s.target.copy(s.center).add(away);
      s.target.y = THREE.MathUtils.clamp(s.target.y, WORLD.seabed + 4, WORLD.surface - 3);
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
    s.center.y = THREE.MathUtils.clamp(s.center.y, floorAt(s.center.x, s.center.z, 3), WORLD.surface - 2.5);

    // Steer the whole shoal around rock, using the school's own volume as the
    // radius. Resolving only the individual fish would let the formation's centre
    // sit inside a boulder with the members squashed against its surface — they'd
    // never penetrate it, but they'd cling to it like iron filings.
    if (resolveSolids(s.center, s.radius)) {
      s.retarget = Math.min(s.retarget, 1.0);
      // The push is horizontal, so re-seat above the dunes at the new x/z.
      s.center.y = Math.max(s.center.y, floorAt(s.center.x, s.center.z, 3));
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
      if (resolveSolids(m.obj.position, m.radius)) {
        const p = m.obj.position;
        p.y = Math.max(p.y, floorAt(p.x, p.z, m.radius));
      }
      m.obj.rotation.y = heading;
      m.obj.rotation.x = pitch;
      m.obj.rotation.z = Math.sin(t * 7 * m.wobble + m.phase) * 0.1;   // tail flick
    }
  }
  return fleeing;
}
