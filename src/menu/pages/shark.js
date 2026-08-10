import { createPreview } from '../preview.js';
import { readStats } from '../stats.js';
import { bank, buy } from '../../upgrades.js';
import { playCollectSound } from '../../audio.js';

// ============================================================
//  PAGE 1 — THE SHARK.  3D preview on the left, stats on the right.
//
//  This two-column layout belongs to the PAGE, not to the menu. The shell owns
//  the overlay, the title and the tab strip and nothing else, which is what lets
//  Map and Missions be completely different shapes later.
//
//  It is also the shop. There is no separate upgrade screen and there should not
//  be: the thing you are buying is a number on this sheet, so the buy button
//  belongs on the row it changes — you read "6 / 20 s of boost", you press the +
//  beside it, you read "8 / 20". No second surface, no confirmation, nothing to
//  navigate. See Docs/systems/progression.md.
// ============================================================

let preview = null, statsEl = null, bankEl = null;

// Every row is "what this shark can do now / what it could do fully upgraded"
// (see stats.js): the number reads "6 / 20 s of boost" and the bar fills to the
// same fraction, so the empty part of the bar is the upgrade path.
//
// Rebuilt whole on every render rather than patched. It is five rows behind a paused
// game, once per open and once per purchase — the clarity of one code path that
// always agrees with the state is worth far more here than a diff would be.
function renderStats() {
  bankEl.textContent = `${bank()} pts`;

  statsEl.innerHTML = readStats().map((s) => {
    const d = s.decimals ?? 0;
    const hasBar = s.max !== undefined;
    const fill = hasBar ? Math.min(Math.max(s.max > 0 ? s.now / s.max : 0, 0), 1) : 0;
    const b = s.buy;

    // Three states for the button, and the middle one is the whole point of the
    // system: affordable, too expensive (greyed, still showing its price so you know
    // what to go and hunt for), or finished. `disabled` does the greying and also
    // makes the click impossible — but upgrades.js re-checks anyway, because a
    // disabled attribute is a courtesy and never the enforcement.
    let button = '';
    if (b) {
      button = b.maxed
        ? '<span class="stat-buy maxed">MAX</span>'
        : `<button class="stat-buy" data-key="${s.key}" ${b.afford ? '' : 'disabled'}
             title="${b.afford ? `Spend ${b.cost} points` : `Needs ${b.cost} points`}"
           >+<em>${b.cost}</em></button>`;
    }

    return `
    <div class="stat${s.dummy ? ' dummy' : ''}${hasBar && s.now >= s.max ? ' maxed' : ''}">
      <div class="stat-head">
        <span class="stat-name">${s.label}${b ? `<span class="stat-lv">Lv ${b.level}/${b.levels}</span>` : ''}</span>
        <span class="stat-value">${s.now.toFixed(d)}${hasBar ? `<span class="stat-max"> / ${s.max.toFixed(d)} ${s.unit}</span>` : `<span class="stat-max"> ${s.unit}</span>`}</span>
        ${button}
      </div>
      ${hasBar ? `<div class="stat-bar"><i style="width:${(fill * 100).toFixed(1)}%"></i></div>` : ''}
      <div class="stat-note">${s.dummy ? 'placeholder · ' : ''}${s.note}</div>
      ${s.locked ? `<div class="stat-note dim">${s.locked}</div>` : ''}
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
        <h3 class="menu-card-title">Stats <span class="stat-bank">0 pts</span></h3>
        <div class="stat-list"></div>
      </section>`;

    statsEl = el.querySelector('.stat-list');
    bankEl = el.querySelector('.stat-bank');
    preview = createPreview(el.querySelector('.preview-canvas'));

    // Delegated, so it survives renderStats() replacing the whole list — binding per
    // button would leak a listener set on every purchase.
    statsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.stat-buy[data-key]');
      if (!btn) return;
      btn.blur();          // ...or the next Space press re-buys through the focus
      if (!buy(btn.dataset.key)) return;
      // Nothing else has to be told. Every consumer reads the live getter each frame
      // (upgrades.js), max health notices on its own (combat/health.js), and this
      // just redraws the sheet it is standing on.
      playCollectSound();
      renderStats();
    });
  },

  enter() {
    renderStats();
    preview.start();
  },

  exit() {
    preview.stop();
  },
};
