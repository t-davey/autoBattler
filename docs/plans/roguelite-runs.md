# Roguelite Runs: plan

Cut the first Difficulty Tier from 2 weeks to a weekend, and make each Run short and different through [Picks](../design.md#picks), so the roguelite layer shows up early. The design holds the rules; this plan holds the order of work.

**Status: decided, not built.** The human chose this on 2026-11-11: a blend of compressing the Tier and roguelite Runs, Runs of about 15–30 minutes of Party time, a weekend Tier, and Boons, Stacking, and Wall prep as the first Picks. [The design's open questions](../design.md#open-questions) list what's still undecided.

## Targets

| What | Before | Now |
|---|---|---|
| First Difficulty Tier | about 300 hours of Party time, 2 weeks | about 30–40 hours, a weekend |
| One Wall | 16–32 hours | about 3 hours, or 6–12 Runs |
| One Run | until a Setback or the player's call | about 15–30 minutes, about one stretch between Lamps |

## Work, in order

Rapid prototyping: each piece lands as a commit straight on `main` and leaves the game runnable. Picks start as placeholders, marked like the [skeleton's](full-skeleton.md), until their names and numbers settle.

| # | Work |
|---|---|
| 1 | **Pace.** Retarget `npm run balance -- world` to about 3 hours per Wall and 30–40 hours per Tier, with shorter check-in gaps. Retune XP, enemy scale, and loot to meet it. This is the compressed Tier on its own, playable before Picks exist: **done**, see [the pace](#the-pace) |
| 2 | **Short Runs.** A Run ends at a Setback, a Guardian attempt, or a return to Town, and the Party sets out again on its own: **already true**, no sim change. A Run covers at most one stretch, since every Guardian fight sends the Party to Town, won or lost. The `world` mode now reports Run length: on 6 Seeds, 786 Runs took 18–26 minutes from the 10th to the 90th percentile, all within 15–30. 47% ended at a Setback and 53% at a Guardian kill |
| 3 | **Picks at Lamps.** A Pick of 3 offers when a Run sets out and before its Guardian, from 3–4 placeholder Boons, Stacking offers, and Wall prep. A default tag rule chooses. The Live Log and the view show what was taken: **done**, `SAVE_VERSION` 4. Six placeholder Picks in `src/sim/content/picks.ts`, drawn from their own random stream so other rolls don't shift. The set-out Pick comes in the Run's first Room, so a new Game's first Run gets one. The Floor map lists the Run's Picks. On 20 Seeds the Tier now takes a median 27.9 hours, under the 30–40 target, with Act 1's Walls all under 2 hours: step 4 retunes |
| 4 | **Measure.** Add a balance mode that reports how much Runs vary and whether Walls fall to good Runs, against the lucky-Run risk the design names. Retune step 1 with Picks in: **done**, in the `world` mode, see [Picks in play](#picks-in-play) |
| 5 | **Rules and reporting.** A tag priority list in Stance, and Away Report Findings about the Picks the best Runs took |

Later, once the base feels right: smaller Picks at Spigot burners, chests, and Elite kills, then Class twists, Sets, Bargains, Routes, and Run-only Belt drops.

## The pace

Measured on 2026-11-11 with `WORLD_SEEDS=20 npm run balance -- world`: 48 hours of Party time, the Routine player checking in every 3 hours. Guardians were the lever. Halving them took the first Wall from 18 hours to 3, while 6× XP alone left it at 6 and pushed levels toward the cap, and more drops barely moved it.

- **The tuning:** every Guardian at half the Warden's demo strength, Battle XP at 1.25×, and Battles dropping an item 30% of the time, up from 10%. Enemy scale is unchanged.
- **The Tier:** all 20 Seeds relight every Lamp, at a median of 33.1 hours, inside the 30–40 target.
- **The Walls:** 7 of 12 take 2–4 hours. Act 1's Lamps 2 and 4 and the Warden fall in under an hour, since the Party arrives over-levelled. Act 3's last two take about 5.5 hours, as Heroes near the cap.
- **Levels run high:** about 18 at the end of Act 1 and 52 at the end of the Tier, against the design's 25. The level curve is an [open question](../design.md#open-questions).
- Step 4 retunes all of this once Picks add power. The `wall` and `checkins` modes still measure the old pace.

## Picks in play

Measured on 2026-11-11 with `WORLD_SEEDS=20 npm run balance -- world`, which now reports the Guardian tries before each Wall's first kill and the frontier Guardian win rate by Pick held.

- **Picks make Runs differ.** Holding Guardian prep lifts the frontier win rate from 11% to 24%. The other Picks barely move it, and poison prep lowers it, from 23% to 9%. Poison prep crowds out Guardian prep, and poison isn't what kills the Party against the Warden's kit.
- **The default rule now ranks Guardian prep first,** ahead of poison. With poison first, it was choosing the worse Pick.
- **Guardians are now at 60% of the Warden's demo strength,** up from 50%, to absorb the Picks' power. The Tier takes a median 30.5 hours, and all 20 Seeds finish it.
- **Most Walls take 4–9 tries.** A Wall falls to a good Run among several, not to the first one. The exceptions are Act 1's Lamp 2 and the Warden, which fall on the first try because the Party arrives over-levelled, and the last two Walls, which take 7–11 tries as Heroes near the cap.
- **No sign of the lucky-Run risk yet.** The best Pick only doubles a low win rate, so no Wall falls far ahead of the Party's growth. It needs another look once Picks grow stronger or Sets arrive.
- 7 of 12 Walls are still off the 2–4 hour pace: Act 1's are fast and Act 3's are uneven. The curve's shape waits for real content.

## Consequences

- **The skeleton's curve is superseded.** [Where the curve breaks](full-skeleton.md#where-the-curve-breaks) measured against 2 weeks, and step 1 replaces it.
- **The second Wall's G40 goes stale,** with its 2–3 check-ins at 8-hour gaps. [The second Wall](second-wall.md) needs its targets redone on the new pace.
- **The level curve may move.** The design expects about level 25 by the end of the first Tier, and the skeleton reaches it in Act 2. Step 1 reports where levels land, for the human to decide.
