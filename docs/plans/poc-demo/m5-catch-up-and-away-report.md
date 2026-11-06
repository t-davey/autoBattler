# Milestone 5: Catch-up and Away Report

**PR title:** `feat: catch up from elapsed time with an Away Report`

**Issue:** [#9](https://github.com/t-davey/autoBattler/issues/9)

**ADRs:** 0001 elapsed time as input, saves store current state; 0002 storage capability (see G20); 0003 no log flood from catch-up.

**Risks:** [R1](risks.md#r1-12-hours-of-catch-up-blocks-the-ui), and the save size and Stash list rows of [Other risks](risks.md#other-risks-found-in-research).

**Needs:** [gaps](gaps.md) G8, G19, G20.

**Create**

- `src/sim/catchup.ts`, `src/sim/catchup.test.ts`
- `src/ui/AwayReportPanel.tsx`, `save.ts` (the `SaveStore` interface and envelope), `localStorageSave.ts`, `save.test.ts`, `driver.test.ts`

**Change**

- `src/sim/game.ts`, `src/sim/index.ts`
- `src/ui/driver.ts`, `store.ts`, `main.tsx`, `App.tsx`
- `scripts/bench-catchup.mjs`

**Sim rules**

- Catch-up as in [How catch-up reuses live stepping](sim-interface.md#how-catch-up-reuses-live-stepping), capped at 12 hours. The Away Report is a fold over `GameEvent`s and adds nothing to `Game`.
- A Setback's main damage type is the type that dealt the largest share of damage the Party took in that Battle, including damage a Ward absorbed. If it took none, the type is physical with a share of 0.
- Elapsed time always comes in as an argument. `src/sim` never reads a clock.

**UI rules**

- **Envelope:** `{ savedAt, game: string }`, where `deserializeGame` alone checks the version. `savedAt` is the time the state was last advanced to, not the time of writing, so writes can't lose or double-count time.
- **When to save:** every 30 seconds, on `visibilitychange` to hidden, on `pagehide`, after a player action, and after catch-up finishes. Never save during catch-up, because `beginCatchUp` has already banked the time. Closing part-way restarts from the last save, with nothing lost.
- **On load:** elapsed is `Date.now() − savedAt`. At 60 seconds or more, run catch-up and show the Away Report. Under that, step live. A clock moved backwards gives 0.
- **Bad saves:** an unreadable or old save moves to `autobattler.save.bad`, the game starts new, and a notice says so. A `setItem` failure shows a visible warning and is never swallowed.
- **Running catch-up:** call `continueCatchUp` in chunks of 5,000 Ticks, yield with `setTimeout(0)` after 16 ms of work, and show progress. Live stepping pauses and player actions wait until it finishes. Catch-up adds no Live Log lines, apart from one line pointing at the Away Report.
- **Away Report contents:** elapsed and applied time, a note if capped, Floors cleared, deepest Floor, Wipes, draws, and causes ("2 Wipes at the Mouldering Warden, mostly poison damage"), Guardian kills, Lamp relit, fall-back note, levels gained, loot counts, rares by name, and unspent skill points, with links to the Stash and planning tabs. It's held in memory only, and dismissed by the player.
- **Skip button:** a "Skip 1 hour" button, rendered only under `import.meta.env.DEV`, calls the same store method as a return from absence, with 3,600,000 ms.
- **Start over:** a dev-only button clears the save, for rehearsals.
- **Starting Seed:** a constant `DEMO_SEED` in `main.tsx`, which M6 chooses. `?seed=` overrides it in dev.

**Tests**

- `catch-up and live play reach identical state for the same Seed and elapsed time`: Seeds 1–5 at 1 hour, with live play cut into uneven slices (16, 33, 100, 1,000, 7,000 ms, repeating), comparing `serializeGame` strings
- `catch-up and live play stay identical over 12 hours`: one Seed, with a long timeout
- `catch-up and live play stay identical when the same action lands on the same Tick`
- `catch-up gives the same result in any chunk size`
- `catch-up stops at the 12-hour cap and the Away Report says so`
- `catch-up treats negative and NaN elapsed time as none`
- `the Away Report counts Floors, Wipes, levels, and loot from the same events as live play`
- `the Away Report names poison as the main damage type of a Guardian Wipe`
- `the Away Report notes a fall back and a relit Lamp`
- `the Away Report lists a draw as a draw, with its main damage type`
- `a Game restored from serializeGame plays on identically after a Wipe, in Town, and mid-Battle`
- In `src/ui/driver.test.ts`, with the clock and window visibility injected, so `driver.ts` needs no DOM types: `a gap of 60 seconds or more runs catch-up`, `a shorter gap steps live`, `nothing steps while the window is hidden`, and `nothing saves during catch-up`
- In `src/ui/save.test.ts`, with an in-memory `SaveStore`: `savedAt is the time state was last advanced to`, `an old version moves aside and starts a new game`, and `a failed write raises a warning`

**In `npm run dev`:** "Skip 1 hour" shows a progress indicator and then the Away Report. Close the tab, wait 2 minutes, and reopen: the Away Report reports about 2 minutes. Cover the window for over 60 seconds, return, and the same happens. The Live Log doesn't flood.

**`npm run smoke:electron`:** applies as a check that the save code doesn't break the shell under `file://`, even though `electron/` doesn't change. The app must still render if `localStorage` throws.

**`CONTEXT.md`:** add **Catch-up** (_Avoid_: offline progress, fast-forward).

**Acceptance:** `npm run check` and `npm run smoke:electron` pass. The R1 measurements are recorded in the PR and are under their limits, or the Worker fallback is in. `dist/` holds no "Skip 1 hour" text after `npm run build`. Demo script step 6 works in the running app, using a real absence of at least 2 minutes.
