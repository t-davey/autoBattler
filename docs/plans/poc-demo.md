# Proof-of-concept demo: implementation plan

The demo tests one thing: is it satisfying to come back to loot, make a build decision, and see that decision beat a Wall? Each milestone is a tracer bullet: one PR that leaves the demo runnable end to end.

**Status: gaps confirmed by the human on 2026-11-05.** S3 and S4 under [Human stops](#human-stops) still lie ahead, and G21 still needs each later milestone's tables confirmed as it starts.

| Milestone | State |
|---|---|
| M1: Live Battle on screen | Merged in [PR #12](https://github.com/t-davey/autoBattler/pull/12) |
| M2: Heroes and skills | Merged in [PR #14](https://github.com/t-davey/autoBattler/pull/14) |
| M3: Floors and the Wall | Next: [m3-floors-and-the-wall.md](poc-demo/m3-floors-and-the-wall.md) |
| M4: Loot and gear | [m4-loot-and-gear.md](poc-demo/m4-loot-and-gear.md) |
| M5: Catch-up and Away Report | [m5-catch-up-and-away-report.md](poc-demo/m5-catch-up-and-away-report.md) |
| M6: Tuning and demo run | [m6-tuning-and-demo-run.md](poc-demo/m6-tuning-and-demo-run.md) |

## How to use this plan

Build one milestone at a time, in order. Every number is a starting value for M6 to tune. Read this file, the next milestone's file, and [as-built.md](poc-demo/as-built.md), then reach further when one of these applies:

- **[gaps.md](poc-demo/gaps.md):** the rulings a milestone's **Needs** line names.
- **[sim-interface.md](poc-demo/sim-interface.md):** adding to `src/sim/index.ts` or the catch-up path.
- **[risks.md](poc-demo/risks.md):** a milestone names a risk, or a threshold trips.
- **[The M2 review](poc-demo-m2-review.md):** a measurement arrives, so fill in its row under Estimates to compare and check the Watch list before tuning.

## Approved scope

This table overrides [docs/design.md](../design.md) for the demo only. Build nothing from the Cut column.

| Area | In the demo | Cut |
|---|---|---|
| Party | Preset trio: Sin-Eater, Huntsman, Lamplighter; editable names | Hexer, Party creation, multiple Parties |
| Skills | 1 Branch per Class (Bulwark, Bloodletting, Hearth), 3 skills each, plus a basic attack; player-set skill order; free respec | Other Branches, gold respec cost |
| Battles | Rows, Oil, cooldowns, physical and poison damage with resistances | Other damage types, Elites |
| World | Act 1 Floors 1–3, ending in 1 Guardian and 1 Lamp | Other Floors and Acts, Boss, Difficulty Tiers |
| Rooms | Battles and chests on a seeded layout | Traps, shrines, side-room rules |
| Loot | Common, magic, and rare items; about 6 Affixes; weapon, body, and one trinket slot; guaranteed rare on first Guardian kill | Uniques, other slots, Salvage, auto-salvage, Stash cap |
| Setbacks | Wipe returns to Town; fixed Push behaviour (fall back after 3 Wipes, retry on level-up) | Stance toggle, Lamp selection |
| Time | Real-time play, catch-up capped at 12 hours, Away Report | 2x speed, saved history of 10 reports |
| Town | Simple menu to re-send the Party | Merchant, gamble vendor, Belt |
| Platform | Browser via `npm run dev`; existing Electron shell still launches | Installer, auto-update, audio |

Placeholder art: CSS tiles and text glyphs, all original, in the grim gothic tone.

**Scope change:** G22, confirmed by the human, extends the Setbacks row: a build change also ends a fallback.

**Milestone order:** kept as approved. Research found no dependency that forces a change.

**Pacing:** the first Wall should take about 1–2 hours of Party time. This is a tunable value, separate from the design's 2-week pacing.

## Demo script

1. Launch and watch the Party clear Rooms on Floor 1, with the Live Log and map running.
2. Skip time. The Away Report shows a Wipe at the Guardian, mostly from poison damage.
3. Open the Stash, equip a new rare, and spend skill points.
4. Skip time or watch live, and see the Guardian fall.
5. The Lamp relights and the guaranteed rare drops.
6. Close the game, reopen it later, and see an Away Report from real elapsed time.

## Human stops

Build stops at each of these until the human answers.

| Stop | When | What the human decides |
|---|---|---|
| **S1: Gaps** | Before each of M1–M4 for G21, and whenever a new gap appears | That milestone's content tables, and any rule this plan leaves unsaid |
| **S2: Skill review** | Done in Milestone 2 | The 9 skills in [docs/demo-skills.md](../demo-skills.md) |
| **S3: Risk fallback** | Whenever a [risk](poc-demo/risks.md) threshold trips or an M6 target is missed, and number tuning hasn't fixed it | Whether to take a fallback that changes the design or scope, or to accept the miss |
| **S4: Rehearsal** | End of Milestone 6 | Whether the demo answers its question |

The human alone merges each PR.

## Build constraints

- **`.tsx` tests aren't configured.** `vite.config.ts` and `tsconfig.test.json` include only `src/**/*.test.ts` (plus the config file itself). No component tests are planned: AGENTS.md verifies UI in the running app, and store tests run as plain `.test.ts`. Files those tests import can't use DOM types, because `tsconfig.test.json` has no DOM lib, so `localStorage` access stays in a file they don't import.
- **The purity test bans the word `Date`** anywhere in non-test files under `src/sim`, including comments and content text.
- **Heroes deal only physical damage in the demo**, Bleed included. Enemy poison resistance therefore does nothing, so enemies have none.
- **JSON equality:** compare states as `serializeGame` strings. `toEqual` treats `-0` and `0` as different, and JSON doesn't.

## Each PR

Follow [docs/pull-requests.md](../pull-requests.md) in full: branch from the latest `main`, reach Done, check scope, review with `mattpocock-skills:code-review`, and fill in the template, including its Saves, Gameplay, and Docs lines. No milestone before M5 has saves, so none needs `!`. Put "Closes" and the milestone's issue in the PR body. Ask before filing any new issue.

In the same PR, retire the milestone: move what later milestones need to know into [as-built.md](poc-demo/as-built.md), delete its file, and mark it merged in the table above. Keep its gaps, since they record the human's rulings.
