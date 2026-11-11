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
| 3 | One Wall per Lamp, Runs that start from a Lamp, and falling back one Lamp |
| 4 | Placeholder Families and Guardians for every empty slot, with the placeholder test |
| 5 | Placeholder art and text in the UI |
| 6 | Balance: `npm run balance` across all 60 Floors, to find where the curve breaks |

## Consequences to check with the human

- **The demo's balance targets and demo Seed go stale.** Second-Wall step 6 ("tune both Walls, then search for a new Seed") has to be redone on the new layout.
- **[docs/design.md](../design.md#proof-of-concept-demo) needs updating:** the demo no longer starts in the Undercroft.
- **Act 1's enemies and damage leaning are still undecided** in the design. Placeholders stand in for them until the human decides.
