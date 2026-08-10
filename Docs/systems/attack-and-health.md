# System: attack & health

> Status: **built, first pass.** The system lives in
> [`src/combat/`](../../src/combat/) — `bite.js`, `health.js`, `aggression.js` —
> with prey hit points in [`src/prey.js`](../../src/prey.js) and the numbers in
> `config.js` → `COMBAT`, `PLAYER` and the whale's `combat` block.

This is [ROADMAP](../ROADMAP.md) **Stage 1's** load-bearing item: *"until losing
is possible nothing else can be evaluated."* One animal fights back — the whale —
and that is deliberate, because the point of this pass is not content. It is to
make the two numbers real that the whole game will hang off: **the shark can be
hurt**, and **a bite is worth an amount of damage**.

---

## Why the whale first

The roadmap's disposition table (§5) puts the whale in the **neutral** row:
*ignores you at distance, flips when provoked.* Neutral is the only disposition
that can be built as a first combat pass without the rest of the system existing,
because it has exactly one trigger — you bit it — and one exit — you left. An
aggressive mob needs detection ranges, blood-in-the-water and pack behaviour to
not feel arbitrary. A neutral one needs nothing you don't already have.

It is also the honest choice for a simulation: nothing in this ocean *hunts* a
shark at 50 m. Things defend themselves.

And it fits the soft-gate rule (§2): **the danger has to be telegraphed before it
punishes.** A whale that hurts you only after you bit it can never feel unfair —
you started it, and you were told what you started (see [Telegraphing](#telegraphing)).

---

## One damage currency

Before this, prey had `bites` — an integer count of snaps to eat it — and the
shark had no health at all. `PLAYER.attack` sat in the stat sheet captioned
*"bites cost hit points, not damage, for now"*.

Now everything alive carries **hp**, and everything that hits carries **damage**.
The bridge between the old model and the new one is one line in `prey.js`:

```js
entry.maxHp = entry.bites * PLAYER.attack;      // 50 bites x 20 dmg = 1000 hp
```

That is where the whale's **1000 hp** comes from — 50 `bites` at the base 20 damage.
Every `bites:` row in `config.js` keeps its meaning as "snaps to eat it, unupgraded",
and the fish still die in one snap.

> It started at 240 (10 bites × 24), chosen to preserve the ten-bite whale exactly. It
> is 1000 now, and the base bite is 20 rather than 24, because the whale had to become
> the wall the upgrade curve is measured against —
> [progression.md](progression.md) has the arc.

### Nothing grows on its own

Bite damage does not change with the shark's **size**, and neither do max health or
the boost tank. Fifty bites to a whale at 6 m, fifty bites at 12.6 m. What raises them is
one thing only: the player **buying a level** with points
([progression.md](progression.md)).

The first pass had damage scaling with the shark (`PLAYER.attack × scale`, 24 → 50)
on the strength of roadmap §6 listing bite damage under the Growth currency. That
was wrong in practice, for a reason worth writing down: **a stat that creeps up by
itself cannot be sold.** The upgrade screen is where health, attack and stamina are
bought, with points the player chose to spend on them instead of on something else,
and every point of damage that arrives free from eating is a point the shop cannot
price. Growth handing out combat power also means the optimal strategy is always
"eat more", which is the single-currency failure §6 exists to avoid.

Note the distinction that survived: eating still *funds* every one of these stats.
It just does not hand them over.

What growth still buys is **geometry, not numbers**:

| | scales with size | why |
|---|---|---|
| Jaw reach | ✓ `BITE.reach × scale` | a 12.6 m animal with a 6 m animal's reach cannot bite past its own nose |
| The hull a whale aims at | ✓ `SHARK.bodyRadius × scale` | a bigger animal is a bigger target — growth is very slightly a liability in a fight |
| Bite damage | ✗ | the upgrade system's to sell |
| Max health | ✗ | ditto |
| Boost seconds | ✗ | ditto |

### Growth itself is six times slower

`SHARK.growthFull` went from **400 points to 2400**, and has been raised twice more
since as the economy inflated — it is **20,000** now, and
[progression.md](progression.md) tracks why. At 400, one clearing of the reef took the
shark from 6 m to nearly its full 12.6 m: the entire growth arc spent inside a single
session, on the one stat in the game that is genuinely real. The rule that came out of
it is that this number has to stay a fraction of what the whole game pays out, or size
stops meaning anything.

This also means points *outlive* the thing they buy, which is exactly what the
upgrade system needed: a currency you keep earning long after your body has stopped
being the interesting thing it pays for.

---

## The shark

| | value | where it comes from |
|---|---|---|
| Max health | `maxHealth()` — **100 hp** at level 0 | already in the stat sheet as a placeholder; it is real now, and upgradable to 500 |
| Bite damage | `biteDamage()` — **20, and 20 at every size** | ditto; the upgrade system raises it to 80 ([progression.md](progression.md)) |
| Grace after a hit | `COMBAT.hurtGrace` — **0.3 s** | stops two whales landing on the same frame reading as one 36-damage hit |
| Healing from a kill | `COMBAT.healPerPoint` — **0.4 hp per point** | a whale heals 60, a dolphin 16, a reef fish 0.4 |
| Out-of-combat regen | `COMBAT.regenRate` — **0.7 hp/s** after `regenDelay` **8 s** | ~2.5 minutes for a full heal: slow enough that eating is still the answer |
| Death pause | `COMBAT.deathHold` — **2.2 s** | you drift, then wake in the shallows |

### Eating heals, and there is no hunger bar

Straight out of roadmap §4. A hunger timer punishes you for stopping to look at
things, and looking at things is the product. So food is not a clock you have to
answer — it is the **repair kit**, and it is only interesting when something has
damaged you. Feeding stays valuable without ever being urgent.

The slow regen is the concession to that: with no regen at all, one bad encounter
leaves you at 12 hp with no way back except finding something big to eat, and in a
world where the nearest whale is the thing that just hurt you, that is a dead end
rather than a decision. 0.7 hp/s is deliberately worse than a single dolphin.

### Death: you wake in the shallows

Roadmap §4 wants a Souls-style recovery loop — wake at the last sanctuary, drop
your uncollected Insight where you died, swim back for it. **Half of that is built
here.** The other half cannot be: there is no Insight currency yet to drop.

What happens today:

1. hp hits 0. The shark is **stunned** — input is ignored, it drifts on its
   momentum, the screen goes red at the edges.
2. After `deathHold`, it wakes at `SHARK.startPos` — the middle of the shallows,
   which is the de facto sanctuary until sanctuaries exist — with full health.
3. **Every hostile animal calms down.** A whale that killed you does not get to
   still be angry when you respawn 280 m away.
4. **Nothing is lost.** Growth, points and eaten count all survive. That is the
   roadmap's rule and it is worth keeping even before there is a currency to drop.

So dying currently costs you the swim back. That is thin, and it is *meant* to be
thin — `death-and-respawn.md` owns the real version.

---

## The whale

### Neutral means one trigger and one exit

```
                  you bite it
   ┌──────────┐  ────────────►  ┌───────────┐
   │   CALM   │                 │  HOSTILE  │
   │ wanders  │  ◄────────────   │  chases   │
   └──────────┘   >35 m away     └───────────┘
                  for 10 s            │
                                      │ within 9 m of its body
                                      ▼
                          ┌────────────────────────┐
                          │ WINDUP 0.75s (rears)   │
                          │        ↓               │
                          │ LUNGE  0.55s (rams)    │  hit: 54 dmg inside 7 m
                          │        ↓               │
                          │ COOLDOWN 3s            │
                          └────────────────────────┘
```

There is no aggression radius, no line of sight and no alert state. A whale you
have not touched will swim straight past you at two metres, exactly as it does
today, because `shy: 0` and nothing down here worries it.

### The strike is three beats, not one

A single instant hit is unreadable — you take damage and never learn why. So an
attack is **commit → windup → lunge**, and the windup exists purely so you can get
out of the way:

- **Commit** at 9 m from its body surface, cooldown permitting. Measured to the
  *body*, not to the nose: a whale defends itself by throwing 20 metres of animal
  around, and "don't be alongside it" is a rule you can act on. A nose-only strike
  would make a whale with a 0.48 rad/s turn rate physically unable to hit anything
  that stayed near its tail — which is where you *want* to be biting it from, so
  it would read as a whale that cannot fight rather than one you outplayed.
- **Windup, 0.75 s.** It drops to just over half speed and **rears** — a `-0.3` rad
  pitch bias on the pivot, so the nose comes up and the whole animal visibly loads.
  Plus a low audio cue.
- **Lunge, 0.55 s** at 4.4× speed — about 10.6 m/s, still under the shark's 12.2
  m/s cruise. The hit lands the first frame the shark is inside 7 m of its body,
  and once per lunge only.
- **Cooldown, 3 s** from the commit.

Do the arithmetic on the windup: 0.75 s of warning at cruise speed is 9.2 m of
travel, against a 7 m strike. **Every single hit is dodgeable**, always, with no
upgrade and no timing precision. That is the property that makes this fair, and it
is the number to protect if any of the others get retuned.

> **Retuned once already.** The first pass ran a 1.1 s windup on a 5 s cooldown at
> 3.4× lunge speed, and it played as a whale that was barely participating — you
> could take one for free by walking away between strikes and never even watch it.
> Everything above is the faster version. The inequality is what stayed fixed while
> the feel moved: 9.2 m of dodge against a 7 m reach is a smaller margin than 13
> against 7, so you now have to actually react, but the guarantee is intact.

The rhythm it produces is: bite twice, back off while it rears, come back in. Combat as
a conversation, which is the whole reason to have a windup at all.

**And it is a fight you lose at level zero.** At **54 damage a strike** against a
starting shark's 100 hp, *two* connect and you are dead. Meanwhile the whale's 1000 hp
is fifty bites, and at the base 0.8 s cooldown that is forty seconds of contact — about
fourteen strikes' worth of exposure for a health pool that survives two.

That is deliberate, and it is the shape of the whole game's difficulty:

| All four upgrade rows at | Bites | Biting time | Strikes taken | vs your hp |
|---|---|---|---|---|
| level 0 | 50 | 40.0 s | ~14 | 756 vs 100 — **dead** |
| level 2 | 32 | 22.4 s | ~8 | 432 vs 180 — **dead** |
| level 4 | 23 | 13.8 s | ~5 | 270 vs 260 — **dead** |
| **level 5** | 20 | 11.0 s | ~4 | 216 vs 300 — **you win** |
| level 10 | 13 | 3.9 s | ~2 | 108 vs 500 — comfortably |

(Those strike counts assume you never break off, which no real fight looks like — every
dodge trades damage taken for time, so a careful player wins it earlier than level 5.)

So the whale is the **difficulty gate** the soft-gate rule in §2 asks for: nothing locks
it, it is right there in the reef from the first minute, and what stops you is that it
kills you. It is also the thing the first few thousand points of upgrades are *for*. The
honest cost of that is written up in progression.md's known limits: there is no other
combat in the game yet, so the opening hour has none.

### It cannot chase you down, on purpose

`chaseMul` **2.6** takes the whale from 2.4 m/s to 6.2 m/s and `turnMul` **2.2**
takes its yaw rate from 0.28 to 0.62 rad/s — a 180° turn in five seconds. It is
*slower than your cruise in every mode*, including the lunge.

That is not an oversight, it is the design. A hostile whale is a **place you
cannot be**, not a pursuer. Leaving is always available and always works; the
threat is entirely about how long you choose to stay inside its reach. Anything
faster would turn a neutral animal into a chase sequence and the shark into prey,
which is the wrong game — and a whale that outswims a shark is also just wrong.

The whale is also still bound by `ROAM_LIMIT` (105 − 10 m from the reef centre),
so it physically cannot follow you up the canyon into the shallows. The escape
route is real geography, not a rule.

### Disengaging: 35 m for 10 s

`leash` **35 m** — the radius it follows you inside — and `forget` **10 s**. Both
conditions, and the timer resets the instant you come back inside 35 m, so poking it
and hiding at 36 m does not reset the fight, it *ends* it, ten seconds later.

**35 m is inside visual range**, and that is the interesting consequence. Visibility
is about 50 m, so the whale now breaks off while you can still plainly see it:
disengaging is something you *watch* rather than something you infer from the ⚠ going
out. The first pass used 70 m — chosen against the fog, on the argument that a whale
should not forget a shark it can still see — and halving it is a deliberate trade of
that realism for a whale that lets go quickly and legibly.

Two things to keep in mind at this radius:

- It is measured **pivot to pivot** on a 21 m animal, so a shark 35 m from the pivot
  is only ~25 m from the nose or the tail. The effective distance is a third shorter
  than the number.
- 35 m is close enough that ordinary fighting movement can cross it. Combined with
  the 10 s timer that is fine — you have to *stay* out — but if the whale ever starts
  giving up mid-fight, this is the number that did it, and `forget` is the one to
  raise rather than this.

Calming resets everything — cooldown, windup, the pitch bias, and it picks a fresh
waypoint immediately (otherwise it keeps swimming at where you were when it gave
up). Being eaten calms it too, so a whale never respawns still angry.

---

## Telegraphing

Seven channels, and they exist because of the soft-gate rule: a player who dies to
something they never saw learns *"unfair"*.

| Channel | Says |
|---|---|
| **Health bar over the shark's head** | how much you have left, where you are already looking |
| **The shark's whole body flashing white** | *that* hit *me* — the one thing a bar cannot say fast enough |
| **`HEALTH` HUD row** | the actual number, whenever you want it |
| **Red vignette** | you were hit *just now* — a flash — and, held, that you are under 30% |
| **Target readout** under the reticle | `Whale 168 / 240` plus a bar: proof a ten-bite animal is taking damage |
| **⚠ on the `NEAREST` row** | that thing is currently angry at you |
| **Whale rear-back + audio cue** | a hit is coming in three quarters of a second |

### Why the health bar is over the shark and not in the corner

While you are fighting you are looking at your own animal and at the thing hitting
it. A gauge anywhere else is a gauge you don't read — the same argument the stamina
ring is built on, which is why that one is parked beside the shark too. So `world.js`
projects a point above the shark's head through the camera each frame and `hud.js`
writes it into two custom properties. One matrix multiply, and only while the bar is
actually up.

**It is only up for 2.5 s after your health moves**, either way — damage or a meal —
and it fades out again. Not a permanent gauge, for two reasons: a bar that is always
there is one you stop seeing within ten minutes, and this game's entire subject is
looking at things, so a permanent UI element welded over the player is in every
screenshot of it. The out-of-combat regen deliberately does *not* raise it, or it
would sit on screen for the two and a half minutes that trickle takes.

Green above 60%, amber to 30%, red below — a bar over your own head is read by
colour first and length second. The fill eases into its new width rather than
jumping, because *how much* you just lost is the reading a bar gives you that the
number in the corner does not.

### The body flash

`COMBAT.hitFlash` seconds of the whole shark going white, ramping **down** from the
frame of impact — the brightest frame has to be the frame you were hit, or it reads
as a glow rather than as a blow. Driven on the materials' `emissive`, not their
`color`: colour is multiplied by the albedo texture, so pushing it to white only
brightens the shark, while emissive is added after lighting and blows the silhouette
out regardless of texture or fog.

This is the channel that does the work the vignette cannot. Red at the screen edges
says "damage is happening"; the body flashing says **which animal it happened to**,
which matters the moment anything other than the whale can be hurt.

---

## What this deliberately is not

- **Not the disposition system.** Dolphins and anglerfish still only flee (`shy`, now
  along a committed escape line rather than pivoting with you — see `FLEE` in config),
  and no species is territorial or aggressive. That is roadmap Stage 3 and
  `dispositions.md`. What is here is one row of that table, built early because
  Stage 1 needs *something* to hurt you.
- **No blood in the water.** Biting a whale does not attract anything.
- **No pressure damage and no hunger.** Both are health *consumers* the system is
  now ready for; neither is wired.
- **No Insight drop on death** — there is no Insight.
- **No knockback and no stagger on the shark.** Being shoved around by a hit
  feels bad when you are 6 m long and it costs control you did not lose.
- **No damage numbers floating off the target.** The health readout under the
  reticle carries it and reads as a wound rather than as a spreadsheet.
- **~~No upgrades.~~** They landed in the very next pass —
  [progression.md](progression.md). Health, attack and stamina are now bought a level
  at a time from the E menu with points from eating, which is exactly what *Nothing
  grows on its own* above was making room for: this system's job was to make those
  three numbers real and flat so that spending points could be the only thing that
  moves them.

---

## Cost

Nothing measurable. Per frame: one distance and a handful of comparisons for each
whale that is currently hostile (at most two), plus the health regen counter. The
bite hit-test already existed and now carries a damage number through it. No new
geometry, no new draw calls and no new material.

The one thing that is not free is the head bar's **screen projection** — a matrix
multiply plus two custom-property writes — and it runs *only on the frames the bar is
up*, which is a couple of seconds after a hit and nothing at all the rest of the
time. Everything else follows the same "only touch the DOM when the value actually
changes" rule as the rest of `hud.js`. The hit flash writes an emissive colour and a
float on each of the shark's materials for 0.22 s, which needs no shader recompile:
`emissive` is an unconditional uniform in three's standard material.

The four new DOM nodes (head bar, damage vignette, target bar, death banner) are
static markup in `index.html` toggled by class.

---

## Every number, and where it came from

### `COMBAT` — the shark's side

| | | why |
|---|---|---|
| `hitFlash` | 0.22 s | the body flash. Long enough to register, short enough not to be a glow. |
| `hitFlashGain` | 2.4 | emissive added at the peak — enough to blow out through the fog |
| `barShowFor` | 2.5 s | how long the head bar lives after your health moves |
| `hurtGrace` | 0.3 s | two whales must not stack on one frame |
| `regenDelay` | 8 s | long enough that it never ticks during a fight |
| `regenRate` | 0.7 hp/s | worse than one dolphin — a floor, not a heal |
| `healPerPoint` | 0.4 | whale 60 hp, dolphin 16, reef fish 0.4 |
| `deathHold` | 2.2 s | long enough to read the banner, short enough not to annoy |
| `warnHealth` | 0.6 | the head bar turns amber |
| `lowHealth` | 0.3 | it turns red, and the vignette stops being a flash and becomes a state |

### The whale's `combat` block

| | | why |
|---|---|---|
| `attack` | 54 dmg | **two** unanswered hits kill a fresh shark; ten kill a fully upgraded one |
| `cooldown` | 3 s | slow enough to read, fast enough to be in the fight |
| `commit` | 9 m | just outside your own bite reach (3.4 + its girth ≈ 6 m) |
| `reach` | 7 m | strictly less than `commit`, so a strike can miss |
| `windup` | 0.75 s | 9.2 m of dodge at cruise, against a 7 m strike |
| `lunge` | 0.55 s | one commitment, not a tracking beam |
| `windupMul` | 0.55 | visibly loading, without stopping dead |
| `lungeMul` | 4.4 | 10.6 m/s — under your cruise, so it is a shove, not a chase |
| `chaseMul` | 2.6 | 6.2 m/s. It follows. It does not catch you. |
| `turnMul` | 2.2 | 0.62 rad/s — you out-turn it, always |
| `rear` | −0.3 rad | the visible tell |
| `leash` | 35 m | the follow radius. Inside the fog, so you see it let go. |
| `forget` | 10 s | as asked for |
| hp | 240 (derived) | `bites 10 × PLAYER.attack 24` — the ten-bite whale, unchanged |

Everything above is a proposal to argue with. The one number that is not a
proposal is `windup > reach / cruise speed`: break that and the system stops being
fair.

---

## File map

The system is a folder, because it is three separable things and one of them is
already a file everyone has to read.

```
src/combat/
  bite.js        the attack: cooldown, the lunge, biteDamage() worth of damage,
                 and the heal on a kill.  (moved here from src/bite.js)
  health.js      the shark's health pool: damage, healing, regen, death, respawn.
                 Knows nothing about rigs, terrain or creatures.
  aggression.js  what a NEUTRAL animal does once bitten: provoke, chase, strike,
                 disengage. Hands creatures.js three multipliers and no rules.
```

Touched, but not owned by it:

```
src/
  prey.js        hp = bites x PLAYER.attack; tryBite() takes damage; onHit/danger
  creatures.js   calls the four aggression.js entry points; steering is unchanged
  shark.js       `stunned` (input ignored while dead), the white hit flash,
                 and respawnShark()
  hud.js         the head bar, HEALTH row, damage vignette, target bar, death banner
  world.js       drives updateHealth(), projects the head bar, registers the respawn
  menu/stats.js  the Health and Attack rows are no longer placeholders
```

`index.html` carries `#health` (the head bar), `#damage`, `#death` and the bar inside
`#biteInfo`. Styles are in `style.css` under *Health bar*, *Damage vignette* and
*Death banner*.

The two boundaries worth keeping: `health.js` is told what "wake at the sanctuary"
means by `world.js` through `setRespawnHandler()` rather than importing the shark
and the whales itself, and `aggression.js` never moves an animal — it only ever
writes a target and three multipliers, so a hostile whale is subject to exactly the
same rock collision, floor clearance and roam bound as a calm one, in the same code.

---

## Known limits

- **Two whales can strike from opposite sides** and the 0.3 s grace will swallow
  one of them. Rare, and forgiving in the player's favour.
- **The whale has no separate "wounded" behaviour.** It fights the same at 12 hp
  as at 240, so there is no moment where it breaks off and flees. A real
  disposition system should give it one.
- **The strike volume is the whole body**, so a whale can hit you with a stretch
  of flank that never visibly moved. The rear-back sells the intent, not the
  geometry.
- **Death has no fade and no camera move** — the screen reddens, you drift, you
  are somewhere else. It reads as a placeholder because it is one.
- **Opening the menu while dead pauses the respawn**, because the menu freezes the
  whole simulation and the death clock is part of it. The banner is also hidden
  behind the overlay while you are in there. Harmless, and it goes away the day the
  death sequence gets its own screen.
- **The stat sheet's Attack row moves with growth**, so it is the one row in the
  menu that changes between two openings without anything being "upgraded". That
  is honest, but it does blur the "capabilities, not readings" rule the panel is
  built on.
- **Nothing else in the ocean can hurt you.** One whale in one basin is not a
  difficulty curve.
