import { LEVEL_1, PROPS_PLAIN } from "./level-1.js";
import { LEVEL_2, PROPS } from "./level-2.js";

// ============================================================
//  LEVELS — one file per basin. Add a level by adding its file and appending it
//  to LEVELS below; nothing else needs to know how many there are.
//
//  The world is a chain of basins laid along Z, each deeper than the last and
//  joined by a canyon (CANYON in ../config.js). The shark's forward vector is
//  (0,0,-1), so holding W from level 1 swims you toward level 2: levels descend
//  in -Z, and level N sits at z = (2 - N) * 280.
//
//  Level fields:
//    center : basin centre in world space
//    play   : hard bound radius — the shark cannot leave this disc except
//             through the canyon. Bigger than WORLD.mountainRing on purpose, so
//             you swim out among the peaks rather than being fenced inside them.
//    seabed : MEAN floor height. The dunes in terrain.js ride on top of it.
//             Relief cannot exceed the water column, so this is what sizes a
//             level's scenery — 42 m of column in the shallows, 82 m on the reef.
//    gapDir : bearing of the opening left in the mountain wall, in the same
//             (cos a, sin a) -> (x, z) convention the prop rings use.
//    clear  : circles of level-local ground where NOTHING scatters, [{x,z,r}].
//             This is how you delete scenery: a scattered prop is one draw from
//             a seeded sequence and has no config line to remove, so you say
//             "this ground is bare" instead. Hand-placed `fixed` props ignore it.
//             Produced by the F4 editor's erase tool.
// ============================================================
export const LEVELS = [LEVEL_1, LEVEL_2];

// ---- PROP TABLE ROW KEYS ---------------------------------------------------
// Each row becomes InstancedMeshes (props.js). Add a row to add scenery.
//   model     : key into MODELS
//   count     : how many to scatter (0 for a purely hand-placed row)
//   sMin/sMax : scale range
//   ring      : [inner, outer] placement band from the level centre, equal-area
//   fixed     : hand-placed instances, [{x, z, scale, rotY?, n?, spread?, jitter?}]
//               — n/spread/jitter turn one entry into a thicket
//   gap       : half-angle of an opening left in the ring, aimed at gapDir
//   palette   : recolour every instance from this list of stone tones
//   shade     : brightness jitter (flora, which keeps its own colour)
//   sway      : bend amplitude in the current, radians
//   tilt      : random lean off vertical, radians
//   sink      : bury the base this far per unit of scale
//   edgeScale : 0..1 — how much of an instance's size comes from how far out it is
//   cutout    : alphaTest threshold, for foliage authored as alpha-BLEND
//   cull      : override PERF.propCull for this row
//   solid     : make every instance a collision volume (collision.js). The number
//               trims the collider against the prop's measured footprint.
//   taper     : fraction of the base radius the collider keeps at its top — ~0.5
//               for a boulder, ~0.1 for a mountain. Only read when `solid` is set.
//   clump     : patch set to gather this row into, shared by key across rows
export { LEVEL_1, PROPS_PLAIN } from "./level-1.js";
export { LEVEL_2, PROPS } from "./level-2.js";
