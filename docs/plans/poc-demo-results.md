# Demo results

The balance tables and rehearsal record for [Milestone 6](https://github.com/t-davey/autoBattler/blob/8b9377cc055dac40c25c625679e2bd48c6a61257/docs/plans/poc-demo/m6-tuning-and-demo-run.md), measured on 2026-11-06.

## Targets

`npm run balance -- wall` runs 200 Seeds for 2 hours of Party time. Every target passes, with no S3 miss to accept. Seeds 1001-1200 played no part in the tuning. Pacing rows read the Untended player, whose first hour every player shares.

| Measure | Target | Seeds 1-200 | Seeds 1001-1200 |
|---|---|---|---|
| Median Battle length, Floors 1–3 | 20–30 s | 22.4 s | 24.0 s |
| Median Floor length | 4–6 min | 4.6 min | 4.6 min |
| First Guardian attempt, median | 13–20 min | 18.3 min | 19.3 min |
| New Party Wipes in first 5 minutes | Under 5% | 0% | 1% |
| At least one rare by 60 minutes | At least 80% | 86.5% | 90.5% |
| Guardian Wipes mainly poison, counting a Seed's shared first hour once per player | At least 90% | 100% of 3,031 | 100% of 2,982 |
| Untended: Guardian killed within 2 hours | At most 10% | 0% | 0% |
| Answer: Guardian killed within 2 hours | At least 80% | 85% | 87.5% |
| Answer: median first kill | 60–120 min | 74 min | 72 min |
| Points only: kill rate below Answer | At least 20 points | 3.5%, 81.5 below | 4%, 83.5 below |

The first Guardian attempt sits near the top of its range. The holdout's 19.3 minutes leaves little margin.

## What changed

Numbers only, with no rule changes, plus one display fix: the Battle panel rounds max health, which Floor scale could show as 206.99999999999997. This departed from the plan's tuning order, which puts Guardian health first. Pacing was furthest off, so Poison and Floor scale came first to stop the Wipes on the way down, then each enemy's health and power, which the order doesn't name, then Guardian health. Rarity came last, as planned, to clear the rare target with margin.

| Number | Was | Now |
|---|---|---|
| The Mouldering Warden's health | 1,200 | 1,100 |
| Poison stack from fungal enemies | 1 | 0.5 |
| Floor scale, Floors 2 and 3 | 1.4, 1.9 | 1.15, 1.3 |
| Sodden Thrall: health, power | 90, 3 | 125, 2 |
| Tallow Wight: health, power | 130, 4 | 180, 3 |
| Bone Chanter: health, power | 60, 3 | 85, 2 |
| Mire Bloat: health, power | 100, 2 | 140, 1.5 |
| Sporeling: health, power | 55, 2 | 75, 1.5 |
| Rarity odds, common/magic/rare, Floor 1 | 80/18/2 | 78/19/3 |
| Rarity odds, Floor 2 | 72/23/5 | 70/23/7 |
| Rarity odds, Floor 3 | 62/28/10 | 60/28/12 |

G29's 1,200 and G32's 1, 1.4, and 1.9 were starting values, so the table above replaces those numbers. Their rules stand.

## What beats the Wall

Each row plays the same first hour, then acts at minute 60. Seeds 1-200.

| Player | Guardian killed | Median first kill | Guardian Wipes per Seed |
|---|---|---|---|
| Untended | 0% | none | 5.7 |
| Points only | 4% | 119 min | 5.6 |
| Gear only | 32% | 89 min | 5.2 |
| **Answer: points and gear** | **85%** | **74 min** | **3.9** |
| Points only, Huntsman 5/1/0 | 51% | 114 min | 5.5 |
| Points only, every Hero 5/1/0 | 47% | 116 min | 5.6 |
| Answer, Sin-Eater spends nothing | 93% | 74 min | 3.7 |
| Answer, Huntsman spends nothing | 60% | 75 min | 4.4 |
| Answer, Lamplighter spends nothing | 46% | 87 min | 5.0 |
| Answer, Lamplighter 2/2/2 (Warm Hands) | 86% | 74 min | 3.9 |
| Answer, Huntsman 5/1/0 (no Long Cut) | 100% | 70 min | 3.1 |

Poison gear and points together beat the Wall most reliably, and each alone falls well short on these builds. The reference build understates points, though: see finding 1. Answer equips only weapons of the same Reach, so no Hero loses a skill, which the plan's wording doesn't state. Holdout rows from the first table's players differ by at most 8 points.

## Findings for the human

No target misses and no risk trips, and none of these is changed here, since each is a design question or a Watch list item. **Finding 1 bears directly on the demo's question.**

1. **Routine play also beats the Wall.** `npm run balance -- drops`, which spends points as they come in step order and equips plain upgrades with no eye on poison, relights the Lamp on 200 of 200 Seeds, median 58 minutes. A one-time spend at minute 60 on 5/1/0 builds kills in about half of Seeds with no gear at all. So the Wall rewards a player who keeps tending, whichever choices they make, and the 81.5-point gap in the targets measures not gearing up against gearing up, for a player who does nothing for an hour. Raising Guardian health would make it harder, at the cost of the Answer's target.
2. **Bulwark points don't help overall.** A Sin-Eater who spends nothing does better than the reference build, 93% against 85%. Against the Warden alone, its builds run from 66% to 86% and Shared Burden is what helps, so the likely cost is the actions Bar the Way uses. The [Watch list](poc-demo-m2-review.md#watch-list) calls this a design question for S3.
3. **The Long Cut lowers the kill rate.** Skipping it raises the Answer from 85% to 100%. The likely reason, not measured: it fires as soon as a target is Bleeding, so it ends a nearly full Bleed, along with Open Veins' bonus, and spends Oil and an action doing so.
4. **Warm Hands shows no effect on the Wall**, as G27 asked: 86% at 2/2/2, 85% at 4/0/2, with the same Wipes. This is a weak test: the 2 builds also differ in Mend and Lantern Ward ranks, which could offset it, and it only spends at minute 60.
5. **The Warden is a sharp cliff.** At level 7, the reference Party in a Waxed Shroud each wins 0% at 8% poison resistance, 12% at 12%, and 86% at 14%. This is likely why one rare can feel decisive, and also why a small number change can move a kill rate a lot.
6. **The Huntsman now runs dry.** Battles are longer, and Oil reached 0 at level 7 on 2/2/2, where the M2 review measured never under 10. A dry Hero uses the basic attack, which is no loss given finding 3.
7. **The Live Log rounds small Poison ticks.** A 0.5 stack reads "sickens for 1" while health falls by 0.5. The rule is right and the line overstates it, which is a UI change for its own PR.

## Risks re-measured

**R2: passes, soft in the same places.** `npm run balance -- builds` now includes the real Warden, with each Hero wearing a Waxed Shroud with Sallow 6. That's the lowest step at which the reference Party wins at least half, and it wins 86% there.

| Class | Physical Pack: best / worst | Poison-leaning enemy: best / worst | Warden: best / worst |
|---|---|---|---|
| Sin-Eater | 67% / 39% | 56% / 47% | 86% / 66% |
| Huntsman | 93% / 49% | 92% / 50% | 100% / 86% |
| Lamplighter | 50% / 4% | 50% / 26% | 86% / 4% |

The Lamplighter's soft pass from M2 hardens at the real Wall into one answer: 4/0/2 is its only viable build there, either skill first. It still passes on the stand-ins.

**R3: passes.** 37.8 items an hour, 3.25 of them rare; 24.8 decision drops an hour; 2.3% dominated pairs; 57.2% of rares with Sallow. Lamp relit in 200 of 200 Seeds, median 58 minutes: see finding 1.

**R1 and the save: pass.** `npm run bench:catchup` runs 12 hours in 97 ms, within 76-119 ms, with a 51 KB save and 465 items, close to M5's numbers. The browser and Stash rows weren't re-measured, since nothing here adds to their cost.

## Demo Seed: 8

`npm run balance -- demo-seed` found 143 of 500 Seeds that hold however long the rehearser watches first: 0, 1, 2, 3, or 5 minutes. **Seed 8** was chosen by hand from those, because its rare is body armour that any Hero can wear.

- **At 1 hour:** 2 or more Guardian Wipes, mostly poison, and a usable Keen Iron-bound Sallow Swift Waxed Shroud with 24% poison resistance and a level requirement of 4.
- **Doing nothing:** no kill in the next hour. Spending points alone on any of 3 builds: no kill in the next hour either.
- **Points and that one rare:** a kill in 13-27 minutes of Party time, on any of 3 builds and whichever Hero wears it.

The search mode tests the reference build, on one wearer. The other builds and wearers came from a one-off check that isn't kept in the repo: reference, 5/1/0 for every Hero, and a third mixed set.

## Rehearsal

`npm run dev` from "Start over", with `DEMO_SEED` 8, in the built-in browser with no console errors. Agent-run, and not the human's verdict.

| Step | Result | Party time | Player's clock |
|---|---|---|---|
| 1. Watch Floor 1 | PASS. Floor 1 with Battle, map, and Live Log running | Seconds | 5-10 s |
| 2. Skip time, read the Wipe | PASS. "2 Wipes at the Mouldering Warden, mostly poison damage", 1 at the Mire Bloat, and a fallback | 1 hour | Under 2 s |
| 3. Equip the rare, spend points | PASS. The shroud on the Lamplighter shows 24%, and 15 points go on the reference build | None | Under 1 min |
| 4. Skip, see the Guardian fall | PASS. "Guardian kills: 3", after 2 more Wipes | 1 hour | Under 2 s |
| 5. Lamp relights, rare drops | PASS. "The Lamp is relit", with 5 rares listed. The report doesn't mark which is the guaranteed one, whose rule has its own test | Same hour | Same |
| 6. Close, reopen, read the report | PASS. Left the page for 63 s, past G19's 60 s. "Away 1 minute", with the spent points and gear kept | 1 minute | 1 minute |

The first 5 steps ran twice, with the same reports both times. Step 4 skipped time rather than watching, as the plan allows. Step 6 left the page for another one on the same origin, so the rehearsal didn't test closing an Electron window, or an absence of hours.

## S4: the human's verdict

**Yes**, from the human on 2026-11-06: the demo answers its question of whether it is satisfying to come back to loot, make a build decision, and see that decision beat a Wall.

## After the verdict: 12 hours of play

Measured on 2026-11-06 with a throwaway script that isn't in the repo, over 60 Seeds and on these same numbers. The player spends points in step order and equips plain upgrades, either at every hour or at every 4 hours. [The second Wall's plan](second-wall.md) acts on this.

| Hour, checking in hourly | Level | Wipes per hour | Guardian kills per hour | Median Battle length |
|---|---|---|---|---|
| 1 | 6 | 3.3 | 0 | 25.6 s |
| 2 | 8 | 0.3 | 4.7 | 16.2 s |
| 3 | 10 | 0 | 5.5 | 13.5 s |
| 12 | 18 | 0 | 6.1 | 10.4 s |

- **Nothing threatens the Party after the first Wall.** Hourly check-ins bring the first kill at a median of 67 minutes, and Wipes stop from hour 3.
- **The Wall falls to levels alone.** With no tending, kills begin in hour 4, at level 10 and 0.3 kills an hour. [The M2 review](poc-demo-m2-review.md#estimates-to-compare) has level 11 winning every time on basic attacks. [The check-in baseline](#check-in-baseline) measures the full absence.
- **Check-ins every 4 hours** bring the first kill at a median of 244 minutes, just after the first tending, with 60 of 60 Seeds killing the Guardian.
- **Levels outrun the design:** level 18 in 12 hours, against about level 25 by the end of a roughly 300-hour Difficulty Tier.
- **Floors add no pressure.** Wipes per Seed over 2 hours in `npm run balance -- wall` run 0.0 / 0.1 / 6.1 on Floors 1/2/3, and most of Floor 3's are at the Guardian.
- **Loot outlives its purpose:** about 50 items an hour keep arriving, with the highest poison resistance levelling off around 36%.

## Check-in baseline

`npm run balance -- checkins`, measured on 2026-11-06 before any change for [the second Wall](second-wall.md), over 200 Seeds. Both targets miss, as expected: they are the ones the next PRs have to reach. Seeds 1001-1200 differ by at most 10 points, in the 4-hour row.

| Measure | Target | Seeds 1-200 | Seeds 1001-1200 |
|---|---|---|---|
| Untended: Guardian killed by 12 hours | At most 10% | 100% | 100% |
| Answer, 8-hour gap: first kill after 2–3 check-ins | At least 80% | 0% | 0% |

First kill by check-ins made, on Seeds 1-200:

| Gap | 0 check-ins | 1 check-in | 2–3 check-ins | No kill | Median first kill | Median level, with the kill's XP |
|---|---|---|---|---|---|---|
| 4 hours | 38% | 63% | 0% | 0% | 4.0 h | 10 |
| 8 hours | 100% | 0% | 0% | 0% | 4.5 h | 11 |
| 12 hours | 100% | 0% | 0% | 0% | 4.5 h | 11 |

- **Routine and Answer players score the same.** Routine spends points in step order and equips plain upgrades, and Answer spends towards the reference build and equips the most poison resistance. Levels beat the Wall so early that their choices barely get a chance to matter, so this baseline can't yet tell them apart.
- **The Party is Set back about 13 times at the Guardian** before the first kill, almost all of it while nobody is watching.
- **Untended levels:** a median of 10 at 4 hours, 14 at 8 hours, 16 at 12 hours, and 22 at 24 hours.

### With XP falloff

The same mode and Seeds, with [option B](second-wall.md#xp-falloff-options) built and no other number changed. Both targets still miss, and step 6 has to reach them. Seeds 1001-1200 differ by at most 2 points.

| Measure | Target | Baseline | With XP falloff |
|---|---|---|---|
| Untended: Guardian killed by 12 hours | At most 10% | 100% | 71% |
| Answer, 8-hour gap: first kill after 2–3 check-ins | At least 80% | 0% | 0% |

| Gap | 0 check-ins | 1 check-in | 2–3 check-ins | No kill | Median first kill | Median level, with the kill's XP |
|---|---|---|---|---|---|---|
| 4 hours | 0% | 100% | 0% | 0% | 4.1 h | 9 |
| 8 hours | 44% | 56% | 0% | 0% | 8.0 h | 10 |
| 12 hours | 71% | 30% | 0% | 0% | 11.9 h | 11 |

- **Levels slow sharply:** untended medians are 9, 10, 11, and 12 at 4, 8, 12, and 24 hours, against 10, 14, 16, and 22. By 24 hours, every Seed still kills the Guardian.
- **The first check-in still wins,** so no record reaches a second one. Routine and Answer players still score the same.
- **The 30-Seed estimate ran slow:** it had 60% killed by 12 hours and 27% before the first 8-hour check-in, where 200 Seeds give 71% and 44%.
- **The first 2 hours barely change:** every `npm run balance -- wall` target still passes, with Answer at 82% rather than 85%, and so does `drops`.
