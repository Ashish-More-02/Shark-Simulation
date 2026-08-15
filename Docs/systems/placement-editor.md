# System: the placement editor (F4)

> Status: **built.** Code in [`src/editor.js`](../../src/editor.js), model list in
> `config.js` `EDITOR`.

Put things exactly where you want them, in the game, by eye — then paste the
result into `config.js`.

---

## Why it exists

Describing a position in words and having someone else turn it into coordinates is
a bad loop. Every round trip risks disturbing something that already looked right,
and you cannot see the result until it is already committed. **Placement is a
visual judgement and it belongs in the viewport.**

## Why it is not a level editor

Nothing the editor makes is loaded at startup, and nothing it makes is
authoritative. Placed objects are **previews**: no collision, no instancing, gone
on reload.

What it produces is **source code**. You paste that into `config.js`, and from
that moment the props system owns those objects exactly like every other prop —
they get chunked, culled, instanced, and given colliders. One source of truth
(`config.js`), and an editor whose only job is helping you write it.

That is a deliberate trade. It means you must paste before you reload, and it
means the world never has a second, invisible source of scenery that the config
does not know about.

---

## Using it

**Press F4.** Swim to where you want something. A green ghost floats ahead of you
showing exactly what will be placed. Press **Enter**.

| Key | Does |
|---|---|
| `F4` | Open / close |
| `Tab` | Switch between the **place** brush and the **erase** brush |
| `[` `]` | Previous / next model |
| `-` `=` | Smaller / bigger (×1.12 a step) — erase radius in erase mode |
| `,` `.` | Yaw |
| `↑` `↓` | Pitch — nose down / up, like a flight stick |
| `←` `→` | Roll |
| `R` | Level it — all three rotations back to zero |
| `9` `0` | Raise / lower, from floating in open water to buried in the sand |
| `;` `'` | Pull the brush closer / push it further away |
| `Enter` | Place it — or erase, in erase mode |
| `Backspace` | Undo the last one |
| `\` | Copy a ready-to-paste config block |

The readout shows the coordinates **local to whichever level you are in**, which
is the number that ends up in the config, so what you see on screen is what gets
written.

**The arrows stop steering while the editor is open** and rotate the ghost
instead. WASD still swims — which matters, because swimming is how the brush is
aimed — so the arrows lose nothing but their alias.

### Off the seabed, at any angle

The brush has all three rotations and a free height, so a prop does not have to
sit flat on the sand. That is the difference between dressing a seabed and
dressing a **reef**: coral grows sideways out of a wall, a fan hangs under an
overhang, and a scene only reads as having depth when some of it is above you.

`9` and `0` are unclamped in both directions:

- **Up** is the water column — the shallows have 42 units of it, the reef 82.
  Nothing holds a floating prop up, so it is genuinely hanging in open water; put
  it against a wall or under something or it will read as a bug.
- **Down** is the old sink, and still the right answer for anything flat-bottomed
  on a slope (see *Placing well* below).

Height is tracked in **world units** while you work but exported as `sink`, which
props.js measures in *model heights* and *downward* — so 8 units up at scale 2
comes out as `sink: -4.00`. The editor does the conversion; the reason it does not
simply store what it exports is that resizing would then move the prop, and every
press of `=` on a floating one would launch it.

The readout says `on the sand` / `12.4 above sand` / `3.0 buried` rather than a
signed number, because height is the one control here with no ghost cue of its own
once the seabed is out of frame.

### Placing well

- **The ghost sits ahead of you, not on you.** Placing a 70-unit mountain on top
  of yourself tells you nothing about how it reads. Back off with `;` `'` and look
  at it in the scene before committing.
- **Sink anything with a flat bottom.** A model sits on one sampled height, so on
  a slope one side lifts off the sand and you can see under it. `0` a couple of
  times fixes it, and it is what rock genuinely does — comes up *through* the
  sediment rather than sitting on it.
- **Watch F3 while you work.** A hand-placed mountain is the easiest way there is
  to put a hundred thousand triangles somewhere nobody will ever look. The two
  panels sit in opposite corners so you can keep both up.
- **Relief cannot exceed the water column.** The readout prints the height in world
  units; the shallows have 42 to play with and the reef 82. Going past that is
  fine if you *want* an island (see the shallows' rim) and a mistake otherwise.

---

## Deleting things (Tab)

**Press Tab.** A red circle lies on the sand ahead of you; `-` `=` size it; `Enter`
clears every scattered prop inside it, colliders included.

### Why you delete AREAS and not objects

You cannot say "remove that rock", because that rock has no line of config to
remove. It is not written down anywhere — it is the 47th draw from a random
sequence, and the row that produced it says `count: 56`, not where any of the 56
went. There is nothing to delete.

So the erase tool records **bare ground** instead: a circle in which nothing
scatters. That is how a level designer thinks anyway ("this should be open sand"),
it reads as intent rather than as bookkeeping, one circle removes as many props as
it covers, and it keeps working if the seed changes and the reef is re-dealt.

Hand-placed `fixed` props deliberately **ignore** clear zones. If you put it there
on purpose, clearing the ground around it should not take it with you. To delete
one of those, delete its line — it has one, which is the whole difference.

### Pasting it

`\` emits a `clear` array per level. Replace the (usually empty) one on that
level's `LEVELS` row in `config.js`:

```js
{ id: 1, name: 'The Shallows', center: [0, 0, 280], play: 95, seabed: -24,
  gapDir: -Math.PI / 2,
  clear: [
    { x: -12.0, z: 41.0, r: 18 },
  ] },
```

Until you paste, the erase is only a preview: the instances are scaled to zero and
their colliders dropped for this session. Reload and they are back.

**Undo does not un-erase.** Backspace removes the *record* so it won't be
exported, but the props stay hidden until you reload — putting instances back into
a live chunk is far more machinery than pressing F5, and the world is seeded, so a
reload restores it exactly.

---

## The world is the same every time now

Every scattered prop used to come from `Math.random()`, so **the reef was
different on every refresh**. That is why tuning felt like it kept undoing itself:
you could never tell whether a change had improved the world or merely reshuffled
it, and nothing could be pointed at because it would not be there next time.

Placement now draws from a seeded generator (`WORLD.seed`, see `placement.js`), so
the world is identical on every load. Change the seed to deal a completely new
reef; leave it alone and what you are looking at is permanent.

The terrain and hand-placed props were always deterministic. This brings the
scatter in line with them, and it is what makes both halves of this editor
meaningful — placing next to something, and clearing an area, both assume that
something will still be there tomorrow.

### ...and editing it does not re-roll it

A seed alone was not enough, and this is the part that actually bites while you
are authoring. Every prop in the world used to draw from ONE sequence in build
order, which means a PRNG's defining property — that each draw decides the next —
applied to the world as a whole. So the world was stable across refreshes but
**not across edits**: paste one `fixed` rock into level 2 and every prop placed
after it in the table moved, because your rock had consumed draws that used to
belong to them. Add a `clear` circle and the same thing happened, since a dropped
candidate changes how many draws the row uses. Level 1 was built first, so
touching the plain re-rolled the entire reef.

That is fixed. Each instance now seeds from its own ADDRESS in the world —
`L<level>:<model>#<row>@<index>` — so its placement is a function of the seed and
that name and of nothing built near it (`props.js`, `planInstances`). Hand-placed
entries are keyed by their coordinates, so their order in the array is irrelevant.
Concretely, all of these are safe:

| edit | what moves |
|---|---|
| raise a row's `count` | the new props appear; the existing ones stay |
| lower a row's `count` | props disappear off the end; the rest stay |
| add a `clear` circle | scenery vanishes inside the circle, and only there |
| add / remove / reorder `fixed` entries | nothing but that entry |
| retune level 1 | nothing in level 2 — the level id is in the name |
| add a row, reorder rows | nothing (rows are named by model, not by index) |

Two edits still re-roll a row on purpose, because they change what the row *is*:
changing its `ring` or its `clump`. And a second row of the same model gets `#1`,
so adding one shifts the later same-model rows; give a row `stream: 'somename'` to
pin its identity by hand if that matters.

---

## Pasting the result

`\` puts a block like this on your clipboard and in the console:

```js
  { model: 'mountain', count: 0,
    fixed: [
      { x: -74.0, z: 84.0, scale: 1.80 },   // level 2
    ] },
```

Each entry carries its own orientation and height, and only the ones you actually
touched are written — a prop you placed square on the sand still exports as the
bare four fields above:

```js
  { model: 'coralPurple', count: 0,
    fixed: [
      { x: 12.0, z: -38.0, scale: 1.40, rotY: 0.65, pitch: -0.39, tilt: 0.26, sink: -2.14 },
    ] },
```

| Field | Means |
|---|---|
| `rotY` | yaw |
| `pitch` | nose up / down (hand-placed only — scatter never pitches) |
| `tilt` | roll. props.js has called the z rotation `tilt` since before there was a pitch to pair it with, and the name stayed |
| `sink` | height, **downward**, in model heights — so a negative one floats |

Because these are written per entry, the row-level `sink` and `tilt` defaults do
not apply to them: an entry that names one overrides the row, and the editor names
every one you moved.

Drop it into the right table in `config.js` — `PROPS` for the reef,
`PROPS_PLAIN` for the shallows — and **add the row's usual options**, because the
editor records placement only, not appearance or collision:

```js
  { model: 'mountain', count: 0,
    palette: MOUNTAIN_PALETTE, solid: 0.8, taper: 0.1, tilt: 0, sink: 3,
    fixed: [ ... ] },
```

| Option | For |
|---|---|
| `palette` | rock colour variation (`MOUNTAIN_PALETTE`, `ROCK_PALETTE`, `PEBBLE_PALETTE`) |
| `shade` | grey jitter for plants instead of a palette |
| `sway` | plants bending in the current |
| `solid` / `taper` | collision. **Without these you can swim through it.** |
| `cutout` | alpha-tested foliage (ferns) |

`count: 0` means "no scatter, only the hand-placed ones". A row can have both:
`count: 20` plus a `fixed` array gives you twenty scattered instances and your
hand-placed ones in the same draw call.

### One entry, many instances

A `fixed` entry can stand for a thicket rather than a single object:

```js
{ x: -50, z: 96, scale: 2.4, n: 26, spread: 15, jitter: 0.3 },
```

`n` instances inside a `spread` radius with scale varied by `jitter`. That is how
the kelp stands at the canyon mouth are written — one line instead of twenty-six.
The editor does not emit these; add `n`/`spread` by hand when you want a clump
rather than a landmark.

---

## Adding models to the brush

`EDITOR.models` in `config.js` is the cycle order, roughly big-to-small so the
things actually worth hand-placing come first. Any key from `MODELS` can go in it.

---

## Known limits

- **No move or select.** Undo and re-place. Adding grab-and-drag means picking
  objects under a crosshair and a transform gizmo, which is a real editor, not a
  three-hundred-line one.
- **Placed objects have no collision** until pasted, so you will swim through your
  own mountains while editing.
- **Nothing survives a reload.** Press `\` before you refresh.
- **Erase is area-only**, and it cannot take out a hand-placed prop — delete that
  one's line instead.
- **Collision does not follow a prop off the sand.** A `solid` row's collider is a
  vertical capsule standing on the instance's base, so a floating or steeply
  pitched prop gets a collider in roughly the right place and the wrong shape.
  Fine for decoration, which is what wants those angles; do not hang a `solid`
  landmark in open water and expect to bump into it correctly.
- **Sway assumes upright.** A swaying row bends around the plant's own vertical
  axis, so pitching or rolling one bends it in a direction that no longer matches
  the current. Reef decoration does not sway, so this only bites if you pitch kelp.
