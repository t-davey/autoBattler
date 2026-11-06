# Milestone 2 review: skills and content tables

The record of stops S1 and S2 for [Milestone 2](https://github.com/t-davey/autoBattler/blob/1e595668bb8380e0d8f1f06b37c6d95e33fb3556/docs/plans/poc-demo.md#milestone-2-heroes-and-skills), settled by the human on 2026-11-05. Mentions of the plan's Milestone 2 section mean that linked text. [docs/demo-skills.md](../demo-skills.md) holds the rules themselves, and [the plan](poc-demo/gaps.md) holds the gaps (G23–G28). This file holds the reasoning, and the estimates to compare against real results.

**How to use it:** when a measurement arrives, fill in its row under [Estimates to compare](#estimates-to-compare). When a result differs enough to matter, check [Watch list](#watch-list) before tuning. Nothing here overrides the rules files.

## Questions and answers

| # | Question | Answer | Why | Recorded in |
|---|---|---|---|---|
| 1 | Should Shared Burden also redirect Poison? | Yes, on back-Row Heroes | As written, it did nothing against the Guardian. The gain is small, but Milestone 6 can tune the share. | G26 |
| 2 | Should R2's "a skill never appears" trigger judge Warm Hands? | No, in M2 or M6 | R2 runs single Battles, so Warm Hands never acts there. M6 compares whole Runs with and without it instead. | G27 |
| 3 | Does the Sin-Eater need a skill order? | No change | It has 1 active skill, as G5 accepted. | [demo-skills.md](../demo-skills.md#the-humans-answers) |
| 4 | Should the `reapplying Bleed replaces it` test stay? | Drop it, keep the rule | Bleeder's Cut only targets enemies that aren't Bleeding, so nothing in the demo can reapply a Bleed. | G28 |
| 5 | Do lost or drawn Battles give XP? | No, only won Battles | A Wipe costs only time, and XP from a loss would reward losing. | G23 |
| 6 | Is there a level cap? | 60, from the design | It won't bind. Points past level 16 sit unspent, since all ranks cost 15 points. | G24 |
| 7 | Which reference builds does R2 use? | Sin-Eater 2/2/2, Huntsman 2/2/2, Lamplighter 4/0/2 | Only the measurement uses them, and players never see them. | G25 |

The Class stat table and XP curve in the plan's Milestone 2 section were confirmed unchanged.

## Corrections to the first draft

The skill file's first draft came from an earlier session and hadn't been reviewed. Its 9 skills, costs, cooldowns, and rank values all matched the plan. These statements didn't hold:

| Draft said | Problem | Now |
|---|---|---|
| A Chest Room adds no Oil | M3 gives +30 on leaving any Room | Follows M3 |
| Open Veins boosts Bleeder's Cut's hit | That skill only hits enemies that aren't Bleeding | Removed from the list |
| Redirecting Poison makes Shared Burden "a real answer" to the Wall | Rank 2 buys the Lamplighter about 3 seconds | Reworded, with the numbers |

## Rules added during review

The draft listed its own unsaid rules, and [demo-skills.md](../demo-skills.md#rules-the-source-leaves-unsaid) keeps them all. The review added:

- The out-of-Row 60% cuts amounts, not durations.
- Each Poison stack ticks on its own clock, and a refresh changes only when stacks expire.
- Bonus armour counts gear once Milestone 4 adds it.
- A newly learned active skill goes to the end of the order.

## Checked and correct

Worked through by hand or against the code:

- **Builds:** 11 legal 6-point allocations per Hero, and a 6-point build reaches rank 2 at most in a step 3 skill.
- **Rank values:** every row runs evenly from the plan's rank 1 value to its rank 5 value.
- **Class stats:** power minus the starter weapon gives the plan's base, and every interval matches `round(30 × 100 / speed)`.
- **XP curve:** the formula gives the plan's values, and its totals match the M3 pacing check at 1,680 XP an hour.
- **Back-Row targeting:** `src/sim/content/enemies.ts` gives only the Bone Chanter `any` targeting.

## Estimates to compare

All are hand estimates from 2026-11-05. Numbers will move with tuning, so a difference is a prompt to look, not a failure.

| Estimate | Expected | Assumes | Compare in | Measured |
|---|---|---|---|---|
| Level 7 Lamplighter dies to Poison alone | about 38 s | 149 health, no healing, Guardian's Spore Breath | M3, M6 | 38.0 s |
| Level 7 Huntsman dies to Poison alone | about 41 s | 170 health, same | M3, M6 | 38.7 s |
| Same Lamplighter with rank 2 Shared Burden | about 41 s | 15% redirected | M3, M6 | 42.0 s |
| Level 10 Lamplighter, without and with rank 5 Shared Burden | about 41 s and about 51 s | 176 health, 30% redirected | M6 | |
| Basic attacks kill the Warden | about 85 s at level 6, about 80 s at level 7 | No skills, nobody falls, 1,600 health | M3, M6 | At 1,200 health (G29), no kill at level 10 or below, since the Party falls first. Level 12 wins every time, in 48 s |
| Damage a second at level 7 | Sin-Eater 6.3, Huntsman 10.7, Lamplighter 6.7 | Basic attacks, no crit or armour | M6 | |
| Level reached in the M2 loop | Level 2 at 4 Battles, 4 at 32, 7 at 154 | 15 XP, won Battles only | M2 | Level 2 within about 2 minutes live |
| Live time to those levels | under 2 min, about 13 min, about 64 min | About 25 s per Battle | M2 | 115 Battles (level 6) after about 42 min, so about 22 s per Battle |
| Huntsman runs dry | About 3 Battles | The Long Cut and Bleeder's Cut, 120 Oil spent against 90 gained | M3, M6 | Never under 10 Oil across 40 Seeds at level 7, 2/2/2 |
| `npm run bench:catchup` | Under the 500 ms limit | 49 ms at M1, before effects and skills | M2 | 58–79 ms across runs |

## R2 result

Measured with `npm run balance -- builds`: level 7, 6 points, 200 Seeds per Battle, with stand-ins calibrated so the reference Party wins about half.

**First run, on the approved numbers: tripped.** The Lamplighter had no viable build whose highest-ranked skill differed. Mend by Lamplight at 120% → 200% was too strong per rank, and points in Warm Hands do nothing in a single Battle.

**Fix, by number tuning as the plan directs:** Mend by Lamplight now heals 150% → 170% of power. Rank 1 is stronger and rank 5 weaker, so a Hero needs fewer points in it. The other two variants tried also passed: Mend 150% → 170% with a stronger Ward, and Mend flat at 160%.

| Class | Physical Pack: best / worst | Poison-leaning enemy: best / worst | Best build in both |
|---|---|---|---|
| Sin-Eater | 67% / 42% | 56% / 49% | Varies |
| Huntsman | 93% / 49% | 92% / 51% | 5/1/0 |
| Lamplighter | 50% / 5% | 51% / 27% | 4/0/2, Mend first |

**What the pass doesn't show:**

- **It's a soft pass for the Lamplighter, which the human accepted on 2026-11-05 for M2, to judge again in M6.** It passes on 2/2/2 and 2/3/1 being viable in the poison-leaning Battle, and those builds put points in Warm Hands, which does nothing there. At 6 points, with Warm Hands idle, Mend by Lamplight is always the highest-ranked useful skill, because Lantern Ward needs 4 points spent first.
- **The Sin-Eater is flat against poison,** as the [watch list](#watch-list) expected: 7 points between its best and worst, so every build counts as viable.
- **The Long Cut looks weak.** The Huntsman's best builds skip it in both Battles, and it's viable only at 1–2 ranks in the physical Pack. Stand-ins don't test the long Battle it might suit, so check it against the real Guardian in M6.
- **Skill order matters for 2 Heroes:** Mend first beats Ward first at every Lamplighter allocation with both skills, by up to 18 points. Lantern Ward first may simply be the wrong choice, rather than a real alternative.

## Watch list

Things to check when results arrive:

- **Bulwark barely touches the Wall.** Bar the Way and Iron Penance only affect Grave Slam, about 1.5 damage a second before armour, and Shared Burden helps only the Lamplighter. If the Sin-Eater's points don't move the Guardian kill rate in M6, consider that a design question for S3, not only a tuning one.
- **R2 can't see a flat result.** If all Sin-Eater builds tie, they all count as viable, so R2 passes without showing a real decision. Read the `builds` table, not just its verdict.
- **R2 starts Battles on full Oil.** Single Battles flatter builds that burn Oil faster than they regain it. M3's carried Oil is the real test.
- **Warm Hands has no measure across builds.** R2 skips it, and M6's `wall` mode uses one reference build, so a with-and-without comparison has to be added to M6.
