// A page that exists only to be a tab. Map, missions and quests are all coming
// (see Docs/ROADMAP.md); until one of them does, they are here to make the tab
// strip real and to keep the page contract honest — if adding a page were not
// genuinely five lines, these would not be five lines.
export function stubPage(id, title, blurb) {
  return {
    id,
    title,
    mount(el) {
      el.innerHTML = `
        <section class="menu-card menu-empty">
          <h3 class="menu-card-title">${title}</h3>
          <p>${blurb}</p>
          <p class="dim">Not built yet.</p>
        </section>`;
    },
    enter() {},
    exit() {},
  };
}
