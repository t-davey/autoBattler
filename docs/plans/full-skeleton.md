# Full-game skeleton: plan

Lay out the whole first Difficulty Tier as [the design](../design.md#world) describes it: 3 Acts of 20 Floors, a Lamp every 5 Floors, and 12 Guardians. Content that doesn't exist yet gets obvious placeholders, so the game plays end to end and each piece of real content later replaces one placeholder.

**Status: decided, not built.** The human made the decisions below on 2026-11-10.

## Decisions

| # | Decision | What it means |
|---|---|---|
| S1 | **New games start in Act 1, on placeholder content.** | The wilderness comes first, as the design orders it. Today's Undercroft content moves to Act 2, so the demo experience changes. Act 1 placeholders take low or no art effort. |
| S2 | **Floors are numbered per Act.** | Players see "Act 2, Floor 5". Inside the sim, a Floor's depth (1–60) drives its scaling, loot, and Floor level. |
| S3 | **The skeleton comes before the rest of [the second Wall](second-wall.md).** | Lamps and falling back get built once, for all 12 Walls. The second Wall then fills in Lamp 2's Guardian sheet and tunes. |
| S4 | **Placeholders follow an extrapolated curve.** | Today's per-Floor tables become formulas that reach depth 60. Each placeholder Guardian copies the Warden's actions, scaled to its depth. Playable, but not tuned. |
| S5 | **Guardians scale with depth, the Warden included.** | A Guardian's health and damage multiply by its depth's scale, relative to where it was tuned. The Warden keeps its tuning at the scale of the demo's Floor 5 and grows from there at depth 25, so it stays a Wall for a Party that has cleared Act 1. |

## Shape

- **The world as data.** A new `src/sim/content/world.ts` lists the Acts: name, place, and the Families and Guardians for each. The Undercroft keeps its 2 Families and the Mouldering Warden at its first Lamp. Every other slot is a placeholder.
- **Depth replaces `FloorNumber`.** A Floor is `{ act, floor }`, and its depth is `(act - 1) * 20 + floor`. `FLOOR_SCALE`, `BATTLE_XP`, `RARITY_ODDS`, `AFFIX_SCALE`, `LEVEL_REQUIREMENT`, and the Floor level become functions of depth. They match today's Floors 1–5 values at depths 1–5, then extend the curve.
- **12 Walls.** The game holds one `WallState` per Lamp, not just one. A Run starts from the last lit Lamp, or from any lit Lamp the player chooses. Falling back moves the Party back one Lamp, as [Setbacks](../design.md#setbacks) says.
- **Placeholders are flagged.** Each placeholder entry carries `placeholder: true`, and its name says so, such as "Placeholder Guardian (Act 1, Lamp 2)". A test lists what's still placeholder, so finished content can be counted.
- **Obvious on screen.** Placeholder enemies and Guardians draw as a flat, labelled block in a colour from outside [the palette](../design.md#palette). Placeholder chest lines and Act intros read as "[placeholder]".
- **The end of the Tier.** Beating the twelfth Guardian shows a placeholder "Tier 1 complete" Finding. Further Difficulty Tiers stay out of scope.
- **Saves break:** `SAVE_VERSION` 3, with a `!` in the title.

## Work, in order

Rapid prototyping: each piece lands as a commit straight on `main`, with no PR, and leaves the game runnable.

| # | Work |
|---|---|
| 1 | World data, and depth formulas that keep today’s values at depths 1–5: **done** |
| 2 | Floors as `{ act, floor }` through the sim, view, and UI labels; new games start at Act 1, Floor 1: **done**. The sim keeps a depth, and `floorAt` gives its Act and Floor. Undercroft content shows in Act 1 until step 4 |
| 3 | One Wall per Lamp, Runs that start from a Lamp, and falling back one Lamp: **done**, `SAVE_VERSION` 3. Runs start after the last lit Lamp; choosing another lit Lamp waits for Stance |
| 4 | Placeholder Families and Guardians for every empty slot, with the placeholder test: **done**. Act 3 stand-ins hit physical until the sim has fire. The balance script now reads Floor 5’s placeholder Guardian |
| 5 | Placeholder art and text in the UI: **done**. Magenta blocks, placeholder chest lines and Act intros, and a Town note once every Lamp is lit |
| 6 | Balance: `npm run balance` across all 60 Floors, to find where the curve breaks: **measured**, see [where the curve breaks](#where-the-curve-breaks) |

## Where the curve breaks

Measured on 2026-11-11 with `WORLD_SEEDS=20 npm run balance -- world`: 20 Seeds, 14 days of Party time, and a Routine player who spends points in step order and equips plain upgrades every 8 hours. The target is 16–32 hours per Wall, about 25 on average.

| Lamp | Relit at, median | Hours since the last | Level |
|---|---|---|---|
| Act 1, Floor 5 | 23.5 h | 23.5 | 14 |
| Act 1, Floor 10 | 64.8 h | 41.3, slow | 19 |
| Act 1, Floor 15 | 88.5 h | 23.7 | 23 |
| Act 1, Floor 20 | 120.4 h | 31.9 | 27 |
| Act 2, Floor 5: the Warden | 138.2 h | 17.8 | 30 |
| Act 2, Floor 10 | 144.3 h | 6.1, fast | 33 |
| Act 2, Floor 15 | 152.5 h | 8.2, fast | 37 |
| Act 2, Floor 20 | 160.7 h | 8.2, fast | 39 |
| Act 3, Floors 5–20 | 165.8–168.7 h | 0.2–5.1, fast | 43–51 |

- **Act 1 roughly holds; Acts 2 and 3 collapse.** Every Seed relit all 12 Lamps, the whole Tier in about 169 hours against the design's roughly 300.
- **The likely cause:** the Party's power grows faster than linear, since levels and gear each grow with depth and multiply each other. Enemy scale grows linearly, by 0.15 a Floor. Hours "since the last" subtract medians, so they are approximate.
- **The human chose to steepen enemy scale.** It stays linear through Act 1, then compounds by 4.5% a Floor. Of the rates tried on 8 Seeds, 3% stayed too fast, 7% and 10% stalled in Act 2, and 4% left Act 2 fast.

With 4.5%, on the same 20 Seeds:

| Lamp | Relit at, median | Hours since the last | Seeds that relit it |
|---|---|---|---|
| Act 1, Floors 5–20 | 23.5–120.4 h | unchanged | 20 |
| Act 2, Floor 5: the Warden | 144.0 h | 23.6 | 20 |
| Act 2, Floor 10 | 160.5 h | 16.5 | 20 |
| Act 2, Floor 15 | 178.0 h | 17.5 | 20 |
| Act 2, Floor 20 | 199.1 h | 21.1 | 20 |
| Act 3, Floor 5 | 248.1 h | 48.9, slow | 18 |
| Act 3, Floor 10 | 272.5 h | 24.5 | 14 |
| Act 3, Floors 15–20 | | | 3 and 2 |

- **Act 2 now holds.** Act 1's Lamp 2 stays slow, and Act 3 slows as Heroes near level 60 and stop growing, so only 2 of 20 Seeds relight every Lamp within 14 days. Act 3 needs its own look once its content exists.

## Consequences to check with the human

- **The demo's balance targets and demo Seed go stale.** Second-Wall step 6 ("tune both Walls, then search for a new Seed") has to be redone on the new layout.
- **[docs/design.md](../design.md#proof-of-concept-demo) needs updating:** the demo no longer starts in the Undercroft.
- **Act 1's enemies and damage leaning are still undecided** in the design. Placeholders stand in for them until the human decides.
