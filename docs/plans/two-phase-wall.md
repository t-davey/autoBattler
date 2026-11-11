# Two-phase Wall: plan

XP falloff slows levels, but the first check-in still wins, so choices barely matter. This slice gives the first Wall two Phases, so a player beats it over 2–3 check-ins and sees progress at each one. A good build wins sooner. Waiting alone doesn't win: the human dropped the 72-hour target, so a player has to check in at least once.

**The question:** does "I got further this time, and now I know what to fix" make coming back feel better?

**Status: decided on 2026-11-06, in progress.** The human approved these values, which are starting values to tune. It covers step 6 of [the second Wall's plan](second-wall.md) for the first Wall, and comes before Floors 4–6.

## What the player sees

1. **Check-in 1:** Wipes, mostly poison, with a best attempt. The player equips poison resistance.
2. **Check-in 2:** Phase 2 reached, with a better best attempt, mostly physical. The player gears for it.
3. **Check-in 3:** The Guardian falls and the Lamp relights.
4. **A player who only waits:** the Wall holds until they check in.

## Decisions

| Decision | Value |
|---|---|
| Phase change | At 50% of the Warden's health, once per Battle |
| Phase 1 | Today's Spore Breath and Grave Slam |
| Phase 2 | A weaker, slower Spore Breath, so poison gear still counts. Grave Slam gets faster and harder, plus a slow, big hit on one front-Row Hero |
| Phase 2 answer | Armour and health on any Hero in front, on top of poison resistance |
| The big hit's name | Grave Maul, kept by the human on 2026-11-10 |
| Best attempt | The lowest Guardian health in an Away Report, shown beside the lowest from all play before it |
| Finding | Facts only, such as "Reached Phase 2 in 3 of 5 attempts. Best: 31% health left, was 62%. Mostly physical damage." It opens the Stash on the stat for the Phase that caused the most Setbacks |
| Phase cue | A Live Log line and harsher Room light, with no new sprite |
| Timers | No enrage. The 120-second draw stays. If it cuts fights short, raise the Warden's damage rather than its health |

## Work, in order

Each is its own PR and leaves the game runnable.

| # | Work | State |
|---|---|---|
| 1 | Guardian Phases in the sim | Built |
| 2 | Best attempt, as a line in the Setbacks Finding | Built |
| 3 | Phase cue in the Battle scene | Live Log line only |
| 4 | `checkins` reports Phases, 24–72 hours, and one-answer players, and the Answer player answers Phase 2 | Built |
| 5 | Tune numbers only, in order: Warden health, Phase 2 damage, threshold, then XP. Confirm on Seeds 1001-1200, then retire the `wall` targets that assume one action at minute 60, and find a new demo Seed | Tuned and confirmed. One-answer misses on the holdout, and no new demo Seed yet |
| 6 | Rehearse, record results, and get the human's verdict over real days | Not started |

Dropping Spore Breath from Phase 2 made the Wall easier: the median first kill moved from 8 hours to 1.7 hours at the 8-hour gap, because Poison is what kills the Party. So Phase 2 keeps a weaker Poison, and step 5 tunes it.

## First tuning sweep

40 Seeds, numbers only, on 2026-11-06. Nothing here is applied yet. "Answer" gears for both Phases, at the 8-hour gap.

| Health, Slam, Maul, Breath stack | Untended by 12 h | Untended by 72 h | Answer: first kill after 2–3 check-ins | One answer: below Answer |
|---|---|---|---|---|
| 1,100, 18, 40, 2 (today) | 100% | 100% | 0% | 0 points |
| 1,800, 18, 40, 2 | 0% | 95% | 0% | 0 points |
| 1,800, 30, 70, 3 | 0% | 83% | 0% | 0 points |
| 2,000, 90, 220, 8 | 0% | 0% | 60% | 0 points |
| 2,200, 110, 260, 9 | 0% | 0% | 70% | Passes |

**Numbers alone can't meet the safety net and the check-in target together.** An untended Party spends no points and equips nothing, while 8 hours of Stash and points make a first check-in far stronger than 72 hours of slowed levels. Plain upgrades (Routine) also did at least as well as Answer in these runs. The human chose to drop the 72-hour target on 2026-11-06.

## Applied numbers

Re-tuned on 2026-11-08 after the first Lamp moved to Floor 5, whose extra Floors gave more XP and loot. The Warden now has 2,600 health. Phase 2 is Spore Breath with 12 Poison stack damage every 90 Ticks, Grave Slam for 130 every 50, and Grave Maul for 300 every 120. Phase 1 is unchanged. Measured with `npm run balance -- checkins`:

| Measure | Target | Seeds 1-200 | Seeds 1001-1200 |
|---|---|---|---|
| Untended: killed by 12 hours | At most 10% | 0% | 0% |
| Answer, 8-hour gap: first kill after 2–3 check-ins | At least 80% | 82% | 82% |
| Answer: Phase 2 reached by the 2nd check-in | At least 80% | 100% | 100% |
| One answer only: kills below Answer | At least 20 points | 29 | 19, a miss |

At the 8-hour gap, Answer kills by the 3rd check-in on 96% of Seeds and Routine, who equips plain upgrades, on 80%. So a smart player now wins more often, though not sooner: both medians are about 16.5 hours. The demo Seed no longer plays its script. The `wall` targets that assume one action at minute 60 are retired, and "First Guardian attempt, 13–20 min" misses at 66.5 minutes, since it was set for 3 Floors.

## Settled after tuning

The human decided these on 2026-11-10:

- **Phase 2's Spore Breath stays as tuned,** at 12 per stack every 90 Ticks, though that is stronger than Phase 1's and the first decision asked for weaker.
- **First Guardian attempt: 50–80 minutes,** replacing 13–20, which was set for 3 Floors.

## Targets

| Target | Value |
|---|---|
| Untended: killed by 12 hours | At most 10% |
| Answer, 8-hour gap: first kill after 2–3 check-ins | At least 80% |
| Answer: Phase 2 reached by the 2nd check-in | At least 80% |
| One answer only, 8-hour gap: kills by the 3rd check-in | At least 20 points below Answer |

The Battle, Floor, early Wipe, and first rare targets stay.

## Risks

- **The poison cliff makes progress sudden.** Lean on Phase 2 and report best attempts so gains show.
- **Plain upgrades beat both Phases.** The one-answer players measure this. Sharpen Phase 2 if the gap misses.
- **Armour drops arrive too slowly.** Measure when the answer arrives, then widen Affix ranges first.
- **The catch-up cap.** Absences stop at 12 hours, so a player who rarely visits takes longer than 72 hours on their clock.
