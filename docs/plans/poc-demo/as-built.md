# As built

What merged milestones left for later ones to know. The code holds their rules and numbers. Their original text is in the [plan at 1e59566](https://github.com/t-davey/autoBattler/blob/1e595668bb8380e0d8f1f06b37c6d95e33fb3556/docs/plans/poc-demo.md).

## Milestone 1 ([PR #12](https://github.com/t-davey/autoBattler/pull/12))

- A Team with only a back Row moves forward when a Battle starts.
- `BattleView` has `party` and `enemies`, and `PARTY_TEAM` in `run.ts` is the only link between them and Team ids.
- Save validation lives in `game.ts`, and each new saved field needs a check there.

## Milestone 2 ([PR #14](https://github.com/t-davey/autoBattler/pull/14))

- `UnitSpec`'s `oil`, `maxOil`, `skills`, and `poisonOnHit` are optional, so enemies and stand-ins don't need them.
- `attack` events report `damage` as health lost, with `absorbed` beside it, and a new `effectDamage` event covers Bleed and Poison ticks. Shared Burden adds a second event, with `redirectedFromName` set.
- On a shared hit, the 1-damage minimum applies only to the original target's share.
- `scripts/balance.mjs` calibrates its stand-in enemies by bisection, so the reference Party stays near 50% as numbers change.

## Milestone 3 ([PR #16](https://github.com/t-davey/autoBattler/pull/16))

- **Setbacks:** `battleEnded` still says how a Battle went, then a `wipe` or `draw` event follows with `floor` and `enemyName`. Count Setbacks from those two events alone, so none counts twice.
- **Actions can report:** `applyAction` takes an optional sink, because spending a point can end a fallback. The store adds those lines to the Live Log.
- **`scenario`:** adds `startAt` and `lampLit`, as planned, and two more for tests that tuning mustn't break: `setbacks` (3 starts fallen back) and `battleTicks` (draws Battles early).
- **Where events fire:** `floorEntered` comes on reaching a Floor's first Room, and so reaches a sink on a new game. Each Room's `roomEntered` comes first, then the Battle or chest. `levelUp` comes before the Room's recovery, so recovery uses the new max health.
- **Timed actions:** the Warden fights by `UnitSpec.actions`. Its `power`, `actionInterval`, and `damageType` go unused.
- **Between Battles:** the Battle panel shows the Party's carried health and Oil, so wear shows outside a Battle too. The Town menu also shows the Setback count from `GameView.wall`.
- **Dev queries:** `src/ui/devSetup.ts` reads `?seed=`, `?start=guardian`, and `?level=`.

## Milestone 4 ([PR #17](https://github.com/t-davey/autoBattler/pull/17))

- **Item ids:** `ItemId` is a number that counts up from `nextItemId`, so a higher id is a newer item. Starter gear takes the first ids.
- **Item views:** `itemFound` carries an `ItemView`. `itemFound` follows the Room's `chestOpened` or `battleEnded`, or a Guardian kill's `guardianFell`, and its `lampRelit` on the first kill.
- **`scenario`:** adds `equipped`, as planned, and `stash` for tests. `rollItem(seed, floor)` rolls one item alone, without a Game. Scenario tests assert against extremes, such as level 1 or level 40, so that tuning doesn't break them.
- **First kill:** the guaranteed rare hangs on `wall.lampLit`, so a `lampLit` scenario gets ordinary drops.
- **Stash filter:** G39 filters by stat, and `ItemView.affixes` now serves only `balance -- drops`.

## Milestone 5 ([PR #18](https://github.com/t-davey/autoBattler/pull/18))

- **Stepping:** `bankElapsed` and `stepTick` in `game.ts` are the only way the Game moves. `advance` and catch-up differ only in how they slice time and where events go.
- **Who holds what:** `driver.ts` holds the time the state was last advanced to, which is a save's `savedAt`. `store.ts` holds the Game, runs catch-up's chunks, and refuses actions during it with `catchingUp`. A full-window overlay stops the player reaching them.
- **Saves:** `SAVE_VERSION` is still 1, and the first saves carry it. From here, a change that stops them loading needs `!` in the PR title.
- **Dev queries:** a save wins over `?seed=`, `?start=`, and `?level=`, which take effect after "Start over". `DEMO_SEED` in `main.tsx` is 8, from `npm run balance -- demo-seed`.
- **Report limits:** a Battle under way when catch-up began shows only the damage since then. `floorsCleared` counts on reaching the next Floor, so a Floor left just before catch-up counts in the report. A second absence adds to an undismissed report.

**R1 and the save and Stash rows, measured on 2026-11-06.** All are under their limits, so no fallback is in. [Milestone 6's results](../poc-demo-results.md#risks-re-measured) re-measure the bench and save rows.

| Measure | Limit | Measured |
|---|---|---|
| `npm run bench:catchup`, 12 hours under Node, median of 3 | 2 s | 100 ms, within 70-130 ms |
| Longest 5,000-Tick chunk under Node | None | 8.9 ms |
| In `npm run dev`, a 13-hour save: `longtask` entries from the catch-up | Any over 100 ms | None reported, so none over 50 ms |
| The same: total time | 10 s | Under 1.5 s, when the report was already up |
| Save after 12 hours, 3 Seeds under Node, median | 1 MB, 20 ms | 48 KB, 0.2 ms, with 447 items |
| Save after that browser catch-up | 1 MB | 63 KB, with 496 items |
| Stash tab with 496 items in `npm run dev`: longest sort or filter, then opening the tab | 100 ms | 87 ms, then an 87 ms task |

The Stash is the closest to its limit, in a dev build. It has no `content-visibility`, which is the fallback if the Stash outgrows this.

## Milestone 6 (PR_LINK)

- **Numbers:** [the results](../poc-demo-results.md) hold the tuned values, every target, and the findings a later Wall should weigh.
- **Tests:** tests no longer pin tuned enemy, Guardian, or Rarity numbers, so tuning shouldn't break them.
- **Balance script:** `wall [firstSeed]` measures the targets, with a later Seed for a check on unseen Seeds. `demo-seed [firstSeed]` re-runs the Seed search when rules change. `builds` now includes the real Warden.
