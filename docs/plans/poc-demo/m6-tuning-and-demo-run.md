# Milestone 6: Tuning and demo run

**PR title:** `chore: tune the first Wall across many Seeds`

**Issue:** [#10](https://github.com/t-davey/autoBattler/issues/10)

**ADRs:** 0001 headless balance.

**Risks:** [R1](risks.md#r1-12-hours-of-catch-up-blocks-the-ui), [R2](risks.md#r2-9-skills-leave-no-real-build-decision), [R3](risks.md#r3-6-affixes-make-drops-feel-samey), and all of [Other risks](risks.md#other-risks-found-in-research).

**Needs:** [gaps](gaps.md) G25, G27.

**Create**

- `docs/plans/poc-demo-results.md`: balance tables and the rehearsal record.

**Change**

- `scripts/balance.mjs`: add a `wall` mode.
- `src/sim/content/*`: numbers only.
- `src/ui/main.tsx`: `DEMO_SEED`.
- Tests only where they pin a number that tuning moves. Prefer changing them to extremes.

**Balance script:** `npm run balance -- wall` runs 200 Seeds headlessly, with 3 scripted players driving `advance` and `applyAction` for 2 hours of Party time:

- **Untended:** no actions at all.
- **Points only:** at 60 minutes, spends all points on a reference build.
- **Answer:** at 60 minutes, spends the same points and equips the Stash's highest poison resistance per slot that levels allow.

**Targets** (each is pass or fail, and the run reports them all)

| Measure | Target |
|---|---|
| Median Battle length, Floors 1–3 | 20–30 s |
| Median Floor length | 4–6 min |
| Party time to first Guardian attempt, median | 13–20 min |
| New Party Wipes in first 5 minutes | Under 5% of Seeds |
| At least one rare by 60 minutes | At least 80% of Seeds |
| Guardian Wipes where poison is the main damage type | At least 90% |
| Untended: Guardian killed within 2 hours | At most 10% of Seeds |
| Answer: Guardian killed within 2 hours | At least 80% of Seeds |
| Answer: median first kill | 60–120 min |
| Points only: Guardian kill rate | At least 20 points below Answer |

The last 2 rows carry the demo's question: the build decision has to be what beats the Wall. Tune in this order: Guardian health, Poison stack damage, poison resistance range, enemy scale, XP curve, drop rates.

**Demo Seed:** choose a `DEMO_SEED` where, on 1 hour of Party time from a new game: the Away Report shows a Guardian Wipe mostly from poison damage; the Stash holds a usable rare with Sallow; and spending points plus equipping it beats the Guardian within the next hour.

**Rehearsal:** run all 6 demo script steps in `npm run dev` from a cleared save, using "Skip 1 hour" for step 4 unless time allows the 15 or more minutes a live Run takes, and record each step's result and time in `docs/plans/poc-demo-results.md`. Then **stop at S4** for the human to run it.

**Tests:** none new beyond `npm run check`, since this PR adds no rules. A rule change found in tuning gets its own test and, if it's a design change, S1.

**In `npm run dev`:** all 6 steps.

**`npm run smoke:electron`:** applies, as the final check that the Electron shell launches.

**`CONTEXT.md`:** no new terms expected.

**Title:** add `!` if the PR's changes stop M5 saves loading, and say so under Saves in the PR body. Changing numbers alone doesn't stop them loading.

**Acceptance:** `npm run check` and `npm run smoke:electron` pass. Every row in the targets table passes, or the human accepted the miss in writing at S3. The 6-step rehearsal passes with `DEMO_SEED`. The human gave a verdict at S4.
