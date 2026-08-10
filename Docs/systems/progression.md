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
  │  +1 .. +150  │ ─────► │  Health   + 450│ ────► │ 2 whale strikes  │
  │  points      │        │  Stamina  + 500│       │ survived, then 10│
  │              │        │  Atk spd  + 550│       │ 50 bites, then 13│
  │              │        │  Attack   + 600│       │ 6s of sprint → 20│
  └──────────────┘        └────────────────┘       │ 1.25 → 3.3 b/s   │
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
| Dolphin | **40** | **10** | 200 hp, fast and shy — the first prey that can refuse you |
| Whale | **150** | **50** | 1000 hp, hits for 54, and it can kill you |

The **fry stays at 1 point** deliberately. It would have been easy to fix the economy by
inflating fish income to meet the new prices, and that would have made the whole
rebalance cosmetic — the same five minutes of farming, with bigger numbers on screen.
The basic fish is the unit everything else is priced in, and it does not move.

**The whale went from 70 to 150** — and that is the one number here I chose rather than
derived, so it is worth defending. It is 2.1× the points for an animal that is now 4.2×
the health and 3× the damage, so it is *worse* points-per-second than the old whale was:
that ratio being too good is exactly what let a player max the entire stat sheet in ten
minutes. But it is still the best-paying thing in the ocean once you can actually take
one, which is the right shape — the hard content should pay best. And the sustained rate
is capped regardless by `BITE.respawn`: two whales a minute, and no more.

**A full clearing of the reef pays about 816 points** with both whales, 516 without
them, and the shallows another 130 — so one sweep of the whole world is roughly **940**,
or **640** while the whales are still out of reach. Those are expected values computed
from the population tables in `config.js` — school counts, class weights, members per
school — not a guess from play. They are what every price below is set against, and
they are the numbers to re-compute if the world's population ever changes.

| | fish | dolphins + anglers | whales | orbs | total |
|---|---|---|---|---|---|
| The reef (level 2) | 269 | 175 | 300 | 72 | **816** |
| The shallows (level 1) | 103 | — | — | 24 | **127** |

Early on the whale column is unavailable — it will kill you — so the real early income
is **~640 for a sweep of both basins**, and the whales are what the first few upgrade
levels unlock as a *source* rather than merely as a fight.

The ladder is deliberately steep at the top. A whale is worth 150 of the fry that
share its water — a hundred and fifty of them — and it is the only thing in the ocean
that can kill you. That is the arithmetic that should make a player decide to go and fight one
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

> **`SHARK.growthFull` has to move whenever the economy does**, or the one genuinely
> real stat in the build silently stops meaning anything. It has been raised three
> times for that reason: 400 was one clearing of the reef; 2400 made size a long arc;
> 3400 held that arc when the fish were priced by size. It is now **20,000**, because
> the upgrade sheet costs 54,500 points to finish and full size at 3,400 would have
> arrived inside the first ten minutes again. 20,000 puts it at roughly a third of the
> way through a complete playthrough — earned, and well before the end.

---

## The four stats you can buy

Ten levels each, and every step is deliberately **small**. Ten levels of +40 hp is a
curve you climb; two of +200 is a switch you flip.

| Stat | Base | Per level | Levels | Fully upgraded | Level 1 | Level 10 | Whole row |
|---|---|---|---|---|---|---|---|
| **Health** | 100 hp | **+40 hp** | 10 | 500 hp | **450** | 2,322 | 11,682 |
| **Stamina** | 6 s boost | **+1.4 s** (and +0.4 s refill) | 10 | 20 s | **500** | 2,580 | 12,980 |
| **Attack speed** | 1.25 bites/s | **−50 ms** cooldown | 10 | 3.3 bites/s | **550** | 2,838 | 14,277 |
| **Attack power** | 20 dmg | **+6 dmg** | 10 | 80 dmg | **600** | 3,096 | 15,576 |

Every ceiling is unchanged from the previous pass — 500 hp, 20 s, 3.3 bites/s, 80 dmg.
What changed is that you now climb to them in ten small steps instead of five or eight
large ones, and that each step costs an order of magnitude more.

### The cost curve is geometric

**Cost of the next level = `cost × 1.2^level`.** So Health reads 450, 540, 648, 778,
933, 1120, 1344, 1612, 1935, 2322.

It used to be linear in the level (`cost × (level+1)`), and that is the wrong curve for
a ten-level row: it makes the last level only ten times the first, so the tail of every
stat is cheap relative to the income you have by the time you reach it, and the sheet
finishes itself. Compounding at 1.2 keeps the last level of anything expensive no
matter how rich the player has become.

Maxing all four is **54,515 points**. **That is not the expected playthrough** — it is
the completionist's. See the pacing section below.

### The prices are unequal on purpose

That ordering *is* the design:

- **Health is cheapest** (450) because dying is what stops a player exploring, and this
  is the row that answers it. It is also the row the whale *forces* on you: at 100 hp
  its 54-damage strike kills you in two.
- **Stamina next** (500) — the escape hatch and the chase, and the one that changes how
  the ocean feels to move through rather than how a fight goes.
- **Attack speed** (550) and **attack power** (600) are the two most expensive rows,
  and they are close together because they buy the same thing — damage per second — by
  different means. Attack power front-loads (its first level takes a whale from 50
  bites to 38); attack speed back-loads (its first level is 6% faster, its last is 20%).

**The two attack rows multiply**, and they are the only pair on the sheet that
interact: damage per bite × bites per second is damage per second, so buying either one
makes the other worth more. A whale takes **40 seconds** of unbroken biting at level 0,
15 s with attack speed maxed alone, 16 s with attack power maxed alone, and **3.9 s
with both**. That is the one place where a player who commits to a strategy gets more
than the sum of its parts.

---

## Pacing: the numbers this was tuned against

The whole point of this rebalance. The previous costs (50–100 a level) could be paid off
in five or ten minutes of farming whales, which made every number on the sheet
meaningless and the upgrade screen a formality.

**The target is a 2–3 hour playthrough** across ten depth levels, with progression still
live at the end of it. So the arc has to be measured in hours.

### What you earn

| Source | Points |
|---|---|
| One sweep of the world, no whales | **~640** |
| ...plus both whales | **~940** |
| Sustained whaling, capped by the 60 s respawn | **300/min**, and no more |

Roughly: **~60 points/min** early (fish and dolphins only — whales are unkillable),
**~150/min** mid (you can take a whale, slowly), **~300/min** late.

### What that buys

| | Points | At 150/min |
|---|---|---|
| First level of anything | 450 | ~3–7 min |
| A **focused** build — two rows to L7, two to L4 | **~19,200** | **~2.1 h** |
| Everything, all four rows to L10 | 54,515 | ~6 h |

The focused build is the expected playthrough and it lands squarely on target. Maxing
everything is deliberately out of reach in one pass through a two-basin world — spreading
levels evenly across four rows is exactly the trap the compounding cost exists to
punish.

> **These are tuned for a TWO-basin world and will need raising again.** Levels 3–10
> will bring their own prey, and with it their own income; the intent is that this
> sheet stays worth buying from at world level 10, which will mean another pass on
> these numbers once there is a world to measure.

---

## What each upgrade actually does to the world

This is the part that matters, and every row has to have an answer or it should not
be for sale.

### Health — `+40 hp` a level, 100 → 500

Read it in **whale strikes survived**. A whale hits for **54**:

| Level | Max hp | Unanswered strikes |
|---|---|---|
| 0 | 100 | **2** |
| 2 | 180 | 4 |
| 5 | 300 | 6 |
| 10 | 500 | 10 |

Two strikes at level 0 is the number that defines the early game. It is why this is the
cheapest row, and it is why the whale is not content you can walk into.

It also multiplies every *other* source of survival, because they are all measured
against the same pool: the out-of-combat regen (0.7 hp/s) and the heal from eating
(0.4 hp per point, so a whale is 60 hp) both stay the same size, which means a bigger
pool takes proportionally longer to top up. Buying health makes you harder to kill
and slower to repair — a real trade, not a free win.

**Buying a level grants the 40 hp immediately**, as current health as well as max.
Being left at 20/150 after spending points would be an upgrade that made you feel
weaker. `combat/health.js` polls the max every frame and hands over the difference,
so no purchase path can forget to do it.

### Attack power — `+6 dmg` a level, 20 → 80

Read it in **bites to kill a whale** (1000 hp, and prey hit points never change — see
below):

| Level | Damage | Bites to a whale |
|---|---|---|
| 0 | 20 | **50** |
| 2 | 32 | 32 |
| 4 | 44 | 23 |
| 6 | 56 | 18 |
| 8 | 68 | 15 |
| 10 | 80 | 13 |

Every step is a measurably shorter fight, and since the whale strikes on a 3 s
cooldown, *fewer bites is fewer strikes taken*. Fifty bites at the base 0.8 s cooldown is
forty seconds of contact — fourteen strikes, which is seven times a starting shark's
whole health pool. Thirteen bites at level 10 is 3.9 s and two strikes. This row is how
a player stops being afraid of the biggest animal in the game.

It does nothing at all to fish, which all die in one bite at every level. That is
correct: attack is a **combat** stat, and the only combat in the game is the whale.

> **Prey health deliberately does not scale with it.** An animal's hp is
> `bites × PLAYER.attack` at the *base* attack, baked at spawn (`prey.js`), so a
> whale is 1000 hp forever. If prey hp tracked your upgraded damage, buying attack
> would do literally nothing — the classic way an upgrade system quietly cancels
> itself out.

### Attack speed — `−50 ms` a level, 0.8 s → 0.3 s of cooldown

The bite cooldown, and **the base was doubled — 0.4 s to 0.8 s — in the same change
that made it upgradable.** That direction is deliberate and it is the more important
half of this row.

A jaw that resets in four tenths of a second is free damage. Nothing in the ocean can
punish it, so there is no fight to have, and — the part that matters here — nothing for
an upgrade to sell you. You cannot price attack speed for a shark that already attacks
as fast as it needs to. Doubling the cooldown creates the room the row lives in.

| Level | Cooldown | Bites/s | Seconds of biting to kill a whale (at 20 dmg) |
|---|---|---|---|
| 0 | 0.80 s | 1.25 | 40.0 |
| 2 | 0.70 s | 1.43 | 35.0 |
| 4 | 0.60 s | 1.67 | 30.0 |
| 6 | 0.50 s | 2.00 | 25.0 |
| 8 | 0.40 s | 2.50 | 20.0 |
| 10 | 0.30 s | 3.33 | 15.0 |

Note **level 8**: it is exactly the 0.4 s the shark used to have for free. So the arc of
this row is *earn back the bite you started with, then go past it* — and it ends 2.7×
faster than the old default rather than merely restoring it.

It is the one **inverted** stat on the sheet: what improves is a number going down. So
the menu shows its reciprocal — bites per second — because "0.8 → 0.3 seconds" cannot
be drawn on a bar that fills as you get better, and because bites per second is what
the player actually feels. The seconds live in the note, where a falling number reads
fine.

One side effect worth knowing, and it is a feature: **biting pushes you along.** Every
snap adds `BITE.lunge` to your speed, so a faster bite is also more thrust —
bite-spamming alone settles at about 2 m/s at level 0 and 6 m/s at level 10, both under
cruise and both clamped by `maxSpeed` regardless. It is part of why a faster bite feels
punchier and not merely more frequent.

`BITE.snap`, the jaw-snap pose, is 0.22 s — shorter than the cooldown at *every* level,
so the pose always resolves between bites and the shark never ends up permanently
mid-chomp. That is a constraint worth preserving if this row is ever extended: an
eleventh level at 0.25 s still clears it, a twelfth at 0.20 s does not.

### Stamina — `+1.4 s` a level, 6 → 20

Sprint is `SHARK.boostSpeed` — 34 mph against a 27 mph cruise — and the tank is how
long you can hold it. So this row buys **distance at 34 mph**:

| Level | Tank | Refill (empty→full) | Boost seconds per rest second | Sprint distance |
|---|---|---|---|---|
| 0 | 6.0 s | 3.5 s | 1.7 | ~91 m |
| 5 | 13.0 s | 5.5 s | 2.4 | ~198 m |
| 10 | 20.0 s | 7.5 s | 2.7 | ~304 m |

Which in play is: escaping a hostile whale without having to out-turn it, **catching a
dolphin at all** — they now swim at 11.7–13.5 m/s against your 12.2 cruise, so the only
way to close the last few metres is on Shift — running down a sprinting bait shoal (they
cap at 13.2 m/s against your 15.2), and crossing the 280 m between the two basins
without settling back to cruise.

The dolphin case is the one that changed most. At 3 bites you caught it and ate it; at
10 it is eight seconds of staying on a target that keeps breaking away, which is the
first thing in the game that asks anything of your *handling* rather than your damage —
and the reason stamina stopped being the row you buy last.

> Making a dolphin take ten bites also meant making it **watchable for ten bites**. Its
> steering was tuned for an animal you glanced at (1.5 rad/s of yaw on a 3-second dwell,
> through 15 m of vertical band) and following that for eight seconds was reported as
> genuinely dizzying. It now runs long straight legs and wide arcs — and 60% faster, at
> 8.6 m/s, which widens its turning circle to 15.6 m for free since radius is
> speed ÷ turn rate. Its escape heading is committed rather than recomputed every frame.
> See `FLEE` and the dolphin's row in `config.js`.
>
> Then it got faster again, to 11.7–13.5 m/s, which puts it **above the shark's 12.2
> cruise and below its 15.2 sprint**. That is the interesting band to sit in and it is
> held there on purpose by `speedCap`: a tail-chase at cruise never closes, so a dolphin
> has to be *cut off* — angled onto, using the long straight legs its 9–16 s dwell gives
> it — and then the last few metres bought with boost. It is the one animal in the game
> you cannot catch without spending stamina, which is what makes that row worth buying
> before you can fight a whale.
>
> `speedCap` is the guard that keeps this a chase rather than a joke. The raw `speed` is
> 13.8 and the ±15% spawn jitter would otherwise produce individuals at 15.8 m/s — faster
> than the shark's sprint, i.e. ten-bite prey worth 40 points that nothing in the game
> could ever catch. `FISH.sprintCap` exists for exactly the same reason on the shoals.

**The refill time grows too**, by 0.4 s a level. A 20 s tank that still filled in
3.5 s would make stamina strictly better than everything else on the sheet — free
permanent sprint. Growing it sub-proportionally means the upgrade lengthens the
sprint *and* improves the rate (1.7 → 2.7 boost-seconds per second of rest) without
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
| **Affordable** | bright blue `+ 450` | `bank ≥ cost` |
| **Too expensive** | grey `+ 450`, unclickable | you cannot pay yet |
| **Bought out** | gold `MAX`, not a button at all | every level owned |

The unaffordable state **keeps its price on screen**. That is the difference between
a button that looks broken and a button that is a goal: you are meant to read `450` at
120 points and go and find something worth eating. Hiding the price, or the button,
would remove the only thing that makes the row aspirational.

`disabled` does the greying *and* makes the click impossible, but `upgrades.js`
re-checks affordability anyway — a disabled attribute is a courtesy, never the
enforcement.

Each row also carries a `Lv 3/10` pill, which is the one reading that saves the player
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

- **No save file.** Every level is lost on reload, which makes a 54,500-point arc
  entirely academic — this is now the single most important missing piece in the game.
  A two-hour progression curve with no persistence is a curve nobody will ever see the
  end of. `upgrades.js` is deliberately two numbers and a level table so that a save is
  a small change. `upgrades.js` is deliberately two numbers and a table so that a save is a
  small change, but it is the next thing this system needs.
- **No respec.** `resetUpgrades()` exists and hands the points back; nothing calls it.
- **No confirmation and no undo.** A misclick spends the points. With a rising cost
  curve and no way to sell a level back, that is a real (if small) trap.
- **The costs are set against computed spawn-table figures and a guessed play rate.**
  "~150 points a minute mid-game" is an estimate, not a measurement — nobody has played
  a two-hour session against these numbers yet. The per-row `cost` is the single dial
  for all of it.
- **Nothing scales with the world yet.** The same ~940 points come from the same two
  basins, so the arc is a grind rather than a descent. Levels 3–10 arriving is what
  turns that into progression; until then, expect to re-clear the reef.
- **The whale is unbeatable until roughly level 5 across the board.** 50 bites at 0.8 s
  is 40 seconds of contact against an animal that kills you in two strikes. That makes
  the early game *fish only* — no combat at all for the first few thousand points — which
  is a real consequence of these numbers and not an accident. It reads as a difficulty
  gate (roadmap §2 wants soft gates that punish you for going too early) but the honest
  version is: there is currently nothing else to fight, so combat is simply absent from
  the opening. Levels 3–10 bringing mid-tier predators is what fixes that properly.
- **Health is the obvious first buy every time**, which makes the first decision less
  interesting than the later ones. That is arguably correct while the whale is the
  only threat, and it should be revisited when something else can hurt you.
- **Points are earned but never *spent* by anything except this screen.** When
  Insight lands (roadmap §6) there will be two currencies and this doc will need to
  say clearly which buys what: Growth the body, Insight the depth.
