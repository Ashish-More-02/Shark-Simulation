# Deep Ocean Shark — direction & growth plan

The game is three things at once: a **story** with a villain at the end of it, an
**exploration** game about the one place on earth that is still genuinely unknown,
and a **systems** game with dispositions, death and upgrades.

Those three pull against each other. Story wants a fixed order, exploration wants
freedom, systems want repetition. Projects that try all three usually end up with a
story you skip, a world you don't read, and upgrades that only make numbers bigger.

> But i genuinely believe that combination of all three will make it greatest of all time, many games like breath of the wild , Ark survival evoloed , and many other games , create this combination which become great over time.

This document is about the one structure that makes all three the same activity.

---

## 1. The one structural decision: depth is the gate

The ocean is vertical, and the dark below is the strongest pull the setting has.
So make depth the thing progression buys.

Every upgrade buys pressure rating, sight, teeth or breath. Every new depth level is
**simultaneously**:

- the next act of the story,
- a new ecosystem to discover,
- a harder combat sandbox.

You never write a quest marker, and the player never feels railroaded — they feel
the dark below them and go get strong enough for it. It is a Metroidvania turned on
its side, which is a proven structure, and it is what makes the mystery of the deep
sea your *hook* rather than just your *setting*.

The gate is **soft**: nothing is locked, and the shark can swim into any level at
any time. What holds a weak shark back is that it dies down there. So "clearing the
gate" below means surviving the next level, not unlocking a door — see §2.

It also means the story cannot be skipped, because the story lives at the depths
you have to pass through to finish the game.

### The loop

```
  ┌───────────────┐  yields   ┌────────────┐   earns   ┌────────────────┐
  │ Explore level │ ────────► │  Discover  │ ────────► │ Two currencies │
  └───────────────┘           └────────────┘           │ Growth·Insight │
         ▲                                             └────────────────┘
         │                                                     │ buys
         │                                                     ▼
         │             ┌───────────────────────┐ survive ┌──────────────┐
         └──────────── │ Next level: next act, │ ◄────── │   What is    │
                       │ ecosystem, threats    │         │  down there  │
                       └───────────────────────┘         └──────────────┘
```

The gate is the only node that touches all three pillars — it spends the systems,
delivers the act, and hands back a fresh place to explore. Remove it and you have
three separate games sharing a shark.

---

## 2. The world: ten levels, descending

Full spec: **[systems/world-levels.md](systems/world-levels.md)**. Summary here.

The ocean is a corridor of **10 levels laid end to end**. Swimming forward carries
you into the next one, and every level's floor sits deeper than the last.

![The complete world in side elevation — ten levels stepping down](images/s1.png)

![The shark crossing level boundaries as it moves ahead](images/s2.png)

### It happens at a real place

**The western Pacific, from Guam south-west to the Challenger Deep** — the southern
end of the Mariana Trench, ~330 km out and 10,935 m down. Level 1 is a Guam reef;
level 10 is the deepest point on earth. Depth is 1:1 with reality; horizontal
distance is compressed about 33×, which is invisible at 50 m of visibility.

Real anchors sit at their real depths the whole way down: the *Cormoran* and
*Tokai Maru* wrecks in Apra Harbor at 35 m — the only place on earth where a WWI
and a WWII ship rest touching — Daikoku Seamount's molten sulfur pool at 414 m,
NW Eifuku's vent of *liquid* CO₂ at 1,600 m, the Mariana snailfish at 8,000 m,
xenophyophores on the floor at 10,600 m.

| # | Depth | Real zone | Light | Pressure |
|---|---|---|---|---|
| 1 | 0–50 m | Epipelagic — the reef | Full sun | 1–6 bar |
| 2 | 50–200 m | Epipelagic — the shelf break | Blue, dimming | 6–21 bar |
| 3 | 200–500 m | Upper mesopelagic | 1% → 0.01% | 21–51 bar |
| 4 | 500–1,000 m | Lower mesopelagic | The last photons | 51–101 bar |
| 5 | 1,000–1,800 m | Upper bathypelagic | **None** | 101–181 bar |
| 6 | 1,800–3,000 m | Bathypelagic | None | 181–301 bar |
| 7 | 3,000–4,000 m | Lower bathypelagic | None | 301–401 bar |
| 8 | 4,000–6,000 m | Abyssopelagic — the plain | None | 401–601 bar |
| 9 | 6,000–8,000 m | Upper hadal — the trench | None | 601–801 bar |
| 10 | 8,000–10,935 m | Hadal — the floor | None | 801–1,090 bar |

**The real numbers write the story for you.** The deepest shark ever recorded was a
Portuguese dogfish at 3,675 m — the bottom of level 7. Levels 8, 9 and 10 are past
anything a shark has ever done, so the act break is sitting in the data. The
deepest fish ever filmed was a snailfish at 8,336 m, which means that on the true
floor there is nothing with a backbone left except you and the thing you came for.

### Two levels resident, never more

Only the level you are in and — near a boundary — its one neighbour are built.
Everything else is torn down. Because `seabedHeight()` stays a **single continuous
function across all ten levels**, a level is only a statement about which slice
currently has a mesh; the boundaries are not seams to be stitched, so the ocean
reads as one place rather than as ten rooms.

Every boundary is also a piece of geography that occludes on its own — a shelf
break, a canyon mouth, a trench wall — so with ~50 m of visibility the player never
has a sightline into a level that isn't loaded.

### Gating is difficulty, not doors

**Every level is reachable from the start.** Nothing is locked. What stops a weak
shark is that the things living down there will kill it, so the player grinds and
returns. Pressure works the same way: below your rated depth health drains and the
screen distorts — a countdown, not a wall.

This is a better fit than hard gates for an exploration game, on one condition: the
danger has to be **telegraphed** before it punishes. A player who dies to something
they heard from the boundary and chose to swim past learns "not yet". A player who
dies to something they never saw learns "unfair", and the soft gate has failed.

### The chart

An 8 km world with 50 m of visibility needs a map. It takes the form of an old
sounding chart — aged paper, brown ink, hand-drawn contours, depth soundings, a
compass rose — and its primary view is the side elevation above, which is both the
right projection for a vertical world and what such a chart genuinely looks like.

Real charts drew speculative sea monsters where the cartographer had no soundings,
which makes them the ideal fog of war: **unvisited levels are blank parchment with a
guess drawn on it**, turning into real coastline as you go. The chart also carries
recovered log fragments, so opening the map is how the story gets read.

---

## 3. You have one verb. You need four.

This is the most under-priced problem in the current build. The only thing the
player can *do* to the world is bite it, so every creature is food and every point
of interest is nothing. No amount of new content fixes that. Verbs multiply design
space faster than models do.

| Verb | Status | What it buys you |
|---|---|---|
| **Bite** | Have it | Feeding and combat. The reticle feedback and multi-bite prey are already doing real work. |
| **Observe** | To build | Hold on a creature to log it. Fills the Codex, pays Insight, gives passive creatures a reason to exist. The non-violent progression path. |
| **Echolocate** | To build | A sonar pulse that lights up points of interest through the dark. Makes darkness a feature instead of a limitation. |
| **Carry** | To build | Hold something in your jaws and take it somewhere. Turns treasure from a pickup into a decision. |

**Prototype echolocate first.** It costs a shader pass and a list of nearby points
of interest, it solves the ~50-unit fog visibility problem *diegetically* rather
than by cheating the fog, and it will sell a trailer on its own.

---

## 4. Death — and why hunger is the wrong model here

The arcade answer is a hunger bar that drains constantly. For this game that is
actively harmful: a timer punishes the player for stopping to look at anything, and
looking at things is the entire product.

| System | Model | Why |
|---|---|---|
| **Health** | Damaged by attacks and hazards; eating heals | Feeding stays valuable without a clock forcing it |
| **Pressure** | Below your rated depth, health drains fast and the screen distorts | The gate made physical — you can always *try*, you just can't survive it |
| **Hunger** | A very slow drain that only bites if ignored for a long session | Flavour and gentle pressure, not a leash |
| **Death** | Wake at the last sanctuary; drop uncollected Insight where you died and swim back for it | Real stakes, no lost progress, and a death becomes a second expedition |

That last row is a Souls-style recovery loop and it is worth stealing wholesale.
It is the only death model that creates tension in an exploration game without
making players resent exploring.

---

## 5. Creature dispositions

Aggressive / neutral / passive, but **contextual** rather than a fixed label. That
is the difference between a creature with a stat and a creature with a temperament,
and it is where the "real feel" comes from.

| Disposition | Baseline | What flips it | Example |
|---|---|---|---|
| Passive | Flees, never engages | Nothing — but a wounded one attracts predators to you | Bait shoals, clownfish |
| Neutral | Ignores you at distance | Approaching young, a nest, or a carcass it claimed | Whales, turtles, groupers |
| Territorial | Warns, then charges | Entering its patrol; backs off if you leave | Rival shark, moray |
| Aggressive | Hunts you on sight | Blood in the water doubles its detection range | Orca pod, the deep predators |

`creatures.js` already carries a `shy` parameter and dwell-based wandering, so this
is an extension of a system that exists rather than a new one. The
blood-in-the-water rule is the cheapest way to give combat consequences beyond the
fight itself.

---

## 6. Two currencies, so exploring isn't a detour

One currency means one optimal playstyle.

- **Growth — from hunting.** Size, bite damage, health, jaw reach. Already built:
  points to scale, damped over 1.2 s. Keep it as is.
- **Insight — from discovery.** Pressure rating, sonar range, stamina, speed, and
  every story fragment. Earned by logging creatures, finding wrecks, recovering
  artefacts.

Note which one buys **depth**: Insight does. A player who only hunts can get
enormous and still be stuck at 400 m — that is the design telling them, in
mechanics rather than in text, what kind of game this is.

---

## 7. Telling a story on a solo budget

There is no cutscene pipeline here and one should never be built. Four channels, in
ascending order of cost:

1. **Environmental storytelling — free.** A whale fall. A trawl net still full. A
   wreck with the hold open. The prop system already places these; the story is in
   *what* gets placed and where.
2. **Log fragments — cheap.** Recovered recordings and journal pages that pay
   Insight. This is the load-bearing channel: it makes the story *be* the
   exploration reward rather than an interruption to it.
3. **Illustrated stills — ~15 pieces.** A painted plate plus narration for the
   prologue and each act transition. Costs a commission, not an animation team, and
   reads as deliberate craft rather than as a shortcut.
4. **The boss — one bespoke encounter.** Multi-phase, arena-scale, the only thing
   in the game with hand-authored behaviour.

### A story spine to argue with

The reef off Guam is emptying and the fish are migrating away from something below.
You follow them down. Human traces get denser as you descend — the old wrecks in
the harbour, then nets, then a deep-sea mining operation working the vents where it
has no legal right to be. The villain is not a monster that wandered in; it is
something the operation made, or woke, and it has been growing in the dark ever
since. The last act happens in water no shark was built for, against a thing that
belongs there.

**The real setting does most of this for free.** Two documented facts:

- A **plastic bag was photographed at 10,898 m** in the Mariana Trench. Our rubbish
  is already at the bottom of the deepest place on earth.
- **Amphipods from the trench carry PCB contamination** comparable to some of the
  most polluted rivers on the planet (Jamieson et al., 2017).

The whole area is a **protected marine monument**, and seafloor mining at
hydrothermal vents is a live Pacific controversy right now. So the antagonist needs
no invention at all — only accuracy, and a player left to draw the conclusion.

One caution: use the geography, wrecks and science freely, but **invent the mining
operator.** Real companies and agencies do not get attached to fictional crimes.

---

## 8. Roadmap

Six stages, each independently shippable. That matters more than the estimates: the
goal is that a year in you have something people are playing, not something that is
nearly ready.

### Stage 1 — Make it a game (≈ 6 weeks)

Health and damage, the sanctuary-respawn death loop, a save file, pause and
settings screens. Add **Observe** and a first Codex.

None of this is content. It is the frame every later stage hangs on, and until
losing is possible nothing else can be evaluated.

*Ships as: a playable loop.*

### Stage 2 — The discovery loop (≈ 8 weeks)

Echolocate, points of interest, wrecks and artefacts, the Insight currency, the
upgrade screen. At the end of this the game has a reason to keep playing that is
not "eat more fish".

*Ships as: a free web demo — build the audience here.*

### Stage 3 — Danger with a temperament (≈ 10 weeks)

The disposition system, territorial and aggressive AI, blood-in-the-water
detection, the first predator that genuinely hunts you. Combat stops being a
one-sided vending machine.

*Ships as: a demo update.*

### Stage 4 — The descent spine (≈ 4 months)

The ten levels themselves — the largest stage, and the one that turns a basin into a
world. Full spec in [systems/world-levels.md](systems/world-levels.md).

Build order matters here, because the streaming has to exist before the content
does:

1. **A continuous `seabedHeight()` across the whole 10-level run.** Everything else
   depends on the terrain being one function rather than ten.
2. **The streaming manager** — two levels resident, hysteresis, time-sliced builds,
   the persistent per-level state record. Test it with ten copies of the current
   reef before authoring anything unique.
3. **Boundary geography** — the shelf breaks and trench walls that make the seams
   invisible.
4. **Per-level ecosystems, fog and light**, working down from level 1.
5. **The chart**, once there is enough world to get lost in.

Chunked prop placement and the fog system carry most of the rendering weight
already; the new work is lifecycle, not drawing.

*Ships as: Steam page + wishlist campaign.*

### Stage 5 — Story and the boss (≈ 4 months)

Illustrated prologue and act plates, log fragments seeded through every band, the
station, the reveal, the multi-phase boss.

Do this last. Story written against systems that already feel good is far better
than systems bent to fit a story.

*Ships as: Steam Early Access.*

### Stage 6 — Ship it properly (≈ 3 months)

Electron + Steamworks, controller support, accessibility, an options menu people
respect, a performance pass on low-end GPUs, a trailer built around the sonar
pulse.

Budget more time here than feels reasonable — this is where web-built games are
usually caught out.

*Ships as: 1.0.*

---

## 9. Can JavaScript carry this?

Yes, and the worry is aimed at the wrong layer. The bottleneck is GPU draw calls,
fill rate and shader cost — and those are **identical** whether the WebGL commands
are issued from JavaScript or from C++. A C++ rewrite of the current renderer would
produce the same frame time.

Two shipped counter-examples: **CrossCode** is written in JavaScript and shipped on
Steam, PS4, Xbox and Switch. **Vampire Survivors** was built in HTML5 and sold
millions on Steam. Neither was held back by the language.

| Real ceiling | Does it bite you? |
|---|---|
| Single-threaded main loop | Only if you add heavy physics or pathfinding. Workers can take those off-thread. |
| GC pauses from per-frame allocation | Manageable — and the code already reuses vectors rather than allocating in the loop. |
| No compute shaders in WebGL2 | Not needed for anything here. WebGPU is the upgrade path if it ever is. |
| ~2–4 GB browser memory ceiling | Real. It forces streaming assets per depth band — which the banded design does anyway. |
| Electron overhead on Steam | ~150–250 MB of Chromium. Accept it, and prefer Electron over Tauri: a bundled engine means one WebGL implementation instead of three. |

**Scope is what will kill this project, not JavaScript.** Five biomes, four verbs, a
disposition system, a codex, a story and a boss is an 18–30 month solo build. Every
stage above is shippable on its own for exactly that reason.

---

## 10. Two risks worth handling early

**Art licensing and coherence.** The models are CC-BY from several different
authors. Fine commercially if attribution is honoured, but a paid game needs one art
direction — right now the clownfish and the whale come from different visual
worlds. Budget for a unifying shader treatment or a modelling pass *before* the
Steam page, not after.

**Audio.** CC0 ambience carries a sandbox; it will not carry five biomes and a boss.
An adaptive score that shifts by depth band is a large part of what will make the
descent feel like a descent. Commission it around Stage 4.

---

## 11. Start here, this week

1. **Prototype echolocate.** A pulse, an expanding ring, points of interest lighting
   up through the fog. One evening for a rough version, and it tells you immediately
   whether the deep-sea fantasy lands.
2. **Add health, damage and the sanctuary respawn.** Nothing about the game can be
   evaluated until losing is possible.
3. **Write the one-page story spine.** Not a script — the five acts, the villain,
   and what the player learns at each band. Every later decision gets easier once
   that page exists.

All three are small. Together they are the difference between a demo people admire
for a minute and a game people ask when they can buy.

---

## 12. Documentation convention

Every system gets its own doc in `Docs/systems/`, written when the system is
designed rather than after it is built. Each states what the system is for, the
numbers it runs on and where they came from, what it costs, and what is still
undecided. This roadmap stays a summary and links out.

- [systems/world-levels.md](systems/world-levels.md) — levels, streaming, the chart
- Planned: `echolocation.md`, `dispositions.md`, `progression.md`,
  `death-and-respawn.md`, `codex.md`, `story-spine.md`

---

*Written against the current build: stamina system, bite mechanics, shoaling AI and
chunked prop culling all in place. Depths, timings and the story spine are proposals
to argue with, not specifications.*
