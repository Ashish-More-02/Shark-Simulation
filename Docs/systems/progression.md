# System: points & upgrades

> Status: **built, first pass.** Currency and levels in
> [`src/upgrades.js`](../../src/upgrades.js), the shop is page one of the E menu
> ([`src/menu/pages/shark.js`](../../src/menu/pages/shark.js) +
> [`stats.js`](../../src/menu/stats.js)), numbers in `config.js` → `UPGRADES`,
> `PLAYER`, and the `points` on every creature row.

Eating pays **points**. Points buy **levels**. A level is a fixed step on one stat,
and the costs are set so you can never buy everything — which is the entire design.

This is [ROADMAP](../ROADMAP.md) §6's **Growth** currency: earned by hunting, spent
on the body. It is the second half of what [attack-and-health.md](attack-and-health.md)
deliberately left undone — that pass made health, attack and stamina real *and flat*,
precisely so this one could be the only thing that raises them.

---

## The shape of it

```
   eat something          open the menu (E)         the world changes
  ┌──────────────┐        ┌────────────────┐       ┌──────────────────┐
  │  +1 .. +70   │ ─────► │  Health   + 50 │ ────► │ 3 more whale     │
  │  points      │        │  Stamina  + 70 │       │ strikes survived │
  │              │        │  Atk spd  +100 │       │ 8 bites, not 10  │
  │              │        │  Attack   +100 │       │ 8s of sprint     │
  └──────────────┘        └────────────────┘       │ 1.4 bites/s      │
         ▲                        │                └──────────────────┘
         │                        │ costs rise per level
         └────────────────────────┴──── you can afford ONE of them
```

There is no separate upgrade screen, and there should not be. The thing you are
buying **is** a number on the stat sheet, so the button lives on the row it changes:
you read `6 / 20 s of boost`, you press the `+` beside it, you read `8 / 20`. No
second surface, no confirmation dialog, nothing to navigate.

---

## What things are worth

Every animal already carried a `points` value; the flat part was the shoaling fish,
where a 5-unit lunker and a 0.6-unit fry were both worth 1. They are now priced by
size, because points are a currency and what a thing is worth has to be visible in
the thing.

| Prey | Points | Bites | Notes |
|---|---|---|---|
| Fry (0.6–1.0 units) | **1** | 1 | the bulk of a shoal |
| Named reef species | **2** | 1 | blue fish, clownfish, reef fish |
| Mid-water fish (1.0–1.6) | **2** | 1 | the commonest class |
| Large fish (2.1–3.0) | **3** | 1 | |
| Anglerfish | **3** | 1 | rare, and it lights itself up for you |
| Lunker (3.8–5.0) | **5** | 1 | one to three per school, worth hunting for |
| Glowing orb | **6** | — | no chase, no bite. Pure bonus. |
| Dolphin | **14** | 3 | fast and shy — the first prey that can refuse you |
| Whale | **70** | 10 | and it fights back |

**A full clearing of the reef pays about 550 points**, and the shallows another 130,
so one sweep of the whole world is roughly **680**. Those are expected values computed
from the population tables in `config.js` — school counts, class weights, members per
school — not a guess from play. They are what every price below is set against, and
they are the numbers to re-compute if the world's population ever changes.

| | fish | creatures | orbs | total |
|---|---|---|---|---|
| The reef (level 2) | 269 | 211 | 72 | **552** |
| The shallows (level 1) | 103 | — | 24 | **127** |

The ladder is deliberately steep at the top. A whale is worth 70 of the fry that
share its water — fourteen of them — and it is the only thing in the ocean that can
kill you. That is the arithmetic that should make a player decide to go and fight one
rather than eat another school, and it is the same arithmetic that makes the Health
upgrade the sensible first purchase.

### Points and the shark's size are the same income, spent twice

The shark's *body* grows on `preyStats.points` and always has. If upgrades spent that
number, buying a level would make you physically smaller.

So there are two readings of one income:

```js
growth = lifetime points              // never decreases. Drives SHARK.growthFull.
bank   = lifetime points - spent      // what the + buttons can see.
```

Nothing decrements the lifetime total. `upgrades.js` tracks `spent` instead, which
means the two uses cannot drift apart, there is no second accumulator to keep in
sync, and a save file is a level table plus one integer.

The HUD's `POINTS` row shows the **bank**, not the lifetime figure — it is the number
you check against a price you just read in the menu, and a lifetime total would keep
climbing after a purchase and look as though nothing had been deducted.

> Pricing the fish by size inflated a reef clear from 404 points to 552 — a factor of
> **1.37** — so `SHARK.growthFull` went from 2400 to **3400** in the same change
> (2400 × 1.37 = 3279, rounded up). Without that, the growth arc tuned in the previous
> pass would have silently got 37% faster as a side effect of adding a currency.

---

## The four stats you can buy

| Stat | Base | Per level | Levels | Fully upgraded | Level 1 costs | Whole row |
|---|---|---|---|---|---|---|
| **Health** | 100 hp | **+50 hp** | 8 | 500 hp | **50** | 1,800 |
| **Stamina** | 6 s boost | **+2 s** (and +0.6 s refill) | 7 | 20 s | **70** | 1,960 |
| **Attack speed** | 1.25 bites/s | **−100 ms** cooldown | 5 | 3.3 bites/s | **100** | 1,500 |
| **Attack power** | 24 dmg | **+8 dmg** | 7 | 80 dmg | **100** | 2,800 |

**Cost of the next level = `cost × (level + 1)`.** So Health goes 50, 100, 150 … 400,
and the eighth level costs eight times the first. Every stat is a rising curve, which
is what makes specialising early cheap and mastery expensive.

Maxing all four is **8,060 points** — about fifteen clearings of the reef, or twelve
sweeps of the whole world, with a 60 s respawn on everything you eat. That is the
entire progression arc for a two-basin world, and it is one number per row to retune.

### The prices are unequal on purpose

That ordering *is* the design:

- **Health is cheapest** because dying is what stops a player exploring, and this is
  the row that answers it. One level — 50 points, less than a single whale — is exactly
  three more whale strikes survived. It is the correct first purchase and it is priced
  to be.
- **Attack power is dearest** because it changes how long every fight in the game
  takes, and therefore how long you spend inside a hostile whale's reach. It is the
  only row that makes the hardest content *shorter* rather than merely survivable.
- **Attack speed costs the same as attack power**, because the two rows buy the same
  thing — damage per second — by different means, and neither is clearly the better
  deal. Attack power front-loads (its first level takes a whale from 10 bites to 8);
  attack speed back-loads (its first level is 12% faster, its last is 33%).
- **Stamina sits between them** — it is the escape hatch and the chase, and it is the
  one that changes how the ocean feels to move through rather than how a fight goes.

**The two attack rows multiply**, and they are the only pair on the sheet that
interact: damage per bite × bites per second is damage per second, so buying either one
makes the other worth more. A whale takes **8 seconds** of unbroken biting at level 0,
3 s with attack speed maxed alone, 2.4 s with attack power maxed alone, and **0.9 s
with both**. That is the one place where a player who commits to a strategy gets more
than the sum of its parts.

Those eight seconds are also why the fight is dangerous: the whale commits a strike
every 3 s, so an unupgraded shark that never breaks off eats three of them — 54 of its
100 hp — and that is before counting the time spent swimming back in after each dodge.
The first whale is a fight you can lose, and the first few levels here are what answer
it.

At ~550 points a reef clear you can buy roughly *two or three early levels per hunt*.
Enough to feel it; nowhere near enough to buy a row. The player is forced to answer
"what do I need next", which is the only question that makes an upgrade screen
interesting.

---

## What each upgrade actually does to the world

This is the part that matters, and every row has to have an answer or it should not
be for sale.

### Health — `+50 hp` a level, 100 → 500

Read it in **whale strikes survived**. A whale hits for 18:

| Level | Max hp | Unanswered strikes |
|---|---|---|
| 0 | 100 | 6 |
| 1 | 150 | 9 |
| 4 | 300 | 17 |
| 8 | 500 | 28 |

It also multiplies every *other* source of survival, because they are all measured
against the same pool: the out-of-combat regen (0.7 hp/s) and the heal from eating
(0.6 hp per point, so a whale is 42 hp) both stay the same size, which means a bigger
pool takes proportionally longer to top up. Buying health makes you harder to kill
and slower to repair — a real trade, not a free win.

**Buying a level grants the 50 hp immediately**, as current health as well as max.
Being left at 20/150 after spending points would be an upgrade that made you feel
weaker. `combat/health.js` polls the max every frame and hands over the difference,
so no purchase path can forget to do it.

### Attack — `+8 dmg` a level, 24 → 80

Read it in **bites to kill a whale** (240 hp, and prey hit points never change — see
below):

| Level | Damage | Bites to a whale |
|---|---|---|
| 0 | 24 | 10 |
| 1 | 32 | 8 |
| 2 | 40 | 6 |
| 3 | 48 | 5 |
| 5 | 64 | 4 |
| 7 | 80 | 3 |

Every step is a measurably shorter fight, and since the whale strikes on a 3 s
cooldown, *fewer bites is fewer strikes taken*. Ten bites at the base 0.8 s cooldown is
eight seconds of contact and three strikes taken; three bites is 2.4 s and one. This row
is how a player stops being afraid of the biggest animal in the game.

It does nothing at all to fish, which all die in one bite at every level. That is
correct: attack is a **combat** stat, and the only combat in the game is the whale.

> **Prey health deliberately does not scale with it.** An animal's hp is
> `bites × PLAYER.attack` at the *base* attack, baked at spawn (`prey.js`), so a
> whale is 240 hp forever. If prey hp tracked your upgraded damage, buying attack
> would do literally nothing — the classic way an upgrade system quietly cancels
> itself out.

### Attack speed — `−100 ms` a level, 0.8 s → 0.3 s of cooldown

The bite cooldown, and **the base was doubled — 0.4 s to 0.8 s — in the same change
that made it upgradable.** That direction is deliberate and it is the more important
half of this row.

A jaw that resets in four tenths of a second is free damage. Nothing in the ocean can
punish it, so there is no fight to have, and — the part that matters here — nothing for
an upgrade to sell you. You cannot price attack speed for a shark that already attacks
as fast as it needs to. Doubling the cooldown creates the room the row lives in.

| Level | Cooldown | Bites/s | Seconds of biting to kill a whale |
|---|---|---|---|
| 0 | 0.8 s | 1.25 | 8.00 |
| 1 | 0.7 s | 1.43 | 7.00 |
| 2 | 0.6 s | 1.67 | 6.00 |
| 3 | 0.5 s | 2.00 | 5.00 |
| 4 | 0.4 s | 2.50 | 4.00 |
| 5 | 0.3 s | 3.33 | 3.00 |

Note **level 4**: it is exactly the 0.4 s the shark used to have for free. So the arc of
this row is *earn back the bite you started with, then go past it* — and it ends 2.7×
faster than the old default rather than merely restoring it.

It is the one **inverted** stat on the sheet: what improves is a number going down. So
the menu shows its reciprocal — bites per second — because "0.8 → 0.3 seconds" cannot
be drawn on a bar that fills as you get better, and because bites per second is what
the player actually feels. The seconds live in the note, where a falling number reads
fine.

One side effect worth knowing, and it is a feature: **biting pushes you along.** Every
snap adds `BITE.lunge` to your speed, so a faster bite is also more thrust —
bite-spamming alone settles at about 2 m/s at level 0 and 6 m/s at level 5, both under
cruise and both clamped by `maxSpeed` regardless. It is part of why a faster bite feels
punchier and not merely more frequent.

`BITE.snap`, the jaw-snap pose, is 0.22 s — shorter than the cooldown at *every* level,
so the pose always resolves between bites and the shark never ends up permanently
mid-chomp. That is a constraint worth preserving if this row is ever extended: a sixth
level at 0.2 s would break it.

### Stamina — `+2 s` a level, 6 → 20

Sprint is `SHARK.boostSpeed` — 34 mph against a 27 mph cruise — and the tank is how
long you can hold it. So this row buys **distance at 34 mph**:

| Level | Tank | Refill (empty→full) | Boost seconds per rest second | Sprint distance |
|---|---|---|---|---|
| 0 | 6 s | 3.5 s | 1.7 | ~91 m |
| 3 | 12 s | 5.3 s | 2.3 | ~182 m |
| 7 | 20 s | 7.7 s | 2.6 | ~304 m |

Which in play is: escaping a hostile whale without having to out-turn it, closing on
a fleeing dolphin (they burst at up to 13.2 m/s and you sprint at 15.2), and crossing
the 280 m between the two basins without settling back to cruise.

**The refill time grows too**, by 0.6 s a level. A 20 s tank that still filled in
3.5 s would make stamina strictly better than everything else on the sheet — free
permanent sprint. Growing it sub-proportionally means the upgrade lengthens the
sprint *and* improves the rate (1.7 → 2.6 boost-seconds per second of rest) without
ever making boost free.

The 0..1 stamina fraction is untouched by all this, so a level bought mid-swim needs
no migration: the same fraction is simply worth more seconds, and the ring beside the
shark visibly drains slower.

---

## The two rows you cannot buy

Both still render, both are captioned on screen with *why*, and neither has a button.

**Speed.** Raising `SHARK.boostSpeed` alone breaks an invariant that is already
documented in `config.js`: the boosted equilibrium (`accel × boostAccelMul / drag` =
16.5) has to stay above `boostSpeed`, or the clamp stops governing and the sprint
creeps toward its asymptote over several seconds instead of arriving. A speed upgrade
therefore has to retune the acceleration with it, and it would also make releasing
Shift a hard drop from the upgraded top speed to `maxSpeed` 14. Roadmap §6 also puts
speed under **Insight** (from discovery) rather than Growth, so this row is waiting
on the right currency as well as the right handling work.

**Pressure.** Nothing in the world reads it. There is no pressure damage, so a level
would be a number changing on a sheet and nothing else. **Selling a stat that does
nothing is the one thing an upgrade screen must never do** — it is worse than not
having the upgrade, because it teaches the player that the shop lies.

---

## Why the ceilings are derived now

`PLAYER.healthCap`, `attackCap`, `staminaCap` and `speedCap` are **gone**. Each stat's
`max` is computed as `base + step × levels` from what the shop actually stocks:

```js
healthCeiling() === PLAYER.health + UPGRADES.health.step * UPGRADES.health.levels
```

The menu has always claimed that *the empty part of every bar is the upgrade path*.
With hand-written caps that was a hope — 100/500 with no upgrades in existence, and
nothing forcing the two numbers to agree. Derived, it is literally true: a full bar
means a finished stat, and the panel can never advertise a ceiling that no amount of
spending arrives at. Retune a step or a level count and every bar in the menu moves
with it.

---

## How a stat gets from here into the game

Every consumer reads a **getter**, not a constant:

| Consumer | Was | Now |
|---|---|---|
| `combat/health.js` | `PLAYER.health` | `maxHealth()` |
| `combat/bite.js` | `PLAYER.attack` | `biteDamage()` |
| `combat/bite.js` | `BITE.cooldown` | `biteCooldown()` |
| `shark.js` (drain) | `STAMINA.boostSeconds` | `boostSeconds()` |
| `shark.js` (refill) | `STAMINA.refillSeconds` | `refillSeconds()` |
| `menu/stats.js` | the constants + `*Cap` | the getters + the ceilings |

`config.js` holds the **base** and the **step**; `upgrades.js` holds the **level**;
the getter composes them. The alternative — mutating `PLAYER.health` in place — loses
the authored value the moment anything is bought, cannot be reset, and turns "every
tunable in the game, data only" into mutable state.

Nothing is pushed anywhere on a purchase. `buy()` increments a level and that is the
end of it: the getters are read live, and max health notices on its own the next
frame. So a level granted by anything else later — a pickup, a story beat, a loading
save file — needs no wiring at all.

---

## The button

Three states, and the middle one is the point of the system.

| State | Looks like | When |
|---|---|---|
| **Affordable** | bright blue `+ 90` | `bank ≥ cost` |
| **Too expensive** | grey `+ 90`, unclickable | you cannot pay yet |
| **Bought out** | gold `MAX`, not a button at all | every level owned |

The unaffordable state **keeps its price on screen**. That is the difference between
a button that looks broken and a button that is a goal: you are meant to read `90` at
40 points and go and find something worth eating. Hiding the price, or the button,
would remove the only thing that makes the row aspirational.

`disabled` does the greying *and* makes the click impossible, but `upgrades.js`
re-checks affordability anyway — a disabled attribute is a courtesy, never the
enforcement.

Each row also carries a `Lv 3/8` pill, which is the one reading that saves the player
doing arithmetic on the bar.

### The sheet re-renders on every purchase

`menu.md` used to say the stat list renders once per open because *"a capability
cannot change while you are looking at it"*. It can now — that is what the buttons
are for — so the list is rebuilt whole after each successful buy. Five rows behind a
paused game, once per click: one code path that always agrees with the state is worth
far more here than a diff.

---

## Cost

Nothing. One integer subtraction per frame for the HUD row, and the getters are an
add and a multiply each, called a handful of times a frame. No allocation, no DOM
work outside the menu, and the menu only renders while it is open and paused.

---

## File map

```
src/
  upgrades.js         the whole system: bank, levels, buy(), and every live getter
  config/config.js    UPGRADES (step/levels/cost), PLAYER bases, per-creature points
  prey.js             pays points on a kill (unchanged); prey hp uses the BASE attack
  combat/health.js    maxHealth(), and grants the level's hp the moment you buy it
  combat/bite.js      biteDamage()
  shark.js            boostSeconds() / refillSeconds()
  hud.js              the POINTS row (the bank, not the lifetime total)
  menu/stats.js       every row's now / ceiling / level / price / affordability
  menu/pages/shark.js the + buttons, the bank readout, the delegated click handler
```

---

## Known limits

- **No save file.** Every level is lost on reload, which makes an 8,060-point arc
  academic. `upgrades.js` is deliberately two numbers and a table so that a save is a
  small change, but it is the next thing this system needs.
- **No respec.** `resetUpgrades()` exists and hands the points back; nothing calls it.
- **No confirmation and no undo.** A misclick spends the points. With a rising cost
  curve and no way to sell a level back, that is a real (if small) trap.
- **The costs are set against one computed figure.** 552 points a reef clear is an
  *expected* value over the spawn tables, and the actual number varies with the seed
  and with every change to the world's population.
- **Nothing scales with the world yet.** The same ~680 points come from the same two
  basins, so the arc is a grind rather than a descent. Levels 3–10 arriving is what
  turns that into progression; until then, expect to re-clear the reef.
- **Health is the obvious first buy every time**, which makes the first decision less
  interesting than the later ones. That is arguably correct while the whale is the
  only threat, and it should be revisited when something else can hurt you.
- **Points are earned but never *spent* by anything except this screen.** When
  Insight lands (roadmap §6) there will be two currencies and this doc will need to
  say clearly which buys what: Growth the body, Insight the depth.
