// ============================================================
//  ASSET URLS — one place that knows where assets/ actually is.
//
//  Every url in config/config.js is written relative to the REPO ROOT
//  ("assets/whale.glb"), because that is what is readable in a config file. The
//  problem is who resolves it: both GLTFLoader and `new Audio()` resolve a
//  relative url against the DOCUMENT's base url, not against the module that
//  supplied it. That was fine while the game lived in the root index.html, and it
//  broke the moment the page moved to pages/game.html — every model and every
//  sound would have been looked for under pages/assets/.
//
//  So resolve here instead, against THIS MODULE's url, which is fixed no matter
//  which page imports it. src/assets.js -> ../ is the repo root, so the strings in
//  config.js keep their meaning and no page has to care where it sits.
//
//  Two call sites, deliberately: loadModel() in loader.js and the two `new Audio`
//  constructors in audio.js. If a third kind of asset ever gets loaded, it comes
//  through here too rather than growing a second convention.
// ============================================================

const ROOT = new URL('../', import.meta.url);

export const assetUrl = (path) => new URL(path, ROOT).href;
