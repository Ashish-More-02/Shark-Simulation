import { PERF } from './config/config.js';
import { camera } from './core.js';

// ============================================================
//  MIXER GATING  (PERFORMANCE.md §4.3)
//
//  An AnimationMixer.update() is not cheap. It interpolates every keyframe track,
//  writes every bone transform, and then Skeleton.update() rebuilds every bone
//  matrix and re-uploads a bone texture to the GPU. Twenty-two of those ran every
//  single frame: 15 skinned species fish, 6 wildlife rigs and the shark.
//
//  Almost none of that work is visible. At FOG_DENSITY 0.0135 a fish 50 metres out
//  is showing you 36% of its colour through the haze, and it is a few pixels tall —
//  you cannot see a clownfish's tail beat at all, let alone at 60 Hz. So:
//
//    inside mixerNear   full rate, every frame
//    out to mixerFar    mixerFarHz, by accumulating dt and spending it in one
//                       larger update. Skinning interpolates between keyframes, so
//                       a 20 Hz rig at 60 metres is indistinguishable from a 60 Hz
//                       one — the stutter is smaller than a pixel.
//    beyond mixerFar    frozen in its last pose
//
//  The shark deliberately does NOT go through here: it fills the screen and is the
//  one rig whose animation the player is actually watching.
//
//  Measured against the CAMERA, not the shark. They are 8.5 units apart and the
//  camera is what decides whether anything is visible at all.
// ============================================================

const FAR_STEP = 1 / PERF.mixerFarHz;

// `entry` is any object with a `mixer` — this parks its accumulator on `animAcc`.
// `slack` discounts the animal's own size, so a 21-unit whale isn't frozen because
// the point we measured happens to be a body-length further off than its flank.
export function tickMixer(entry, dt, position, slack = 0) {
  const mixer = entry.mixer;
  if (!mixer) return;

  const d = camera.position.distanceTo(position) - slack;

  if (d > PERF.mixerFar) {
    // Drop the accumulated time rather than banking it: coming back into range
    // should resume the swim cycle, not fast-forward through the seconds it spent
    // out of sight.
    entry.animAcc = 0;
    return;
  }
  if (d < PERF.mixerNear) {
    mixer.update(dt);
    return;
  }

  const acc = (entry.animAcc || 0) + dt;
  if (acc < FAR_STEP) { entry.animAcc = acc; return; }
  entry.animAcc = 0;
  mixer.update(acc);
}
