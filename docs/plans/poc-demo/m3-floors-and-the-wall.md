# Milestone 3: Floors and the Wall

**PR title:** `feat: send the Party through Floors to a Guardian and Lamp`

**Issue:** [#7](https://github.com/t-davey/autoBattler/issues/7)

**ADRs:** 0001 seeded Floors; 0003 DOM map behind one component.

**Risks:** [R1](risks.md#r1-12-hours-of-catch-up-blocks-the-ui).

**Needs:** [gaps](gaps.md) G2, G7, G8, G9, G10, G16, G18, G21, G22.

**Create**

- `src/sim/floors.ts`, `src/sim/run.ts`, `src/sim/content/guardian.ts`, `src/sim/floors.test.ts`, `src/sim/run.test.ts`
- `src/ui/FloorMap.tsx`, `TownMenu.tsx`

**Change**

- `src/sim/game.ts`: replace the temporary Battle loop with Runs.
- `src/sim/battle.ts`: separate `maxHealth` from `health`, so health can carry between Rooms, and let a Unit have several timed `actions`, each with its own interval and target (one front-Row Hero, or every Hero). A Unit with `actions` uses them instead of `power`, `actionInterval`, and `damageType`, and each action carries its own damage.
- `src/sim/game.test.ts`: drop the temporary-loop test.
- `src/sim/view.ts`, `src/sim/index.ts`
- `src/ui/App.tsx`, `store.ts`, `describeEvent.ts`, `style.css`

**Sim rules**

- **Layout:** each visit to a Floor draws a new Seed from the Game's Rng. A self-avoiding walk on a 9×7 grid places 8–12 Rooms in order. The Party visits every Room in that order, with no side Rooms.
- **Room kinds:** the last Room holds the stairs and a Battle. Of the others, two-thirds are Battles and one-third chests, shuffled. Floor 3 adds a Guardian Room after its last Room.
- **Room timing:** 50 Ticks of travel into each Room, then a Battle or a 200-Tick chest search. A chest adds a flavour line to the Live Log and holds nothing until M4.
- **Carrying over:** health and Oil carry between Rooms. On leaving a Room, Heroes recover 15% of max health, raised by Warm Hands, and 30 Oil.
- **Enemy scale by Floor:** health and power × 1.0, 1.4, 1.9. XP per Battle: 15, 20, 25. Guardian: 100.
- **Falling in a won Battle:** G7.
- **Wipe:** all progress in the Run ends, with no XP, item, or level lost. The Party returns to Town instantly.
- **Town:** restores all health and Oil. The Party leaves after 100 Ticks (G9), or at once on `sendParty`. `sendParty` is refused outside Town.
- **Every Run starts at Floor 1.**
- **Push:** G2 and G22, with `fellBack` and `retryingGuardian` events for the Live Log. `fellBack` also sets the Away Report's fall-back note.
- **Lamp:** a Guardian kill relights the Lamp, then the Party returns to Town. After that, G10.

**Guardian:** the Mouldering Warden, alone, in the front Row, with 0% critical chance. Floor scale doesn't apply to it.

| Health | Armour | Physical resistance | Action | Interval | Effect |
|---|---|---|---|---|---|
| 1,600 | 15 | 0% | Spore Breath | 60 Ticks | 1 Poison stack, worth 3 damage, on every Hero |
| | | | Grave Slam | 80 Ticks | 12 physical to one front-Row Hero |

Hand-check: at 5 stacks, Poison deals 7.5 damage a second to every Hero, so an unhealed level 6 Lamplighter (140 health) dies at about 37 seconds. A level 6 Party's basic attacks need about 85 seconds to kill the Warden. Poison resistance, healing, Wards, and damage all move this. Bar the Way doesn't stop Spore Breath, since it hits every Hero, so the answer can't be a single skill.

**Pacing check** (by hand, before tuning): about 12.7 Floors and 84 Battles an hour give about 1,680 XP an hour. That is level 3 at the first Guardian attempt (15 minutes), level 6 at 1 hour, level 7 at 90 minutes, and level 8 at 2 hours.

**Tests** (use `scenario` so that tuning can't break them)

- `the same Seed produces the same Floor layouts`
- `layouts have 8-12 connected Rooms on the grid across 1,000 Seeds`
- `about two-thirds of Rooms are Battles across many Seeds`
- `Floor 3 ends in a Guardian Room`
- `health and Oil carry between Rooms`
- `a Hero who falls in a won Battle rises at 20% health`
- `Warm Hands raises recovery between Rooms, and only the highest counts`
- `a Wipe returns the Party to Town and keeps XP and levels`
- `Town restores health and Oil, then the Party leaves on its own`
- `sendParty leaves Town at once, and is refused elsewhere`
- `a draw returns the Party to Town and counts towards the 3 Wipes`
- `the 3rd Wipe makes Runs turn back before the Guardian`
- `a level-up during fallback resumes Guardian attempts and clears the count`
- `spending a skill point during fallback resumes Guardian attempts and clears the count`
- `a Guardian kill clears the count`
- `a Unit with several actions times each on its own interval`
- `an action can hit every Hero`
- `deeper Floors scale enemy health, power, and XP`
- `level-ups before the 3rd Wipe don't clear the count`
- `a level 40 Party kills the Guardian and relights the Lamp`
- `a level 1 Party Wipes at the Guardian, mostly from poison damage`
- `the Guardian respawns on Runs after the Lamp is lit`
- `serializeGame round-trips a Game mid-Run, and the copy plays on identically`

**In `npm run dev`:** the CSS-grid map shows Rooms with glyphs and the Party moving through them. A dev build's `?seed=` query sets the Seed. The Town menu shows on a Wipe, with its button, a countdown, and whether the Lamp is lit. Reaching the Wall needs 15 minutes live, so verify the Guardian, Wipe, and Lamp with a dev-only `?start=guardian` query that passes `scenario` to `createGame`, and with `?level=40` for the kill.

**`npm run smoke:electron`:** not required.

**`CONTEXT.md`:** add **Party time**, **Fall back**, and **Setback** (a Wipe or a draw that returns the Party to Town). **Lamp** needs no change.

**Acceptance:** `npm run check` passes, and `npm run bench:catchup`, now through full Runs, is within the R1 limit. In the running app, the Party clears Floor 1 from a new game with no Wipe, a `?start=guardian` Party at low level Wipes and returns to Town, and a `?start=guardian&level=40` Party relights the Lamp and starts again from Floor 1.
