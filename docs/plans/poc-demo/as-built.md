# As built

What merged milestones left for later ones to know. The code holds their rules and numbers. Their original text is in the [plan at 1e59566](https://github.com/t-davey/autoBattler/blob/1e595668bb8380e0d8f1f06b37c6d95e33fb3556/docs/plans/poc-demo.md).

## Milestone 1 ([PR #12](https://github.com/t-davey/autoBattler/pull/12))

- A Team with only a back Row moves forward when a Battle starts.
- `BattleView` has `party` and `enemies`, and `PARTY_TEAM` in `run.ts` is the only link between them and Team ids.
- `driver.ts` applies no cap, and a returning window runs its whole gap live. M5 moves long gaps to catch-up.
- Save validation lives in `game.ts`, and each new saved field needs a check there.

## Milestone 2 ([PR #14](https://github.com/t-davey/autoBattler/pull/14))

- `UnitSpec`'s `oil`, `maxOil`, `skills`, and `poisonOnHit` are optional, so enemies and stand-ins don't need them.
- `attack` events report `damage` as health lost, with `absorbed` beside it, and a new `effectDamage` event covers Bleed and Poison ticks. M5's main damage type can fold over both. Shared Burden adds a second event, with `redirectedFromName` set.
- On a shared hit, the 1-damage minimum applies only to the original target's share.
- `scripts/balance.mjs` calibrates its stand-in enemies by bisection, so the reference Party stays near 50% as numbers change.

## Milestone 3 (PR_LINK)

- **Setbacks:** `battleEnded` still says how a Battle went, then a `wipe` or `draw` event follows with `floor` and `enemyName`. Count Setbacks from those two events alone, so none counts twice. M5's Setback kind comes from the event's type, and `fellBack` sets the Away Report's fall-back note.
- **Actions can report:** `applyAction` takes an optional sink, because spending a point can end a fallback. The store adds those lines to the Live Log. M4's `equipItem` calls `endFallback` the same way (G22).
- **`scenario`:** adds `startAt` and `lampLit`, as planned, and two more for tests that tuning mustn't break: `setbacks` (3 starts fallen back) and `battleTicks` (draws Battles early).
- **Where events fire:** `floorEntered` comes on reaching a Floor's first Room, and so reaches a sink on a new game. Each Room's `roomEntered` comes first, then the Battle or chest. `levelUp` comes before the Room's recovery, so recovery uses the new max health.
- **Timed actions:** the Warden fights by `UnitSpec.actions`. Its `power`, `actionInterval`, and `damageType` go unused.
- **Between Battles:** the Battle panel shows the Party's carried health and Oil, so wear shows outside a Battle too. The Town menu also shows the Setback count from `GameView.wall`.
- **Dev queries:** `src/ui/devSetup.ts` reads `?seed=`, `?start=guardian`, and `?level=`. `bench:catchup` now limits at M3's 2 s.

**The Wall, measured over 2 hours of Party time on the human's machine, for M6 to tune.** None of it trips a risk, and all of it is before M4's gear.

| Measure | Plan's hand estimate | Measured |
|---|---|---|
| First Guardian attempt, spending points as they come | 15 minutes | Median 28 minutes across 40 Seeds, reached in all 40 |
| First Guardian attempt, spending no points | 15 minutes | Median 94 minutes where reached, and 17 of 40 Seeds never reach it |
| Level at 2 hours | 8 | 8 in 39 of 40 Seeds |
| New game clears Floor 1 with no Setback, no points spent | Always | 286 of 300 Seeds |
| Where Wipes land at 2 hours, points spent | Mostly the Guardian | Floor 2: 4. Floor 3: 66. Guardian: 196 |
| Where Wipes land at 2 hours, no points spent | Mostly the Guardian | Floor 1: 1. Floor 2: 111. Floor 3: 317. Guardian: 27 |
| Guardian kill, 6-point reference builds | Level 7 with gear | Level 8: never. Level 10: every time, with no Hero falling |

The hand estimates assumed nobody Wipes on the way down. Three Setbacks on Floor 3 can trigger a fallback before the Party has met the Guardian, and it wins only at a sharp level cliff. Check both against the demo script in M6.
