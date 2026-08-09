import * as THREE from 'three';
import { WORLD, WATER } from './config/config.js';
import { scene, uTime } from './core.js';
import { worldBounds } from './levels.js';

// ============================================================
//  WATER SURFACE  — the underside of an open-ocean surface
//
//  This plane is only ever seen from BELOW: shark.js clamps the camera to
//  WORLD.surface - 0.6 for the whole game. That is a much more specific problem
//  than "draw some water", and it has a specific answer.
//
//  Two pieces of physics do all the work (see the WATER block in config.js):
//
//    SNELL'S WINDOW      Light from the whole sky refracts into a ~48.6° cone
//                        directly overhead. Look up, and you see through it.
//    TOTAL INTERNAL      Outside that cone the surface is a mirror — and the
//    REFLECTION          only thing down here to reflect is the dark deep.
//
//  So the look is a bright shimmering patch overhead falling off to near-black
//  toward the horizon. The previous material was a flat MeshLambertMaterial,
//  colour 0x63c6ee: evenly bright in every direction, no window, no mirror. Even
//  brightness in all directions is precisely what a swimming pool looks like — lit
//  from every side, white floor two metres down, nothing dark to reflect — which
//  is why it read as fresh water however the colour itself was tuned.
//
//  Both terms fall out of ONE number, the angle between the surface normal and the
//  direction to the camera, so this is cheaper than the Lambert material it
//  replaces rather than more expensive: no light loop, no PBR includes, one dot.
//
//  PERFORMANCE NOTES (carried over from the Phase 1 pass, still true):
//    * side: BackSide, not DoubleSide. The top face is never seen, and halving the
//      fragments of a big blended plane is a real saving on a tile-based GPU,
//      which cannot occlusion-cull blended geometry at all.
//    * The ripple is a closed-form function of (position, time), so it lives in
//      the vertex shader. It used to be a CPU loop rewriting 4,225 vertices and
//      re-uploading the whole position buffer every frame.
//    * The plane stays 400 units wide on purpose. Shrinking it looks like free
//      triangles (8,192 -> 2,048) but it is 0.5% of the frame's geometry, and the
//      camera can sit ~118 units from the origin: pull the edge in to r=100 and
//      you would watch the water stop, ten units away, well inside fog range.
// ============================================================

// The wave field, shared by both shader stages. Authored in WORLD xz so the
// fragment side can differentiate it without re-deriving the plane's rotation.
//
// Only the first term displaces geometry — the other two are far too fine for a
// 64x64 grid to resolve, and exist purely to break up the NORMAL. That is the
// cheap trick here: ripple detail you can actually see costs nothing but a couple
// of sines, because the window/mirror falloff is driven entirely by the normal.
const WAVES = /* glsl */`
  float waveHeight(vec2 p, float t) {
    return sin(p.x * 0.15 + t * 1.50) * 0.6
         + cos(p.y * 0.12 + t       ) * 0.6;
  }

  vec3 waveNormal(vec2 p, float t) {
    // d/dx and d/dz of the swell above, plus two finer cross-chop octaves
    float dx =  0.090 * cos(p.x * 0.15 + t * 1.50)
             +  0.112 * cos(p.x * 0.62 - p.y * 0.31 + t * 2.30)
             +  0.119 * cos(p.x * 1.70 + p.y * 1.10 + t * 3.10);
    float dz = -0.072 * sin(p.y * 0.12 + t)
             -  0.056 * cos(p.x * 0.62 - p.y * 0.31 + t * 2.30)
             +  0.077 * cos(p.x * 1.70 + p.y * 1.10 + t * 3.10);
    return normalize(vec3(-dx, 1.0, -dz));
  }
`;

export function createWater() {
  // Segments only need to be dense enough to sample the swell's wavelength; the
  // finer chop is normal-only and needs no geometry at all.
  // Sized off the world, not a constant: the surface has to reach over every
  // level or you swim out from under it and see the sky through the ceiling.
  const b = worldBounds();
  // Segment DENSITY, not a segment count: 64 across the old 400-unit plane was
  // 6.25 units a segment, and holding that as the world grows is what stops the
  // swell being stretched flat over a bigger surface. Vertices are nearly free
  // here — this plane is fill-bound, not vertex-bound.
  const seg = (n) => Math.ceil(n / 6.25);
  const geo = new THREE.PlaneGeometry(b.width, b.depth, seg(b.width), seg(b.depth));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    // fog: true earns the USE_FOG / FOG_EXP2 defines, but a ShaderMaterial has to
    // supply the uniform OBJECTS itself — three only merges UniformsLib.fog into
    // its own built-in shaders, and the per-frame fog refresh writes into these
    // two by name. Omit them and it throws on the first draw.
    fog: true,
    uniforms: {
      uTime,
      uDeep:    { value: new THREE.Color(WATER.deep) },
      uWindow:  { value: new THREE.Color(WATER.window) },
      uGlint:   { value: new THREE.Color(WATER.glint) },
      uOpacity: { value: new THREE.Vector2(WATER.opacity[0], WATER.opacity[1]) },
      uBright:  { value: WATER.brightness },
      fogColor:   { value: new THREE.Color() },
      fogDensity: { value: 0 },
    },

    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vWorld;
      ${WAVES}
      void main() {
        // Displace in WORLD space and skip the trip back through local space: the
        // plane is authored in XY and rotated -90° about X, so "local +z is world
        // height" is a trap worth not re-deriving in two places.
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += waveHeight(wp.xz, uTime);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        #include <fog_vertex>
        gl_Position = projectionMatrix * mvPosition;
      }`,

    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      #include <tonemapping_pars_fragment>
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uWindow;
      uniform vec3 uGlint;
      uniform vec2 uOpacity;
      uniform float uBright;
      varying vec3 vWorld;
      ${WAVES}

      // Sun dapple on the underside of the surface — the same two-sine
      // interference pattern the seabed caustics use (materials.js), raised to a
      // high power so it reads as bright shifting veins rather than a wash.
      float sunVeins(vec2 p, float t) {
        vec2 a = p * 0.55 + vec2(t * 0.20, t * 0.13);
        vec2 b = p * 0.37 - vec2(t * 0.15, t * 0.22);
        float v = sin(a.x) * sin(a.y) + sin(b.x + 1.7) * sin(b.y + 0.6);
        return pow(clamp(v * 0.5 + 0.5, 0.0, 1.0), 7.0);
      }

      void main() {
        vec3 N = waveNormal(vWorld.xz, uTime);
        vec3 V = normalize(cameraPosition - vWorld);   // fragment -> eye, points DOWN
        // The entire look is this one number: 1 looking straight up through the
        // surface, 0 sliding along it toward the horizon. abs() because we are
        // underneath, so the normal and the view vector oppose each other.
        float ct = clamp(abs(dot(V, N)), 0.0, 1.0);

        // cos(48.6°) = 0.661 is the hard physical edge of the window. Smeared wide
        // on purpose: a crisp rim reads as a decal, and real surface chop smears it
        // anyway by tilting the local normal a few degrees either way.
        float window = smoothstep(0.24, 0.86, ct);

        vec3 col = mix(uDeep, uWindow, window);
        col += uGlint * sunVeins(vWorld.xz, uTime) * window * 1.15;

        // Luminance last, so it lifts the mirror, the window and the sun veins by
        // the same factor and the falloff between them keeps its shape. ACES tone
        // mapping then rolls off whatever this pushes past 1 instead of clipping it,
        // which is why the glint can be scaled here but not in its hex value.
        gl_FragColor = vec4(col * uBright, mix(uOpacity.x, uOpacity.y, window));

        // Order matters and is not obvious: three runs fog AFTER tone mapping and
        // the output colour-space conversion, because the fog colour is authored in
        // output space. Fogging earlier would tone-map the haze twice.
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });

  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(b.midX, WORLD.surface, b.midZ);
  // It never moves again — keep it out of the per-frame matrix walk (§4.4).
  water.matrixAutoUpdate = false;
  water.updateMatrix();
  scene.add(water);
  return water;
}
