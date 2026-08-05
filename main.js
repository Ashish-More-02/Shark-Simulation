// ============================================================
//  🦈 Deep Ocean Shark — entry point.
//  Boot, then run the frame loop. All the actual work lives in src/:
//
//    config.js     every tunable, no logic
//    core.js       renderer / scene / camera / shared clock
//    materials.js  caustic shader injection, particle sprites
//    terrain.js    sand, dunes, the seabedHeight() source of truth
//    water.js      surface plane + ripples
//    godrays.js    additive light shafts
//    particles.js  bubbles, marine snow, shark wake
//    loader.js     GLB loading, scale/orientation normalizing, merging
//    props.js      scatter placement + per-instance rock weathering
//    fish.js       shoaling and fleeing
//    orbs.js       collectibles
//    shark.js      rig, handling, swim clip, chase camera
//    input.js      keyboard / mouse-look
//    hud.js        the only module that touches the DOM
//    world.js      composition root: builds the scene, drives updates
// ============================================================
import { renderer, scene, camera, uTime } from './src/core.js';
import { buildWorld, updateWorld } from './src/world.js';
import { showControls, showLoadError, wireStartScreen } from './src/hud.js';
import { capturePointer } from './src/input.js';

let last = performance.now();

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05);   // clamp: no huge step after a tab switch
  last = now;
  uTime.value = now * 0.001;

  updateWorld(dt, uTime.value);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

buildWorld().then(() => {
  showControls();
  last = performance.now();          // don't bill the load time to the first frame
  requestAnimationFrame(tick);       // render behind the start screen
}).catch(showLoadError);

wireStartScreen(capturePointer);
