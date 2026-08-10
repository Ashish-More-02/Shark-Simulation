# System: the in-game menu (E)

> Status: **built.** Shell in [`src/menu/menu.js`](../../src/menu/menu.js), pages in
> [`src/menu/pages/`](../../src/menu/pages/), stat bases in `config.js` `PLAYER` and
> the levels they are bought in in [`src/upgrades.js`](../../src/upgrades.js).

One overlay that holds everything the HUD cannot: the shark itself, its numbers,
and — later — the map, the missions and the quest log.

---

## Why it exists

The HUD is a **glance** surface. It sits in the corner, it is read while you are
moving, and everything on it has to survive being looked at for a tenth of a
second. That budget is already spent: six rows and a stamina ring.

Everything else the game will want to say — how much health you have, what your
bite is worth, where you are on a map, what a quest wants — is a **study**
surface. You stop, you read, you decide, you go back. Trying to put that on the
HUD ruins the HUD; leaving it out means the game can never grow a system that
needs more than one line to explain itself.

So: a second surface, deliberately large (72% of the viewport), that **stops the
world while it is up**. It is not a pause menu that happens to show stats. It is
the game's second screen, and pausing is just what makes reading it fair.

---

## The shape

```
┌──────────────────────────────────────────────────┐
│                🦈 Deep Ocean Shark               │  ← shell: title
│ ┌──────────────────────────────────────────────┐ │
│ │  Shark │ Map │ Missions │ Quests             │ │  ← shell: tab strip
│ └──────────────────────────────────────────────┘ │
│ ┌───────────────────┐ ┌──────────────────────────┐│
│ │                   │ │  STATS         1240 pts  ││
│ │   3D shark        │ │  health   ▓▓▓▓░░  [+ 50] ││ ← the PAGE owns this
│ │   (drag to spin)  │ │  stamina  ▓▓░░░░  [+ 70] ││
│ │                   │ │  attack   ▓░░░░░  [+ 90] ││ ← greyed if you can't pay
│ │                   │ │  pressure ▓▓▓▓▓░         ││
│ └───────────────────┘ └──────────────────────────┘│
└──────────────────────────────────────────────────┘
```

The split that matters is **shell vs page**.

The **shell** owns the overlay, the blur, the title, the tab strip, the open/close
key, and what happens to the game while it is open. It knows nothing about sharks
or stats.

A **page** owns one tab's worth of body. The two-column shark-and-stats view above
is *page one*, not the menu's layout — which is why Map and Missions can be
completely different shapes later without touching the shell.

---

## Opening it

**Press `E`.** Press it again, or `Esc`, or the **×** in the panel's top-right
corner, to close.

### E was the dive key

It cannot be both. `Q`/`E` was rise/dive; vertical control moved to **`Space`
(rise) / `Ctrl` (dive)**, with `Q`/`Z` kept as aliases for anyone with the old
habit. Space-and-Ctrl is the near-universal binding for swim and fly games, so
this is the one time the conflict is worth resolving in the menu's favour rather
than picking a different key for the menu.

### What happens to the game while it is up

| | while the menu is open |
|---|---|
| simulation | **frozen** — `main.js` skips `updateWorld` |
| rendering | **continues** — the last live frame stays behind the blur |
| pointer lock | released, and *cannot be re-taken* by clicking the visible margin |
| keys, mouse-look, bite | suspended at the source (`input.js`) |
| swim audio | eased to its at-rest volume |
| ambience | keeps playing |

Two of those are less obvious than they look. **Rendering has to continue** — a
`backdrop-filter` blur samples what is behind it, and what is behind it is a
canvas; stop drawing and you are blurring an undefined buffer. And **input is
suspended in `input.js`, not by ignoring keys in the shark**, because the click
that would otherwise re-capture the pointer lands on the 30% of the canvas the
overlay does not cover. Gating at the source is one flag instead of a rule every
future consumer of `input.js` has to remember.

---

## The 3D preview

The left panel is a **second `WebGLRenderer` on its own canvas**, with its own
scene, its own two lights, and its own copy of the shark model.

It is not the game's renderer, and it is not the game's shark. Reusing either
would mean moving the real animal out of the world and putting it back, or
scissoring a viewport into a canvas that the DOM has to lay the menu out on top
of. A second context costs one model's worth of memory and only draws while the
menu is actually open, which is the cheap side of that trade.

The model is loaded **lazily, on the first open** — through the same `loadModel`
the world uses, so it arrives normalized, oriented and with its clips attached,
and the browser serves the GLB from cache. Boot time is untouched.

- **It does not spin on its own.** The only thing that ever moves it is a drag.
  An idle rotation makes the panel feel alive for about four seconds and is a
  nuisance for the rest of them — you cannot read a silhouette that is turning.
- **Drag** to spin it. Yaw is free, pitch is clamped to ±35° so it can never end
  up belly-up and unreadable.
- **It faces you on every open.** The loader points every model's nose down -Z
  and the camera sits on +Z, so the untouched pose shows you the *tail*; the
  resting yaw is π (turned around) less 0.35 rad, which is far enough off dead-on
  to show the face and the length of the body at the same time. Reopening resets
  to that pose rather than restoring the angle you left — last session's angle was
  for last session, and inheriting it means opening the menu to the underside of a
  tail you have to drag your way out of.
- It plays the same `Armature|Swim` clip the real shark does, at a third rate —
  a still model reads as a trophy, a swimming one reads as your animal.
- It is drawn at the shark's **current growth scale**, and the camera distance is
  computed from the model's bounding sphere times that scale, so a fully grown
  12.6 m shark is framed as completely as a fresh 6 m one. Apparent size is
  therefore constant; growth belongs on a number, not on a viewport crop.

---

## The stats

### Every row is "now / fully upgraded"

That is the design of the whole panel, not a formatting choice. A row is

```js
{ key, label, now, max, unit, decimals, note, dummy, locked,
  buy: { level, levels, cost, afford, maxed } | null }
```

`now` is what this shark can do **today**, `max` is what it could do with every
upgrade bought, both as plain numbers in the row's own unit. The panel prints
**`6 / 20 s of boost`** and fills the bar to `now / max`. So the empty part of
every bar is the **upgrade path** — and since the shop exists, the price of the next
step of it is on the same line.

**These are not live readings, deliberately.** A stat sheet describes the
*animal*, not the moment. "Six seconds of boost capacity out of a possible twenty"
is a fact about your shark worth opening a menu for; "4.3 seconds left in the tank
right now" is not — it is stale before you finish reading it, and the green ring
beside the shark already says it better. Same for speed: the row is your **top
speed**, not your speedometer. The HUD is the speedometer.

That division is the point of having two surfaces at all:

| | HUD | menu |
|---|---|---|
| answers | what is happening *now* | what my shark *is* |
| changes | every frame | when you earn something |
| read | at a glance, moving | stopped, deliberately |

Nothing here hands out a percentage either. "30% stamina" does not tell you
whether that is six seconds or two.

### The six rows

| Stat | now | fully upgraded | For sale? |
|---|---|---|---|
| **Health** | `maxHealth()` — 100 hp at Lv 0 | 500 hp at Lv 8 | ✓ **+50 hp**, 50 pts |
| **Stamina** | `boostSeconds()` — 6 s at Lv 0 | 20 s at Lv 7 | ✓ **+2 s**, 70 pts |
| **Top speed** | `SHARK.boostSpeed` — 34 mph | — | ✗ locked, and captioned why |
| **Attack power** | `biteDamage()` — 24 dmg at Lv 0 | 80 dmg at Lv 7 | ✓ **+8 dmg**, 100 pts |
| **Attack speed** | `attackRate()` — 1.25 bites/s at Lv 0 | 3.3 bites/s at Lv 5 | ✓ **−100 ms**, 100 pts |
| **Pressure** | `PLAYER.pressure` — 14 atm | `PLAYER.pressureCap` — 60 | ✗ placeholder |

**This panel is also the shop** — see
[progression.md](progression.md) for the currency, the prices and what each level
does to the world. Four rows carry a `+` button and a `Lv 3/8` pill; the two that do
not carry a caption saying why, because an inert control with no explanation reads as
a broken one. **Attack speed is shown as bites per second** rather than as its
underlying cooldown: it is the one stat that improves by a number going DOWN, and a bar
cannot fill toward a smaller value. The menu is honest about which halves are made up: placeholder rows are
dimmed and captioned as such, because a dummy stat that looks live is a bug you find
months later.

Every real `now` is read from the getter the game itself runs on — `maxHealth()`,
`biteDamage()`, `boostSeconds()` — rather than restated here, so the sheet and the
simulation can never drift apart. That is the failure this arrangement exists to
prevent.

**And none of them move on their own.** Attack power briefly scaled with the shark's
growth and that was reverted: a `now` that drifts upward by itself is a shop with no
prices. Every number on this page changes when the player spends points on this page,
and at no other time.

**The ceilings are derived, not authored.** `max` is `base + step × levels`, computed
from what the shop actually stocks, so "the empty part of every bar is the upgrade
path" is literally true rather than a hope. A full bar is drawn in gold and means a
finished stat — never an aspirational number nobody can reach.

**Stamina** is the tank *behind* the green ring. The ring shows how much of it is
left and is only up while `Shift` is held; this row shows how big it is, which is
the half an upgrade would change. Its note carries the refill time — the other
number the ring cannot say.

**Top speed** comes out of the physics: one world unit is one metre, so
`SHARK.boostSpeed` is m/s and mph is a multiplication. Its note names the cruise
speed as well, because the gap between 27 and 34 mph is what `Shift` is *for*.

**Pressure** is what the shark can take, in atmospheres. The tolerance is a
placeholder; the number it is measured against is not — the note says the deepest
sea floor in the world is 9.2 atm, about 82 m, computed from the real world
extent, because a tolerance means nothing without the depth demanding it. At 14
against 9.2 the whole world is survivable with room to spare, which is what you
want while there is nothing to survive. Drop it under 9.2 the day pressure damage
exists and the reef floor becomes somewhere you have to earn.

**Health and attack** were placeholders until
[attack-and-health.md](attack-and-health.md) landed, and became purchasable when
[progression.md](progression.md) did. Both transitions cost exactly what they were
supposed to: rows in `stats.js` changed and nothing else moved. That was the whole
reason for routing them through a config block instead of typing them into the markup.

The list renders **once per open, and again after every purchase.** This doc used to
say once per open, full stop, on the grounds that *"a capability cannot change while
you are looking at it — and the day something does, it re-renders the list itself."*
That day arrived: the `+` buttons are exactly that something, and they call the
re-render, as promised. It rebuilds the sheet whole rather than patching a row — five
rows behind a paused game, once per click.

---

## Adding a page

A page is an object with five members. Write it in `src/menu/pages/`, add it to
the array in `pages/index.js`, and it has a tab.

```js
export default {
  id: 'map',
  title: 'Map',
  mount(el) { /* build your DOM into el. Called ONCE, on first open. */ },
  enter()   { /* became visible — start loops here */ },
  exit()    { /* hidden — stop everything you started */ },
};
```

The contract that matters is **`mount` runs once, `enter`/`exit` run every time**.
Anything expensive (a renderer, a model, a big DOM tree) is built in `mount` and
merely started and stopped in `enter`/`exit`. That is what keeps opening the menu
for the fifth time as cheap as the second, and it is why the shark preview's
WebGL context is created once and its rAF loop starts and stops.

Tab order is array order.

---

## File map

```
src/menu/
  menu.js            shell: overlay, tabs, E key, pause/input handoff
  preview.js         the rotatable 3D model viewport (own renderer)
  stats.js           what a stat IS: label, value, bar fraction, price, source
  pages/
    index.js         the page registry — array order is tab order
    shark.js         page 1: preview + stats + the buy buttons, two columns
    stub.js          makes the empty Map/Missions/Quests tabs
```

`index.html` carries one empty `<div id="menu">`; everything inside it is built by
`menu.js`. Styles live in `style.css` under `---- MENU ----`.

### On hud.js being "the only module that touches the DOM"

It no longer is, and that is intended. `hud.js` remains the only module that
touches the **HUD** — the fixed set of elements declared in `index.html` and
written every frame. The menu is a self-contained subsystem whose DOM is its
entire product, and routing a growing tree of pages through a lookup table in
`hud.js` would make `hud.js` the thing it exists to prevent. The rule as it now
stands: **two DOM owners, `hud.js` and `src/menu/`, and no third.**

---

## Known limits

- **No gamepad, and clicking the dimmed area outside the panel does not close it.**
  `E`, `Esc` and the × button.
- **The tab strip is not keyboard-navigable** — click a tab. Arrow-key focus
  handling comes with the first page anyone actually navigates.
- **Map, Missions and Quests are empty stubs.** They exist to prove the page
  contract and to make the tab strip real.
- **Pressure and top speed have no `+` button.** Both are captioned on screen with
  the reason — see [progression.md](progression.md). Health, attack and stamina used
  to be in this line and no longer are.
- **A purchase cannot be undone**, and there is no confirmation. `resetUpgrades()`
  exists in `upgrades.js` and nothing calls it.
- **The preview has no zoom.** Drag rotates; distance is fit to the model.
- **Opening the menu mid-bite** freezes the snap pose until you close it. Harmless,
  and it goes away if the pause is ever replaced by a live background.
- **There is no `SIZE` row** in the stats, even though it is the one stat that is
  fully real. Four rows were asked for; it is the obvious fifth.
