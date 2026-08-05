import * as THREE from 'three';
import { uTime } from './core.js';

// ============================================================
//  SHARED MATERIAL / TEXTURE HELPERS
// ============================================================

// A soft round particle sprite, drawn once and reused by every Points system.
export function softSprite(inner, mid) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, mid);
  g.addColorStop(1, 'rgba(200,235,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Shimmering light patterns, injected into any MeshStandardMaterial.
// Fed into totalEmissiveRadiance rather than gl_FragColor: in the standard
// fragment shader <fog_fragment> runs AFTER <tonemapping_fragment> and
// <colorspace_fragment>, so adding light at the end would skip tone mapping and
// land in gamma space — bright caustics would clip to flat white. Going in as
// emissive keeps them tone-mapped, colour-managed and correctly fogged.
export function addCaustics(material, strength) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uCaustic = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uCaustic; varying vec3 vWPos;
        float caustic(vec2 p, float t){
          vec2 a = p * 0.34 + vec2(t * 0.055, t * 0.032);
          vec2 b = p * 0.21 - vec2(t * 0.041, t * 0.062);
          float v = sin(a.x) * sin(a.y) + sin(b.x + 1.7) * sin(b.y + 0.6);
          return pow(v * 0.5 + 0.5, 6.0) * 1.5;
        }`)
      .replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += vec3(0.38, 0.66, 0.85) * caustic(vWPos.xz, uTime) * uCaustic;`);
  };
  // distinct cache key so this variant gets its own compiled program
  material.customProgramCacheKey = () => 'caustics';
  return material;
}
