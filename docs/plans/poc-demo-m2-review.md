# Milestone 2 review

The estimates, the R2 result, and the Watch list left by stops S1 and S2 of Milestone 2, settled by the human on 2026-11-05. [docs/demo-skills.md](../demo-skills.md) holds the rules, and [the gaps](poc-demo/gaps.md) hold the rulings (G23–G28). The [full review at 1af2dc0](https://github.com/t-davey/autoBattler/blob/1af2dc0b1d99a3928f209195bccbbca7f12b4a3c/docs/plans/poc-demo-m2-review.md) has everything cut from here, including the questions asked and the corrections to the first draft.

**How to use it:** when a measurement arrives, fill in its row under [Estimates to compare](#estimates-to-compare). When a result differs enough to matter, check [Watch list](#watch-list) before tuning. Nothing here overrides the rules files.

## Estimates to compare

All are hand estimates from 2026-11-05. Numbers will move with tuning, so a difference is a prompt to look, not a failure.

| Estimate | Expected | Assumes | Compare in | Measured |
|---|---|---|---|---|
| Level 7 Lamplighter dies to Poison alone | about 38 s | 149 health, no healing, Guardian's Spore Breath | M3, M6 | 38.0 s |
| Level 7 Huntsman dies to Poison alone | about 41 s | 170 health, same | M3, M6 | 38.7 s |
| Same Lamplighter with rank 2 Shared Burden | about 41 s | 15% redirected | M3, M6 | 42.0 s |
| Level 10 Lamplighter, without and with rank 5 Shared Burden | about 41 s and about 51 s | 176 health, 30% redirected | M6 | 42 s and 50 s, across 40 Seeds. With it, the Lamplighter outlives the Battle in 6 of 40 |
| Basic attacks kill the Warden | about 85 s at level 6, about 80 s at level 7 | No skills, nobody falls, 1,600 health | M3, M6 | At 1,200 health (G29), no kill at level 10 or below, since the Party falls first. Level 12 wins every time, in 48 s. M6, at 1,100 and 100 Seeds: none at level 9, 32% at level 10, every time at level 11, in 45 s |
| Damage a second at level 7 | Sin-Eater 6.3, Huntsman 10.7, Lamplighter 6.7 | Basic attacks, no crit or armour | M6 | Against the Warden's 15 armour, averaged over each whole Battle, so a Hero's time dead counts: 5.3, 7.6, 4.4 |
| Live time to those levels | under 2 min, about 13 min, about 64 min | About 25 s per Battle | M2, M6 | 115 Battles (level 6) after about 42 min, so about 22 s per Battle. M6, Seed 8: level 6 at 60 min, level 8 at 120 min, with longer Battles and Setbacks |
| Huntsman runs dry | About 3 Battles | The Long Cut and Bleeder's Cut, 120 Oil spent against 90 gained | M3, M6 | M3: never under 10 Oil across 40 Seeds at level 7, 2/2/2. M6, with longer Battles: reaches 0 |

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
- **Shared Burden's gain is small.** Rank 2 buys the Lamplighter about 3 seconds against Poison. M6 can tune the share.
- **R2 can't see a flat result.** If all Sin-Eater builds tie, they all count as viable, so R2 passes without showing a real decision. Read the `builds` table, not just its verdict.
- **R2 starts Battles on full Oil.** Single Battles flatter builds that burn Oil faster than they regain it. M3's carried Oil is the real test.
- **Warm Hands has no measure across builds.** R2 skips it, and M6's `wall` mode uses one reference build, so a with-and-without comparison has to be added to M6.
