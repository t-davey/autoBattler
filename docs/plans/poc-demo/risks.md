# Risks

Number tuning always comes first. A fallback that changes rules, scope, or design stops at S3.

## R1: 12 hours of catch-up blocks the UI

| When | Measurement | Threshold that triggers action |
|---|---|---|
| M1 | `npm run bench:catchup`: 432,000 Ticks of continuous Battles under Node, median of 3 runs (the bare tracer was 67–81 ms) | Over 500 ms: remove per-Tick allocation before starting M2 |
| M3 | The same, through full Runs (measured at M3: 92 ms median, within 57–124 ms) | Over 2 s: profile and fix before starting M4 |
| M5 | In a browser, with `PerformanceObserver` on `longtask`, from a 12-hour save | Total over 10 s, or any task over 100 ms: take the fallback |

**Fallback:** move catch-up to a Web Worker. The sim has no DOM, so the Worker runs `deserializeGame`, `beginCatchUp`, and `continueCatchUp`, and posts back the state and the Away Report. It costs one new file and a Vite worker import. Never approximate 12 hours with a summary formula, since [ADR 0001](../../adr/0001-deterministic-sim-core.md) requires that catch-up run the same rules.

**Equivalence tests:** `advance runs the same Ticks however elapsed time is sliced` (M1) and `catch-up and live play reach identical state for the same Seed and elapsed time` (M5). A failure in either stops the milestone, whichever fallback is in use.

## R2: 9 skills leave no real build decision

Only 5 of the 9 skills are active, and the Sin-Eater has just 1, so skill order is a real choice for 2 Heroes at most.

**Measured in M2**, re-measured in M6 against the real Guardian. `npm run balance -- builds` sets builds with `scenario` and `setSkillOrder`, takes Units from `partyUnitSpecs`, and runs them through `simulateBattle` with stand-in enemy `UnitSpec`s. It covers, for each Class, all legal 6-point allocations and skill orders with the other 2 Heroes on reference builds, over 200 Seeds, against 2 stand-in Battles: a 4-enemy physical Pack and a poison-leaning single enemy. Stand-in numbers are set so the reference Party wins about half the time. A build is **viable** if its win rate is within 10 points of the Class's best in that Battle.

**Fallback triggers if any of these holds:**

- A Class has fewer than 2 viable builds whose highest-ranked skills differ.
- Every Class's best build is the same in both Battles.
- A skill never appears with a rank in any viable build. Warm Hands doesn't count (G27).

**Fallback, in order:**

1. Change skill numbers.
2. Let the player choose each Hero's Row (S3), which also makes the out-of-Row penalty a real choice.
3. Add Tainted Shaft, the Huntsman's poison skill, giving it a third active and a Row trade-off (S3).

## R3: 6 Affixes make drops feel samey

**Measured in M4**, re-measured in M6. `npm run balance -- drops` runs 2 hours of Party time over 200 Seeds and reports:

- **Decision drops per hour:** items better than a Hero's current item on at least one stat and worse on another, for at least one Hero.
- **Dominated pairs:** the share of same-slot rare pairs where one is at least as good on every stat.
- **Poison share:** the share of rares with Sallow.

**Fallback triggers if** there are fewer than 2 decision drops per hour, more than 40% dominated pairs, or a poison share outside 30–80%.

**Fallback, in order:**

1. Widen Affix ranges.
2. Weight Affixes by Slot, such as Keen on weapons and Hale on body armour.
3. Add up to 2 Affixes from stats already in scope, max Oil and physical resistance (S3, since it stretches "about 6").

## Other risks found in research

| Risk | Milestone that measures it | Threshold | Fallback |
|---|---|---|---|
| Uncapped Stash bloats saves, since Salvage and a cap are cut | M5: `serializeGame` length and time after 12 hours | Over 1 MB or 20 ms | Save only on `visibilitychange`, `pagehide`, and every 60 s |
| Long Stash list lags | M5: Stash tab holding a 12-hour Stash, about 400 items | A sort or filter over 100 ms | `content-visibility: auto` on rows, as [the research note](../../research/rendering-technology.md) suggests |
| The demo Seed stops working as rules change | M6 | Rehearsal fails | Re-run the Seed search |
