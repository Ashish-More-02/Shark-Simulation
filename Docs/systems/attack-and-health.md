# System: attack & health

> Status: **built, first pass.** The system lives in
> [`src/combat/`](../../src/combat/) — `bite.js`, `health.js`, `aggression.js` —
> with prey hit points in [`src/prey.js`](../../src/prey.js) and the numbers in
> `config.js` → `COMBAT`, `PLAYER` and the `combat` block on each fighting species
> (the whale and, since the second pass, the manta ray).

This is [ROADMAP](../ROADMAP.md) **Stage 1's** load-bearing item: *"until losing
is possible nothing else can be evaluated."* One animal fights back — the whale —
and that is deliberate, because the point of this pass is not content. It is to
make the two numbers real that the whole game will hang off: **the shark can be
hurt**, and **a bite is worth an amount of damage**.

> **Second pass: the manta ray.** Two of them in the shallows and three on the reef,
> running the same machine at a third of the damage — see [The manta ray](#the-manta-ray).
> It cost one `combat` block in config and **no code in `src/combat/`**, which was the
> test of whether the whale's implementation had been written as a whale or as a
> disposition. Its arrival also settles the first of this doc's known limits: level 1
> is no longer a basin where nothing can hurt you.

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
| A fighter's `commit` / `reach` | ✓ `+ (mouthAhead − bodyRadius) × (scale − 1)` | a flat strike range is one a grown shark stands permanently outside of — see [why both follow the shark](#and-why-both-follow-the-shark-as-it-grows) |
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
                                      │ within 6 m of its body
                                      ▼
                          ┌────────────────────────┐
                          │ WINDUP 0.75s (rears)   │
                          │        ↓               │
                          │ LUNGE  0.55s (rams)    │  hit: 54 dmg inside 4 m
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

- **Commit** at 6 m from its body surface, cooldown permitting. Measured to the
  *body* rather than to a point — but only to the **front 55%** of that body, which is
  a correction; see [Which end of the animal hits you](#which-end-of-the-animal-hits-you).
- **Windup, 0.75 s.** It drops to just over half speed and **rears** — a `-0.3` rad
  pitch bias on the pivot, so the nose comes up and the whole animal visibly loads.
  Plus a low audio cue.
- **Lunge, 0.55 s** at 4.4× speed — about 10.6 m/s, still under the shark's 12.2
  m/s cruise. The hit lands the first frame the shark is inside 4 m of its body,
  and once per lunge only.
- **Cooldown, 3 s** from the commit.

Do the arithmetic on the windup: 0.75 s of warning at cruise speed is 9.2 m of
travel, against a 4 m strike. **Every single hit is dodgeable**, always, with no
upgrade and no timing precision. That is the property that makes this fair, and it
is the number to protect if any of the others get retuned.

> **Retuned once already.** The first pass ran a 1.1 s windup on a 5 s cooldown at
> 3.4× lunge speed, and it played as a whale that was barely participating — you
> could take one for free by walking away between strikes and never even watch it.
> Everything above is the faster version. The inequality is what stayed fixed while
> the feel moved: 9.2 m of dodge against what was then a 7 m reach is a smaller margin
> than 13 against 7, so you now have to actually react, but the guarantee is intact.

The rhythm it produces is: bite twice, back off while it rears, come back in. Combat as
a conversation, which is the whole reason to have a windup at all.

### How close is close: `commit` and `reach` against your own bite envelope

`commit` and `reach` were 9 m and 7 m, and they were **wrong** — not marginally, but in
kind. Read what the number measures (`bodyD` in `aggression.js`): the gap between the
shark's **hull** and the animal's **body surface**, both girths already subtracted. 7 m
of that is seven clear metres of open water, more than a shark's whole body length, and
the whale connected across it with nothing visibly touching. Being hit stopped being a
consequence of where you chose to be.

The right scale to judge them against is **the shark's own bite envelope** — the band of
`bodyD` it can occupy while its jaws are in range of something. Both ends fall out of
`BITE`, and the animal's girth cancels out of both, so this is the same window for a
whale and for an anglerfish:

```
   nose touching its body        bodyD = (mouthAhead − bodyRadius) × scale
   at the limit of your jaws     bodyD = 0.6 + (reach + mouthAhead − bodyRadius) × scale
```

At 6 m long that is **1.75 m to 5.75 m**. So:

| | reach | where that sits in your bite envelope |
|---|---|---|
| Whale | 4 m | 56% — hug it and it can hit you; bite at arm's length and it cannot |
| Manta ray | 2.5 m | 19% — a wing actually reaching you |

### Which end of the animal hits you

`bodyD` is a distance to the animal's **spine**, and the spine ran the whole length of
it — so the strike connected from anywhere along a 21 m whale, including 10 m of tail
pointing away from you. Being rammed by a tail that never moved, from an animal whose
head was aimed somewhere else, is the strongest single complaint this fight produced,
and the original justification for it does not survive contact:

> *"A nose-only strike would make a whale with a 0.62 rad/s turn rate unable to hit
> anything that stayed near its tail — which is where you want to be biting it from."*

That is true, and it is not a reason to let a tail deal 54 damage. It is a description
of a **position the player earned**. A ram is a head-first commitment; if you are behind
the animal, the answer is that it has to turn around.

So `combat.strikeSpan` is the fraction of the body, measured back from the nose, that a
strike connects with. Both distances are measured to that stretch of animal and to
nothing else:

| | `strikeSpan` | what it is, in metres |
|---|---|---|
| Whale | 0.55 | the front 11.5 m of 21 — head, jaw, shoulder. Reaches just past the pivot, because an animal that size does lead with its whole front half. |
| Manta ray | 0.5 | the **disc**: 4.2 m of 8.4, excluding the whip tail |

**Shortening the section is only half the fix, and the smaller half.** A capsule has an
end cap — a hemisphere of radius `girth + reach`, which on a whale is **7.3 m** — so a
strike limited to the front 55% still bled two thirds of the way down the tail it was
supposed to exclude. No value of `strikeSpan` removes that; it only moves it. So
`strikeDistance()` drops the rear cap outright and returns `Infinity` behind the section:

```
                  strikeSpan 0.55 on a 21 m whale
   tail ◄─────────────────────────────┬──────────────────────────► nose
        -10.5 m                    -1.05 m                     +10.5 m
        └──── cannot touch you ─────┘└──── can, within 4 m ────┘└─ +4 m ─┘
```

The nose end *keeps* its cap, because water in front of the animal is exactly where a ram
arrives. The result is a rule with no fine print: **a whale's tail cannot *ram* you, and a
manta's cannot touch you at all.** The whale's tail can now *slap* you, which is a
different attack with its own tell — see
[the fluke slap](#the-fluke-slap-and-why-the-whale-got-faster) — and the two attacks'
spans tile the animal exactly, 0.55 in front and 0.45 behind.

The manta's number is measured off the rig rather than chosen. Walking its vertices back
from the nose, the half-width peaks at 33–42% of the length, collapses across 42–50%, and
past 55% is a tail 8 cm across:

```
 from nose   0-8%   8-17%  17-25%  25-33%  33-42%  42-50%  50-58%  58-100%
 halfwidth   ▇▇▇    ▇▇▇▇   ▇▇▇▇▇▇▇▇▇  ▇▇▇▇▇▇▇▇▇▇▇  ▇▇▇▇▇▇▇▇▇▇▇▇▇  ▇▇  ▇  ·
                                          ^ wingtips        ^ disc ends
```

Cost: one clamped projection per hostile animal per frame, into a scratch vector.

### …and why both follow the shark as it grows

Not as a difficulty dial — as a fix for an artefact of the same measurement. `bodyD` runs
to the shark's *pivot* less a sphere at that pivot, while its jaws work from a mouth
`mouthAhead × scale` in front of it, so **the closest `bodyD` a shark can ever be at while
biting grows with it**: 1.75 m at 6 m long, 2.6 m at 9 m, 3.7 m at full size.

Leave the strike distances flat and a 9 m shark is a shark the manta ray can *never
touch*, however close it swims, because the strike range is smaller than the nearest its
target can physically be. That is not an easy fight, it is a dead mechanic, and it arrives
silently as the player grows.

So the correction is **additive** — the growth in that minimum standoff, and nothing more:

```js
const standoff = (BITE.mouthAhead - SHARK.bodyRadius) * (sharkScale - 1);   // 0 … 1.93 m
const reach = atk.reach + standoff;
```

Multiplying by the scale was the first attempt and it is worse in two ways. It inflates
the absolute distances rather than preserving the relationship — the whale's 4 m becomes
8.4 m against a full-grown shark, which is the "hitting me from miles away" complaint all
over again — and it eats nearly all of the dodge margin, because `windup × cruise` does
*not* grow: 9.15 m of warning against an 8.4 m strike, and 5.49 against 5.25 for the
manta.

Additive keeps the one property that actually matters, and keeps it as a constant number
of metres rather than a percentage: **every animal can always reach a shark that closes to
within `reach − 1.75` m of touching it** — 2.25 m for the whale, 0.75 m for the manta — at
every size. The fight does get easier as you grow, since your jaws outrange the strike by
more and more, and that is a reasonable thing for growth to buy. It never becomes
impossible, which is the failure mode.

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

`chaseMul` **3.1** takes the whale from 3.0 m/s to **9.3 m/s** and `turnMul` **2.2**
takes its yaw rate from 0.36 to **0.79 rad/s** — a 180° turn in four seconds. It is
*slower than your cruise in every mode*, including the lunge.

> **Both were raised** from 2.4/6.2 m/s and 0.28/0.62 rad/s, at the same time as the
> fluke slap and for the same reason: once its tail stopped being a weapon, a whale that
> needed five seconds to turn round could be farmed from behind. The ceiling on how far
> they could go is the sentence above — **under your cruise, in every mode** — because
> the moment a whale can run you down, disengaging stops being free and the shark is
> prey. 9.3 m/s against 12.2 keeps 2.9 m/s of escape in hand without boost.

That is not an oversight, it is the design. A hostile whale is a **place you
cannot be**, not a pursuer. Leaving is always available and always works; the
threat is entirely about how long you choose to stay inside its reach. Anything
faster would turn a neutral animal into a chase sequence and the shark into prey,
which is the wrong game — and a whale that outswims a shark is also just wrong.

The whale is also still bound by its basin's roam limit (`roamFor()` in
`creatures.js` — the reef's `play` 105, less 10 m), so it physically cannot follow you
up the canyon into the shallows. The escape route is real geography, not a rule. Note
that this now cuts both ways: a manta provoked in the shallows is held inside the
shallows' 85 m circle, so the canyon is an exit from either end.

### The fluke slap, and why the whale got faster

Restricting the strike to the animal's front 55% fixed being rammed by a tail. It also
created a worse problem than the one it solved: **the space behind a 21 m animal that
takes four seconds to turn round was free damage forever.** Tail-sitting became strictly
the best way to fight a whale — not a tactic, an exploit, and the kind that quietly
deletes the encounter it applies to.

Two changes answer it together, and neither works alone. Faster turning without a tail
attack just shortens the free window; a tail attack without faster turning leaves an
animal that still cannot reorient. So:

**1. A second attack, off the other end.** `combat.tail` runs the *same*
commit → windup → lunge → cooldown machine, read backwards from the flukes
(`strikeDistance(…, −1)`). What differs is everything the player perceives:

| | ram | fluke slap |
|---|---|---|
| damage | 54 — two kill a fresh shark | **36** — three do |
| cooldown | 3 s | **3.6 s**, and *shared* with the ram: one attack per cooldown, ever |
| the tell | `rear` **−0.3** — nose **up**, body loading backwards | `rear` **+0.4** — nose **down**, so ten metres of tail lifts clear of the water it is about to come back through |
| audio | `whaleStrike`, a low heave | `whaleTail`, louder and sharper — you are *behind* the animal and cannot see the tell |
| the swing | 4.4× speed at you: it closes the gap | 1.2× forward: it comes out of the swing moving, away from you |
| turning | tracks you at 0.79 rad/s | **0.25×** — it holds its heading, or facing you would take the flukes off target |
| covers | the front **11.5 m** (`strikeSpan` 0.55) | the rear **9.5 m** (`strikeSpan` 0.45) |

The two spans **sum to 1**, so every part of the whale belongs to exactly one attack and
no band of body is safe by accident. And the slap's return sweep *is* the animation: the
pitch bias eases back to zero during the lunge, so the flukes are visibly moving through
the water on the frames the hit can land.

Note the geometry runs the opposite way to the ram's. A ram *closes* — commit at 6 m,
reach 4 m, and it swims the 2 m. A slap *drifts*: the whale keeps moving forward through
the swing, so its flukes travel ~2 m **away** from a shark parked behind them, and the
1.5 m between `commit` 6 and `reach` 4.5 is spent rather than gained. Which lands the same
rule as everywhere else in this fight:

- a shark that **holds position** when the tail lifts had to be within 2.4 m — it is out
- a shark that **keeps following the tail**, which is what biting it requires, is inside
  4.5 m and takes 36

Sustained, the head is still the dangerous end — 18 dmg/s against the tail's 10 — so the
slap punishes a position without ever making the tail the place you *want* to be.

**2. Mobility, capped by the one rule that cannot move.** Covered in
[It cannot chase you down](#it-cannot-chase-you-down-on-purpose): 3.0 m/s cruise, 9.3 m/s
hostile, 0.79 rad/s, and a `speedCap` so the fastest individual's ram still comes in under
your 12.2 m/s cruise. The whale is on you now instead of trailing you, and leaving still
always works.

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

## The manta ray

### The same machine, a third of the size

Five of them: **two in the shallows, three on the reef** — the only wildlife rig that
lives in more than one basin (`CREATURES[].levels`, see
[world-levels.md](world-levels.md)). 120 hp, six bites, 20 points, and a `combat` block
that is the whale's four beats scaled down:

```
   commit 4.5 m ──► WINDUP 0.45 s ──► LUNGE 0.4 s ──► COOLDOWN 2.4 s
                    wings + nose up      16 dmg inside 2.5 m
```

It is **6.0 m across** — wider than the shark is long, and the second-largest animal in
the game after the whale. That size is *presence*, not difficulty: `commit` and `reach`
are measured from the body surface, so a bigger manta is one you meet from further out
and not one that hits harder or takes longer to kill.

Where the whale is a **wall** you buy upgrades to get through, the manta is a **tax on
greed**. You can kill one at level zero — six bites is 4.8 s of contact, about two of
its strikes, 32 of your 100 hp — and eating it hands 8 hp back. So the trade is real
but survivable, and the lesson it teaches costs a third of a health bar rather than a
death.

That is why it, and not the whale, is what level 1 gets. **The neutral contract has to
be learned somewhere cheap.** A player who first meets "bite it and it turns on you"
at 54 damage a strike learns it by dying; one who meets it at 16 learns it by backing
off, and arrives at the reef already reading the tell.

### It is also the first animal that is both shy and a fighter

`shy: 0.55` **and** a `combat` block, which nothing else in the game has. Crowd it and
it drifts away down a committed escape line (`FLEE`); *bite* it and it turns. That
combination is the disposition the roadmap's neutral row actually describes, and the
whale cannot show it because `shy: 0` — nothing down there worries a whale.

It costs one guard, in `creatures.js`: the flee block is skipped while hostile. Without
it a provoked manta would flee and attack on alternate frames — both blocks write the
same `target` — and do neither. That guard was written defensively when the whale
landed; this is what made it load-bearing.

### What is different, and why

- **It corners.** 1.19 rad/s against the whale's 0.62, and an 8.9 m turn radius —
  tighter than the dolphin's despite being slower, because a 4 m wing is *for* that.
  Circling it is not the free win circling a whale is. You still out-turn it (the
  shark is 1.6 rad/s), so it is a fight you can win by handling rather than by damage.
- **The dodge window is tighter.** 0.45 s × 12.2 m/s cruise = **5.5 m of warning
  against a 2.5 m strike**, where the whale gives 9.2 against 4. The invariant is
  intact — *every hit is still dodgeable with no upgrade* — but it asks for a flinch
  rather than a stroll. This is the one number in the block that is not a free choice:
  `windup × cruise > reach`, or the whole thing stops being fair.
- **It lets go much sooner.** `leash` **18 m** and `forget` **4 s**, against the
  whale's 35 and 10. An animal that is not a predator following you across a basin
  would read as a bug rather than as a grudge, so this one gives up after a short
  follow and no more: 18 m measured pivot-to-pivot on an 8.4 m body is ~14 m of clear
  water from its nose, which is a second and a half of cruising. Decide to leave and
  the fight is over about four seconds later. The floor on this pair is `commit` 4.5 —
  a leash near the commit distance would make it disengage mid-strike — and if it ever
  seems to forget you *during* a fight, `forget` is the number to raise rather than
  the leash.
- **On the reef, it is only half there.** The three reef mantas spend half of every
  76-second cycle up at the surface and half down on the sand (`CREATURES[].surface`,
  see [world-reference.md](world-reference.md)), so *where* you fight one is now part of
  the fight: at the top of the column there is no seabed to pin it against and no reef
  to break line of sight with. Provoking one **cancels the trip outright** — otherwise
  it would chase you horizontally while holding its depth 5 m under the surface, which
  is an animal attacking you sideways — so a fight always happens at the depth it
  started at.
- **Its own strike cue** (`combat.sfx: 'mantaStrike'`) — the same file as the whale's,
  played near its recorded rate instead of half of it. The whale's heave at a manta's
  size sounds like a whale you cannot see, which is a worse lie than no sound.
- **It respawns in 45 s**, not `BITE.respawn`'s 60. Five animals are the resident
  population of two basins, and the shallows with no manta in them are the shallows
  with no wildlife at all.

### The one thing its geometry needed

A manta is **6.0 m across and 0.96 m thick**, and `creatures.js` measures body radius
off a rig's *height* — which is correct for everything shaped like a tube and gives a
ray a **48 cm body**. A wing you were sitting on would not have been biteable, and its
strike distances would have been measured from a spine with no animal around it. So
`CREATURES[].girth` overrides it (2.25, roughly the half-span of the solid inner disc),
while `clearance` deliberately stays measured — how far its belly hangs below its
origin really *is* half its height, which is what lets a manta glide a metre off the
sand where a whale cannot.

The catch worth knowing: `girth` is a hand-authored number in world units, so it does
**not** move when `MODELS.manta.targetSize` does. The wingspan went 4.0 → 6.0 m and the
girth had to be walked 1.5 → 2.25 by hand to match. Everything else about the animal's
geometry — hit capsule length, floor clearance, the surface its strikes are measured
from — is derived from the measured bounding box and scaled itself.

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
| **Rear-back + audio cue** | a hit is coming — in 0.75 s from a whale, 0.45 s from a manta, and the cue is per species |
| **Which way the animal is pointing** | *which* attack can reach you: a whale rams with its front 11.5 m and slaps with its rear 9.5 m, and the two tells point opposite ways |

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
  `dispositions.md`. What is here is **one row of that table with two species in it**
  — the whale and the manta ray — built early because Stage 1 needs *something* to
  hurt you. The manta is the closest thing to a second row: it is the only animal that
  both flees you and fights you, which is what a disposition should be able to say.
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
static markup in `pages/game/game.html` toggled by class.

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
| `commit` | 6 m (+ standoff) | inside the shark's own bite envelope, so it commits while you are working on it |
| `reach` | 4 m (+ standoff) | contact range — the inner ~56% of your bite envelope at base size. See *How close is close*. |
| `strikeSpan` | 0.55 | only the front 11.5 m of it can hit you. Its tail cannot. |
| `windup` | 0.75 s | 9.2 m of dodge at cruise, against a 4 m strike |
| `lunge` | 0.55 s | one commitment, not a tracking beam |
| `windupMul` | 0.55 | visibly loading, without stopping dead |
| `lungeMul` | 3.8 | 11.4 m/s, 12.16 on the fastest individual — under your 12.2 cruise |
| `chaseMul` | 3.1 | 9.3 m/s. It follows, closely. It does not catch you. |
| `turnMul` | 2.2 | 0.79 rad/s off a raised base `turn` — a 180 in 4 s. You still out-turn it. |
| `rear` | −0.3 rad | the visible tell |
| `leash` | 35 m | the follow radius. Inside the fog, so you see it let go. |
| `forget` | 10 s | as asked for |
| hp | 240 (derived) | `bites 10 × PLAYER.attack 24` — the ten-bite whale, unchanged |

Everything above is a proposal to argue with. The one that is not is
`windup × cruise > reach + standoff`, worst case at full growth: **9.15 > 5.93** for the
ram, **7.32 > 6.43** for the fluke slap, **5.49 > 4.43** for the manta. Break any of those
and that attack stops being dodgeable on a grown shark, which is where it stops being
fair.

### The manta ray's `combat` block

Read against the whale's, column for column — it is the same block, and the point of
the table is the ratios.

| | manta | whale | why |
|---|---|---|---|
| `attack` | 16 dmg | 54 | seven strikes to kill a fresh shark, not two. The mob that teaches the tell. |
| `cooldown` | 2.4 s | 3.0 | quicker round again — a small animal that is *busy* |
| `commit` | 4.5 m (+ standoff) | 6 (+ standoff) | it commits once you are genuinely on it |
| `reach` | 2.5 m (+ standoff) | 4 (+ standoff) | a wing actually reaching you — the inner ~19% of your bite envelope |
| `strikeSpan` | 0.5 | 0.55 | the disc hits you; the 4 m whip tail does not |
| `windup` | 0.45 s | 0.75 | 5.5 m of dodge against a 2.5 m strike — a flinch, not a stroll |
| `lunge` | 0.4 s | 0.55 | a flick of the whole disc |
| `windupMul` | 0.6 | 0.55 | visibly loading without stopping dead |
| `lungeMul` | 1.85 | 4.4 | 11.5 m/s (12.0 at the capped jitter) — still under your 12.2 cruise |
| `chaseMul` | 1.5 | 2.6 | 9.8 m/s. Leaving is always available, without boost. |
| `turnMul` | 1.7 | 2.2 | **1.19 rad/s** vs the whale's 0.62 — this one corners |
| `rear` | −0.35 rad | −0.3 | nose and wings up; the whole disc loads |
| `leash` | 18 m | 35 | it follows a short way and stops. ~14 m from its nose. |
| `forget` | 4 s | 10 | small animals have short grudges |
| `sfx` | `mantaStrike` | `whaleStrike` | same file, near its recorded rate instead of half |
| `tail` | — | a whole second attack | the manta's whip tail is 8 cm across and slaps nothing; see [the fluke slap](#the-fluke-slap-and-why-the-whale-got-faster) |
| hp | 120 (derived) | 1000 | `bites 6 × PLAYER.attack 20` |

Its non-combat half — `speed` 6.2 (capped 6.5), `turn` 0.7, `band` [0.06, 0.42],
`ring` [14, 66], `girth` 2.25, `respawn` 45, `points` 20 — is documented inline on the
row in `config.js`, and its **6.0 m wingspan** (`MODELS.manta.targetSize` 8.4, which is
nose to tail tip) on the model row.

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
                 Nothing in it is about whales: adding the manta ray changed no
                 line of it, because every number comes off `spec.combat`.
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

`pages/game/game.html` carries `#health` (the head bar), `#damage`, `#death` and the bar
inside `#biteInfo`. Styles are in `pages/game/game.css` under *Health bar*, *Damage vignette* and
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
- **~~The strike volume is the whole body~~** — fixed by `combat.strikeSpan`, and the
  tail-sitting exploit that fix created is fixed too, by the
  [fluke slap](#the-fluke-slap-and-why-the-whale-got-faster). Both of those were shipped
  in the same afternoon as the bug they answer, which is the argument for writing the
  known-limits section honestly: it is the to-do list.
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
- **~~Nothing else in the ocean can hurt you.~~** The manta ray is the second
  fighter, and it put a hazard in level 1 as well. Two species across two basins is
  still not a *curve* — there is one step in it, 16 damage to 54, and nothing between
  or beyond them — but it is no longer a single point.
- **Neither fighter has a wounded state.** A manta fights the same at 8 hp as at 120,
  same as the whale. A real disposition system gives both of them a break-off.
- **Two mantas at once is the hardest fight in the game**, and nothing arranges for it
  or against it: three of them share the reef on independent waypoints, so whether you
  are fighting one or two is luck. That is fine at 16 damage a strike and would not be
  at 54.
