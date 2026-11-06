# Two-phase Wall: plan

XP falloff slows levels, but the first check-in still wins, so choices barely matter. This slice gives the first Wall two Phases, so a player beats it over 2–3 check-ins and sees progress at each one. A good build wins sooner, and waiting still wins eventually.

**The question:** does "I got further this time, and now I know what to fix" make coming back feel better?

**Status: decided on 2026-11-06, in progress.** The human approved these values, which are starting values to tune. It covers step 6 of [the second Wall's plan](second-wall.md) for the first Wall, and comes before Floors 4–6.

## What the player sees

1. **Check-in 1:** Wipes, mostly poison, with a best attempt. The player equips poison resistance.
2. **Check-in 2:** Phase 2 reached, with a better best attempt, mostly physical. The player gears for it.
3. **Check-in 3:** The Guardian falls and the Lamp relights.
4. **A player who only waits:** levels get there in days rather than hours.

## Decisions

| Decision | Value |
|---|---|
| Phase change | At 50% of the Warden's health, once per Battle |
| Phase 1 | Today's Spore Breath and Grave Slam |
| Phase 2 | A weaker, slower Spore Breath, so poison gear still counts. Grave Slam gets faster and harder, plus a slow, big hit on one front-Row Hero |
| Phase 2 answer | Armour and health on any Hero in front, on top of poison resistance |
| The big hit's name | "Grave Maul" is a placeholder for the human to replace |
| Best attempt | The lowest Guardian health in an Away Report, shown beside the previous report's |
| Finding | Facts only, such as "Reached Phase 2 in 3 of 5 attempts. Best: 31% health left, was 62%. Mostly physical damage." It opens the Stash on the stat for the Phase that caused the most Setbacks |
| Phase cue | A Live Log line and harsher Room light, with no new sprite |
| Timers | No enrage. The 120-second draw stays. If it cuts fights short, raise the Warden's damage rather than its health |

## Work, in order

Each is its own PR and leaves the game runnable.

| # | Work | State |
|---|---|---|
| 1 | Guardian Phases in the sim | In progress |
| 2 | Best attempt and its Finding | Not started |
| 3 | Phase cue in the Battle scene | Not started |
| 4 | `checkins` reports Phases, 24–72 hours, and one-answer players, and the Answer player answers Phase 2 | Not started |
| 5 | Tune numbers only, in order: Warden health, Phase 2 damage, threshold, then XP. Confirm on Seeds 1001-1200, then retire the `wall` targets that assume one action at minute 60, and find a new demo Seed | Not started |
| 6 | Rehearse, record results, and get the human's verdict over real days | Not started |

Dropping Spore Breath from Phase 2 made the Wall easier: the median first kill moved from 8 hours to 1.7 hours at the 8-hour gap, because Poison is what kills the Party. So Phase 2 keeps a weaker Poison, and step 5 tunes it.

## Targets

| Target | Value |
|---|---|
| Untended: killed by 12 hours | At most 10% |
| Answer, 8-hour gap: first kill after 2–3 check-ins | At least 80% |
| Answer: Phase 2 reached by the 2nd check-in | At least 80% |
| Untended: killed by 72 hours | At least 80% |
| One answer only, 8-hour gap: kills by the 3rd check-in | At least 20 points below Answer |

The Battle, Floor, early Wipe, and first rare targets stay.

## Risks

- **The poison cliff makes progress sudden.** Lean on Phase 2 and report best attempts so gains show.
- **Plain upgrades beat both Phases.** The one-answer players measure this. Sharpen Phase 2 if the gap misses.
- **Armour drops arrive too slowly.** Measure when the answer arrives, then widen Affix ranges first.
- **The catch-up cap.** Absences stop at 12 hours, so a player who rarely visits takes longer than 72 hours on their clock.
