import { createPreview } from '../preview.js';
import { readStats } from '../stats.js';

// ============================================================
//  PAGE 1 — THE SHARK.  3D preview on the left, stats on the right.
//
//  This two-column layout belongs to the PAGE, not to the menu. The shell owns
//  the overlay, the title and the tab strip and nothing else, which is what lets
//  Map and Missions be completely different shapes later.
// ============================================================

let preview = null, statsEl = null;

// Every row is "what this shark can do now / what it could do fully upgraded"
// (see stats.js): the number reads "6 / 20 s of boost" and the bar fills to the
// same fraction, so the empty part of the bar is the upgrade path.
//
// Rendered once per open, not on a timer. These are capabilities, and a
// capability cannot change while you are looking at it — nothing in the game
// grants an upgrade from behind a paused menu. The day one does, it re-renders
// this list itself.
function renderStats() {
  statsEl.innerHTML = readStats().map((s) => {
    const d = s.decimals ?? 0;
    const fill = Math.min(Math.max(s.max > 0 ? s.now / s.max : 0, 0), 1);
    return `
    <div class="stat${s.dummy ? ' dummy' : ''}${s.now >= s.max ? ' maxed' : ''}">
      <div class="stat-head">
        <span class="stat-name">${s.label}</span>
        <span class="stat-value">${s.now.toFixed(d)}<span class="stat-max"> / ${s.max.toFixed(d)} ${s.unit}</span></span>
      </div>
      <div class="stat-bar"><i style="width:${(fill * 100).toFixed(1)}%"></i></div>
      <div class="stat-note">${s.dummy ? 'placeholder · ' : ''}${s.note}</div>
    </div>`;
  }).join('');
}

export default {
  id: 'shark',
  title: 'Shark',

  mount(el) {
    el.innerHTML = `
      <section class="menu-card menu-viewport">
        <canvas class="preview-canvas"></canvas>
        <div class="menu-card-hint">drag to rotate</div>
      </section>
      <section class="menu-card">
        <h3 class="menu-card-title">Stats</h3>
        <div class="stat-list"></div>
      </section>`;

    statsEl = el.querySelector('.stat-list');
    preview = createPreview(el.querySelector('.preview-canvas'));
  },

  enter() {
    renderStats();
    preview.start();
  },

  exit() {
    preview.stop();
  },
};
